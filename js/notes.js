/* =========================================================
   DİLARA - Notlarım
   Notlar tarihe göre (en yeni üstte) ve aylara ayrılarak listelenir.
   ========================================================= */
(function () {
  "use strict";
  var Site = window.Site;
  var list = document.getElementById("notes-list");
  if (!list) return;

  Site.load("notes").then(function (notes) {
    var sorted = Site.sortByDate(notes);
    if (!sorted.length) { list.innerHTML = '<p class="empty">Henüz not yok.</p>'; return; }
    var html = "", month = "";
    sorted.forEach(function (n) {
      var parts = Site.formatDate(n.date).split(" ");
      var m = parts[1] + " " + parts[2];
      if (m !== month) { month = m; html += '<h2 class="note-month">' + Site.esc(m) + "</h2>"; }
      html += Site.noteCard(n);
    });
    list.innerHTML = html;
  }).catch(function (e) { Site.fail(list, e); });
})();
