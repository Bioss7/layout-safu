import { resolve } from "node:path";
import { defineConfig } from "vite";
import { uiPreview } from "./tools/ui-preview.mjs";
import { formatOnSave } from "./tools/format-on-save.mjs";
import { pageAssets, restoreAssetTags, scriptInputs, assetFileName } from "./tools/page-assets.mjs";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [pageAssets(), restoreAssetTags(), uiPreview(), formatOnSave()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        index: resolve("index.html"),
        about: resolve("about/index.html"),
        programs: resolve("programs/index.html"),
        abiturient: resolve("abiturient/index.html"),
        students: resolve("students/index.html"),
        partners: resolve("partners/index.html"),
        stp: resolve("stp/index.html"),
        "template-main": resolve("template-main/index.html"),
        "template-abiturient": resolve("template-abiturient/index.html"),
        "template-international": resolve("template-international/index.html"),
        "ui-catalog": resolve("ui/index.html"),
        "ui-statistics": resolve("ui/statistics/index.html"),
        "programs-detail": resolve("programs/detail/index.html"),
        "css-common": resolve("assets/scss/common.scss"),
        ...Object.fromEntries(
          [
            "main",
            "about",
            "programs",
            "abiturient",
            "students",
            "partners",
            "stp",
            "template-main",
            "template-abiturient",
            "template-international",
          ].map((page) => [`css-${page}`, resolve(`${page}/assets/scss/${page}.scss`)]),
        ),
        ...scriptInputs(),
      },
      output: {
        entryFileNames: ({ name }) =>
          name.startsWith("ui-") ? "ui/assets/js/[name].js" : "[name].js",
        chunkFileNames: "ui/assets/js/[name].js",
        assetFileNames: assetFileName,
      },
    },
  },
});
