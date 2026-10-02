/* =========================================================
   DİLARA - Galeri ve Lightbox
   Fotoğraflar data/gallery.json dosyasından (veya admin panelinden) gelir.
   ========================================================= */
(function () {
  "use strict";
  var Site = window.Site;
  var CATEGORIES = ["Tümü", "Ben", "Günlük Hayat", "Geziler", "Anılar", "Sevdiğim Yerler", "Diğer"];

  var grid = document.getElementById("gallery-grid");
  var chips = document.getElementById("gallery-filters");
  var box = document.getElementById("lightbox");
  if (!grid || !box) return;

  var imgEl = box.querySelector(".lightbox-stage img");
  var capEl = box.querySelector(".lightbox-caption");
  var countEl = box.querySelector(".lb-count");
  var all = [], shown = [], index = 0, active = "Tümü", lastFocus = null;

  Site.load("gallery").then(function (list) {
    all = list;
    var used = CATEGORIES.filter(function (c) { return c === "Tümü" || all.some(function (g) { return g.category === c; }); });
    chips.innerHTML = used.map(function (c) {
      return '<button type="button" class="chip" aria-pressed="' + (c === active) + '">' + Site.esc(c) + "</button>";
    }).join("");
    chips.addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      active = b.textContent;
      chips.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c === b)); });
      render();
    });
    render();
  }).catch(function (e) { Site.fail(grid, e); });

  function render() {
    shown = all.filter(function (g) { return active === "Tümü" || g.category === active; });
    grid.innerHTML = shown.length ? shown.map(function (g, i) {
      return '<button type="button" class="gallery-item" data-i="' + i + '" aria-label="Fotoğrafı büyüt: ' + Site.esc(g.caption || g.category) + '">' +
        '<img src="' + Site.esc(Site.img(g.src)) + '" alt="' + Site.esc(g.caption || "") + '" loading="lazy">' +
        (g.caption ? "<figcaption>" + Site.esc(g.caption) + "</figcaption>" : "") + "</button>";
    }).join("") : '<p class="empty">Bu kategoride henüz fotoğraf yok.</p>';
  }

  grid.addEventListener("click", function (e) {
    var item = e.target.closest(".gallery-item");
    if (item) open(parseInt(item.getAttribute("data-i"), 10));
  });

  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    box.classList.add("is-open");
    box.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    box.querySelector(".lb-close").focus();
  }
  function close() {
    box.classList.remove("is-open");
    box.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }
  function show(i) {
    index = (i + shown.length) % shown.length;
    var g = shown[index];
    imgEl.src = Site.img(g.src);
    imgEl.alt = g.caption || "";
    capEl.textContent = [g.caption, g.category].filter(Boolean).join(", ");
    countEl.textContent = (index + 1) + " / " + shown.length;
  }

  box.querySelector(".lb-close").addEventListener("click", close);
  box.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1); });
  box.querySelector(".lb-next").addEventListener("click", function () { show(index + 1); });
  box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("lightbox-stage")) close(); });

  document.addEventListener("keydown", function (e) {
    if (!box.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });

  // Telefonda parmakla kaydırma
  var startX = null;
  box.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
})();
