import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PROJECT_DIR = path.resolve('.');
const WEBP_QUALITY = 100;
const WEBP_QUALITY_PHOTO = 100;

const PHOTO_PATTERNS = [
  'hero-people', 'technologies-people', 'transport-ecosystem',
  'internship-condition/01', 'internship-condition/02',
  'review-person', 'review-card-person', 'features-bg',
  'hero-bg', 'reminder-bg', 'application-bg', 'directions-bg'
];

function isPhoto(relPath) {
  return PHOTO_PATTERNS.some(p => relPath.includes(p));
}

// Папки изображений каждой страницы: <page>/assets/img и общая assets/img
function getPageImgDirs() {
  return ['', 'main', 'about', 'programs', 'abiturient', 'students']
    .map(page => path.join(PROJECT_DIR, page, 'assets', 'img'))
    .filter(directory => fs.existsSync(directory));
}

function getAllPngFiles(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'optimized' || entry.name === 'webp') continue;
      results.push(...getAllPngFiles(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.png')) {
      results.push(rel);
    }
  }
  return results;
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(1);
}

async function main() {
  const srcDirs = getPageImgDirs();

  if (!srcDirs.length) {
    console.log('Не найдено папок <page>/assets/img и общая assets/img');
    return;
  }

  const stats = [];
  let totalOriginal = 0;
  let totalOptPng = 0;
  let totalWebp = 0;

  for (const srcDir of srcDirs) {
    const outDirRoot = path.join(srcDir, 'optimized');
    const files = getAllPngFiles(srcDir);
    if (!files.length) continue;

    if (!fs.existsSync(outDirRoot)) {
      fs.mkdirSync(outDirRoot, { recursive: true });
    }

    for (const rel of files) {
      const srcPath = path.join(srcDir, rel);
      const relLabel = path.relative(PUBLIC_DIR, srcPath);
      const outDir = path.dirname(path.join(outDirRoot, rel));
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      const pngOut = path.join(outDirRoot, rel);
      const webpOut = path.join(outDirRoot, rel.replace('.png', '.webp'));

      const originalSize = fs.statSync(srcPath).size;
      totalOriginal += originalSize;

      const quality = isPhoto(rel) ? WEBP_QUALITY_PHOTO : WEBP_QUALITY;

      let optPngSize = 0;
      let webpSize = 0;

      try {
        await sharp(srcPath)
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toFile(pngOut);
        optPngSize = fs.statSync(pngOut).size;

        await sharp(srcPath)
          .webp({ quality, effort: 6 })
          .toFile(webpOut);
        webpSize = fs.statSync(webpOut).size;
      } catch (err) {
        console.error(`  ERROR: ${relLabel} — ${err.message}`);
        continue;
      }

      totalOptPng += optPngSize;
      totalWebp += webpSize;

      const savings = ((1 - webpSize / originalSize) * 100).toFixed(0);
      stats.push({
        file: relLabel,
        original: originalSize,
        optPng: optPngSize,
        webp: webpSize,
        savings
      });

      console.log(`  ✓ ${relLabel}  →  PNG: ${formatKB(optPngSize)} KB,  WebP: ${formatKB(webpSize)} KB  (${savings}% saving)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                   СТАТИСТИКА ОПТИМИЗАЦИИ                  ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`${'Файл'.padEnd(52)} ${'Оригинал'.padStart(10)} ${'PNG'.padStart(10)} ${'WebP'.padStart(10)} ${'Экономия'.padStart(8)}`);
  console.log('─'.repeat(92));

  for (const s of stats) {
    console.log(
      `${s.file.padEnd(52)} ` +
      `${formatKB(s.original).padStart(8)} KB ` +
      `${formatKB(s.optPng).padStart(8)} KB ` +
      `${formatKB(s.webp).padStart(8)} KB ` +
      `${(s.savings + '%').padStart(8)}`
    );
  }

  console.log('─'.repeat(92));
  console.log(
    `${'ИТОГО'.padEnd(52)} ` +
    `${formatKB(totalOriginal).padStart(8)} KB ` +
    `${formatKB(totalOptPng).padStart(8)} KB ` +
    `${formatKB(totalWebp).padStart(8)} KB ` +
    `${((1 - totalWebp / totalOriginal) * 100).toFixed(0) + '%'.padStart(7)}`
  );
  console.log(`\nФайлов обработано: ${stats.length}`);
  console.log(`Оригинал:  ${formatKB(totalOriginal)} KB (${(totalOriginal / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Сжатый PNG: ${formatKB(totalOptPng)} KB (${(totalOptPng / 1024 / 1024).toFixed(2)} MB)  — ${((1 - totalOptPng / totalOriginal) * 100).toFixed(0)}% экономии`);
  console.log(`WebP:       ${formatKB(totalWebp)} KB (${(totalWebp / 1024 / 1024).toFixed(2)} MB)  — ${((1 - totalWebp / totalOriginal) * 100).toFixed(0)}% экономии`);
  console.log(`\nЭкономия WebP vs оригинал: ${formatKB(totalOriginal - totalWebp)} KB (${((1 - totalWebp / totalOriginal) * 100).toFixed(0)}%)`);
}

main().catch(console.error);
