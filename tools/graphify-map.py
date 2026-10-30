"""Local Graphify adapter for HTML/SCSS and the component registry.

Run with the isolated Graphify Python, from any directory. --prepare extracts
AST and inventories sources; --build merges the semantic chunks from the skill.
No application build, imports, hooks or external model calls are performed.
"""
import argparse
import base64
from collections import Counter
from html.parser import HTMLParser
import json
import hashlib
import os
from pathlib import Path
import re
import sys
from urllib.request import urlopen

from graphify.detect import detect, ignored_predicate

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "graphify-out"
ALLOWED = {".html", ".scss", ".css", ".js", ".mjs", ".md", ".json"}


def write(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read(name):
    return json.loads((OUT / name).read_text(encoding="utf-8"))


def ident(value):
    return re.sub(r"[^a-z0-9]", "_", value.lower())


def fid(path):
    return "file_" + ident(path)


def inventory():
    ignored = ignored_predicate(ROOT, gitignore=False)
    paths = []
    for base, dirs, files in os.walk(ROOT, followlinks=False):
        dirs[:] = sorted(d for d in dirs if not (Path(base) / d).is_symlink()
                         and not ignored(Path(base) / d))
        for name in sorted(files):
            p = Path(base) / name
            if not p.is_symlink() and p.suffix in ALLOWED and not ignored(p):
                paths.append(p.relative_to(ROOT).as_posix())
    return sorted(paths)


class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.resources = []
        self.classes = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.classes.update(a.get("class", "").split())
        ref = a.get("src") if tag == "script" else a.get("href") if tag == "link" else None
        if ref:
            self.resources.append((ref, self.getpos()[0]))


def frontend(paths):
    texts = {p: (ROOT / p).read_text(encoding="utf-8-sig") for p in paths}
    nodes = {fid(p): {"id": fid(p), "label": p, "file_type": "document" if p.endswith(".md") else "code",
                     "source_file": p, "source_location": "L1", "_origin": "semantic"} for p in paths}
    edges, unresolved = [], []

    def link(src, target, relation, line=1, confidence="EXTRACTED", evidence=None):
        if src == target:
            return
        edges.append({"source": src, "target": target, "relation": relation,
                      "confidence": confidence, "confidence_score": 1.0 if confidence == "EXTRACTED" else .85,
                      "source_file": nodes[src]["source_file"], "source_location": f"L{line}",
                      "weight": 1.0, "_origin": "semantic", "evidence": evidence})

    def resolve(source, ref):
        ref = ref.split("?")[0].split("#")[0]
        if not ref or re.match(r"(?:[a-z]+:|//)", ref):
            return None
        base = ROOT / ref.lstrip("/") if ref.startswith("/") else (ROOT / source).parent / ref
        candidates = [base]
        if not base.suffix:
            candidates += [base.with_suffix(".scss"), base.with_name("_" + base.name).with_suffix(".scss")]
        for p in candidates:
            try:
                rel = p.resolve().relative_to(ROOT).as_posix()
            except ValueError:
                continue
            if rel in texts:
                return rel
        return None

    html_classes = {}
    for path, text in texts.items():
        if path.endswith(".html"):
            parser = Resources()
            parser.feed(text)
            html_classes[path] = parser.classes
            for ref, line in parser.resources:
                target = resolve(path, ref)
                if target:
                    link(fid(path), fid(target), "loads_resource", line, evidence=ref)
            for m in re.finditer(r"<!-- safu:(header|footer) -->", text):
                target = f"assets/html/{m[1]}.html"
                link(fid(path), fid(target), "includes_shared_html", text.count("\n", 0, m.start()) + 1, evidence=m[0])
        if path.endswith(".scss"):
            for m in re.finditer(r'@(?:use|forward|import)\s+[\"\']([^\"\']+)', text):
                target = resolve(path, m[1])
                if target:
                    link(fid(path), fid(target), "imports_scss", text.count("\n", 0, m.start()) + 1, evidence=m[0])
                elif not m[1].startswith(("sass:", "http")):
                    unresolved.append({"source": path, "reference": m[1]})

    # A shared class proves lexical overlap, not that a style/handler executes.
    for path, text in texts.items():
        if Path(path).suffix not in {".scss", ".css", ".js", ".mjs"} or "assets/" not in path:
            continue
        classes = set(re.findall(r"(?<![\w-])\.([a-zA-Z_][\w-]*)", text))
        owner = path.split("/assets/")[0] if "/assets/" in path else ""
        for page, used in html_classes.items():
            if owner and not page.startswith(owner + "/") and not (owner == "main" and page == "index.html"):
                continue
            shared = sorted(classes & used)
            if shared:
                link(fid(path), fid(page), "shares_class_names", confidence="INFERRED", evidence=shared)

    registry_path = "ui/data/blocks.json"
    registry = json.loads(texts[registry_path])
    for entry in registry.get("entries", []) + registry.get("reusableComponents", []):
        cid = "component_" + ident(entry["page"] + "_" + entry["id"])
        nodes[cid] = {"id": cid, "label": f'{entry["page"]}: {entry["id"]} — {entry.get("purpose", "")}',
                      "file_type": "concept", "source_file": registry_path, "source_location": "L1",
                      "_origin": "semantic"}
        link(cid, fid(registry_path), "registered_in")
        for p in entry.get("files", []):
            if p in texts:
                link(cid, fid(p), "implemented_in", evidence=p)
        origin = entry.get("reuseSource")
        if origin:
            for p in origin.get("files", []):
                if p in texts:
                    link(cid, fid(p), "documented_reuse_source", evidence=p)

    package = json.loads(texts["package.json"])
    for name, command in package["scripts"].items():
        if name == "stats" or "statistics" in name:
            continue
        cid = "command_" + ident(name)
        nodes[cid] = {"id": cid, "label": f"pnpm {name}", "file_type": "concept", "source_file": "package.json",
                      "source_location": "L1", "command": command, "_origin": "semantic"}
        link(cid, fid("package.json"), "defined_in", evidence=command)
        for p in re.findall(r"tools/[\w./-]+\.(?:mjs|js)", command):
            if p in texts:
                link(cid, fid(p), "runs_script", evidence=command)
    return {"nodes": list(nodes.values()), "edges": edges, "hyperedges": []}, unresolved


def prepare():
    from graphify.extract import extract
    OUT.mkdir(exist_ok=True)
    paths = inventory()
    detection = detect(ROOT, gitignore=False)
    # Extend Graphify's inventory: SCSS is not classified by its built-in detector.
    detection["frontend_files"] = paths
    detection["files"] = {"code": [str(ROOT / p) for p in paths if not p.endswith(".md")],
                          "document": [str(ROOT / p) for p in paths if p.endswith(".md")],
                          "paper": [], "image": [], "video": []}
    detection["total_files"] = len(paths)
    detection["total_words"] = sum(len((ROOT / p).read_text(encoding="utf-8-sig").split()) for p in paths)
    detection["unclassified"] = []
    write(".graphify_detect.json", detection)
    (OUT / ".graphify_python").write_text(sys.executable, encoding="utf-8")
    (OUT / ".graphify_root").write_text(str(ROOT), encoding="utf-8")
    ast = extract([ROOT / p for p in paths if Path(p).suffix in {".js", ".mjs"}], cache_root=ROOT, root=ROOT)
    write(".graphify_ast.json", ast)
    adapter, unresolved = frontend(paths)
    write(".graphify_frontend.json", adapter)
    write("unresolved-references.json", unresolved)
    print("Inventory:", len(paths), "files", dict(Counter(Path(p).suffix for p in paths)))
    print("AST:", len(ast["nodes"]), "nodes", len(ast["edges"]), "edges")
    print("Frontend:", len(adapter["nodes"]), "nodes", len(adapter["edges"]), "edges")


def build(force=False):
    from graphify.build import build_from_json
    from graphify.cluster import cluster, score_all
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.report import generate
    from graphify.export import to_json, to_html
    from graphify.diagnostics import diagnose_extraction, format_diagnostic_report
    extraction = {"nodes": [], "edges": [], "hyperedges": [], "input_tokens": 0, "output_tokens": 0}
    chunks = sorted(OUT.glob(".graphify_chunk_*.json"))
    if not chunks:
        raise SystemExit("Semantic chunks missing; run documentation extraction with the Graphify skill first")
    coverage = {}
    for p in [OUT / ".graphify_ast.json", OUT / ".graphify_frontend.json", *chunks]:
        part = json.loads(p.read_text(encoding="utf-8"))
        if p in chunks:
            for item in part.get("nodes", []) + part.get("edges", []):
                item["_origin"] = "semantic"
        for key in ("nodes", "edges", "hyperedges"):
            extraction[key].extend(part.get(key, []))
        coverage.update(part.get("coverage", {}))
    for source, lines in coverage.items():
        if len(Path(source).read_text(encoding="utf-8").splitlines()) != lines:
            raise SystemExit(f"Semantic coverage mismatch: {source}")
    expected = {p for p in read(".graphify_detect.json")["files"]["document"] if p.endswith(".md")}
    if expected - coverage.keys():
        raise SystemExit(f"Semantic coverage missing: {expected - coverage.keys()}")
    source_hashes = {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in sorted(expected)}
    hashes_path = OUT / ".graphify_semantic_sources.json"
    if hashes_path.exists() and read(hashes_path.name) != source_hashes:
        raise SystemExit("Documentation changed: refresh semantic chunks and remove the old semantic_sources snapshot before rebuilding")
    write(hashes_path.name, source_hashes)
    paths = set(read(".graphify_detect.json")["frontend_files"])
    nodes = {}
    for node in extraction["nodes"]:
        source = Path(node.get("source_file", ""))
        relative = source.relative_to(ROOT).as_posix() if source.is_absolute() else source.as_posix()
        if relative not in paths:
            raise SystemExit(f"Out-of-scope node source: {relative}")
        nodes.setdefault(node["id"], node)
    extraction["nodes"] = list(nodes.values())
    # AST import targets outside the scan are not source nodes. Resolve local
    # JSON imports to the inventory and omit private/excluded module references.
    local_ids = {ident(str(Path(p).with_suffix("")).replace("\\", "/")): fid(p) for p in paths}
    omitted = []
    resolved_edges = []
    for edge in extraction["edges"]:
        for end in ("source", "target"):
            if edge[end] not in nodes and edge[end] in local_ids:
                edge[end] = local_ids[edge[end]]
        missing = [edge[end] for end in ("source", "target") if edge[end] not in nodes and not edge[end].startswith("ref_")]
        if missing:
            omitted.append({"reason": "excluded or unresolved local target", "edge": edge})
        else:
            resolved_edges.append(edge)
    extraction["edges"] = resolved_edges
    write("omitted-edges.json", omitted)
    # File ownership bridges AST symbols to HTML, registry and stylesheet links.
    for node in list(nodes.values()):
        if node.get("_origin") == "ast":
            source = Path(node["source_file"])
            relative = source.relative_to(ROOT).as_posix() if source.is_absolute() else source.as_posix()
            if node["id"] != fid(relative):
                extraction["edges"].append({"source": fid(relative), "target": node["id"], "relation": "declares_symbol",
                                            "source_file": relative, "source_location": node.get("source_location"),
                                            "confidence": "EXTRACTED", "confidence_score": 1.0, "weight": 1.0})
    # Keep all evidence on duplicate unordered pairs; Graphify's default graph
    # represents one undirected edge per pair. Do not silently discard relations.
    pairs = {}
    for edge in extraction["edges"]:
        key = tuple(sorted((edge["source"], edge["target"])))
        if key not in pairs:
            pairs[key] = dict(edge, evidence_records=[])
        pairs[key]["evidence_records"].append(edge)
    extraction["edges"] = list(pairs.values())
    write(".graphify_extract.json", extraction)
    diagnostic = diagnose_extraction(extraction, directed=False, root=ROOT)
    write("health.json", diagnostic)
    print(format_diagnostic_report(diagnostic))
    G = build_from_json(extraction, root=ROOT, directed=False, dedup=False)
    if not G.number_of_nodes():
        raise SystemExit("Empty graph")
    communities = cluster(G)
    cohesion = score_all(G, communities)
    labels = {}
    for cid, members in communities.items():
        owners = Counter(str(G.nodes[n].get("source_file", "")).replace("\\", "/").split("/")[0] for n in members)
        owner = owners.most_common(1)[0][0]
        labels[cid] = {"assets": "Общие компоненты", "tools": "Инструменты и проверки", ".agents": "Правила разработки",
                       "ui": "Реестры и каталог"}.get(owner, f"Модуль {owner}")
    if not to_json(G, communities, str(OUT / "graph.json"), community_labels=labels, force=force):
        raise SystemExit("Graphify refused to overwrite a larger graph; preserve it and investigate")
    gods = god_nodes(G)
    surprises = surprising_connections(G, communities)
    questions = suggest_questions(G, communities, labels)
    report = generate(G, communities, cohesion, labels, gods, surprises, read(".graphify_detect.json"),
                      {"input": 0, "output": 0}, str(ROOT), suggested_questions=questions)
    report = re.sub(r"- Token cost:.*", "- Token cost: host-agent usage unavailable; no external model API calls", report)
    report += "\n\n## Local adapter limitations\n\nAST runs locally. Documentation was extracted by Codex, without an API backend. " \
              "Exact host-agent token usage is unavailable; no external model API was used. " \
              "SCSS/HTML/registry links use tools/graphify-map.py. Shared class names are INFERRED, not runtime proof. " \
              "Duplicate undirected pairs retain evidence_records; edge direction is not preserved. " \
              "graphify-out/ is ignored by Git. Excluded media, vendor and private statistics are not indexed.\n"
    (OUT / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    write(".graphify_labels.json", {str(k): v for k, v in labels.items()})
    write(".graphify_analysis.json", {"communities": communities, "cohesion": cohesion, "gods": gods,
                                       "surprises": surprises, "questions": questions})
    if G.number_of_nodes() > 5000:
        print("WARNING: >5000 nodes; HTML will use community aggregation")
    if not to_html(G, communities, str(OUT / "graph.html"), community_labels=labels, node_limit=5000):
        raise SystemExit("HTML export did not produce a graph")
    # Graphify's default HTML loads vis-network from a CDN. Cache this pinned
    # rendering dependency locally; no graph data is sent over the network.
    html_path = OUT / "graph.html"
    html = html_path.read_text(encoding="utf-8")
    script = re.search(r'<script\s+src="(https://unpkg.com/vis-network@9\.1\.6/standalone/umd/vis-network\.min\.js)"\s+integrity="sha384-([^"]+)"\s+crossorigin="anonymous"\s*>', html)
    if not script:
        raise SystemExit("Unexpected Graphify visualizer dependency; inspect before downloading")
    dependency = OUT / "vis-network.min.js"
    data = dependency.read_bytes() if dependency.exists() else urlopen(script[1], timeout=30).read()
    if base64.b64encode(hashlib.sha384(data).digest()).decode() != script[2]:
        raise SystemExit("Visualizer integrity mismatch")
    dependency.write_bytes(data)
    html = html[:script.start()] + '<script src="vis-network.min.js">' + html[script.end():]
    html_path.write_text(html, encoding="utf-8")
    from graphify.detect import save_manifest
    from graphify.cache import save_semantic_cache
    docs = set(read(".graphify_detect.json")["files"]["document"])
    semantic = [json.loads(p.read_text(encoding="utf-8")) for p in chunks]
    spec = Path.home() / ".codex/skills/graphify/references/extraction-spec.md"
    def from_document(item):
        source = Path(item.get("source_file", ""))
        return str(source if source.is_absolute() else ROOT / source) in docs
    save_semantic_cache([n for part in semantic for n in part.get("nodes", []) if from_document(n)],
                        [e for part in semantic for e in part.get("edges", []) if from_document(e)],
                        [h for part in semantic for h in part.get("hyperedges", []) if from_document(h)],
                        root=ROOT, allowed_source_files=docs, prompt_file=spec)
    save_manifest(read(".graphify_detect.json")["files"], root=ROOT)
    print("Graph:", G.number_of_nodes(), "nodes", G.number_of_edges(), "edges", len(communities), "communities")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["prepare", "build"])
    parser.add_argument("--force", action="store_true", help="Allow a verified full rebuild to shrink the generated graph")
    args = parser.parse_args()
    prepare() if args.phase == "prepare" else build(force=args.force)
