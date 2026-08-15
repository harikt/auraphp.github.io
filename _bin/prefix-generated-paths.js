#!/usr/bin/env node
/*
 * Apply site.baseurl to the generated manuals under packages/.
 *
 *   node _bin/prefix-generated-paths.js           report what would change
 *   node _bin/prefix-generated-paths.js --write   apply it
 *
 * Those files are bookdown output, not Jekyll sources: they carry no front
 * matter, so Jekyll copies them through verbatim and their root-absolute
 * hrefs never see Liquid. On auraphp.com that is fine. Published as a project
 * page under a path prefix, every one of them points at the wrong host root.
 *
 * The prefix is read from _config.yml, so on a branch with `baseurl: ""` this
 * is a no-op. It is idempotent — an already-prefixed path is left alone — so
 * it can be re-run after bookdown regenerates the manuals.
 *
 * The real fix is to teach _bookdown/templates/main.php to emit relative
 * paths, which would remove the need for this entirely.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.indexOf('--write') !== -1;
const DIRS = ['packages'];

function baseurl() {
    const config = fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
    const m = /^baseurl:\s*"([^"]*)"/m.exec(config);
    return m ? m[1] : '';
}

const PREFIX = baseurl();

if (!PREFIX) {
    console.log('baseurl is empty — nothing to prefix. (This is expected on master.)');
    process.exit(0);
}

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full, out); }
        else if (entry.name.endsWith('.html')) { out.push(full); }
    });
    return out;
}

/* href="/x" and src="/x" only. Protocol-relative "//cdn" is left alone, and so
   is anything already carrying the prefix. */
const PATTERN = /\b(href|src)="\/(?!\/)/g;

let touched = 0;
let total = 0;

DIRS.forEach(function (dir) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) { return; }

    walk(base, []).forEach(function (file) {
        const before = fs.readFileSync(file, 'utf8');

        /* Jekyll would process a file with front matter; those are sources,
           not generated output, and are handled with Liquid instead. */
        if (before.startsWith('---')) { return; }

        const after = before.replace(PATTERN, function (match, attr, offset) {
            const rest = before.slice(offset + match.length);
            if (rest.startsWith(PREFIX.slice(1) + '/')) { return match; }
            return attr + '="' + PREFIX + '/';
        });

        if (after === before) { return; }

        const n = (after.match(new RegExp('="' + PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/', 'g')) || []).length;
        total += n;
        touched++;
        if (WRITE) { fs.writeFileSync(file, after); }
        console.log('  ' + path.relative(ROOT, file) + '  (' + n + ')');
    });
});

console.log('\nprefix "' + PREFIX + '" — ' + touched + ' files, ' + total + ' paths');
if (!WRITE) { console.log('(report only; pass --write to apply)'); }
