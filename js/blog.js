/* =========================================================
   DİLARA - Blog
   blog.html: kategori filtresi + arama
   blog/<yazi>.html: önceki / sonraki / benzer yazılar
   ========================================================= */
(function () {
  "use strict";
  var Site = window.Site;
  if (!Site) return;

  if (Site.page === "blog") initList();
  if (Site.page === "post") initPost();

  function initList() {
    var grid = document.getElementById("post-list");
    var chips = document.getElementById("post-filters");
    var search = document.getElementById("post-search");
    var state = { cat: "Tümü", q: "" };
    var posts = [];

    Site.load("posts").then(function (list) {
      posts = Site.sortByDate(list);
      var cats = ["Tümü"].concat(Array.from(new Set(posts.map(function (p) { return p.category; }).filter(Boolean))));
      chips.innerHTML = cats.map(function (c) {
        return '<button type="button" class="chip" aria-pressed="' + (c === state.cat) + '">' + Site.esc(c) + "</button>";
      }).join("");
      chips.addEventListener("click", function (e) {
        var b = e.target.closest(".chip");
        if (!b) return;
        state.cat = b.textContent;
        chips.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c === b)); });
        render();
      });
      search.addEventListener("input", function () { state.q = search.value.trim().toLocaleLowerCase("tr"); render(); });
      render();
    }).catch(function (e) { Site.fail(grid, e); });

    function render() {
      var shown = posts.filter(function (p) {
        if (state.cat !== "Tümü" && p.category !== state.cat) return false;
        if (!state.q) return true;
        return (p.title + " " + p.excerpt + " " + p.category).toLocaleLowerCase("tr").indexOf(state.q) > -1;
      });
      grid.innerHTML = shown.length ? shown.map(Site.postCard).join("") : '<p class="empty">Aramana uygun yazı bulunamadı.</p>';
    }
  }

  function initPost() {
    var slug = document.body.getAttribute("data-slug");
    var nav = document.getElementById("post-nav");
    var related = document.getElementById("related");
    var wrap = document.getElementById("related-wrap");

    Site.load("posts").then(function (list) {
      var posts = Site.sortByDate(list);
      var i = posts.findIndex(function (p) { return p.slug === slug; });
      if (i === -1) return;
      var newer = posts[i - 1], older = posts[i + 1];
      var link = function (p, cls, label) {
        return '<a class="' + cls + '" href="' + encodeURIComponent(p.slug) + '.html"><small>' + label + "</small><strong>" + Site.esc(p.title) + "</strong></a>";
      };
      nav.innerHTML = (older ? link(older, "prev", "Önceki yazı") : "") + (newer ? link(newer, "next", "Sonraki yazı") : "");

      var current = posts[i];
      var others = posts.filter(function (p) { return p.slug !== slug; });
      var same = others.filter(function (p) { return p.category === current.category; });
      var pick = same.concat(others.filter(function (p) { return same.indexOf(p) === -1; })).slice(0, 3);
      if (pick.length) {
        related.innerHTML = pick.map(Site.postCard).join("");
        wrap.hidden = false;
      }
    }).catch(function (e) { console.error(e); });
  }
})();
