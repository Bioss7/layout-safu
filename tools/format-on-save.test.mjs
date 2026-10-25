import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createLogger, createServer } from "vite";
import { format } from "prettier";
import { formatOnSave } from "./format-on-save.mjs";

async function waitFor(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await delay(50);
  }
  assert.fail("Не дождались обработки сохранения Vite");
}

test("Vite форматирует сохранения без массовых изменений и циклов", async () => {
  const root = await mkdtemp(join(tmpdir(), "safu-format-"));
  const config = { tabWidth: 2, endOfLine: "lf", printWidth: 100 };
  const warnings = [];
  const logger = createLogger("silent");
  logger.warn = (message) => warnings.push(message);
  let server;
  try {
    await writeFile(join(root, ".prettierrc.json"), JSON.stringify(config));
    await writeFile(join(root, ".prettierignore"), "figma/\ndist/\n");
    const existing = join(root, "existing.js");
    const source = "const value={answer:42};";
    await writeFile(existing, source);
    server = await createServer({
      configFile: false,
      root,
      customLogger: logger,
      plugins: [formatOnSave()],
      server: { middlewareMode: true, ws: false },
    });
    await waitFor(() => Object.keys(server.watcher.getWatched()).includes(root));
    await delay(200);
    assert.equal(await readFile(existing, "utf8"), source);

    // Новый файл каждого типа, затем повторное сохранение уже существующего файла.
    for (const [name, text] of [
      ["index.html", "<div><span>Test</span></div>"],
      ["style.scss", ".test{color:red;}"],
      ["style.css", ".test{color:red;}"],
      ["main.js", source],
      ["data.json", '{"answer":42}'],
    ]) {
      const file = join(root, name);
      const expected = await format(text, { ...config, filepath: file });
      await writeFile(file, text);
      await waitFor(async () => (await readFile(file, "utf8")) === expected);
    }
    await writeFile(existing, source + "\nconst next=1;");
    const expected = await format(source + "\nconst next=1;", { ...config, filepath: existing });
    await waitFor(async () => (await readFile(existing, "utf8")) === expected);
    const modifiedAt = (await stat(existing)).mtimeMs;
    await delay(300);
    assert.equal((await stat(existing)).mtimeMs, modifiedAt);

    await mkdir(join(root, "figma"));
    const ignored = join(root, "figma", "context.json");
    await writeFile(ignored, '{"raw":true}');
    await delay(300);
    assert.equal(await readFile(ignored, "utf8"), '{"raw":true}');
    await writeFile(existing, "const broken = ;");
    await waitFor(() => warnings.some((warning) => warning.includes("[prettier]")));
    assert.equal(await readFile(existing, "utf8"), "const broken = ;");
    await writeFile(existing, source);
    await waitFor(
      async () =>
        (await readFile(existing, "utf8")) ===
        (await format(source, { ...config, filepath: existing })),
    );
    const response = await server.transformRequest("/existing.js");
    assert.ok(response.code.includes("answer: 42"));
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
