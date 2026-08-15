/*
 * The "On this page" rail on content pages.
 *
 * Built in the browser rather than in Liquid: the site runs on GitHub Pages,
 * which only allows its own whitelisted plugins, so there is no heading-
 * extraction filter available at build time. The headings are already in the
 * HTML, so reading them back out costs nothing.
 *
 * The rail stays hidden unless the page has at least MIN_SECTIONS headings —
 * a contents list of one item is furniture, not navigation.
 */
(function () {
    'use strict';

    var MIN_SECTIONS = 2;

    var rail = document.getElementById('page-rail');
    var list = document.getElementById('rail-list');
    var prose = document.querySelector('.prose');

    /* Without a rail the copy would keep the two-column measure and sit hard
       left. Marking the container lets the stylesheet give the width back —
       the same treatment a page gets when it opts out with `rail: false`. */
    function solo() {
        var body = prose && prose.closest ? prose.closest('.page-body') : null;
        if (body) {
            body.classList.add('page-body-solo');
        }
    }

    if (!rail || !list || !prose) {
        solo();
        return;
    }

    var headings = Array.prototype.slice.call(prose.querySelectorAll('h2, h3'));

    /* An h3 is only worth listing under an h2 — a page that opens straight
       into h3s has no hierarchy to show. */
    var topLevel = headings.filter(function (h) { return h.tagName === 'H2'; });

    if (topLevel.length < MIN_SECTIONS) {
        solo();
        return;
    }

    function slug(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');
    }

    var used = {};
    var links = [];

    headings.forEach(function (heading) {
        /* Some headings already carry an id that is linked from elsewhere —
           contributing.html links to #standards — so never overwrite one. */
        if (!heading.id) {
            var base = slug(heading.textContent) || 'section';
            var id = base;
            var n = 2;
            while (used[id] || document.getElementById(id)) {
                id = base + '-' + n;
                n++;
            }
            heading.id = id;
        }
        used[heading.id] = true;

        var link = document.createElement('a');
        link.href = '#' + heading.id;
        link.textContent = heading.textContent;

        var item = document.createElement('li');
        if (heading.tagName === 'H3') {
            item.className = 'rail-sub';
        }
        item.appendChild(link);
        list.appendChild(item);
        links.push(link);
    });

    rail.hidden = false;

    /* Mark the section currently in view. Guarded because the rail is purely
       decorative without it, and older browsers should not break the page. */
    if (!('IntersectionObserver' in window)) {
        return;
    }

    var visible = {};

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            visible[entry.target.id] = entry.isIntersecting;
        });

        var currentId = null;
        headings.forEach(function (heading) {
            if (visible[heading.id]) {
                currentId = currentId || heading.id;
            }
        });

        /* Past the last heading nothing intersects; keep the last one lit
           rather than clearing the rail entirely. */
        if (currentId) {
            links.forEach(function (link) {
                link.setAttribute('aria-current',
                    link.getAttribute('href') === '#' + currentId ? 'true' : 'false');
            });
        }
    }, { rootMargin: '0px 0px -70% 0px' });

    headings.forEach(function (heading) { observer.observe(heading); });
}());
