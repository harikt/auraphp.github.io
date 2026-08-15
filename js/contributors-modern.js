/*
 * The contributor list on /community.
 *
 * A port of js/contributors.js off jQuery and off the Bootstrap grid classes
 * it emitted (`span3`), so it can run under the `modern` layout, which loads
 * no vendor bundle. Behaviour is otherwise unchanged: read contributors.json,
 * shuffle so the same people are not always first, render them all.
 */
(function () {
    'use strict';

    /* Not `contributors`: that slug belongs to the <h2> above, so the section
       keeps the clean #contributors anchor. */
    /* Set by the layout from site.baseurl: empty on auraphp.com, a path prefix
       when the site is published as a GitHub project page. */
    var BASE = window.AURA_BASEURL || '';

    var mount = document.getElementById('contributors-list');
    if (!mount) {
        return;
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* Fisher-Yates. The original walked the object's key order, which is
       insertion order for string keys, so shuffling the keys is the same
       thing without the intermediate object. */
    function shuffle(list) {
        for (var i = list.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
        }
        return list;
    }

    function render(data) {
        var keys = shuffle(Object.keys(data));

        var note = document.createElement('p');
        note.className = 'contributors-note';
        note.textContent = 'We currently have ' + keys.length
            + ' contributors to the project.';

        var list = document.createElement('ul');
        list.className = 'contributors';

        keys.forEach(function (key) {
            var person = data[key];
            var item = document.createElement('li');
            item.className = 'contributor';
            /* `name` is null for a fair number of GitHub accounts; the login
               is the only thing guaranteed to be there. */
            var label = person.name || key;
            item.innerHTML =
                '<a href="' + escapeHtml(person.html_url) + '" tabindex="-1" aria-hidden="true">'
                + '<img src="' + escapeHtml(person.avatar_url) + '" alt="" width="44" height="44" loading="lazy">'
                + '</a>'
                + '<a lang="en" rel="contact colleague" href="' + escapeHtml(person.html_url) + '">'
                + escapeHtml(label) + '</a>';
            list.appendChild(item);
        });

        mount.innerHTML = '';
        mount.appendChild(note);
        mount.appendChild(list);
    }

    fetch(BASE + '/contributors.json')
        .then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(render)
        .catch(function (error) {
            mount.innerHTML = '<p>The contributor list could not be loaded. '
                + 'They are all on <a href="https://github.com/auraphp">GitHub</a>.</p>';
            if (window.console && console.error) {
                console.error('contributors.json', error);
            }
        });
}());
