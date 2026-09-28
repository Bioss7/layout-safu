const { src, dest, series, parallel, watch } = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const autoprefixer = require('gulp-autoprefixer').default;
const cleanCss = require('gulp-clean-css');
const terser = require('gulp-terser');
const replace = require('gulp-replace');
const del = require('del');
const browserSync = require('browser-sync').create();
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIST = 'dist';
const ORIGINAL = `${DIST}/original`;
const IMG_SRC = 'public/assets/img';

const HTML_FILES = ['*.html', '*.php'];

function clean() {
  return del.deleteAsync([DIST]);
}

function styles() {
  return src('src/scss/style.scss')
    .pipe(sass({ outputStyle: 'expanded' }).on('error', sass.logError))
    .pipe(autoprefixer())
    .pipe(dest(`${ORIGINAL}/css`))
    .pipe(cleanCss({ compatibility: 'ie8' }))
    .pipe(dest(`${DIST}/assets/css`));
}

function accessibility() {
  return src('public/assets/css/accessibility.css')
    .pipe(dest(`${ORIGINAL}/css`))
    .pipe(cleanCss({ compatibility: 'ie8' }))
    .pipe(dest(`${DIST}/assets/css`));
}

function scripts() {
  return src('public/assets/js/*.js')
    .pipe(dest(`${ORIGINAL}/js`))
    .pipe(terser())
    .pipe(dest(`${DIST}/assets/js`));
}

function images() {
  return src([
    `${IMG_SRC}/**/*`,
    `!${IMG_SRC}/optimized/**/*`,
  ], { encoding: false })
    .pipe(dest(`${DIST}/assets/img`));
}

function fonts() {
  return src('public/assets/fonts/**/*', { encoding: false })
    .pipe(dest(`${DIST}/assets/fonts`));
}

function vendor() {
  return src('public/assets/vendor/**/*', { encoding: false })
    .pipe(dest(`${DIST}/assets/vendor`));
}

function html() {
  return src(HTML_FILES)
    .pipe(replace(/\.\.\/public\/assets\//g, 'assets/'))
    .pipe(dest(DIST));
}

function getAllPngFiles(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'webp' && entry.name !== 'optimized') {
        results.push(...getAllPngFiles(path.join(dir, entry.name), rel));
      }
    } else if (entry.name.toLowerCase().endsWith('.png')) {
      results.push(rel);
    }
  }
  return results;
}

async function webp() {
  const files = getAllPngFiles(IMG_SRC);
  const webpBase = path.join(DIST, 'assets', 'img', 'webp');
  let converted = 0;
  let skipped = 0;

  for (const rel of files) {
    const srcPath = path.join(IMG_SRC, rel);
    const webpOut = path.join(webpBase, rel.replace(/\.png$/i, '.webp'));

    if (fs.existsSync(webpOut) && fs.statSync(webpOut).mtimeMs >= fs.statSync(srcPath).mtimeMs) {
      skipped++;
      continue;
    }

    fs.mkdirSync(path.dirname(webpOut), { recursive: true });

    try {
      await sharp(srcPath)
        .webp({ quality: 95, effort: 4 })
        .toFile(webpOut);
      converted++;
    } catch (err) {
      console.error(`  ERROR: ${rel} — ${err.message}`);
    }
  }

  if (converted) {
    console.log(`webp: ${converted} converted, ${skipped} already up-to-date`);
  }
}

const build = series(
  clean,
  parallel(styles, accessibility, scripts, images, fonts, vendor, html),
  webp,
);

function serve() {
  browserSync.init({
    server: DIST,
    notify: false,
    open: false,
  });

  watch('src/scss/**/*.scss', styles);
  watch('public/assets/css/*.css', accessibility);
  watch('public/assets/js/**/*.js', scripts);
  watch('public/assets/fonts/**/*', fonts);
  watch('public/assets/vendor/**/*', vendor);
  watch('public/assets/img/**/*', series(webp, images));
  watch(HTML_FILES, html);

  watch(path.join(DIST, '**/*')).on('change', browserSync.reload);
}

exports.clean = clean;
exports.styles = styles;
exports.accessibility = accessibility;
exports.scripts = scripts;
exports.images = images;
exports.webp = webp;
exports.fonts = fonts;
exports.vendor = vendor;
exports.html = html;
exports.build = build;
exports.serve = serve;
exports.default = series(build, serve);
