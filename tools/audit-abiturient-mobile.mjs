import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const phase = process.argv[2] || "after";
if (!["before", "after"].includes(phase)) throw new Error("Use before or after");
const out = `screenshots/abiturient/audit-mobile/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "chrome" } : {}),
});
const page = await browser.newPage({ viewport: { width: 576, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const sections = [
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
const vars = await readFile(new URL("../src/scss/abiturient/_vars.scss", import.meta.url), "utf8");
const breakpoints = [...vars.matchAll(/\$bp-\d+:\s*(\d+)px;/g)].map((match) => +match[1]);
const widths = [
  ...new Set(breakpoints.flatMap((w) => [w - 1, w, w + 1]).concat([1920, 820, 1024])),
].sort((a, b) => a - b);
const result = { errors, widths: {} };
try {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("http://127.0.0.1:4174/abiturient/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await page.mouse.move(0, 0);
    result.widths[width] = await page.evaluate(
      ({ sections, detailed }) => {
        const rect = (e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
        };
        const metrics = (e) => {
          const s = getComputedStyle(e);
          return {
            selector: e.tagName.toLowerCase() + "." + [...e.classList].join("."),
            text: e.children.length ? "" : e.textContent.trim(),
            ...rect(e),
            styles: Object.fromEntries(
              [
                "paddingTop",
                "paddingRight",
                "paddingBottom",
                "paddingLeft",
                "marginTop",
                "marginRight",
                "marginBottom",
                "marginLeft",
                "gap",
                "fontFamily",
                "fontSize",
                "fontWeight",
                "lineHeight",
                "letterSpacing",
                "color",
                "backgroundColor",
                "borderWidth",
                "boxShadow",
                "filter",
                "display",
                "flexDirection",
                "objectFit",
                "objectPosition",
              ].map((p) => [p, s[p]]),
            ),
          };
        };
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          broken: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src),
          sections: sections.map((s) => ({ selector: s, ...rect(document.querySelector(s)) })),
          chrome: [".header", ".footer"].map((s) => {
            const e = document.querySelector(s);
            return { selector: s, html: e.outerHTML, width: e.offsetWidth, height: e.offsetHeight };
          }),
          nodes: detailed
            ? [...document.querySelectorAll("main [class]")]
                .filter((e) => e.getBoundingClientRect().width && !e.closest(".footer,.header"))
                .map(metrics)
            : [],
        };
      },
      { sections, detailed: [390, 576].includes(width) },
    );
    if ([390, 576].includes(width)) {
      await page.screenshot({ path: `${out}/page-${width}.png`, fullPage: true, animations: "disabled" });
      for (let i = 0; i < sections.length; i++)
        await page
          .locator(sections[i])
          .screenshot({ path: `${out}/${i + 1}-${width}.png`, animations: "disabled" });
      for (const s of ["header", "footer"])
        await page.locator("." + s).screenshot({ path: `${out}/${s}.png`, animations: "disabled" });
    }
  }
  await writeFile(`${out}/metrics.json`, JSON.stringify(result, null, 2));
  if (phase === "after") {
    const before = JSON.parse(
      await readFile("screenshots/abiturient/audit-mobile/before/metrics.json", "utf8"),
    );
    const failures = [];
    for (const [w, r] of Object.entries(result.widths)) {
      if (r.overflow || r.broken.length)
        failures.push({ width: w, overflow: r.overflow, broken: r.broken });
      if (JSON.stringify(r.chrome) !== JSON.stringify(before.widths[w].chrome))
        failures.push({ width: w, chrome: "changed" });
      if (w > 576)
        r.sections.forEach((s, i) => {
          const b = before.widths[w].sections[i];
          if (Math.abs(s.width - b.width) > 0.6 || Math.abs(s.height - b.height) > 0.6)
            failures.push({ width: w, section: s.selector, before: b, after: s });
        });
    }
    await writeFile(`${out}/regressions.json`, JSON.stringify(failures, null, 2));
    console.log(JSON.stringify({ widths: widths.length, errors, failures }, null, 2));
    if (errors.length || failures.length) process.exitCode = 1;
  } else
    console.log(
      JSON.stringify({ widths: widths.length, errors, sections: result.widths[768].sections }),
    );
} finally {
  await browser.close();
}

