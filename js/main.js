/* =========================================================
   DİLARA - Ortak JavaScript
   Menü, tema, üst/alt bilgi ve Ana Sayfa / Hakkımda / İletişim içerikleri.
   Menüye sayfa eklemek/çıkarmak için sadece NAV listesini düzenle.
   ========================================================= */
(function () {
  "use strict";

  var T = window.PostTemplate;
  var body = document.body;
  var ROOT = body.getAttribute("data-root") || "";
  var PAGE = body.getAttribute("data-page") || "";

  var NAV = [
    { href: "index.html", label: "Ana Sayfa", page: "home" },
    { href: "about.html", label: "Hakkımda", page: "about" },
    { href: "blog.html", label: "Blog", page: "blog" },
    { href: "gallery.html", label: "Galeri", page: "gallery" },
    { href: "projects.html", label: "Projelerim", page: "projects" },
    { href: "notes.html", label: "Notlarım", page: "notes" },
    { href: "contact.html", label: "İletişim", page: "contact" }
  ];

  /* ---------- Yardımcılar (diğer dosyalar da kullanır) ---------- */
  var cache = {};
  var Site = {
    root: ROOT,
    page: PAGE,
    esc: T.esc,
    formatDate: T.formatDate,
    img: function (src) { return T.withRoot(src, ROOT); },

    // data/ klasöründen JSON okur
    load: function (name) {
      if (!cache[name]) {
        cache[name] = fetch(ROOT + "data/" + name + ".json", { cache: "no-cache" }).then(function (r) {
          if (!r.ok) throw new Error(name + ".json okunamadı (" + r.status + ")");
          return r.json();
        });
      }
      return cache[name];
    },

    fail: function (el, err) {
      if (!el) return;
      var local = location.protocol === "file:";
      el.innerHTML = '<p class="empty">' + (local
        ? "İçerik yüklenemedi. Dosyayı çift tıklayarak açtığın için tarayıcı veri dosyalarını okumaya izin vermiyor. Siteyi GitHub Pages üzerinden ya da yerel bir sunucuyla aç."
        : "İçerik şu an yüklenemedi. Sayfayı yenilemeyi dene.") + "</p>";
      if (err) console.error(err);
    },

    sortByDate: function (list) {
      return list.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    },

    postCard: function (p) {
      var href = ROOT + "blog/" + encodeURIComponent(p.slug) + ".html";
      return '<article class="post-card">' +
        '<div class="post-card__img">' + (p.cover ? '<img src="' + Site.esc(Site.img(p.cover)) + '" alt="" loading="lazy">' : "") + "</div>" +
        '<div class="post-card__body">' +
        '<div class="post-card__meta"><span class="tag">' + Site.esc(p.category) + '</span><time datetime="' + Site.esc(p.date) + '">' + Site.esc(Site.formatDate(p.date)) + "</time></div>" +
        '<h3><a href="' + href + '">' + Site.esc(p.title) + "</a></h3>" +
        "<p>" + Site.esc(p.excerpt) + "</p>" +
        '<a class="text-link" href="' + href + '" tabindex="-1" aria-hidden="true">Devamını oku</a>' +
        "</div></article>";
    },

    noteCard: function (n) {
      var p = String(n.date).split("-");
      var mon = T.formatDate(n.date).split(" ")[1] || "";
      return '<article class="note">' +
        '<div class="note-date"><strong>' + parseInt(p[2], 10) + "</strong><span>" + Site.esc(mon) + "</span></div>" +
        "<div>" + (n.type ? '<div class="note-type">' + Site.esc(n.type) + "</div>" : "") +
        "<p>" + Site.esc(n.text) + "</p></div></article>";
    },

    // Kaydırınca yumuşak beliren bloklar
    reveal: function (scope) {
      var els = (scope || document).querySelectorAll(".reveal:not(.is-visible)");
      if (!("IntersectionObserver" in window)) {
        els.forEach(function (el) { el.classList.add("is-visible"); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px" });
      els.forEach(function (el) { io.observe(el); });
    }
  };
  window.Site = Site;

  /* ---------- Üst menü ---------- */
  function renderHeader() {
    var holder = document.getElementById("site-header");
    if (!holder) return;
    var current = PAGE === "post" ? "blog" : PAGE;
    var links = NAV.map(function (n) {
      return '<li><a href="' + ROOT + n.href + '"' + (n.page === current ? ' aria-current="page"' : "") + ">" + n.label + "</a></li>";
    }).join("");
    holder.outerHTML =
      '<header class="site-header" id="top">' +
      '<div class="container header-inner">' +
      '<a class="brand" href="' + ROOT + 'index.html" data-site="brand">DİLARA</a>' +
      '<nav class="site-nav" id="site-nav" aria-label="Ana menü"><ul class="nav-list">' + links + "</ul></nav>" +
      '<div class="header-actions">' +
      '<button class="icon-btn" type="button" id="theme-toggle"></button>' +
      '<button class="icon-btn menu-toggle" type="button" id="menu-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Menüyü aç"><span></span></button>' +
      "</div></div></header>";

    var header = document.querySelector(".site-header");
    var toggle = document.getElementById("menu-toggle");

    function setMenu(open) {
      body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
    }
    toggle.addEventListener("click", function () { setMenu(!body.classList.contains("menu-open")); });
    document.querySelectorAll(".nav-list a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
    window.matchMedia("(min-width: 901px)").addEventListener("change", function (m) { if (m.matches) setMenu(false); });

    function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    initTheme();
  }

  /* ---------- Açık / koyu tema ---------- */
  function initTheme() {
    var btn = document.getElementById("theme-toggle");
    var html = document.documentElement;
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    function current() { return html.getAttribute("data-theme") || (mq.matches ? "dark" : "light"); }
    function paint() {
      var dark = current() === "dark";
      btn.textContent = dark ? "☀️" : "🌙";
      btn.setAttribute("aria-label", dark ? "Açık temaya geç" : "Koyu temaya geç");
    }
    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* gizli sekmede kayıt olmayabilir */ }
      paint();
    });
    mq.addEventListener("change", paint);
    paint();
  }

  /* ---------- Alt bilgi ---------- */
  function renderFooter(site) {
    var holder = document.getElementById("site-footer");
    if (!holder) return;
    var links = ((site && site.contact && site.contact.links) || []).map(function (l) {
      return '<a href="' + Site.esc(T.safeUrl(l.url)) + '" target="_blank" rel="noopener">' + Site.esc(l.label) + "</a>";
    }).join("");
    var name = (site && site.name) || "Dilara";
    holder.outerHTML =
      '<footer class="site-footer"><div class="container footer-inner">' +
      "<p>© " + new Date().getFullYear() + " " + Site.esc(name) + ". " + Site.esc((site && site.slogan) || "") + "</p>" +
      '<div class="footer-links">' + links + '<a href="#top">Yukarı çık</a></div>' +
      "</div></footer>";
  }

  /* ---------- Ana sayfa ---------- */
  function initHome(site) {
    var nameEl = document.getElementById("hero-name");
    if (nameEl) {
      var name = (site.name || "Dilara") + ".";
      nameEl.setAttribute("aria-label", name);
      nameEl.innerHTML = Array.from(name).map(function (ch, i) {
        return '<span class="letter" aria-hidden="true" style="animation-delay:' + (i * 60) + 'ms">' + Site.esc(ch) + "</span>";
      }).join("");
    }
    setText("hero-greeting", site.hero && site.hero.greeting);
    setText("hero-text", site.hero && site.hero.text);
    setText("hero-slogan", site.slogan);
    var photo = document.getElementById("hero-photo");
    if (photo && site.about && site.about.photo) photo.src = Site.img(site.about.photo);

    var latest = document.getElementById("latest-posts");
    if (latest) {
      Site.load("posts").then(function (posts) {
        latest.innerHTML = Site.sortByDate(posts).slice(0, 3).map(Site.postCard).join("") || '<p class="empty">Henüz yazı yok.</p>';
      }).catch(function (e) { Site.fail(latest, e); });
    }
    var notes = document.getElementById("home-notes");
    if (notes) {
      Site.load("notes").then(function (list) {
        notes.innerHTML = Site.sortByDate(list).slice(0, 2).map(Site.noteCard).join("") || '<p class="empty">Henüz not yok.</p>';
      }).catch(function (e) { Site.fail(notes, e); });
    }
  }

  /* ---------- Hakkımda ---------- */
  function initAbout(site) {
    var a = site.about || {};
    var photo = document.getElementById("about-photo");
    if (photo && a.photo) photo.src = Site.img(a.photo);
    setText("about-heading", a.heading);
    var text = document.getElementById("about-text");
    if (text && a.text) {
      text.innerHTML = String(a.text).split(/\n{2,}/).map(function (p) { return "<p>" + Site.esc(p).replace(/\n/g, "<br>") + "</p>"; }).join("");
    }
    var lists = document.getElementById("about-lists");
    if (lists) {
      lists.innerHTML = (a.sections || []).filter(function (s) { return s.items && s.items.length; }).map(function (s) {
        return '<div class="about-box"><h3>' + Site.esc(s.title) + "</h3><ul>" +
          s.items.map(function (i) { return "<li>" + Site.esc(i) + "</li>"; }).join("") + "</ul></div>";
      }).join("");
    }
  }

  /* ---------- İletişim ---------- */
  function initContact(site) {
    var c = site.contact || {};
    setText("contact-intro", c.intro);
    var mail = document.getElementById("contact-mail");
    if (mail) {
      if (c.email) { mail.href = "mailto:" + c.email; mail.textContent = c.email; }
      else mail.hidden = true;
    }
    var links = document.getElementById("contact-links");
    if (links) {
      links.innerHTML = (c.links || []).map(function (l) {
        var shown = String(l.url).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
        return '<a class="contact-link" href="' + Site.esc(T.safeUrl(l.url)) + '" target="_blank" rel="noopener">' +
          "<span>" + Site.esc(l.label) + "<br><small>" + Site.esc(shown) + "</small></span><span aria-hidden=\"true\">↗</span></a>";
      }).join("");
    }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  /* ---------- Başlat ---------- */
  renderHeader();
  Site.ready = Site.load("site").then(function (site) {
    Site.data = site;
    var brand = document.querySelector('[data-site="brand"]');
    if (brand && site.brand) brand.textContent = site.brand;
    renderFooter(site);
    if (PAGE === "home") initHome(site);
    if (PAGE === "about") initAbout(site);
    if (PAGE === "contact") initContact(site);
    return site;
  }).catch(function (e) {
    renderFooter(null);
    console.error(e);
    return {};
  });
  Site.reveal();
})();
