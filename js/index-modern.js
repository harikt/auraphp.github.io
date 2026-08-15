/*
 * The landing page index.
 *
 * This is a port of the logic that shipped inside the Claude Design component
 * (`DCLogic`), rewritten as plain DOM code with two deliberate changes:
 *
 *   1. the package list is read from /packages.json rather than a hardcoded
 *      copy — that file is the index's source of truth, reconciled against
 *      GitHub by _bin/sync-packages.js;
 *   2. no jQuery, so nothing here depends on the Bootstrap-era vendor bundle
 *      that the `site` layout loads.
 */
(function () {
    'use strict';

    var REPO_BASE = 'https://github.com/auraphp/Aura.';

    /* Set by the layout from site.baseurl: empty on auraphp.com, a path prefix
       when the site is published as a GitHub project page. */
    var BASE = window.AURA_BASEURL || '';

    /* Bookdown emits entries for things that are not installable packages. */
    var LISTED_TYPES = ['library', 'interface'];

    var packages = [];
    var latestBranchOf = {};
    var seriesLabels = [];

    var state = {
        series: 'Newest',
        selected: null,
        copied: false,
        copyFailed: false
    };

    var copyTimer = null;

    var el = {
        filter: document.getElementById('series-filter'),
        list: document.getElementById('pkg-list'),
        detail: document.getElementById('pkg-detail'),
        kicker: document.getElementById('detail-kicker'),
        name: document.getElementById('detail-name'),
        description: document.getElementById('detail-description'),
        copyBtn: document.getElementById('copy-btn'),
        copyCmd: document.getElementById('copy-cmd'),
        copyLabel: document.getElementById('copy-label'),
        copyNote: document.getElementById('copy-note'),
        pin: document.getElementById('detail-pin'),
        docs: document.getElementById('detail-docs'),
        releases: document.getElementById('detail-releases'),
        repo: document.getElementById('detail-repo')
    };

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* packages.json descriptions are written in Markdown, and the only markup
       any of them actually uses is the code span. */
    function renderDescription(text) {
        return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    function build(data) {
        Object.keys(data).forEach(function (branch) {
            seriesLabels.push(branch);

            Object.keys(data[branch]).forEach(function (short) {
                var info = data[branch][short];

                if (LISTED_TYPES.indexOf(info.type) === -1) {
                    return;
                }

                /* packages.json is the authority on the Composer name; the
                   derivation is only a fallback for an entry that omits it. */
                var composer = info.composer
                    || ('aura/' + short.toLowerCase().replace(/_/g, '-'));

                packages.push({
                    branch: branch,
                    short: short,
                    type: info.type,
                    version: info.version,
                    /* An untagged N.x branch: real code, but nothing released
                       on it, so it is never what a plain require resolves to. */
                    dev: info.dev === true,
                    description: info.description,
                    name: 'Aura.' + short,
                    composer: composer,
                    repo: info.github || (REPO_BASE + short),
                    releases: (info.github || (REPO_BASE + short)) + '/releases',
                    /* An explicit `docs` wins, for a package that has no
                       bookdown manual built for it yet. Otherwise: 1.x
                       predates the manuals, and interface packages document
                       themselves in their READMEs. */
                    docs: info.docs
                        || ((branch === '1.x' || info.type === 'interface')
                            ? (info.github || (REPO_BASE + short)) + '/tree/' + branch
                            : BASE + '/packages/' + branch + '/' + short)
                });
            });
        });

        /* A dev branch must never count as a package's newest series: it would
           push "Newest of each" at an unreleased branch and hide the release
           people actually want. Tagged series claim the slot first; a dev
           branch only takes it for a package that has no tag at all. */
        packages.forEach(function (pkg) {
            if (!pkg.dev && !latestBranchOf[pkg.short]) {
                latestBranchOf[pkg.short] = pkg.branch;
            }
        });
        packages.forEach(function (pkg) {
            if (!latestBranchOf[pkg.short]) {
                latestBranchOf[pkg.short] = pkg.branch;
            }
        });

        /* Only the newest series of a package is what a bare `composer
           require` resolves to; every older series has to be pinned, or you
           silently install the wrong one. */
        packages.forEach(function (pkg) {
            pkg.isLatest = latestBranchOf[pkg.short] === pkg.branch;

            if (pkg.dev) {
                /* The branch name is the constraint — there is no tag to
                   range over, so `^N.0` would resolve to nothing. */
                pkg.prerelease = true;
                pkg.constraint = ':' + pkg.version;
            } else {
                var major = pkg.version.split('.')[0];
                var dash = pkg.version.indexOf('-');
                var stability = dash > -1
                    ? '@' + pkg.version.slice(dash + 1).replace(/[0-9.]+$/, '')
                    : '';

                pkg.prerelease = stability !== '';
                pkg.constraint = (pkg.isLatest && !stability)
                    ? ''
                    : ':^' + major + '.0' + stability;
            }

            pkg.requireCmd = 'composer require ' + pkg.composer + pkg.constraint;
        });
    }

    function scope() {
        if (state.series === 'Newest') {
            return packages.filter(function (pkg) { return pkg.isLatest; });
        }
        return packages.filter(function (pkg) { return pkg.branch === state.series; });
    }

    function current() {
        var visible = scope();
        var found = null;

        visible.forEach(function (pkg) {
            if (pkg.name === state.selected) {
                found = pkg;
            }
        });

        return found || visible[0] || packages[0] || null;
    }

    function select(name) {
        if (state.selected === name) {
            return;
        }
        state.selected = name;
        renderList();
        renderDetail();
    }

    function renderFilter() {
        var labels = ['Newest'].concat(seriesLabels);

        el.filter.innerHTML = '';

        labels.forEach(function (label) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'series-btn';
            button.textContent = label === 'Newest' ? 'Newest of each' : label;
            button.setAttribute('aria-pressed', String(state.series === label));
            button.addEventListener('click', function () {
                state.series = label;
                /* The previously selected package may not exist on the new
                   series; settle `selected` on whatever current() falls back
                   to, so the list and the detail pane cannot disagree. */
                var settled = current();
                state.selected = settled ? settled.name : null;
                renderFilter();
                renderList();
                renderDetail();
            });
            el.filter.appendChild(button);
        });
    }

    function renderList() {
        var active = current();

        el.list.innerHTML = '';

        scope().forEach(function (pkg, index) {
            var on = active && pkg.name === active.name;

            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'pkg-row';
            button.setAttribute('aria-current', String(!!on));
            button.innerHTML =
                '<span class="pkg-num">' + String(index + 1).padStart(2, '0') + '</span>'
                + '<span class="pkg-name">' + escapeHtml(pkg.name) + '</span>'
                + '<span class="pkg-meta">' + escapeHtml(pkg.version)
                + (pkg.dev ? ' &middot; <span class="pkg-dev">unreleased</span>' : '')
                + (pkg.type === 'interface' ? ' &middot; interface' : '') + '</span>'
                + '<span class="pkg-mark" aria-hidden="true">&rarr;</span>';

            button.addEventListener('click', function () { select(pkg.name); });
            button.addEventListener('mouseenter', function () { select(pkg.name); });
            button.addEventListener('focus', function () { select(pkg.name); });

            var item = document.createElement('li');
            item.appendChild(button);
            el.list.appendChild(item);
        });
    }

    function renderDetail() {
        var pkg = current();

        if (!pkg) {
            el.detail.hidden = true;
            return;
        }

        el.detail.hidden = false;
        el.kicker.textContent = 'Series ' + pkg.branch + ' · Release ' + pkg.version;
        el.name.textContent = pkg.name;
        el.description.innerHTML = renderDescription(pkg.description);

        el.copyCmd.textContent = pkg.requireCmd;
        el.copyBtn.setAttribute('aria-label', 'Copy: ' + pkg.requireCmd);
        el.copyBtn.setAttribute('data-copied', String(state.copied));
        el.copyLabel.textContent = state.copied
            ? 'Copied'
            : state.copyFailed ? 'Select and copy' : 'Copy';
        el.copyNote.textContent = state.copyFailed
            ? 'This browser blocked the clipboard — select the command above and copy it manually.'
            : '';

        if (pkg.dev) {
            var released = latestBranchOf[pkg.short];
            el.pin.textContent = 'Nothing is tagged on this series yet — this installs the '
                + pkg.branch + ' branch as it stands.'
                + (released === pkg.branch
                    ? ' This package has no tagged release at all.'
                    : ' The newest release is on ' + released + '.');
        } else if (!pkg.constraint) {
            el.pin.textContent = 'Newest series; no constraint needed.';
        } else if (pkg.isLatest) {
            el.pin.textContent = 'Only a prerelease exists on this series — the '
                + pkg.constraint.slice(pkg.constraint.indexOf('@'))
                + ' flag is required for Composer to install it.';
        } else {
            el.pin.textContent = 'Pinned to the ' + pkg.branch
                + ' series — without the constraint Composer installs '
                + latestBranchOf[pkg.short] + '.';
        }

        el.docs.href = pkg.docs;
        el.releases.href = pkg.releases;
        el.repo.href = pkg.repo;
    }

    function flagCopied() {
        state.copied = true;
        state.copyFailed = false;
        renderDetail();
        clearTimeout(copyTimer);
        copyTimer = setTimeout(function () {
            state.copied = false;
            renderDetail();
        }, 2200);
    }

    function flagCopyFailed() {
        state.copied = false;
        state.copyFailed = true;
        renderDetail();
        clearTimeout(copyTimer);
        copyTimer = setTimeout(function () {
            state.copyFailed = false;
            renderDetail();
        }, 6000);
    }

    function legacyCopy(text) {
        var field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.cssText = 'position:fixed;top:-1000px';
        document.body.appendChild(field);
        field.select();

        var ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (e) {
            ok = false;
        }
        document.body.removeChild(field);

        if (ok) {
            flagCopied();
        } else {
            flagCopyFailed();
        }
    }

    function copy(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(flagCopied, function () {
                legacyCopy(text);
            });
        } else {
            legacyCopy(text);
        }
    }

    function renderStats() {
        var counts = {
            packages: String(Object.keys(latestBranchOf).length),
            series: String(seriesLabels.length)
        };

        Object.keys(counts).forEach(function (key) {
            var spans = document.querySelectorAll('[data-stat="' + key + '"]');
            Array.prototype.forEach.call(spans, function (span) {
                span.textContent = counts[key];
            });
        });

        var note = document.querySelector('[data-stat="series-note"]');
        if (note && seriesLabels.length) {
            note.textContent = 'major series, from ' + seriesLabels[seriesLabels.length - 1]
                + ' to ' + seriesLabels[0] + ', all still reachable and documented';
        }
    }

    function fail(error) {
        el.list.innerHTML = '<li class="index-loading">The package index could not be loaded. '
            + 'It is also on <a href="https://github.com/auraphp">GitHub</a>.</li>';
        if (window.console && console.error) {
            console.error('packages.json', error);
        }
    }

    el.copyBtn.addEventListener('click', function () {
        var pkg = current();
        if (pkg) {
            copy(pkg.requireCmd);
        }
    });

    fetch(BASE + '/packages.json')
        .then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            build(data);
            state.selected = 'Aura.Sql';
            renderStats();
            renderFilter();
            renderList();
            renderDetail();
        })
        .catch(fail);
}());
