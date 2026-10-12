import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve('public');
const DEFAULT_QUALITY = 95;

const args = process.argv.slice(2);
let quality = DEFAULT_QUALITY;

const qualityFlag = args.find(a => a.startsWith('--quality='));
if (qualityFlag) {
  quality = parseInt(qualityFlag.split('=')[1], 10);
  if (isNaN(quality) || quality < 1 || quality > 100) {
    console.error('Quality must be 1-100');
    process.exit(1);
  }
}

// Папки изображений каждой страницы: public/<page>/assets/img
function getPageImgDirs() {
  const dirs = [];
  for (const entry of fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const imgDir = path.join(PUBLIC_DIR, entry.name, 'assets', 'img');
    if (fs.existsSync(imgDir)) dirs.push(imgDir);
  }
  return dirs;
}

function getAllPngFiles(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'webp' || entry.name === 'optimized') continue;
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
    console.log('Не найдено папок public/<page>/assets/img');
    return;
  }

  let totalOriginal = 0;
  let totalWebp = 0;
  let count = 0;

  for (const srcDir of srcDirs) {
    const outDirRoot = path.join(srcDir, 'webp');
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

      const webpOut = path.join(outDirRoot, rel.replace('.png', '.webp'));
      const originalSize = fs.statSync(srcPath).size;
      totalOriginal += originalSize;

      try {
        await sharp(srcPath)
          .webp({ quality, effort: 4 })
          .toFile(webpOut);
      } catch (err) {
        console.error(`  ERROR: ${relLabel} — ${err.message}`);
        continue;
      }

      const webpSize = fs.statSync(webpOut).size;
      totalWebp += webpSize;
      count++;

      const savings = ((1 - webpSize / originalSize) * 100).toFixed(0);
      console.log(`  ${relLabel}  →  ${formatKB(originalSize)} KB → ${formatKB(webpSize)} KB  (${savings}% smaller)`);
    }
  }

  console.log(`\nConverted: ${count} files`);
  console.log(`Original:  ${formatKB(totalOriginal)} KB (${(totalOriginal / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`WebP:      ${formatKB(totalWebp)} KB (${(totalWebp / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Saved:     ${formatKB(totalOriginal - totalWebp)} KB (${((1 - totalWebp / totalOriginal) * 100).toFixed(0)}%)`);
  console.log(`Quality:   ${quality}`);
}

main().catch(console.error);
