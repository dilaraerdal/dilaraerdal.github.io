/* =========================================================
   DİLARA - Ortak şablonlar
   Admin paneli yeni blog yazısı sayfalarını ve sitemap.xml'i
   bu dosyadaki fonksiyonlarla üretir.
   ========================================================= */
(function (global) {
  "use strict";

  // Sitedeki sabit sayfalar (sitemap için)
  var PAGES = ["", "about.html", "blog.html", "gallery.html", "projects.html", "notes.html", "contact.html"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeUrl(url) {
    url = String(url || "").trim();
    if (/^(javascript|data|vbscript):/i.test(url)) return "#";
    return url;
  }

  // Göreli görsel yolunun başına kök klasörü ekler (blog/ içindeki sayfalar için "../")
  function withRoot(src, root) {
    if (!src) return "";
    if (/^(https?:)?\/\//i.test(src) || src.charAt(0) === "/") return src;
    return (root || "") + src;
  }

  function inline(text, root) {
    var s = esc(text);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) {
      return '<img src="' + withRoot(safeUrl(src), root) + '" alt="' + alt + '" loading="lazy">';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, href) {
      var ext = /^https?:/i.test(href);
      return '<a href="' + safeUrl(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return s;
  }

  /* Basit Markdown:
     ## Başlık, ### Alt başlık, **kalın**, *italik*, [bağlantı](url),
     ![açıklama](görsel), - madde, 1. sıralı madde, > alıntı */
  function renderMarkdown(md, root) {
    var blocks = String(md || "").replace(/\r\n/g, "\n").split(/\n{2,}/);
    return blocks.map(function (block) {
      block = block.trim();
      if (!block) return "";
      var lines = block.split("\n");
      var h = block.match(/^(#{1,3})\s+(.+)$/);
      if (h && lines.length === 1) {
        var lvl = h[1].length === 3 ? 3 : 2;
        return "<h" + lvl + ">" + inline(h[2], root) + "</h" + lvl + ">";
      }
      var img = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (img) {
        return '<figure><img src="' + esc(withRoot(safeUrl(img[2]), root)) + '" alt="' + esc(img[1]) + '" loading="lazy">' +
          (img[1] ? "<figcaption>" + esc(img[1]) + "</figcaption>" : "") + "</figure>";
      }
      if (lines.every(function (l) { return /^[-*]\s+/.test(l); })) {
        return "<ul>" + lines.map(function (l) { return "<li>" + inline(l.replace(/^[-*]\s+/, ""), root) + "</li>"; }).join("") + "</ul>";
      }
      if (lines.every(function (l) { return /^\d+[.)]\s+/.test(l); })) {
        return "<ol>" + lines.map(function (l) { return "<li>" + inline(l.replace(/^\d+[.)]\s+/, ""), root) + "</li>"; }).join("") + "</ol>";
      }
      if (lines.every(function (l) { return /^>\s?/.test(l); })) {
        return "<blockquote><p>" + lines.map(function (l) { return inline(l.replace(/^>\s?/, ""), root); }).join("<br>") + "</p></blockquote>";
      }
      return "<p>" + lines.map(function (l) { return inline(l, root); }).join("<br>") + "</p>";
    }).join("\n");
  }

  var MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function formatDate(iso) {
    var p = String(iso || "").split("-");
    if (p.length < 3) return iso || "";
    return parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
  }

  function cleanBase(url) { return String(url || "").replace(/\/+$/, ""); }

  // Tek bir blog yazısı için eksiksiz HTML sayfası üretir (blog/<slug>.html)
  function buildPostPage(post, site) {
    var base = cleanBase(site.siteUrl);
    var url = base + "/blog/" + post.slug + ".html";
    var image = post.cover ? (/^https?:/i.test(post.cover) ? post.cover : base + "/" + post.cover) : base + "/images/og-image.jpg";
    var title = post.title + " | " + (site.name || "Dilara");
    var ld = {
      "@context": "https://schema.org", "@type": "BlogPosting",
      headline: post.title, description: post.excerpt, datePublished: post.date,
      image: image, url: url, author: { "@type": "Person", name: site.name || "Dilara" }
    };
    return [
      "<!DOCTYPE html>",
      '<html lang="tr">',
      "<head>",
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
      "<title>" + esc(title) + "</title>",
      '<meta name="description" content="' + esc(post.excerpt) + '">',
      '<link rel="canonical" href="' + esc(url) + '">',
      '<meta property="og:type" content="article">',
      '<meta property="og:site_name" content="' + esc(site.name || "Dilara") + '">',
      '<meta property="og:title" content="' + esc(post.title) + '">',
      '<meta property="og:description" content="' + esc(post.excerpt) + '">',
      '<meta property="og:url" content="' + esc(url) + '">',
      '<meta property="og:image" content="' + esc(image) + '">',
      '<meta property="og:locale" content="tr_TR">',
      '<meta property="article:published_time" content="' + esc(post.date) + '">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="theme-color" content="#FBFAF7">',
      '<link rel="icon" href="../favicon.svg" type="image/svg+xml">',
      '<link rel="apple-touch-icon" href="../images/apple-touch-icon.png">',
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,400..600,0..100&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">',
      '<link rel="stylesheet" href="../css/style.css">',
      '<link rel="stylesheet" href="../css/responsive.css">',
      "<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>",
      '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, "\\u003c") + "</script>",
      "</head>",
      '<body data-page="post" data-root="../" data-slug="' + esc(post.slug) + '">',
      '<a class="skip-link" href="#icerik">İçeriğe geç</a>',
      '<div id="site-header"></div>',
      '<main id="icerik">',
      '  <article class="container">',
      '    <header class="article-head article">',
      '      <div class="post-card__meta"><span class="tag">' + esc(post.category) + '</span><time datetime="' + esc(post.date) + '">' + esc(formatDate(post.date)) + "</time></div>",
      "      <h1>" + esc(post.title) + "</h1>",
      '      <p class="muted">' + esc(post.excerpt) + "</p>",
      "    </header>",
      post.cover ? '    <figure class="article-cover"><img src="' + esc(withRoot(post.cover, "../")) + '" alt="' + esc(post.title) + '"></figure>' : "",
      '    <div class="article prose">',
      renderMarkdown(post.body, "../"),
      "    </div>",
      '    <nav class="article post-nav" id="post-nav" aria-label="Diğer yazılar"></nav>',
      "  </article>",
      '  <section class="section" id="related-wrap" hidden>',
      '    <div class="container">',
      '      <div class="section-head"><h2>Benzer yazılar</h2><a class="text-link" href="../blog.html">Tüm yazılar</a></div>',
      '      <div class="post-grid" id="related"></div>',
      "    </div>",
      "  </section>",
      "</main>",
      '<div id="site-footer"></div>',
      '<script src="../js/post-template.js"></script>',
      '<script src="../js/main.js"></script>',
      '<script src="../js/blog.js"></script>',
      "</body>",
      "</html>",
      ""
    ].filter(function (l) { return l !== ""; }).join("\n") + "\n";
  }

  function buildSitemap(site, posts) {
    var base = cleanBase(site.siteUrl);
    var today = new Date().toISOString().slice(0, 10);
    var urls = PAGES.map(function (p) {
      return "  <url><loc>" + esc(base + "/" + p) + "</loc><lastmod>" + today + "</lastmod></url>";
    });
    (posts || []).forEach(function (p) {
      urls.push("  <url><loc>" + esc(base + "/blog/" + p.slug + ".html") + "</loc><lastmod>" + esc(p.date) + "</lastmod></url>");
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join("\n") + "\n</urlset>\n";
  }

  function buildRobots(site) {
    return "User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: " + cleanBase(site.siteUrl) + "/sitemap.xml\n";
  }

  // Türkçe karakterleri dönüştürerek adres uyumlu kısa ad üretir
  function slugify(text) {
    var map = { "ç": "c", "ğ": "g", "ı": "i", "İ": "i", "ö": "o", "ş": "s", "ü": "u", "Ç": "c", "Ğ": "g", "Ö": "o", "Ş": "s", "Ü": "u", "â": "a", "î": "i", "û": "u" };
    return String(text || "").replace(/[çğıİöşüÇĞÖŞÜâîû]/g, function (c) { return map[c]; })
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  }

  var api = {
    PAGES: PAGES, esc: esc, renderMarkdown: renderMarkdown, formatDate: formatDate, withRoot: withRoot,
    buildPostPage: buildPostPage, buildSitemap: buildSitemap, buildRobots: buildRobots, slugify: slugify, safeUrl: safeUrl
  };
  global.PostTemplate = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
