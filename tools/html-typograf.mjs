import { resolve } from "node:path";
import { parse } from "parse5";
import Typograf from "typograf";

const stpFile = resolve(import.meta.dirname, "../stp/index.html");
const rules = [
  "common/punctuation/quote",
  "ru/dash/main",
  "common/space/delRepeatSpace",
  "common/space/delBeforePunctuation",
  "common/space/afterComma",
  "common/nbsp/afterShortWordByList",
];
const protectedTags = new Set(["script", "style", "pre", "code"]);

export function typografStpHtml(html, filename) {
  if (!filename || resolve(filename) !== stpFile) return html;
  const document = parse(html, { sourceCodeLocationInfo: true });
  let main;
  const visit = (node, callback) => {
    if (callback(node) === false) return;
    for (const child of node.childNodes || []) visit(child, callback);
    if (node.content) visit(node.content, callback);
  };
  visit(document, (node) => {
    if (node.tagName === "main") main ??= node;
  });
  const location = main?.sourceCodeLocation;
  if (!location?.startTag || !location.endTag) return html;
  if (main.attrs.some((attribute) => attribute.name === "data-no-typograf")) return html;
  const start = location.startTag.endOffset;
  const end = location.endTag.startOffset;
  const ranges = [];
  visit(main, (node) => {
    if (
      node.nodeName === "#comment" ||
      protectedTags.has(node.tagName) ||
      node.attrs?.some((attribute) => attribute.name === "data-no-typograf")
    ) {
      const span = node.sourceCodeLocation;
      if (span) ranges.push([span.startOffset, span.endOffset]);
      return false;
    }
  });
  let prefix = "SAFU_TYPOGRAF_SAFE_";
  while (html.includes(prefix)) prefix += "X";
  const saved = [];
  let fragment = html.slice(start, end);
  for (const [from, to] of ranges.sort((a, b) => b[0] - a[0])) {
    const token = `${prefix}${saved.length}_END`;
    saved.push([token, html.slice(from, to)]);
    fragment = fragment.slice(0, from - start) + token + fragment.slice(to - start);
  }
  const typograf = new Typograf({ locale: ["ru"], disableRule: "*" });
  typograf.enableRule(rules);
  typograf.addSafeTag(new RegExp(`${prefix}\\d+_END`, "g"));
  fragment = typograf.execute(fragment);
  for (const [token, content] of saved) fragment = fragment.replace(token, () => content);
  return html.slice(0, start) + fragment + html.slice(end);
}

export function stpTypograf() {
  return {
    name: "safu-stp-typograf",
    transformIndexHtml: {
      order: "pre",
      handler: (html, context) => typografStpHtml(html, context.filename),
    },
  };
}
