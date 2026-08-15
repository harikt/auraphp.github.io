<?php
// default library templates
$library = dirname(__DIR__) . "/vendor/bookdown/bookdown/templates";

// project-specific templates
$project = __DIR__;

// register the templates
$templates = $this->getViewRegistry();
$templates->set("core", "{$library}/core.php");
$templates->set("navheader", "{$library}/navheader.php");
$templates->set("navfooter", "{$library}/navfooter.php");
$templates->set("toc", "{$library}/toc.php");

// The manual this page belongs to, and its sibling pages, for the sidebar.
// An index page lists its own children; a chapter borrows its parent's list,
// so every page of a manual shows the same contents.
$page = $this->page;
$manual = $page->isIndex() ? $page : ($page->hasParent() ? $page->getParent() : null);
$siblings = ($manual && method_exists($manual, 'getChildren')) ? $manual->getChildren() : array();
?>
<!DOCTYPE html>
<html class="no-js" lang="en">
    <head>
        <title>Aura for PHP : <?= $this->page->getTitle(); ?></title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="msapplication-TileColor" content="#ffffff">
        <meta name="msapplication-TileImage" content="/favicon/ms-icon-144x144.png">
        <meta name="theme-color" content="#eaf3fa">

        <link rel="alternate" type="application/atom+xml" title="Atom" href="/blog/atom.xml" />

        <link rel="apple-touch-icon" sizes="57x57" href="/favicon/apple-icon-57x57.png">
        <link rel="apple-touch-icon" sizes="60x60" href="/favicon/apple-icon-60x60.png">
        <link rel="apple-touch-icon" sizes="72x72" href="/favicon/apple-icon-72x72.png">
        <link rel="apple-touch-icon" sizes="76x76" href="/favicon/apple-icon-76x76.png">
        <link rel="apple-touch-icon" sizes="114x114" href="/favicon/apple-icon-114x114.png">
        <link rel="apple-touch-icon" sizes="120x120" href="/favicon/apple-icon-120x120.png">
        <link rel="apple-touch-icon" sizes="144x144" href="/favicon/apple-icon-144x144.png">
        <link rel="apple-touch-icon" sizes="152x152" href="/favicon/apple-icon-152x152.png">
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-icon-180x180.png">
        <link rel="icon" type="image/png" sizes="192x192"  href="/favicon/android-icon-192x192.png">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon/favicon-96x96.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png">
        <link rel="manifest" href="/favicon/manifest.json">

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

        <!--
            The same two stylesheets the Jekyll pages load, so the manuals and
            the rest of the site are one design. No Bootstrap: this template
            used to carry its own copy of the old chrome, which is why the
            manuals kept their old look after the site was redesigned.

            Paths are root-absolute because bookdown output is copied through
            Jekyll verbatim and never sees Liquid. A fork published under a
            path prefix rewrites them with _bin/prefix-generated-paths.js.
        -->
        <link rel="stylesheet" href="/css/broadsheet.css">
        <link rel="stylesheet" href="/css/aura-modern.css">

        <!-- Syntax highlighting for the code samples. The theme paints its own
             background, which css/aura-modern.css neutralises so the block
             keeps the design's own surface colour. -->
        <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/highlight.js/8.5/styles/magula.min.css">
        <script src="//cdnjs.cloudflare.com/ajax/libs/highlight.js/8.5/highlight.min.js"></script>
    </head>

    <body class="modern">

        <header class="site-header">
            <div class="rule-thick"></div>
            <div class="site-header-inner">
                <a href="/"><img class="site-logo" src="/img/aura-logo-black.png" alt="Aura for PHP"></a>
                <p class="site-dateline">Est. 2011 &middot; MIT licence &middot; Composer only</p>
                <nav class="site-nav">
                    <a href="/">Home</a>
                    <a href="/about">About</a>
                    <a href="/packages" class="active">Packages</a>
                    <a href="/framework">Framework</a>
                    <a href="/blog">Blog</a>
                    <a href="/community">Community</a>
                    <a href="/contributing">Contributing</a>
                </nav>
            </div>
            <div class="rule-thin"></div>
        </header>

        <article class="band page docs">
            <div class="page-body">

                <?php if ($siblings) { ?>
                <!-- The manual's own contents. This is what the pages were
                     missing: without it a chapter had only the prev/next row
                     for navigation, and the width beside the copy read as
                     empty rather than as a column. -->
                <nav class="docs-sidebar" aria-label="Manual contents">
                    <p class="rail-label"><?= $manual->getTitle(); ?></p>
                    <ul class="docs-sidebar-list">
                        <?php foreach ($siblings as $sibling) { ?>
                        <li<?= $sibling->getHref() === $page->getHref() ? ' class="is-current"' : ''; ?>>
                            <a href="<?= $sibling->getHref(); ?>"<?= $sibling->getHref() === $page->getHref() ? ' aria-current="page"' : ''; ?>><?= $sibling->getNumberAndTitle(); ?></a>
                        </li>
                        <?php } ?>
                    </ul>
                </nav>
                <?php } ?>

                <!-- bookdown's `core` renders the nav header, the page's own
                     h1, the body, and the nav footer as one block. -->
                <div class="prose">
                    <?php echo $this->render("core"); ?>
                </div>

            </div>
        </article>

        <footer class="site-footer">
            <p class="footer-line">Take only the piece you need.</p>
            <div class="rule-thick" style="margin-bottom:14px"></div>
            <div class="footer-meta">
                <p>&copy; 2011&ndash;<?= date("Y") ?> Aura for PHP</p>
                <p>Index compiled from packages.json</p>
                <p><a href="https://github.com/auraphp">github.com/auraphp</a></p>
            </div>
            <script type="text/javascript">
                var sc_project=9117595;
                var sc_invisible=1;
                var sc_security="b58cd28d";
                var scJsHost = (("https:" == document.location.protocol) ? "https://secure." : "http://www.");
                document.write("<sc"+"ript type='text/javascript' src='" + scJsHost+ "statcounter.com/counter/counter.js'></"+"script>");
            </script>
            <noscript><div class="statcounter"><a
                title="site stats"
                href="http://statcounter.com/free-web-stats/"
                target="_blank"><img class="statcounter"
                src="http://c.statcounter.com/9117595/0/b58cd28d/0/"
                alt="site stats"
            ></a></div></noscript>
        </footer>

        <!-- No page-toc.js here: the sidebar is this page's navigation, and a
             second contents list on the right would be one too many. -->
        <script>hljs.initHighlightingOnLoad();</script>

    </body>
</html>
