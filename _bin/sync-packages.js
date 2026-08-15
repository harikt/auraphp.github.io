#!/usr/bin/env node
/*
 * Reconcile packages.json with what is actually tagged on GitHub.
 *
 *   node _bin/sync-packages.js                    report the drift, change nothing
 *   node _bin/sync-packages.js --write            apply it
 *   node _bin/sync-packages.js --add Aura.Acl     adopt a package the index
 *                                                 has never listed (add --write
 *                                                 to persist it)
 *
 * A release-manager tool, not part of the site build. Needs `gh` on PATH and
 * authenticated (`gh auth status`); everything is read through the GitHub API,
 * which is the org's own source of truth for what exists.
 *
 * Rules it applies:
 *   - a series with tagged releases is listed at its newest tag;
 *   - a series that exists only as an N.x branch is listed as that branch with
 *     "dev": true, so the site can badge it instead of implying a release;
 *   - an entry whose bookdown manual has not been built gets an explicit
 *     "docs" pointing at the GitHub branch, so no Documentation link 404s.
 *
 * It never invents a package: only repos already named in packages.json, plus
 * the WATCH list below, are considered. Anything else in the org is reported
 * as unlisted so a human can decide.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'packages.json');
const WRITE = process.argv.indexOf('--write') !== -1;

/* Repos named by --add. Their identity is read from the repo's own
   composer.json, so nothing about a new package is typed here by hand. */
const ADD = process.argv.reduce(function (acc, arg, i) {
    if (arg === '--add' && process.argv[i + 1]) { acc.push(process.argv[i + 1]); }
    return acc;
}, []);

/* Org repos that are deliberately not part of the package index: the site
   itself, tooling, and packages that have been abandoned. Listing them here
   keeps them out of the "not in the index" report, so that report stays a
   list of real decisions rather than known noise. */
const NOT_PACKAGES = [
    'auraphp.github.io',
    'bin',
    'system',
    'Example.Testing',
    'installer-default',
    'installer-system',
    'Aura.SqlMapper_Bundle'   // abandoned
];

/* Package classes that are no longer maintained. Entries already in
   packages.json keep their recorded version, but the sync neither bumps them
   nor discovers new series for them — an abandoned line should not grow a
   fresh dev branch on the site every time someone pushes to it. Remove a type
   from this list to bring that class back under sync. */
const ABANDONED_TYPES = ['kernel', 'bundle', 'framework'];

function gh(endpoint) {
    try {
        return JSON.parse(execFileSync('gh', ['api', '--paginate', endpoint], {
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024
        }));
    } catch (e) {
        return null;
    }
}

/* Sorts release-first: 2.0.0 outranks 2.0.0-beta1. */
function cmp(a, b) {
    const am = a.split('-'), bm = b.split('-');
    const an = am[0].split('.').map(Number), bn = bm[0].split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((an[i] || 0) !== (bn[i] || 0)) { return (an[i] || 0) - (bn[i] || 0); }
    }
    if (!am[1] && bm[1]) { return 1; }
    if (am[1] && !bm[1]) { return -1; }
    if (!am[1] && !bm[1]) { return 0; }
    return am[1] < bm[1] ? -1 : am[1] > bm[1] ? 1 : 0;
}

const local = JSON.parse(fs.readFileSync(FILE, 'utf8'));

/* Newest-series metadata per package, to seed any entry we have to invent. */
const meta = {};
Object.keys(local).forEach(function (branch) {
    Object.keys(local[branch]).forEach(function (short) {
        const info = local[branch][short];
        if (!meta[short]) {
            meta[short] = {
                type: info.type,
                composer: info.composer,
                github: info.github,
                description: info.description
            };
        }
    });
});
function ghRaw(endpoint) {
    const res = gh(endpoint);
    if (!res || !res.content) { return null; }
    return Buffer.from(res.content, res.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
}

/* The site's `type` is its own vocabulary — library, interface, bundle,
   kernel, project, framework — and the repo naming convention carries it.
   Composer's own `type` only tells library from project, so it is the last
   resort. Only library, interface and bundle are shown in the index; the rest
   are recorded but not listed. */
function siteType(repo, composerType) {
    if (/_Interface$/.test(repo)) { return 'interface'; }
    if (/_Bundle$/.test(repo)) { return 'bundle'; }
    if (/_Kernel$/.test(repo)) { return 'kernel'; }
    if (/_Project$/.test(repo)) { return 'project'; }
    if (/_Demo$/.test(repo) || repo === 'Aura.Framework') { return 'framework'; }
    return composerType === 'project' ? 'project' : 'library';
}

const repos = gh('orgs/auraphp/repos?per_page=100');
if (!repos) {
    console.error('gh failed — is it installed and authenticated? (gh auth status)');
    process.exit(1);
}

/* Private repos are visible to an authenticated member and to nobody else, so
   they must never reach a public index — and must not be reported as an
   omission either, or every maintainer run nags about a deliberate secret. */
const repoNames = repos
    .filter(r => !r.private)
    .map(r => r.name)
    .filter(n => NOT_PACKAGES.indexOf(n) === -1);
const unlisted = [];
const adopted = [];

ADD.forEach(function (arg) {
    /* Accept "Aura.Acl", "Acl" or "aura/acl" — whichever the maintainer has
       in front of them. */
    const guess = arg.replace(/^aura\//i, '').replace(/^Aura\./, '').replace(/-/g, '_');
    const repo = repoNames.find(n => n.toLowerCase() === ('aura.' + guess).toLowerCase())
        || repoNames.find(n => n.toLowerCase() === guess.toLowerCase());

    if (!repo) {
        console.error('--add ' + arg + ': no such repo in the auraphp org.');
        console.error('  candidates: ' + repoNames.filter(n => !meta[n.replace(/^Aura\./, '')]).join(', '));
        process.exit(1);
    }

    const short = repo.replace(/^Aura\./, '');
    if (meta[short]) {
        console.error('--add ' + arg + ': ' + repo + ' is already in the index; a plain run will pick up its versions.');
        process.exit(1);
    }

    let composerJson = {};
    const raw = ghRaw('repos/auraphp/' + repo + '/contents/composer.json');
    if (raw) {
        try { composerJson = JSON.parse(raw); } catch (e) { /* fall through to defaults */ }
    }

    const repoMeta = repos.find(r => r.name === repo) || {};
    const description = composerJson.description || repoMeta.description;

    if (!composerJson.name) {
        console.error('--add ' + arg + ': ' + repo + ' has no readable composer.json "name".');
        console.error('  It may not be a Composer package. Add it by hand if it really belongs here.');
        process.exit(1);
    }
    if (!description) {
        console.error('--add ' + arg + ': no description in composer.json or on the repo. Add one there first.');
        process.exit(1);
    }

    meta[short] = {
        type: siteType(repo, composerJson.type),
        composer: composerJson.name,
        github: 'https://github.com/auraphp/' + repo,
        description: description.replace(/\s+/g, ' ').trim()
    };
    adopted.push({
        repo: repo,
        short: short,
        line: repo + '  ->  ' + meta[short].composer + '  [' + meta[short].type + ']'
    });
});

/* short name -> { major: {version, dev} } */
const want = {};

repoNames.forEach(function (repo) {
    const short = repo.replace(/^Aura\./, '');
    if (!meta[short]) {
        unlisted.push(repo);
        return;
    }

    const tags = gh('repos/auraphp/' + repo + '/tags?per_page=100') || [];
    const branches = gh('repos/auraphp/' + repo + '/branches?per_page=100') || [];

    const byMajor = {};
    tags.forEach(function (t) {
        const v = t.name.replace(/^v/, '');
        if (!/^\d+\.\d+/.test(v)) { return; }
        const major = v.split('.')[0];
        if (!byMajor[major] || cmp(v, byMajor[major]) > 0) { byMajor[major] = v; }
    });

    const devBranches = {};
    branches.forEach(function (b) {
        const m = /^(\d+)\.x$/.exec(b.name);
        if (m) { devBranches[m[1]] = m[1] + '.x-dev'; }
    });

    want[short] = {};
    new Set(Object.keys(byMajor).concat(Object.keys(devBranches))).forEach(function (major) {
        want[short][major] = byMajor[major]
            ? { version: byMajor[major], dev: false }
            : { version: devBranches[major], dev: true };
    });
});

function hasManual(branch, short) {
    const base = path.join(ROOT, 'packages', branch, short);
    return fs.existsSync(base) || fs.existsSync(base + '.html');
}

const bumps = [], toDev = [], adds = [], orphans = [], frozen = [];

Object.keys(local).forEach(function (branch) {
    const major = branch.split('.')[0];
    Object.keys(local[branch]).forEach(function (short) {
        const info = local[branch][short];
        if (ABANDONED_TYPES.indexOf(info.type) !== -1) {
            frozen.push(branch + ' ' + short + ' (' + info.type + ')');
            return;
        }
        const target = (want[short] || {})[major];
        if (!target) {
            orphans.push(branch + ' ' + short + ' (' + info.version + ')');
            return;
        }
        if (target.dev && !info.dev) {
            toDev.push({ branch, short, from: info.version, to: target.version });
        } else if (!target.dev && cmp(target.version, info.version) > 0) {
            bumps.push({ branch, short, from: info.version, to: target.version });
        }
    });
});

Object.keys(want).forEach(function (short) {
    if (ABANDONED_TYPES.indexOf(meta[short].type) !== -1) { return; }
    Object.keys(want[short]).forEach(function (major) {
        const branch = major + '.x';
        if (local[branch] && local[branch][short]) { return; }
        adds.push(Object.assign({ branch, short }, want[short][major]));
    });
});

function report(title, rows, fmt) {
    console.log('\n== ' + title + ' (' + rows.length + ')');
    rows.forEach(r => console.log('   ' + fmt(r)));
}

/* An adopted repo with no tag and no N.x branch has nothing to list. Writing
   it would leave a package in the index that names no version at all. */
adopted.forEach(function (a) {
    if (Object.keys(want[a.short] || {}).length === 0) {
        console.error('--add ' + a.repo + ': nothing to list — the repo has no tags and no N.x branch.');
        console.error('  Tag a release, or push a version branch, then run --add again.');
        process.exit(1);
    }
});

report('adopted by --add', adopted, a => a.line);
report('version bumps', bumps, b => b.branch.padEnd(5) + b.short.padEnd(18) + b.from + '  ->  ' + b.to);
report('corrected to a dev branch — no such tag exists', toDev,
    b => b.branch.padEnd(5) + b.short.padEnd(18) + b.from + '  ->  ' + b.to);
report('new entries', adds, a => a.branch.padEnd(5) + a.short.padEnd(18) + a.version.padEnd(14)
    + (a.dev ? '[dev] ' : '      ') + (hasManual(a.branch, a.short) ? 'manual exists' : 'docs -> github'));
report('listed here, no matching tag or branch on GitHub', orphans, m => m);
report('frozen — abandoned type, left as recorded', frozen, m => m);
report('org repos not in the index', unlisted, r => r);

if (!WRITE) {
    console.log('\n(report only; pass --write to apply)');
    process.exit(0);
}

bumps.forEach(function (b) { local[b.branch][b.short].version = b.to; });
toDev.forEach(function (b) {
    local[b.branch][b.short].version = b.to;
    local[b.branch][b.short].dev = true;
});

adds.forEach(function (a) {
    if (!local[a.branch]) { local[a.branch] = {}; }
    const m = meta[a.short];
    const entry = { type: m.type, version: a.version };
    if (a.dev) { entry.dev = true; }
    entry.github = m.github;
    entry.composer = m.composer;
    entry.description = m.description;
    local[a.branch][a.short] = entry;
});

/* Documentation links: anything without a built manual points at GitHub.
   Interface packages and 1.x already resolve there by rule. */
Object.keys(local).forEach(function (branch) {
    Object.keys(local[branch]).forEach(function (short) {
        const info = local[branch][short];
        if (info.type === 'interface' || branch === '1.x') {
            delete info.docs;
            return;
        }
        if (hasManual(branch, short)) {
            delete info.docs;
        } else {
            info.docs = info.github + '/tree/' + branch;
        }
    });
});

/* Series descending, packages alphabetical within a series, keys in a stable
   order so the diff stays readable. */
const ORDER = ['type', 'version', 'dev', 'github', 'composer', 'docs', 'description'];
const sorted = {};
Object.keys(local)
    .sort((x, y) => parseInt(y, 10) - parseInt(x, 10))
    .forEach(function (branch) {
        sorted[branch] = {};
        Object.keys(local[branch]).sort().forEach(function (short) {
            const info = local[branch][short];
            const clean = {};
            ORDER.forEach(function (k) {
                if (info[k] !== undefined) { clean[k] = info[k]; }
            });
            Object.keys(info).forEach(function (k) {
                if (clean[k] === undefined) { clean[k] = info[k]; }
            });
            sorted[branch][short] = clean;
        });
    });

fs.writeFileSync(FILE, JSON.stringify(sorted, null, 4) + '\n');
console.log('\nwrote ' + FILE);
