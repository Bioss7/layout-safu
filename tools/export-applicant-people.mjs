import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

// MCP download_assets добавляет непрозрачный белый фон при экспорте этой группы.
// Собираем один прозрачный PNG по исходным заливкам, геометрии и crop-transform Figma.
// Фотографии не ретушируются; результат используется одним picture на странице.
const root = new URL('../', import.meta.url);
const man = (await readFile(new URL('abiturient/figma/source-images/image107.png', root))).toString('base64');
const woman = (await readFile(new URL('abiturient/figma/source-images/image105.png', root))).toString('base64');
for (const [breakpoint, width, height, layers] of [
  [1920, 670, 706, [[114.59375, 0, 554.906433, 698.610779, man, 1, .944227755, 0, .000390016], [0, 122.15625, 396.301819, 582.845581, woman, .760878503, .839219093, .137070447, .068044797]]],
  [390, 440, 463, [[75, 0, 365, 459, man, 1, .944227755, 0, .000390016], [0, 80, 260, 383, woman, .760878503, .839219093, .137070447, .068044797]]],
]) {
  const parts = layers.map(([x, y, w, h, data, scaleX, scaleY, offsetX, offsetY], index) => `<defs><clipPath id="c${index}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#c${index})"><image href="data:image/png;base64,${data}" x="${x - offsetX / scaleX * w}" y="${y - offsetY / scaleY * h}" width="${w / scaleX}" height="${h / scaleY}" preserveAspectRatio="none"/></g>`).join('');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts}</svg>`)).png().toFile(fileURLToPath(new URL(`abiturient/assets/img/hero/hero-people-${breakpoint}.png`, root)));
}
