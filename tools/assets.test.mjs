import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Script } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = resolve(root, "dist");
const pages = [
  "main",
  "about",
  "programs",
  "abiturient",
  "students",
  "template-main",
  "template-abiturient",
  "template-international",
];
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(resolve(directory, entry.name))
          : resolve(directory, entry.name),
      ),
    )
  ).flat();
}

test("Ресурсы страниц и общая оболочка собираются в свои каталоги", async () => {
  const outputs = JSON.parse(await readFile(resolve(dist, "layout-assets.json"), "utf8"));
  assert.ok(
    outputs.every(
      (name) =>
        !/^assets\/(?:css|js)\//.test(name) ||
        ["assets/css/common.css", "assets/js/header.js", "assets/js/footer.js"].includes(name),
    ),
  );
  await access(resolve(dist, "assets/css/common.css"));
  for (const page of pages) {
    await access(resolve(dist, `${page}/assets/css/${page}.css`));
    const html = await readFile(
      resolve(dist, page === "main" ? "index.html" : `${page}/index.html`),
      "utf8",
    );
    assert.equal((html.match(/<header\b/g) || []).length, 1);
    assert.equal((html.match(/<footer\b/g) || []).length, 1);
    assert.equal((html.match(/assets\/js\/header\.js/g) || []).length, 1);
    assert.equal((html.match(/assets\/js\/footer\.js/g) || []).length, 1);
    assert.ok(!html.includes("/src/") && !html.includes("<!-- safu:"));
    const css = await readFile(resolve(dist, `${page}/assets/css/${page}.css`), "utf8");
    assert.ok(!/\.header__|\.footer__/.test(css), `${page}: общая оболочка не дублируется`);
  }
});

test("Локальные ссылки HTML/CSS разрешаются и остаются относительными", async () => {
  for (const file of await files(dist)) {
    if (!/\.(html|css)$/.test(file) || file.includes(`${resolve(dist, "ui")}`)) continue;
    const source = await readFile(file, "utf8");
    const values = file.endsWith(".css")
      ? [...source.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((match) => match[1])
      : [
          ...source.matchAll(/(?:src|poster)=["']([^"']+)["']|<link\b[^>]*href=["']([^"']+)["']/g),
        ].map((match) => match[1] || match[2]);
    for (const value of values) {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) continue;
      assert.ok(!value.startsWith("/"), `${file}: ${value}`);
      await access(resolve(dirname(file), decodeURI(value.split(/[?#]/)[0])));
    }
  }
});

test("Скрипты самодостаточны, исходники не попадают в dist", async () => {
  for (const file of await files(dist)) {
    assert.ok(!file.endsWith(".scss") && !file.includes("/assets/html/"));
    if (file.endsWith(".js") && !file.includes(`${resolve(dist, "ui")}`))
      new Script(await readFile(file, "utf8"), { filename: file });
  }
});
