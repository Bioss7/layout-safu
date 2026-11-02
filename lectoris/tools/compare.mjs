import sharp from "sharp";
import { fileURLToPath } from "node:url";

const file = (relative) => fileURLToPath(new URL(relative, import.meta.url));
async function compare(left, right, output, width) {
  const a = await sharp(left).resize({ width }).png().toBuffer();
  const b = await sharp(right).resize({ width }).png().toBuffer();
  const ma = await sharp(a).metadata();
  const mb = await sharp(b).metadata();
  await sharp({
    create: {
      width: width * 2,
      height: Math.max(ma.height, mb.height),
      channels: 4,
      background: "#eee",
    },
  })
    .composite([
      { input: a, left: 0, top: 0 },
      { input: b, left: width, top: 0 },
    ])
    .png()
    .toFile(output);
}
for (const width of [1920, 390]) {
  await compare(
    file("../figma/reference-" + (width === 1920 ? "desktop" : "mobile") + ".png"),
    file("../screenshots/browser-" + width + ".png"),
    file("../screenshots/comparison-" + width + ".png"),
    width === 1920 ? 960 : 390,
  );
}
const reference = await sharp(file("../figma/reference-mobile.png"))
  .extract({ left: 0, top: 0, width: 390, height: 1078 })
  .png()
  .toBuffer();
await compare(
  reference,
  file("../screenshots/slider-390-anna.png"),
  file("../screenshots/comparison-slider-mobile.png"),
  390,
);
const states = [];
for (const [index, id] of ["anna", "gulnaz", "irina", "dmitry", "alexey"].entries()) {
  const input = await sharp(file("../screenshots/slider-390-" + id + ".png"))
    .extract({ left: 0, top: 490, width: 390, height: 588 })
    .png()
    .toBuffer();
  states.push({ input, left: index * 390, top: 0 });
}
await sharp({ create: { width: 1950, height: 588, channels: 4, background: "#fff" } })
  .composite(states)
  .png()
  .toFile(file("../screenshots/slider-mobile-all.png"));
console.log("Comparison screenshots updated.");
