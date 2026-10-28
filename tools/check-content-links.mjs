import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const base = process.env.TEMPLATES_BASE_URL || "http://127.0.0.1:4173";
const output = new URL("../screenshots/content-links/", import.meta.url);
await mkdir(output, { recursive: true });
// Отдельный пустой профиль: история нужна для проверки :visited. Личный профиль не используется.
const profile = await mkdtemp(fileURLToPath(new URL("profile-", output)));
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  channel: "chrome",
});
const page = await context.newPage();
const results = [];
const colors = { default: [0, 122, 255], hover: [0, 174, 239], visited: [88, 86, 214] };
const colorPixels = async (buffer, color) => {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let index = 0; index < data.length; index += info.channels)
    if (color.every((value, channel) => Math.abs(data[index + channel] - value) <= 2)) count++;
  return count;
};
try {
  for (const template of ["template-main", "template-abiturient", "template-international"]) {
    for (const width of [1920, 576]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/${template}/`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const link = page.locator(".template-content a").first();
      await link.evaluate((node, target) => {
        node.href = target;
      }, `${base}/template-main/?link-test=${template}-${width}`);
      await page.mouse.move(0, 0);
      const normal = await link.evaluate((node) => {
        const css = getComputedStyle(node);
        return {
          color: css.color,
          font: css.fontFamily,
          weight: css.fontWeight,
          underline: css.textDecorationLine,
        };
      });
      assert.equal(normal.color, "rgb(0, 122, 255)");
      assert.ok(normal.font.includes("Montserrat"));
      assert.equal(normal.weight, "500");
      assert.ok(normal.underline.includes("underline"));
      const normalImage = await link.screenshot();
      assert.ok((await colorPixels(normalImage, colors.default)) > 5);
      await link.hover();
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".template-content a")).color ===
          "rgb(0, 174, 239)",
      );
      assert.ok((await colorPixels(await link.screenshot(), colors.hover)) > 5);
      await page.mouse.move(0, 0);
      await link.focus();
      assert.ok(await link.evaluate((node) => node.matches(":focus-visible")));
      assert.equal(await link.evaluate((node) => getComputedStyle(node).outlineStyle), "solid");
      // Настоящий переход и возврат. Цвет :visited проверяем по пикселям, не через computedStyle.
      const source = page.url();
      await link.press("Enter");
      await page.waitForURL(/link-test=/);
      await page.goBack({ waitUntil: "networkidle" });
      assert.equal(page.url(), source);
      const visited = page.locator(".template-content a").first();
      // При восстановлении DOM из сети возвращаем адрес уже посещённой ссылки.
      await visited.evaluate((node, target) => {
        node.href = target;
      }, `${base}/template-main/?link-test=${template}-${width}`);
      await page.mouse.move(0, 0);
      const visitedImage = await visited.screenshot();
      await writeFile(new URL(`${template}-${width}-visited.png`, output), visitedImage);
      const visitedPixels = await colorPixels(visitedImage, colors.visited);
      assert.ok(
        visitedPixels > 5,
        `${template} ${width}: видимый цвет посещённой ссылки (${visitedPixels})`,
      );
      await visited.hover();
      await page.waitForTimeout(200);
      assert.ok((await colorPixels(await visited.screenshot(), colors.hover)) > 5);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      await page.screenshot({
        path: fileURLToPath(new URL(`${template}-${width}.png`, output)),
        fullPage: true,
      });
      for (const [size, line] of [
        [14, 20],
        [16, 24],
        [18, 26],
      ]) {
        await visited.evaluate(
          (node, values) => {
            node.parentElement.style.fontSize = `${values[0]}px`;
            node.parentElement.style.lineHeight = `${values[1]}px`;
          },
          [size, line],
        );
        const inherited = await visited.evaluate((node) => ({
          size: getComputedStyle(node).fontSize,
          line: getComputedStyle(node).lineHeight,
          weight: getComputedStyle(node).fontWeight,
        }));
        assert.deepEqual(inherited, { size: `${size}px`, line: `${line}px`, weight: "500" });
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
        assert.ok((await colorPixels(await visited.screenshot(), colors.visited)) > 5);
        await visited.hover();
        await page.waitForTimeout(200);
        const sample = await visited.screenshot();
        assert.ok((await colorPixels(sample, colors.hover)) > 5);
        if (template === "template-main" && width === 576)
          await writeFile(new URL(`sample-${size}-hover.png`, output), sample);
      }
      results.push({ template, width, normal, visitedPixels });
    }
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await writeFile(new URL("results.json", output), JSON.stringify(results, null, 2));
  await context.close();
}
