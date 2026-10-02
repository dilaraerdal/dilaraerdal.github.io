/* =========================================================
   DİLARA - Yönetim paneli
   Sunucu gerektirmez: değişiklikleri GitHub API üzerinden doğrudan
   depoya kaydeder. GitHub Pages siteyi ~1 dakika içinde günceller.
   Erişim anahtarı yalnızca bu tarayıcıda tutulur ve sadece
   api.github.com adresine gönderilir.
   ========================================================= */
(function () {
  "use strict";

  const T = window.PostTemplate;
  const esc = T.esc;
  const $ = (id) => document.getElementById(id);
  const KEY = "dilara-admin";
  const NOTE_TYPES = ["Bugün öğrendiğim şey", "Bugün kendime şunu söyledim", "Unutmamam gerekenler", "İleride yapmak istediklerim"];
  const GALLERY_CATS = ["Ben", "Günlük Hayat", "Geziler", "Anılar", "Sevdiğim Yerler", "Diğer"];
  const ROOT_PAGES = ["index.html", "about.html", "blog.html", "gallery.html", "projects.html", "notes.html", "contact.html", "404.html"];

  let cfg = null;
  let state = { site: null, posts: [], notes: [], gallery: [], projects: [] };
  let tab = "posts";
  let dirty = false;
  let pending = {};          // seçilen ama henüz yüklenmemiş görseller
  const previews = {};       // bu oturumda yüklenen görsellerin önizlemeleri
  const main = $("admin-main");

  /* ---------------- Yardımcılar ---------------- */
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const byDate = (list) => list.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const src = (path) => previews[path] || path || "";
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function toB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromB64(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  let toastTimer;
  function toast(msg, isError) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("is-error", !!isError);
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), isError ? 7000 : 4000);
  }
  function busy(on, text) {
    $("busy").hidden = !on;
    if (text) $("busy-text").textContent = text;
  }

  /* ---------------- GitHub API ---------------- */
  function explain(status, msg) {
    if (status === 401) return "Erişim anahtarı geçersiz ya da süresi dolmuş. Çıkış yapıp yeni anahtarla giriş yap.";
    if (status === 403) return "Anahtarın bu depoya yazma izni yok. Anahtar ayarlarında Contents iznini 'Read and write' yap." + (msg ? " (" + msg + ")" : "");
    if (status === 404) return "Depo bulunamadı. Kullanıcı adını, depo adını ve anahtarın bu depoya erişimi olduğunu kontrol et.";
    return "GitHub kaydedemedi (" + status + "): " + (msg || "bilinmeyen hata");
  }
  const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

  async function gh(method, path, body) {
    let res;
    try {
      res = await fetch("https://api.github.com/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) + path, {
        method,
        cache: "no-store",
        headers: Object.assign({
          Authorization: "Bearer " + cfg.token,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }, body ? { "Content-Type": "application/json" } : {}),
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new Error("GitHub'a bağlanılamadı. İnternet bağlantını kontrol et.");
    }
    if (method === "GET" && res.status === 404) return null;
    if (!res.ok) {
      let msg = "";
      try { msg = (await res.json()).message || ""; } catch (e) { /* boş yanıt */ }
      const err = new Error(explain(res.status, msg));
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  async function getFile(path) {
    const d = await gh("GET", "/contents/" + encPath(path) + "?ref=" + encodeURIComponent(cfg.branch));
    if (!d || Array.isArray(d)) return null;
    return { sha: d.sha, text: d.content ? fromB64(d.content) : "" };
  }

  async function putFile(path, content, message, isB64) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = await gh("GET", "/contents/" + encPath(path) + "?ref=" + encodeURIComponent(cfg.branch));
      const body = { message, content: isB64 ? content : toB64(content), branch: cfg.branch };
      if (cur && cur.sha) body.sha = cur.sha;
      try {
        return await gh("PUT", "/contents/" + encPath(path), body);
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && attempt === 0) continue; // aynı anda değişmişse bir kez daha dene
        throw e;
      }
    }
  }

  async function deleteFile(path, message) {
    const cur = await gh("GET", "/contents/" + encPath(path) + "?ref=" + encodeURIComponent(cfg.branch));
    if (!cur || !cur.sha) return;
    await gh("DELETE", "/contents/" + encPath(path), { message, sha: cur.sha, branch: cfg.branch });
  }

  async function readJSON(name, fallback) {
    const f = await getFile("data/" + name + ".json");
    if (!f) return fallback;
    try { return JSON.parse(f.text); } catch (e) { throw new Error("data/" + name + ".json dosyası bozuk. GitHub'da dosyayı kontrol et."); }
  }
  const writeJSON = (name, data, msg) => putFile("data/" + name + ".json", JSON.stringify(data, null, 2) + "\n", msg);

  /* ---------------- Görseller ---------------- */
  function resizeImage(file, max = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (file.type && !/^image\//.test(file.type)) return reject(new Error(file.name + " bir fotoğraf dosyası değil."));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const data = c.toDataURL("image/jpeg", quality);
        resolve({ b64: data.split(",")[1], preview: data });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(file.name + " açılamadı. JPG veya PNG bir fotoğraf dene.")); };
      img.src = url;
    });
  }
  async function uploadImage(image, name) {
    const path = "images/uploads/" + today().replace(/-/g, "") + "-" + (T.slugify(name) || "foto") + "-" + Math.random().toString(36).slice(2, 6) + ".jpg";
    await putFile(path, image.b64, "Görsel yüklendi: " + path, true);
    previews[path] = image.preview;
    return path;
  }
  function bindImagePicker(inputId, previewId, key) {
    $(inputId).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        pending[key] = await resizeImage(file);
        const img = $(previewId);
        img.src = pending[key].preview;
        img.hidden = false;
        dirty = true;
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------------- Kaydetme akışı ---------------- */
  async function run(steps, okMsg) {
    busy(true);
    try {
      for (let i = 0; i < steps.length; i++) {
        $("busy-text").textContent = steps[i][0] + (steps.length > 1 ? " (" + (i + 1) + "/" + steps.length + ")" : "");
        await steps[i][1]();
      }
      dirty = false;
      toast(okMsg || "Yayınlandı. Değişiklikler 1-2 dakika içinde sitede görünür.");
      return true;
    } catch (e) {
      console.error(e);
      toast(e.message || "Kaydedilemedi. Tekrar dene.", true);
      return false;
    } finally {
      busy(false);
    }
  }

  /* ---------------- Giriş / çıkış ---------------- */
  function readCfg() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!c) return null;
      if (!c.token) c.token = sessionStorage.getItem(KEY + "-token") || "";
      return c;
    } catch (e) { return null; }
  }
  function storeCfg(c, remember) {
    try {
      const base = { owner: c.owner, repo: c.repo, branch: c.branch };
      localStorage.setItem(KEY, JSON.stringify(remember ? Object.assign(base, { token: c.token }) : base));
      if (remember) sessionStorage.removeItem(KEY + "-token");
      else sessionStorage.setItem(KEY + "-token", c.token);
    } catch (e) { /* depolama kapalıysa her seferinde giriş gerekir */ }
  }
  function forgetToken() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || "null");
      if (c) { delete c.token; localStorage.setItem(KEY, JSON.stringify(c)); }
      sessionStorage.removeItem(KEY + "-token");
    } catch (e) { /* yok say */ }
  }

  async function connect(c) {
    cfg = c;
    const repo = await gh("GET", "");
    if (!repo) throw new Error(explain(404));
    const br = await gh("GET", "/branches/" + encodeURIComponent(c.branch));
    if (!br) throw new Error("\"" + c.branch + "\" adlı dal bulunamadı. Genellikle main olur.");
    await reloadAll();
  }
  async function reloadAll() {
    const [site, posts, notes, gallery, projects] = await Promise.all([
      readJSON("site", null), readJSON("posts", []), readJSON("notes", []), readJSON("gallery", []), readJSON("projects", [])
    ]);
    if (!site) throw new Error("Depoda data/site.json bulunamadı. Önce site dosyalarının tamamını depoya yükle.");
    state = { site, posts, notes, gallery, projects };
  }
  function showPanel() {
    $("login-view").hidden = true;
    $("panel-view").hidden = false;
    render();
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = {
      owner: $("l-owner").value.trim(),
      repo: $("l-repo").value.trim(),
      branch: $("l-branch").value.trim() || "main",
      token: $("l-token").value.trim()
    };
    $("login-error").textContent = "";
    busy(true, "Bağlanılıyor");
    try {
      await connect(c);
      storeCfg(c, $("l-remember").checked);
      showPanel();
    } catch (err) {
      $("login-error").textContent = err.message;
    } finally { busy(false); }
  });

  $("logout").addEventListener("click", () => {
    if (dirty && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Çıkış yapılsın mı?")) return;
    forgetToken();
    location.reload();
  });

  (async function init() {
    const saved = readCfg();
    const host = location.hostname;
    if (saved) {
      $("l-owner").value = saved.owner || "";
      $("l-repo").value = saved.repo || "";
      $("l-branch").value = saved.branch || "main";
    } else if (/\.github\.io$/.test(host)) {
      const owner = host.split(".")[0];
      const seg = location.pathname.split("/")[1];
      $("l-owner").value = owner;
      $("l-repo").value = seg && !/\.html$/.test(seg) ? seg : host;
    }
    if (saved && saved.token) {
      busy(true, "Yükleniyor");
      try { await connect(saved); showPanel(); }
      catch (err) { $("login-error").textContent = err.message; }
      finally { busy(false); }
    }
  })();

  /* ---------------- Sekmeler ---------------- */
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b || b.dataset.tab === tab) return;
    if (dirty && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?")) return;
    tab = b.dataset.tab;
    render();
  });
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  main.addEventListener("input", () => { dirty = true; });

  function render(view, arg) {
    dirty = false;
    pending = {};
    document.querySelectorAll("#tabs [data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === tab)));
    const views = { posts: viewPosts, postEditor: viewPostEditor, notes: viewNotes, gallery: viewGallery, projects: viewProjects, projectEditor: viewProjectEditor, general: viewGeneral };
    views[view || tab](arg);
    window.scrollTo(0, 0);
  }
  function back() {
    if (dirty && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?")) return;
    render();
  }

  function itemRow(img, title, sub, actions) {
    return '<div class="item">' + (img ? '<img src="' + esc(src(img)) + '" alt="">' : '<span class="thumb-empty"></span>') +
      "<div><strong>" + esc(title) + "</strong><small>" + esc(sub) + '</small></div><div class="item-actions">' + actions + "</div></div>";
  }

  /* ================= YAZILAR ================= */
  function viewPosts() {
    const rows = byDate(state.posts).map((p) => itemRow(p.cover, p.title, T.formatDate(p.date) + ", " + p.category,
      '<a class="btn btn--ghost btn--sm" href="blog/' + encodeURIComponent(p.slug) + '.html" target="_blank" rel="noopener">Gör</a>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-edit="' + esc(p.slug) + '">Düzenle</button>' +
      '<button class="btn btn--ghost btn--sm btn-danger" type="button" data-del="' + esc(p.slug) + '">Sil</button>')).join("");
    main.innerHTML = '<div class="panel-head"><h2>Yazılar</h2><button class="btn btn--dark btn--sm" type="button" id="new-post">Yeni yazı</button></div>' +
      '<div class="list">' + (rows || '<p class="empty">Henüz yazı yok. İlk yazını ekle.</p>') + "</div>";
    $("new-post").onclick = () => render("postEditor", null);
    main.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => render("postEditor", b.dataset.edit)));
    main.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => deletePost(b.dataset.del)));
  }

  function viewPostEditor(slug) {
    const old = slug ? state.posts.find((p) => p.slug === slug) : null;
    const p = old || { title: "", slug: "", date: today(), category: "", excerpt: "", cover: "", body: "" };
    const cats = Array.from(new Set(state.posts.map((x) => x.category).filter(Boolean)));
    let slugTouched = !!old;

    main.innerHTML =
      '<div class="panel-head"><h2>' + (old ? "Yazıyı düzenle" : "Yeni yazı") + '</h2><button class="btn btn--ghost btn--sm" type="button" data-back>Vazgeç</button></div>' +
      '<form class="box" id="post-form" novalidate>' +
      '<label class="field"><span>Başlık</span><input name="title" required value="' + esc(p.title) + '"></label>' +
      '<div class="row2">' +
      '<label class="field"><span>Adres</span><input name="slug" required value="' + esc(p.slug) + '" autocapitalize="off" spellcheck="false"><small>blog/<b id="slug-prev">' + esc(p.slug || "...") + "</b>.html</small></label>" +
      '<label class="field"><span>Tarih</span><input type="date" name="date" required value="' + esc(p.date) + '"></label></div>' +
      '<label class="field"><span>Kategori</span><input name="category" list="cat-list" required value="' + esc(p.category) + '" placeholder="Örneğin Günlük"><datalist id="cat-list">' +
      cats.map((c) => '<option value="' + esc(c) + '">').join("") + "</datalist></label>" +
      '<label class="field"><span>Kısa açıklama</span><textarea name="excerpt" required maxlength="220" rows="3">' + esc(p.excerpt) + "</textarea><small>Blog kartlarında ve Google sonuçlarında görünür (en fazla 220 karakter).</small></label>" +
      '<div class="field"><span>Kapak fotoğrafı</span><div class="image-pick"><img id="cover-prev" src="' + esc(src(p.cover)) + '" alt=""' + (p.cover ? "" : " hidden") + '>' +
      '<label class="btn btn--ghost btn--sm file-btn">Fotoğraf seç<input type="file" accept="image/*" id="cover-file"></label></div></div>' +
      '<div class="field"><span>Yazı</span>' +
      '<div class="md-toolbar">' +
      '<button type="button" class="chip" data-md="h2">Başlık</button>' +
      '<button type="button" class="chip" data-md="bold">Kalın</button>' +
      '<button type="button" class="chip" data-md="italic">İtalik</button>' +
      '<button type="button" class="chip" data-md="list">Madde</button>' +
      '<button type="button" class="chip" data-md="quote">Alıntı</button>' +
      '<button type="button" class="chip" data-md="link">Bağlantı</button>' +
      '<label class="chip file-btn">Fotoğraf ekle<input type="file" accept="image/*" id="body-image"></label>' +
      '<button type="button" class="chip" id="toggle-preview" aria-pressed="false">Önizleme</button></div>' +
      '<textarea class="tall" name="body" id="body">' + esc(p.body) + "</textarea>" +
      '<div class="preview prose" id="preview" hidden></div>' +
      "<small>## ile başlık, **kalın**, *italik*, - ile madde, &gt; ile alıntı. Paragraflar arasında bir boş satır bırak.</small></div>" +
      '<div class="form-actions"><button class="btn btn--dark" type="submit">' + (old ? "Değişiklikleri yayınla" : "Yazıyı yayınla") + '</button><button class="btn btn--ghost" type="button" data-back>Vazgeç</button></div>' +
      "</form>";

    const form = $("post-form");
    const body = $("body");
    main.querySelectorAll("[data-back]").forEach((b) => (b.onclick = back));
    form.elements.title.addEventListener("input", () => {
      if (!slugTouched) { form.elements.slug.value = T.slugify(form.elements.title.value); $("slug-prev").textContent = form.elements.slug.value || "..."; }
    });
    form.elements.slug.addEventListener("input", () => { slugTouched = true; $("slug-prev").textContent = T.slugify(form.elements.slug.value) || "..."; });
    bindImagePicker("cover-file", "cover-prev", "cover");

    // Biçim düğmeleri
    function wrap(before, after, placeholder) {
      const s = body.selectionStart, e = body.selectionEnd;
      const sel = body.value.slice(s, e) || placeholder;
      body.setRangeText(before + sel + after, s, e, "end");
      body.focus();
      dirty = true;
    }
    function block(text) {
      const s = body.selectionStart;
      const pre = body.value.slice(0, s);
      const gap = !pre || /\n\n$/.test(pre) ? "" : /\n$/.test(pre) ? "\n" : "\n\n";
      body.setRangeText(gap + text + "\n\n", s, body.selectionEnd, "end");
      body.focus();
      dirty = true;
    }
    main.querySelectorAll("[data-md]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.md;
      if (k === "h2") block("## Başlık");
      if (k === "bold") wrap("**", "**", "kalın yazı");
      if (k === "italic") wrap("*", "*", "italik yazı");
      if (k === "list") block("- Birinci madde\n- İkinci madde");
      if (k === "quote") block("> Alıntı");
      if (k === "link") {
        const url = prompt("Bağlantı adresi (https://...)");
        if (url) wrap("[", "](" + url.trim() + ")", "bağlantı yazısı");
      }
    }));
    $("body-image").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      let path;
      const ok = await run([["Fotoğraf yükleniyor", async () => { path = await uploadImage(await resizeImage(file), form.elements.slug.value || "yazi"); }]],
        "Fotoğraf yüklendi. Yazıyı yayınlayınca sitede görünür.");
      dirty = true;
      if (ok) block("![Fotoğraf açıklaması](" + path + ")");
    });
    $("toggle-preview").addEventListener("click", (e) => {
      const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
      e.currentTarget.setAttribute("aria-pressed", String(on));
      const prev = $("preview");
      if (on) {
        // Bu oturumda yüklenen görselleri önizlemede göster
        let html = T.renderMarkdown(body.value, "");
        Object.keys(previews).forEach((k) => { html = html.split('src="' + k + '"').join('src="' + previews[k] + '"'); });
        prev.innerHTML = html;
      }
      prev.hidden = !on;
      body.hidden = on;
    });

    form.addEventListener("submit", (e) => { e.preventDefault(); savePost(form, old); });
  }

  async function savePost(form, old) {
    const f = {
      title: form.elements.title.value.trim(),
      slug: T.slugify(form.elements.slug.value),
      date: form.elements.date.value,
      category: form.elements.category.value.trim(),
      excerpt: form.elements.excerpt.value.trim(),
      body: form.elements.body.value.replace(/\s+$/, "")
    };
    if (!f.title || !f.slug || !f.date || !f.category || !f.excerpt) return toast("Başlık, adres, tarih, kategori ve kısa açıklama zorunlu.", true);
    if (!f.body) return toast("Yazı alanı boş olamaz.", true);
    if (state.posts.some((p) => p.slug === f.slug && (!old || p.slug !== old.slug))) return toast("Bu adresle başka bir yazı var. Adresi değiştir.", true);

    const post = Object.assign({ cover: old ? old.cover : "" }, f);
    const cover = pending.cover;
    let posts;
    const steps = [];
    if (cover) steps.push(["Kapak fotoğrafı yükleniyor", async () => { post.cover = await uploadImage(cover, post.slug); }]);
    steps.push(["Yazı sayfası oluşturuluyor", () => putFile("blog/" + post.slug + ".html", T.buildPostPage(post, state.site), (old ? "Yazı güncellendi: " : "Yeni yazı: ") + post.title)]);
    steps.push(["Yazı listesi güncelleniyor", () => {
      posts = byDate(state.posts.filter((p) => p.slug !== post.slug && (!old || p.slug !== old.slug)).concat(post));
      return writeJSON("posts", posts, "Yazı listesi güncellendi");
    }]);
    if (old && old.slug !== post.slug) steps.push(["Eski adres kaldırılıyor", () => deleteFile("blog/" + old.slug + ".html", "Eski yazı adresi kaldırıldı: " + old.slug)]);
    steps.push(["Site haritası güncelleniyor", () => putFile("sitemap.xml", T.buildSitemap(state.site, posts), "sitemap.xml güncellendi")]);

    if (await run(steps)) { state.posts = posts; render("posts"); }
  }

  async function deletePost(slug) {
    const p = state.posts.find((x) => x.slug === slug);
    if (!p || !confirm("\"" + p.title + "\" yazısı silinsin mi? Bu işlem geri alınamaz.")) return;
    const posts = state.posts.filter((x) => x.slug !== slug);
    const ok = await run([
      ["Yazı listesi güncelleniyor", () => writeJSON("posts", posts, "Yazı silindi: " + p.title)],
      ["Yazı sayfası siliniyor", () => deleteFile("blog/" + slug + ".html", "Yazı sayfası silindi: " + slug)],
      ["Site haritası güncelleniyor", () => putFile("sitemap.xml", T.buildSitemap(state.site, posts), "sitemap.xml güncellendi")]
    ], "Yazı silindi.");
    if (ok) { state.posts = posts; render(); }
  }

  /* ================= NOTLAR ================= */
  function viewNotes(editId) {
    const old = editId ? state.notes.find((n) => n.id === editId) : null;
    const n = old || { date: today(), type: NOTE_TYPES[0], text: "" };
    const rows = byDate(state.notes).map((x) =>
      '<div class="item item--text"><div><small>' + esc(T.formatDate(x.date)) + (x.type ? ", " + esc(x.type) : "") + "</small><p>" + esc(x.text) + "</p></div>" +
      '<div class="item-actions"><button class="btn btn--ghost btn--sm" type="button" data-edit="' + esc(x.id) + '">Düzenle</button>' +
      '<button class="btn btn--ghost btn--sm btn-danger" type="button" data-del="' + esc(x.id) + '">Sil</button></div></div>').join("");

    main.innerHTML = '<div class="panel-head"><h2>Notlar</h2></div>' +
      '<form class="box" id="note-form"><h3>' + (old ? "Notu düzenle" : "Yeni not") + "</h3>" +
      '<div class="row2"><label class="field"><span>Tarih</span><input type="date" name="date" required value="' + esc(n.date) + '"></label>' +
      '<label class="field"><span>Not türü</span><input name="type" list="note-types" value="' + esc(n.type) + '"><datalist id="note-types">' +
      NOTE_TYPES.map((t) => '<option value="' + esc(t) + '">').join("") + "</datalist></label></div>" +
      '<label class="field"><span>Not</span><textarea name="text" required rows="4">' + esc(n.text) + "</textarea></label>" +
      '<div class="item-actions" style="justify-content:start"><button class="btn btn--dark" type="submit">' + (old ? "Değişiklikleri yayınla" : "Notu yayınla") + "</button>" +
      (old ? '<button class="btn btn--ghost" type="button" data-back>Vazgeç</button>' : "") + "</div></form>" +
      '<div class="list">' + (rows || '<p class="empty">Henüz not yok.</p>') + "</div>";

    const form = $("note-form");
    main.querySelectorAll("[data-back]").forEach((b) => (b.onclick = back));
    main.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => { if (!dirty || confirm("Kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?")) render("notes", b.dataset.edit); }));
    main.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Bu not silinsin mi?")) return;
      const notes = state.notes.filter((x) => x.id !== b.dataset.del);
      if (await run([["Not siliniyor", () => writeJSON("notes", notes, "Not silindi")]], "Not silindi.")) { state.notes = notes; render(); }
    }));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = { id: old ? old.id : uid("n"), date: form.elements.date.value, type: form.elements.type.value.trim(), text: form.elements.text.value.trim() };
      if (!note.date || !note.text) return toast("Tarih ve not alanı zorunlu.", true);
      const notes = byDate(state.notes.filter((x) => x.id !== note.id).concat(note));
      if (await run([["Not kaydediliyor", () => writeJSON("notes", notes, old ? "Not güncellendi" : "Yeni not")]])) { state.notes = notes; render("notes"); }
    });
  }

  /* ================= GALERİ ================= */
  function viewGallery() {
    let draft = clone(state.gallery);
    const catOptions = (sel) => GALLERY_CATS.map((c) => '<option' + (c === sel ? " selected" : "") + ">" + esc(c) + "</option>").join("");

    main.innerHTML = '<div class="panel-head"><h2>Galeri</h2></div>' +
      '<form class="box" id="g-upload"><h3>Fotoğraf ekle</h3>' +
      '<label class="field"><span>Fotoğraflar</span><input type="file" accept="image/*" multiple id="g-files"><small>Birden fazla fotoğraf seçebilirsin. Fotoğraflar yüklenmeden önce otomatik küçültülür.</small></label>' +
      '<div class="row2"><label class="field"><span>Kategori</span><select id="g-cat">' + catOptions("Günlük Hayat") + "</select></label>" +
      '<label class="field"><span>Açıklama (isteğe bağlı)</span><input id="g-caption" placeholder="Örneğin Sahil yürüyüşü"></label></div>' +
      '<button class="btn btn--dark" type="submit">Fotoğrafları yükle</button></form>' +
      '<div class="g-grid" id="g-grid"></div>' +
      '<div class="save-bar"><button class="btn btn--dark" type="button" id="g-save" disabled>Değişiklikleri yayınla</button><small id="g-state">Açıklama, kategori, sıra ya da silme değişikliği yok.</small></div>';

    const grid = $("g-grid");
    function mark() {
      dirty = true;
      $("g-save").disabled = false;
      $("g-state").textContent = "Yayınlanmamış değişiklikler var.";
    }
    function paint() {
      grid.innerHTML = draft.map((g, i) =>
        '<div class="g-card"><img src="' + esc(src(g.src)) + '" alt="" loading="lazy"><div class="g-body">' +
        '<input data-cap="' + i + '" value="' + esc(g.caption || "") + '" placeholder="Açıklama" aria-label="Açıklama">' +
        '<select data-cat="' + i + '" aria-label="Kategori">' + catOptions(g.category) + "</select>" +
        '<div class="item-actions"><span><button class="btn btn--ghost btn--sm" type="button" data-up="' + i + '" aria-label="Öne al"' + (i === 0 ? " disabled" : "") + ">↑</button> " +
        '<button class="btn btn--ghost btn--sm" type="button" data-down="' + i + '" aria-label="Geri al"' + (i === draft.length - 1 ? " disabled" : "") + ">↓</button></span>" +
        '<button class="btn btn--ghost btn--sm btn-danger" type="button" data-rm="' + i + '">Sil</button></div></div></div>').join("") ||
        '<p class="empty">Galeride henüz fotoğraf yok.</p>';
    }
    paint();

    grid.addEventListener("input", (e) => {
      const i = e.target.dataset.cap;
      if (i !== undefined) { draft[i].caption = e.target.value; mark(); }
    });
    grid.addEventListener("change", (e) => {
      const i = e.target.dataset.cat;
      if (i !== undefined) { draft[i].category = e.target.value; mark(); }
    });
    grid.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const d = b.dataset;
      const move = (i, j) => { const t = draft[i]; draft[i] = draft[j]; draft[j] = t; };
      if (d.up !== undefined) move(+d.up, +d.up - 1);
      else if (d.down !== undefined) move(+d.down, +d.down + 1);
      else if (d.rm !== undefined) { if (!confirm("Bu fotoğraf galeriden kaldırılsın mı?")) return; draft.splice(+d.rm, 1); }
      else return;
      mark(); paint();
    });

    $("g-save").onclick = async () => {
      const next = clone(draft);
      if (await run([["Galeri kaydediliyor", () => writeJSON("gallery", next, "Galeri güncellendi")]])) { state.gallery = next; render(); }
    };

    $("g-upload").addEventListener("submit", async (e) => {
      e.preventDefault();
      const files = Array.from($("g-files").files);
      if (!files.length) return toast("Önce en az bir fotoğraf seç.", true);
      const cat = $("g-cat").value, cap = $("g-caption").value.trim();
      const added = [];
      const steps = files.map((file, i) => ["Fotoğraf yükleniyor", async () => {
        const path = await uploadImage(await resizeImage(file), cap || cat);
        added.push({ id: uid("g"), src: path, category: cat, caption: cap });
      }]);
      let next;
      steps.push(["Galeri kaydediliyor", () => { next = added.concat(draft); return writeJSON("gallery", next, files.length + " fotoğraf eklendi"); }]);
      if (await run(steps, files.length + " fotoğraf eklendi. 1-2 dakika içinde sitede görünür.")) { state.gallery = next; render(); }
    });
  }

  /* ================= PROJELER ================= */
  function viewProjects() {
    const rows = state.projects.map((p) => itemRow(p.image, p.title, (p.tech || []).join(", "),
      '<button class="btn btn--ghost btn--sm" type="button" data-edit="' + esc(p.id) + '">Düzenle</button>' +
      '<button class="btn btn--ghost btn--sm btn-danger" type="button" data-del="' + esc(p.id) + '">Sil</button>')).join("");
    main.innerHTML = '<div class="panel-head"><h2>Projeler</h2><button class="btn btn--dark btn--sm" type="button" id="new-project">Yeni proje</button></div>' +
      '<div class="list">' + (rows || '<p class="empty">Henüz proje yok.</p>') + "</div>";
    $("new-project").onclick = () => render("projectEditor", null);
    main.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => render("projectEditor", b.dataset.edit)));
    main.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      const p = state.projects.find((x) => x.id === b.dataset.del);
      if (!p || !confirm("\"" + p.title + "\" projesi silinsin mi?")) return;
      const projects = state.projects.filter((x) => x.id !== p.id);
      if (await run([["Proje siliniyor", () => writeJSON("projects", projects, "Proje silindi: " + p.title)]], "Proje silindi.")) { state.projects = projects; render(); }
    }));
  }

  function viewProjectEditor(id) {
    const old = id ? state.projects.find((p) => p.id === id) : null;
    const p = old || { title: "", description: "", image: "", tech: [], link: "" };
    main.innerHTML = '<div class="panel-head"><h2>' + (old ? "Projeyi düzenle" : "Yeni proje") + '</h2><button class="btn btn--ghost btn--sm" type="button" data-back>Vazgeç</button></div>' +
      '<form class="box" id="project-form">' +
      '<label class="field"><span>Proje adı</span><input name="title" required value="' + esc(p.title) + '"></label>' +
      '<label class="field"><span>Açıklama</span><textarea name="description" required rows="4">' + esc(p.description) + "</textarea></label>" +
      '<div class="field"><span>Görsel</span><div class="image-pick"><img id="proj-prev" src="' + esc(src(p.image)) + '" alt=""' + (p.image ? "" : " hidden") + '>' +
      '<label class="btn btn--ghost btn--sm file-btn">Görsel seç<input type="file" accept="image/*" id="proj-file"></label></div></div>' +
      '<label class="field"><span>Kullandığım teknolojiler</span><input name="tech" value="' + esc((p.tech || []).join(", ")) + '" placeholder="HTML, CSS, JavaScript"><small>Virgülle ayır.</small></label>' +
      '<label class="field"><span>Proje bağlantısı</span><input name="link" type="url" value="' + esc(p.link) + '" placeholder="https://"><small>Boş bırakırsan "Bağlantı yakında eklenecek" yazar.</small></label>' +
      '<div class="form-actions"><button class="btn btn--dark" type="submit">' + (old ? "Değişiklikleri yayınla" : "Projeyi yayınla") + '</button><button class="btn btn--ghost" type="button" data-back>Vazgeç</button></div></form>';

    const form = $("project-form");
    main.querySelectorAll("[data-back]").forEach((b) => (b.onclick = back));
    bindImagePicker("proj-file", "proj-prev", "image");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const link = form.elements.link.value.trim();
      if (link && !/^https?:\/\//i.test(link)) return toast("Bağlantı https:// ile başlamalı.", true);
      const item = {
        id: old ? old.id : uid("p"),
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim(),
        image: old ? old.image : "",
        tech: form.elements.tech.value.split(",").map((t) => t.trim()).filter(Boolean),
        link
      };
      if (!item.title || !item.description) return toast("Proje adı ve açıklama zorunlu.", true);
      const image = pending.image;
      let projects;
      const steps = [];
      if (image) steps.push(["Görsel yükleniyor", async () => { item.image = await uploadImage(image, item.title); }]);
      steps.push(["Proje kaydediliyor", () => {
        projects = old ? state.projects.map((x) => (x.id === item.id ? item : x)) : [item].concat(state.projects);
        return writeJSON("projects", projects, (old ? "Proje güncellendi: " : "Yeni proje: ") + item.title);
      }]);
      if (await run(steps)) { state.projects = projects; render("projects"); }
    });
  }

  /* ================= GENEL BİLGİLER ================= */
  function viewGeneral() {
    const s = state.site;
    const a = s.about || {}, c = s.contact || {}, h = s.hero || {};
    const sec = (x) => '<div class="box sec"><label class="field"><span>Alan başlığı</span><input class="sec-title" value="' + esc(x.title) + '"></label>' +
      '<label class="field"><span>Maddeler</span><textarea class="sec-items" rows="4">' + esc((x.items || []).join("\n")) + "</textarea><small>Her satıra bir madde yaz. Alanı kaldırmak için başlığı sil.</small></label></div>";

    main.innerHTML = '<div class="panel-head"><h2>Genel bilgiler</h2></div>' +
      '<form id="general-form">' +
      '<div class="box"><h3>Site</h3>' +
      '<label class="field"><span>Site adresi</span><input name="siteUrl" type="url" required value="' + esc(s.siteUrl) + '"><small>Örneğin https://dilaraerdal.github.io. Değiştirirsen tüm sayfalardaki Google adresleri de güncellenir.</small></label>' +
      '<div class="row2"><label class="field"><span>Adın</span><input name="name" required value="' + esc(s.name) + '"></label>' +
      '<label class="field"><span>Menüdeki site adı</span><input name="brand" required value="' + esc(s.brand) + '"></label></div>' +
      '<label class="field"><span>Slogan</span><input name="slogan" value="' + esc(s.slogan) + '"></label>' +
      '<label class="field"><span>Google Search Console doğrulama kodu</span><input name="googleVerification" value="' + esc(s.googleVerification || "") + '" placeholder="Kodu ya da meta etiketinin tamamını yapıştır" autocapitalize="off" spellcheck="false"></label></div>' +

      '<div class="box"><h3>Ana sayfa</h3>' +
      '<label class="field"><span>Selamlama</span><input name="greeting" value="' + esc(h.greeting) + '"><small>Büyük yazılan adının üstünde görünür.</small></label>' +
      '<label class="field"><span>Karşılama yazısı</span><textarea name="heroText" rows="3">' + esc(h.text) + "</textarea></label></div>" +

      '<div class="box"><h3>Hakkımda</h3>' +
      '<div class="field"><span>Profil fotoğrafı</span><div class="image-pick"><img id="about-prev" src="' + esc(src(a.photo)) + '" alt=""' + (a.photo ? "" : " hidden") + '>' +
      '<label class="btn btn--ghost btn--sm file-btn">Fotoğraf seç<input type="file" accept="image/*" id="about-file"></label></div><small>Dikey (portre) bir fotoğraf en iyi sonucu verir.</small></div>' +
      '<label class="field"><span>Başlık</span><input name="aboutHeading" value="' + esc(a.heading) + '"></label>' +
      '<label class="field"><span>Kendini anlattığın yazı</span><textarea name="aboutText" rows="7">' + esc(a.text) + "</textarea><small>Paragraflar arasında bir boş satır bırak.</small></label></div>" +
      '<div id="sections">' + (a.sections || []).map(sec).join("") + "</div>" +
      '<button class="btn btn--ghost btn--sm" type="button" id="add-sec" style="margin-bottom:20px">Yeni alan ekle</button>' +

      '<div class="box"><h3>İletişim</h3>' +
      '<label class="field"><span>Giriş yazısı</span><textarea name="contactIntro" rows="3">' + esc(c.intro) + "</textarea></label>" +
      '<label class="field"><span>E-posta</span><input name="email" type="email" value="' + esc(c.email) + '"></label>' +
      '<label class="field"><span>Sosyal medya hesapları</span><textarea name="links" rows="5">' + esc((c.links || []).map((l) => l.label + " | " + l.url).join("\n")) + "</textarea>" +
      "<small>Her satıra bir hesap: Instagram | https://instagram.com/kullaniciadi</small></label></div>" +
      '<div class="save-bar"><button class="btn btn--dark" type="submit">Değişiklikleri yayınla</button></div></form>';

    bindImagePicker("about-file", "about-prev", "photo");
    $("add-sec").onclick = () => { $("sections").insertAdjacentHTML("beforeend", sec({ title: "", items: [] })); dirty = true; };
    $("general-form").addEventListener("submit", (e) => { e.preventDefault(); saveGeneral(e.target); });
  }

  async function saveGeneral(form) {
    const old = state.site;
    const next = clone(old);
    const url = form.elements.siteUrl.value.trim().replace(/\/+$/, "");
    if (!/^https:\/\/[^\s/]+/i.test(url)) return toast("Site adresi https:// ile başlamalı.", true);

    const links = [];
    for (const line of form.elements.links.value.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const parts = line.split("|");
      const label = (parts[0] || "").trim(), link = (parts.slice(1).join("|") || "").trim();
      if (!label || !/^https?:\/\//i.test(link)) return toast("Sosyal medya satırı hatalı: \"" + line + "\". Biçim: Instagram | https://...", true);
      links.push({ label, url: link });
    }
    let verif = form.elements.googleVerification.value.trim();
    const m = verif.match(/content=["']([^"']+)["']/i);
    if (m) verif = m[1];

    Object.assign(next, { siteUrl: url, name: form.elements.name.value.trim() || "Dilara", brand: form.elements.brand.value.trim() || "DİLARA", slogan: form.elements.slogan.value.trim(), googleVerification: verif });
    next.hero = { greeting: form.elements.greeting.value.trim(), text: form.elements.heroText.value.trim() };
    next.about = Object.assign({}, old.about, {
      heading: form.elements.aboutHeading.value.trim(),
      text: form.elements.aboutText.value.trim(),
      sections: Array.from(main.querySelectorAll(".sec")).map((b) => ({
        title: b.querySelector(".sec-title").value.trim(),
        items: b.querySelector(".sec-items").value.split("\n").map((x) => x.trim()).filter(Boolean)
      })).filter((x) => x.title)
    });
    next.contact = { intro: form.elements.contactIntro.value.trim(), email: form.elements.email.value.trim(), links };

    const urlChanged = next.siteUrl !== old.siteUrl;
    const nameChanged = next.name !== old.name;
    const verifChanged = (next.googleVerification || "") !== (old.googleVerification || "");
    const photo = pending.photo;
    const steps = [];
    if (photo) steps.push(["Profil fotoğrafı yükleniyor", async () => { next.about.photo = await uploadImage(photo, "profil"); }]);
    steps.push(["Bilgiler kaydediliyor", () => writeJSON("site", next, "Genel bilgiler güncellendi")]);
    if (urlChanged) {
      ROOT_PAGES.forEach((page) => steps.push(["Adresler güncelleniyor: " + page, async () => {
        const f = await getFile(page);
        if (f && f.text.indexOf(old.siteUrl) > -1) await putFile(page, f.text.split(old.siteUrl).join(next.siteUrl), "Site adresi güncellendi: " + page);
      }]));
      steps.push(["robots.txt güncelleniyor", () => putFile("robots.txt", T.buildRobots(next), "robots.txt güncellendi")]);
      steps.push(["Site haritası güncelleniyor", () => putFile("sitemap.xml", T.buildSitemap(next, state.posts), "sitemap.xml güncellendi")]);
    }
    if (urlChanged || nameChanged) {
      state.posts.forEach((p) => steps.push(["Yazı sayfaları yenileniyor", () => putFile("blog/" + p.slug + ".html", T.buildPostPage(p, next), "Yazı sayfası yenilendi: " + p.slug)]));
    }
    if (verifChanged) {
      steps.push(["Google doğrulaması ekleniyor", async () => {
        const f = await getFile("index.html");
        if (!f) return;
        const tag = '<meta name="google-site-verification" content="' + esc(next.googleVerification) + '">';
        const text = /<meta name="google-site-verification"[^>]*>/.test(f.text)
          ? f.text.replace(/<meta name="google-site-verification"[^>]*>/, tag)
          : f.text.replace("</head>", tag + "\n</head>");
        await putFile("index.html", text, "Google doğrulama kodu güncellendi");
      }]);
    }
    if (await run(steps)) { state.site = next; render("general"); }
  }
})();
