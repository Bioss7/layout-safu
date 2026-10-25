import { readFile, writeFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { format, getFileInfo, resolveConfig } from "prettier";

const extensions = new Set([".html", ".scss", ".css", ".js", ".json"]);

export function formatOnSave() {
  let dispose;
  return {
    name: "local-format-on-save",
    apply: "serve",
    configureServer(server) {
      const root = server.config.root;
      const ignorePath = resolve(root, ".prettierignore");
      const pending = new Map();

      async function formatFile(file) {
        const info = await getFileInfo(file, { ignorePath });
        if (info.ignored || !info.inferredParser) return;
        const source = await readFile(file, "utf8");
        const config = await resolveConfig(file, { useCache: false });
        const result = await format(source, { ...config, filepath: file });
        // Запись форматтера тоже вызывает watcher. Неизменённый текст не записываем.
        // Если во время форматирования пришло новое сохранение, его обработает очередь.
        if (result !== source && (await readFile(file, "utf8")) === source) {
          await writeFile(file, result, "utf8");
        }
      }

      function onSave(file) {
        file = resolve(file);
        const local = relative(root, file);
        if (
          isAbsolute(local) ||
          local === ".." ||
          local.startsWith(`..${sep}`) ||
          !extensions.has(extname(file).toLowerCase())
        )
          return;

        // Сохранения одного файла выполняются последовательно, разных — независимо.
        const task = (pending.get(file) ?? Promise.resolve())
          .then(() => formatFile(file))
          .catch((error) => {
            if (error.code !== "ENOENT") {
              server.config.logger.warn(`[prettier] ${local}: ${error.message}`);
            }
          });
        pending.set(file, task);
        void task.then(() => {
          if (pending.get(file) === task) pending.delete(file);
        });
      }

      server.watcher.on("change", onSave);
      server.watcher.on("add", onSave);
      // Vite использует ignoreInitial: true: запуск не форматирует существующие файлы.
      dispose = async () => {
        server.watcher.off("change", onSave);
        server.watcher.off("add", onSave);
        await Promise.all(pending.values());
      };
    },
    async closeBundle() {
      await dispose?.();
    },
  };
}
