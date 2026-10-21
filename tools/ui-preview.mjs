import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectRemarks } from "./project-data.mjs";
export { collectRemarks } from "./project-data.mjs";
import { collectStatistics, privateDirectory } from "./ai-statistics.mjs";

export function uiPreview() {
  function install(server) {
    server.middlewares.use(async (request, response, next) => {
      const path = request.url?.split("?")[0];
      if (!path?.startsWith("/__ui/")) return next();
      // Локальный обработчик: не выполняет команды из запроса и не обращается к API.
      const remote = request.socket.remoteAddress;
      const host = request.headers.host?.replace(/:\d+$/, "");
      if (
        !["127.0.0.1", "localhost", "[::1]"].includes(host) ||
        !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)
      ) {
        response.writeHead(403).end();
        return;
      }
      if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
        response.writeHead(403).end();
        return;
      }
      try {
        let data;
        if (path === "/__ui/remarks" && request.method === "GET") data = await collectRemarks();
        else if (path === "/__ui/statistics/refresh" && request.method === "POST")
          data = await collectStatistics();
        else if (path === "/__ui/statistics" && request.method === "GET") {
          try {
            data = JSON.parse(await readFile(resolve(privateDirectory, "report.json"), "utf8"));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
            data = await collectStatistics();
          }
        } else {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify(data));
      } catch {
        response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        response.end(
          JSON.stringify({
            error: "Не удалось прочитать локальный отчёт. Проверьте зарегистрированные источники.",
          }),
        );
      }
    });
  }
  return { name: "local-ui-report", configureServer: install, configurePreviewServer: install };
}
