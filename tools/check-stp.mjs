import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";

const port = "4184",
  base = "http://127.0.0.1:" + port,
  output = "screenshots/stp";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
  ],
  { stdio: "pipe", windowsHide: true },
);
let browser;
const errors = [],
  report = { widths: [], geometry: {}, internal: {}, hover: {}, marquee: {} };
const selectors = [
  ".stp-hero",
  ".marquee",
  ".section--program",
  ".section--dashboard",
  ".section--competencies",
  ".section--companies",
  ".section--cases",
  ".section--contacts",
];
const widths = [
  360, 390, 480, 575, 576, 577, 640, 767, 768, 769, 880, 991, 992, 993, 1100, 1199, 1200, 1201,
  1300, 1399, 1400, 1401, 1600, 1920, 2560,
];
const rects = (l) =>
  l.evaluateAll((ns) =>
    ns.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
    }),
  );
const near = (a, b, label, t = 1) =>
  assert(Math.abs(a - b) <= t, label + ": " + a + " вместо " + b);
async function marquee(page, width) {
  // Снимки с animations: disabled управляют Web Animations вручную.
  // Для проверки CSS hover начинаем с нового документа.
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const root = page.locator(".marquee"),
    track = page.locator(".marquee__track");
  await page.mouse.move(0, 0);
  await expect(root).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(track).toHaveCSS("animation-duration", "90s");
  await expect(track).toHaveCSS("animation-play-state", "running");
  const groups = await rects(page.locator(".marquee__group"));
  near(groups[0].width, groups[1].width, "Равные группы", 0.01);
  near(groups[1].x - groups[0].x, groups[0].width, "Стык групп", 0.01);
  const position = () => track.evaluate((n) => new DOMMatrix(getComputedStyle(n).transform).m41);
  await root.hover();
  await expect(track).toHaveCSS("animation-play-state", "paused");
  await track.evaluate(async (n) => {
    await n.getAnimations()[0].ready;
  });
  const paused = await position();
  await page.waitForTimeout(120);
  near(await position(), paused, "Пауза", 0.01);
  await page.mouse.move(0, 0);
  await expect(track).toHaveCSS("animation-play-state", "running");
  const running = await position();
  await page.waitForTimeout(120);
  assert(Math.abs((await position()) - running) > 1, "Движение должно возобновиться");
  // Сравниваем соседние копии по обе стороны стыка, без зависимости от таймера теста.
  const seam = await track.evaluate((n) => {
    const a = n.getAnimations()[0];
    a.pause();
    a.currentTime = 89999;
    const before = n.children[1].getBoundingClientRect().left;
    a.currentTime = 90001;
    const after = n.children[0].getBoundingClientRect().left;
    a.currentTime = 0;
    a.play();
    return { before, after };
  });
  near(seam.before, seam.after, "Бесшовность", 1);
  report.marquee[width] = { background: "white", duration: 90, paused: true, resumed: true, seam };
  // Проверка стыка через Web Animations переопределяет CSS play-state.
  // Новый документ возвращает CSS полный контроль перед следующими проверками.
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}
async function states(page, width) {
  await page.setViewportSize({ width, height: 1080 });
  await page.goto(base + "/stp/", { waitUntil: "networkidle" });
  const checked = [];
  const hover = async (l, label, values) => {
    await page.mouse.move(0, 0);
    await l.hover();
    for (const [k, v] of Object.entries(values)) await expect(l).toHaveCSS(k, v);
    checked.push(label);
  };
  for (const [i, l] of (await page.locator(".stp-hero__breadcrumbs a").all()).entries())
    await hover(l, "breadcrumbs " + i, {
      color: "rgb(0, 174, 239)",
      "text-decoration-line": "none",
    });
  const more = page.locator(".stp-program__more");
  await hover(more, "program more", { color: "rgb(0, 174, 239)" });
  await page.mouse.down();
  await expect(more).toHaveCSS("color", "rgb(35, 66, 96)");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  for (const [i, l] of (await page.locator(".stp-project").all()).entries())
    await hover(l, "project " + i, {
      "background-color": "rgb(0, 174, 239)",
      color: "rgb(255, 255, 255)",
    });
  const panels = page.locator(".js-stp-accordion"),
    buttons = page.locator(".js-accordion-trigger");
  for (let i = 0; i < 4; i++) {
    await buttons.nth(i).hover();
    await expect(panels.nth(i)).toHaveCSS(
      "background-color",
      i === 0 ? "rgba(255, 255, 255, 0.7)" : "rgb(0, 174, 239)",
    );
    await expect(buttons.nth(i)).toHaveCSS(
      "color",
      i === 0 ? "rgb(11, 45, 78)" : "rgb(255, 255, 255)",
    );
    checked.push("accordion " + i);
  }
  // Default экземпляров Link уже accent; в Figma Hover также accent.
  for (const [i, l] of (await page.locator(".stp-link").all()).entries())
    await hover(l, "dashboard link " + i, {
      color: "rgb(0, 174, 239)",
      "text-decoration-line": "none",
    });
  for (const [i, l] of (await page.locator(".stp-contact__list a").all()).entries())
    await hover(l, "contact " + i, {
      "text-decoration-line": "underline",
      color: "rgb(11, 45, 78)",
    });
  for (const s of [".stp-competency", ".stp-metric", ".stp-company", ".stp-case"]) {
    for (const card of await page.locator(s).all()) {
      await page.mouse.move(0, 0);
      const appearance = () =>
        card.evaluate((n) => {
          const s = getComputedStyle(n);
          return [s.backgroundColor, s.backgroundImage, s.boxShadow, s.transform, s.cursor];
        });
      const before = await appearance();
      await card.hover();
      assert.deepEqual(await appearance(), before, "Статичная карточка " + s);
    }
  }
  await page.mouse.move(0, 0);
  await page.keyboard.press("Tab");
  for (const l of await page.locator("main a, main button").all()) {
    await l.focus();
    await expect(l).toHaveCSS("outline-style", "solid");
    await expect(l).toHaveCSS("outline-width", "3px");
  }
  for (let i = 1; i < 4; i++) {
    await buttons.nth(i).focus();
    await page.keyboard.press(i % 2 ? "Enter" : "Space");
    await expect(buttons.nth(i)).toHaveAttribute("aria-expanded", "true");
    const body = page.locator("#" + (await buttons.nth(i).getAttribute("aria-controls")));
    await expect(body).toBeVisible();
    assert((await body.innerText()).trim().length > 0);
  }
  await expect(buttons.nth(0)).toHaveAttribute("aria-expanded", "true");
  await buttons.nth(0).click();
  await expect(buttons.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#program-body-0")).toBeHidden();
  report.hover[width] = {
    checked,
    staticCards: true,
    keyboardFocus: true,
    independentAccordions: true,
  };
}
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => {
      if (d.toString().includes(port)) resolve();
    });
    server.on("error", reject);
    server.on("exit", (c) => reject(new Error("Preview exited: " + c)));
  });
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(base) && r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
  await page.goto(base + "/stp/", { waitUntil: "networkidle" });
  await mkdir(output, { recursive: true });
  for (const s of ["h1", "header", "footer"]) assert.equal(await page.locator(s).count(), 1);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1080 });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator(".stp-competency:visible").count(), 6);
    assert.equal(await page.locator(".stp-case:visible").count(), 4);
    assert(
      !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)),
      "Переполнение страницы " + width,
    );
    const bad = await page
      .locator(".stp-competency,.stp-case,.stp-contact,.stp-stat,.stp-project")
      .evaluateAll((ns) =>
        ns.filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.className),
      );
    assert.deepEqual(bad, [], "Переполнение карточек " + width);
    report.widths.push(width);
    if ([1920, 390].includes(width)) {
      await marquee(page, width);
      for (const s of selectors) await page.locator(s).scrollIntoViewIfNeeded();
      await page.evaluate(() =>
        Promise.all([...document.images].map((i) => i.decode().catch(() => {}))),
      );
      report.geometry[width] = await page.locator(selectors.join(",")).evaluateAll((ns) =>
        ns.map((n) => {
          const r = n.getBoundingClientRect();
          return {
            selector: n.className,
            x: r.x,
            y: r.y + scrollY,
            width: r.width,
            height: r.height,
          };
        }),
      );
      const chart = (await rects(page.locator(".stp-chart")))[0];
      near(chart.height, 121, "Высота графика");
      if (width === 1920) {
        const columns = await rects(page.locator(".stp-dashboard__cards > *"));
        columns.forEach((r, i) => {
          near(r.x, 100 + i * 434, "Колонка x");
          near(r.width, 418, "Колонка width");
          near(r.height, 434, "Колонка height");
        });
        const interiors = await page
          .locator(".stp-stat")
          .evaluateAll((ns) =>
            ns.map(
              (n) =>
                n.clientWidth -
                parseFloat(getComputedStyle(n).paddingLeft) -
                parseFloat(getComputedStyle(n).paddingRight),
            ),
          );
        interiors.forEach((w) => near(w, 354, "Внутренняя ширина"));
        near(chart.x, 1019, "График x");
        near(chart.y, 2322.5, "График y");
        near(chart.width, 316, "График width");
        const bars = await rects(page.locator(".stp-chart__bar"));
        bars.forEach((r, i) => {
          near(r.width, 42, "Столбец width", 0.1);
          near(r.x, chart.x + i * 54, "Столбец x", 0.1);
        });
        const companies = await rects(page.locator(".stp-company"));
        companies.forEach((r, i) => {
          near(r.width, 412, "Предприятие width");
          near(r.height, 260, "Предприятие height");
          near(r.x, 968 + (i % 2) * 436, "Предприятие x");
        });
        // Координаты исходных узлов Figma в системе кадра 1920, а не накопление высот.
        for (const [s, x, y, w, h] of [
          [".stp-hero__title", 100, 304, 1115, 168],
          [".stp-program__header", 100, 1012, 1720, 96],
          [".stp-program__columns", 100, 1188, 1720, 564],
          [".stp-competency", 99.5, 3494, 563, 510],
          [".stp-case__picture", 100, 5922, 418, 235],
          [".stp-contact__avatar", 124, 7554, 56, 56],
        ]) {
          const r = (await rects(page.locator(s).first()))[0];
          for (const [k, v] of Object.entries({ x, y, width: w, height: h }))
            near(r[k], v, s + " " + k, 2);
        }
        report.internal[width] = { columns, interiors, chart, bars, companies };
      } else {
        const cards = await rects(page.locator(".stp-competency"));
        [368, 392, 370].forEach((h, i) => near(cards[i].height, h, "Компетенция height"));
        const cases = await rects(page.locator(".stp-case"));
        [879.2679443359375, 853.2679443359375, 879.2679443359375].forEach((h, i) =>
          near(cases[i].height, h, "Кейс height", 0.1),
        );
        report.internal[width] = { chart, competencies: cards, cases };
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: output + "/page-" + width + ".png",
        fullPage: true,
        animations: "disabled",
      });
      for (const s of selectors)
        await page.locator(s).screenshot({
          path: output + "/" + width + "-" + s.slice(1) + ".png",
          animations: "disabled",
        });
    }
  }
  for (const [width, heights] of [
    [1920, [802, 90, 1022, 1332, 1404, 1020, 1444, 849]],
    [390, [832, 58, 1478, 3067, null, 1692, null, 1803]],
  ])
    heights.forEach((h, i) => {
      if (h !== null)
        near(report.geometry[width][i].height, h, "Секция " + selectors[i] + " на " + width, 2);
    });
  for (const width of [1920, 390]) await states(page, width);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator(".stp-dashboard__live")).toHaveCSS("animation-name", "stp-live");
  await expect(page.locator(".stp-dashboard__live")).toHaveCSS("animation-duration", "1s");
  const frames = await page.locator(".stp-dashboard__live").evaluate((n) =>
    n
      .getAnimations()[0]
      .effect.getKeyframes()
      .map((k) => k.opacity),
  );
  assert.deepEqual(frames, ["1", "0"]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".marquee__track")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".marquee__group[aria-hidden]")).toBeHidden();
  await expect(page.locator(".stp-dashboard__live")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".stp-dashboard__live")).toHaveCSS("opacity", "1");
  const broken = await page
    .locator("main img")
    .evaluateAll((ns) => ns.filter((n) => !n.complete || !n.naturalWidth).map((n) => n.src));
  assert.deepEqual(broken, []);
  assert.deepEqual(errors, []);
  Object.assign(report, { errors, reducedMotion: true, live: { keyframes: frames, duration: 1 } });
  await writeFile(output + "/geometry.json", JSON.stringify(report.geometry, null, 2));
  await writeFile(output + "/checks.json", JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        widths: widths.length,
        hoverInstances: report.hover[1920].checked.length,
        errors,
        marquee: report.marquee,
        internal: report.internal,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server.kill();
}
