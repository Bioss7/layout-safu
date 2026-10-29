import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

// Исходные слои Figma не меняем; в фон попадают только декоративные слои.
const root = new URL("../partners/assets/img/", import.meta.url);
const recipe = JSON.parse(await readFile(new URL("./partners-backgrounds.json", import.meta.url)));
const image = await readFile(new URL(recipe.sourceImage, root));
assert.equal(createHash("sha256").update(image).digest("hex"), recipe.sourceSha256);
const imageUrl = `data:image/png;base64,${image.toString("base64")}`;
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  for (const node of recipe.nodes) {
    const page = await browser.newPage({
      viewport: { width: node.width, height: node.height },
      deviceScaleFactor: recipe.scale,
    });
    let mapStyle = "inset:0;width:100%;height:100%;object-fit:cover;";
    if (node.image.mode === "CROP") {
      const [[a, , tx], [, d, ty]] = node.image.transform;
      const width = node.width / a;
      const height = node.height / d;
      mapStyle = `left:${-tx * width}px;top:${-ty * height}px;width:${width}px;height:${height}px;`;
    }
    const layers = [];
    for (const glow of node.glows) {
      const svg = await readFile(new URL(glow.source, root), "utf8");
      const width = Number(svg.match(/\bwidth="([\d.]+)"/)[1]);
      const height = Number(svg.match(/\bheight="([\d.]+)"/)[1]);
      const paddingX = (width - glow.width) / 2;
      const paddingY = (height - glow.height) / 2;
      const [[a, , tx], [, d, ty]] = glow.transform;
      const left = tx + Math.min(0, a * glow.width) - paddingX;
      const top = ty + Math.min(0, d * glow.height) - paddingY;
      const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      layers.push(
        `<img src="${src}" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;transform:scale(${a},${d});mix-blend-mode:${glow.blendMode}">`,
      );
    }
    await page.setContent(`<!doctype html><style>
      *{box-sizing:border-box}html,body{margin:0}
      .art{position:relative;width:${node.width}px;height:${node.height}px;overflow:hidden;isolation:isolate;background-color:${node.backgroundColor};transform:scaleX(${node.mirror ? -1 : 1})}
      img{position:absolute;max-width:none}
      </style><div class="art"><img src="${imageUrl}" style="${mapStyle}opacity:${node.image.opacity}">${layers.join("")}</div>`);
    await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
    const png = await page.screenshot();
    const output = new URL(node.output, root);
    await mkdir(new URL("./", output), { recursive: true });
    await sharp(png).webp({ lossless: true }).toFile(fileURLToPath(output));
    console.log(
      `${node.nodeId}: ${node.output} (${node.width * recipe.scale}×${node.height * recipe.scale})`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
