/* =========================================================
   DİLARA - Projelerim
   Projeler data/projects.json dosyasından (veya admin panelinden) gelir.
   ========================================================= */
(function () {
  "use strict";
  var Site = window.Site;
  var list = document.getElementById("project-list");
  if (!list) return;

  Site.load("projects").then(function (projects) {
    list.innerHTML = projects.length ? projects.map(function (p) {
      var tech = (p.tech || []).map(function (t) { return "<li>" + Site.esc(t) + "</li>"; }).join("");
      var link = p.link
        ? '<a class="btn btn--ghost" href="' + Site.esc(window.PostTemplate.safeUrl(p.link)) + '" target="_blank" rel="noopener">Projeyi gör</a>'
        : '<span class="muted">Bağlantı yakında eklenecek.</span>';
      return '<article class="project">' +
        '<div class="project__img">' + (p.image ? '<img src="' + Site.esc(Site.img(p.image)) + '" alt="' + Site.esc(p.title) + '" loading="lazy">' : "") + "</div>" +
        '<div class="project__body"><h2>' + Site.esc(p.title) + "</h2>" +
        "<p>" + Site.esc(p.description) + "</p>" +
        (tech ? '<ul class="tech" aria-label="Kullanılanlar">' + tech + "</ul>" : "") +
        "<div>" + link + "</div></div></article>";
    }).join("") : '<p class="empty">Henüz proje eklenmedi.</p>';
  }).catch(function (e) { Site.fail(list, e); });
})();
