import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { typografStpHtml, stpTypograf } from "./html-typograf.mjs";

const filename = resolve(import.meta.dirname, "../stp/index.html");
const transform = (html) => typografStpHtml(html, filename);

test("typographs STP main without changing the shell or attributes", () => {
  const html =
    '<header>"Шапка"</header><main id="main"><p title="a - b" data-x="1  2">"Текст" - в Арктике,  еще текст.</p><a href="/a-b?q=1&amp;x=2">на Севере</a></main><footer>"Подвал"</footer>';
  const result = transform(html);
  assert.ok(result.includes("«Текст»\u00a0— в\u00a0Арктике, еще текст."));
  assert.ok(result.includes('title="a - b" data-x="1  2"'));
  assert.ok(result.includes('href="/a-b?q=1&amp;x=2"'));
  assert.ok(result.includes("на\u00a0Севере"));
  assert.ok(result.startsWith('<header>"Шапка"</header>'));
  assert.ok(result.endsWith('<footer>"Подвал"</footer>'));
  assert.equal(transform(result), result);
});

test("preserves protected fragments, comments, numbers and word hyphens", () => {
  const protectedHtml =
    '<!-- "Комментарий" - тест --><script>const a = "a - b";</script><style>.a { content: "a - b"; }</style><pre>"a"  - b</pre><code>"a" - b</code><div data-no-typograf><div>"Вложенный" - текст</div>в Арктике</div>';
  const result = transform(
    `<main>${protectedHtml}<p>научно-технический 1 234,56 ₽ 10-20 "Текст"</p></main>`,
  );
  assert.ok(result.includes(protectedHtml));
  assert.ok(result.includes("научно-технический 1 234,56 ₽ 10-20 «Текст»"));
});

test("processes inline markup together and ignores other pages", () => {
  const html = '<main><p>"Привет <em>мир</em>"</p></main>';
  assert.equal(transform(html), "<main><p>«Привет <em>мир</em>»</p></main>");
  for (const path of [
    "/project/index.html",
    "/project/international/index.html",
    "/project/events/stp/index.html",
  ])
    assert.equal(typografStpHtml(html, path), html);
  assert.equal(typografStpHtml(html, filename.replaceAll("/", "\\")), transform(html));
  assert.equal(transform('<p>"Без main"</p>'), '<p>"Без main"</p>');
});

test("Vite hook shares one transformation for dev and build", () => {
  const plugin = stpTypograf();
  assert.equal(plugin.transformIndexHtml.order, "pre");
  const html = '<main><p>"Текст"</p></main>';
  assert.equal(plugin.transformIndexHtml.handler(html, { filename }), transform(html));
});

test("supports excluding main and nested fragments inside templates", () => {
  const main = '<main data-no-typograf><p>"Текст" - в Арктике</p></main>';
  assert.equal(transform(main), main);
  const fragment = '<span data-no-typograf>"Текст" - в Арктике</span>';
  const html = `<main><template>${fragment}</template><p>"Текст"</p></main>`;
  const result = transform(html);
  assert.ok(result.includes(fragment));
  assert.ok(result.includes("<p>«Текст»</p>"));
});
