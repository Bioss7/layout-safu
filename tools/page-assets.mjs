import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const owners = ["", "main", "about", "programs", "abiturient", "students"];
const posix = (path) => path.replaceAll("\\", "/");
const local = (path) => posix(relative(root, path));

export function renderSharedHtml(html, overlay = false) {
  return html.replace(/<!-- safu:(header|footer) -->/g, (_, block) =>
    readFileSync(resolve(root, "assets/html", `${block}.html`), "utf8").replaceAll(
      "{{headerModifier}}",
      overlay ? " header--overlay" : "",
    ),
  );
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

export function scriptInputs() {
  return Object.fromEntries(
    owners
      .flatMap((owner) => files(resolve(root, owner, "assets/js")))
      .filter((file) => file.endsWith(".js"))
      .map((file) => [local(file).slice(0, -3), file]),
  );
}

export function assetFileName({ names = [], originalFileNames = [] }) {
  const name = names[0] || "";
  if (name.endsWith(".css")) {
    const stem = name.slice(0, -4).replace(/^css-/, "");
    if (stem === "common") return "assets/css/common.css";
    if (owners.includes(stem) && stem) return `${stem}/assets/css/${stem}.css`;
    if (/^(?:ui|pages)/.test(stem)) return "ui/assets/[name][extname]";
    throw new Error(`Unknown stylesheet owner: ${name}`);
  }
  const source = originalFileNames
    .map(posix)
    .map((file) => (file.startsWith(posix(root) + "/") ? file.slice(posix(root).length + 1) : file))
    .find((file) =>
      /^(?:(?:main|about|programs|abiturient|students)\/)?assets\/(?:img|fonts|vendor)\//.test(
        file,
      ),
    );
  if (source) return source;
  if (originalFileNames.some((file) => posix(file).startsWith("ui/")))
    return "ui/assets/[name][extname]";
  throw new Error(`Unknown asset owner: ${originalFileNames.join(", ")} (${name})`);
}

export function pageAssets() {
  let building = false;
  return {
    name: "safu-page-assets",
    configResolved(config) {
      building = config.command === "build";
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        const pageDirectory = dirname(context.filename);
        const overlay =
          posix(context.filename) === posix(resolve(root, "index.html")) ||
          /[\\/](?:abiturient|students)[\\/]index\.html$/.test(context.filename);
        html = renderSharedHtml(html, overlay);
        // Относительные ссылки работают и в dev, и после размещения dist в подкаталоге.
        html = html
          .replace(
            /(\b(?:src|href|poster)=")(\/(?!\/)[^"]*\/assets\/[^"?#]+)([^"]*")/g,
            (_, before, url, after) => {
              let path = posix(relative(pageDirectory, resolve(root, "." + url)));
              if (!path.startsWith(".")) path = "./" + path;
              return before + path + after;
            },
          )
          .replace(/(\b(?:src|href)=")\/assets\/([^"?#]+)([^"]*")/g, (_, before, url, after) => {
            let path = posix(relative(pageDirectory, resolve(root, "assets", url)));
            if (!path.startsWith(".")) path = "./" + path;
            return before + path + after;
          });
        if (!building) return html;
        // CSS собирается отдельными входами, чтобы Vite не смешивал общий и страничный код.
        return html.replace(
          /<link\b[^>]*href="[^"]*\/assets\/(?:scss\/[^"/]+\.scss|vendor\/[^"/]+\.css)"[^>]*>|<script\b[^>]*src="[^"]*\/assets\/(?:js|vendor)\/[^"?]+\.js"[^>]*><\/script>/g,
          (tag) => {
            const output = tag.replace(/\/scss\/([^/".]+)\.scss/, "/css/$1.css");
            return `<!-- safu-built:${Buffer.from(output).toString("base64")} -->`;
          },
        );
      },
    },
    configureServer(server) {
      server.watcher.add(resolve(root, "assets/html"));
      server.watcher.on("change", (file) => {
        if (local(file).startsWith("assets/html/")) server.ws.send({ type: "full-reload" });
      });
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const outputs = new Set(Object.keys(bundle));
        // Копируем также файлы, выбираемые динамически из JS и data-атрибутов.
        for (const owner of owners) {
          for (const file of files(resolve(root, owner, "assets"))) {
            const name = local(file);
            if (!/\/assets\/(?:img|fonts|vendor)\//.test("/" + name)) continue;
            this.emitFile({ type: "asset", fileName: name, source: readFileSync(file) });
            outputs.add(name);
          }
        }
        this.emitFile({
          type: "asset",
          fileName: "layout-assets.json",
          source: JSON.stringify([...outputs].sort(), null, 2) + "\n",
        });
      },
    },
  };
}

export function restoreAssetTags() {
  return {
    name: "safu-classic-assets",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html.replace(/<!-- safu-built:([A-Za-z0-9+/=]+) -->/g, (_, encoded) =>
          Buffer.from(encoded, "base64").toString("utf8"),
        );
      },
    },
  };
}
