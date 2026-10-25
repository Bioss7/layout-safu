import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";

const phase = process.argv[2] || "before";
if (!["before", "after"].includes(phase)) throw new Error("Use before or after");
const output = `screenshots/abiturient/full-audit/${phase}`;
await mkdir(output, { recursive: true });
const frames = [1920, 1440, 1200, 992, 768, 576, 390];
const vars = await readFile("src/scss/abiturient/_vars.scss", "utf8");
const points = [...vars.matchAll(/\$bp-\d+:\s*(\d+)px;/g)].map((m) => +m[1]);
const boundaries = points.flatMap((w) => [w - 1, w, w + 1]);
const mids = [425, 500, 558, 628, 724, 880, 1071, 1175, 1320, 1680];
const widths = [...new Set([...frames, ...boundaries, ...mids])].filter(
  (w) => w >= 390 && w <= 1920,
);
const selectors = [
  ".applicant-hero",
  ".apply-banner",
  ".section--education > .container",
  ".section--admission",
  ".section--opportunities > .container",
  ".section--contacts",
  ".section--reviews > .container",
  "#faq",
  ".question__surface",
];
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const page = await browser.newPage();
const errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400 && r.url().startsWith("http://127.0.0.1:4173"))
    errors.push(`${r.status()} ${r.url()}`);
});
try {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("http://127.0.0.1:4173/abiturient/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await page.mouse.move(0, 0);
    const data = await page.evaluate(
      ({ selectors, detailed }) => {
        const rect = (e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
        };
        const properties = [
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "letterSpacing",
          "textAlign",
          "color",
          "backgroundColor",
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "marginTop",
          "marginRight",
          "marginBottom",
          "marginLeft",
          "gap",
          "rowGap",
          "columnGap",
          "borderRadius",
          "borderWidth",
          "boxShadow",
          "display",
          "flexDirection",
          "alignItems",
          "justifyContent",
          "objectFit",
          "objectPosition",
          "overflow",
          "textShadow",
        ];
        const excluded = (e) => e.closest(".header, .footer, .header-panels");
        const elements = detailed
          ? [...document.querySelectorAll("main *")]
              .filter((e) => !excluded(e) && e.checkVisibility() && e.getClientRects().length)
              .map((e) => ({
                tag: e.tagName,
                class: e.className.baseVal ?? e.className,
                id: e.id,
                text: e.children.length ? "" : e.textContent.trim(),
                ...rect(e),
                styles: Object.fromEntries(properties.map((k) => [k, getComputedStyle(e)[k]])),
                ...(e instanceof HTMLImageElement
                  ? {
                      src: new URL(e.currentSrc).pathname,
                      naturalWidth: e.naturalWidth,
                      naturalHeight: e.naturalHeight,
                    }
                  : {}),
              }))
          : [];
        const assets = new Set();
        for (const e of document.querySelectorAll("main *")) {
          if (excluded(e)) continue;
          if (e instanceof HTMLImageElement) assets.add(new URL(e.currentSrc).pathname);
          for (const pseudo of [null, "::before", "::after"]) {
            const s = getComputedStyle(e, pseudo);
            for (const property of ["backgroundImage", "maskImage", "webkitMaskImage"]) {
              for (const m of (s[property] || "").matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
                if (!m[1].startsWith("data:")) assets.add(new URL(m[1], location.href).pathname);
              }
            }
          }
        }
        return {
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          sections: selectors.map((s) => ({ selector: s, ...rect(document.querySelector(s)) })),
          excluded: [".header", ".footer", ".marquee"].map((s) => {
            const e = document.querySelector(s);
            return { selector: s, width: rect(e).width, height: rect(e).height, html: e.outerHTML };
          }),
          brokenImages: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src),
          elements,
          assets: [...assets],
        };
      },
      { selectors, detailed: frames.includes(width) },
    );
    results.push(data);
    if (frames.includes(width)) {
      await page.screenshot({ path: `${output}/page-${width}.png`, fullPage: true });
      for (const [i, s] of selectors.entries())
        await page.locator(s).screenshot({ path: `${output}/section-${width}-${i}.png` });
    }
  }
  await writeFile(`${output}/metrics.json`, JSON.stringify({ errors, results }, null, 2));
  const failures = results.filter((r) => r.scrollWidth > r.width || r.brokenImages.length);
  const assets = [...new Set(results.flatMap((r) => r.assets))];
  for (const path of assets) {
    assert.ok(path.startsWith("/abiturient/assets/"), `Page-local asset: ${path}`);
    assert.ok(
      (await stat(`public${decodeURIComponent(path)}`)).size > 0,
      `Nonempty asset: ${path}`,
    );
  }
  if (phase === "after") {
    const before = JSON.parse(
      await readFile("screenshots/abiturient/full-audit/before/metrics.json", "utf8"),
    );
    const expected = JSON.parse(await readFile("abiturient/alignment-audit.json", "utf8"));
    const geometry = [];
    for (const result of results) {
      const baseline = before.results.find((r) => r.width === result.width);
      assert.deepEqual(
        result.excluded,
        baseline.excluded,
        `Header/footer/marquee content and dimensions preserved at ${result.width}`,
      );
      if (!frames.includes(result.width)) continue;
      const frame = expected.frames.find((f) => f.width === result.width);
      let y = 0;
      for (const [i, section] of result.sections.entries()) {
        const ref = frame.sections[i];
        if (i) {
          const prev = frame.sections[i - 1];
          y += Math.round(prev.height) + Math.round(ref.y - prev.y - prev.height);
        }
        const copyShift = result.width === 390 && i >= 3 ? 20 : 0;
        const heightShift = result.width === 390 && i === 2 ? 20 : 0;
        for (const [property, actualValue, expectedValue] of [
          ["y", section.y, y + copyShift],
          ["height", section.height, ref.height + heightShift],
        ]) {
          if (Math.abs(actualValue - expectedValue) > 2)
            geometry.push({
              width: result.width,
              selector: section.selector,
              nodeId: ref.id,
              property,
              actual: actualValue,
              expected: expectedValue,
            });
        }
      }
    }
    await writeFile(`${output}/geometry.json`, JSON.stringify(geometry, null, 2));
    assert.deepEqual(
      geometry,
      [],
      "Section geometry matches Figma within 2px; agreed mobile copy adds 20px",
    );
  }
  console.log(
    JSON.stringify({
      phase,
      frames,
      widths: widths.length,
      errors,
      failures: failures.map((r) => ({
        width: r.width,
        scrollWidth: r.scrollWidth,
        brokenImages: r.brokenImages,
      })),
    }),
  );
  if (failures.length || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
