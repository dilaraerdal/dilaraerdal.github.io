# DİLARA — Kişisel web sitesi ve blog

Tamamen ücretsiz çalışan, GitHub Pages üzerinde yayınlanan kişisel site. Sunucu, veritabanı ya da ücretli servis gerekmez.

## İçindekiler

- Ana Sayfa, Hakkımda, Blog, Galeri, Projelerim, Notlarım, İletişim
- Her blog yazısının kendi sayfası (`blog/yazi-adi.html`), önceki/sonraki ve benzer yazılar
- Galeri: kategoriler ve büyütülebilir fotoğraflar (klavye ve parmakla kaydırma destekli)
- Açık/koyu tema (seçim tarayıcıda hatırlanır)
- Mobil uyumlu tasarım ve hamburger menü
- SEO: her sayfada title, description, canonical, Open Graph; `sitemap.xml` ve `robots.txt`
- **Yönetim paneli** (`admin.html`): yazı, not, fotoğraf, proje ve kişisel bilgileri tarayıcıdan düzenleme

## Dosya yapısı

```
index.html, about.html, blog.html, gallery.html, projects.html, notes.html, contact.html
admin.html          Yönetim paneli
404.html            Bulunamayan sayfa
blog/               Her yazının kendi sayfası
data/               Sitedeki tüm içerik (site.json, posts.json, notes.json, gallery.json, projects.json)
css/                style.css, responsive.css, admin.css
js/                 main.js, blog.js, gallery.js, notes.js, projects.js, post-template.js, admin.js
images/             Görseller (panelden yüklenenler images/uploads/ içine gider)
sitemap.xml, robots.txt, favicon.svg, .nojekyll
```

## GitHub Pages'e yükleme (adım adım)

1. **GitHub hesabı aç:** https://github.com adresinden ücretsiz hesap oluştur. Kullanıcı adın sitenin adresi olacak (örneğin `dilaraerdal` → `https://dilaraerdal.github.io`).
2. **Depo oluştur:** Sağ üstteki **+** → **New repository**.
   - Repository name: tam olarak `kullaniciadin.github.io` yaz (örneğin `dilaraerdal.github.io`).
   - **Public** seçili olsun (ücretsiz Pages için gerekli).
   - **Create repository**'ye bas.
3. **Dosyaları yükle:** Depo sayfasında **uploading an existing file** bağlantısına tıkla. Zip'i bilgisayarında aç, **içindeki tüm dosya ve klasörleri** (zip'in kendisini ya da dış klasörü değil) sürükleyip bırak. En alttaki **Commit changes**'e bas.
   - `.nojekyll` gizli dosya olduğu için görünmeyebilir. Görünmüyorsa sorun değil, site onsuz da çalışır.
4. **Pages'i aç:** Depoda **Settings** → sol menüde **Pages**.
   - Source: **Deploy from a branch**
   - Branch: **main**, klasör: **/(root)** → **Save**.
5. **Bekle ve aç:** 1-2 dakika sonra `https://kullaniciadin.github.io` adresinde site yayında olur. Aynı sayfada yeşil bir bağlantı çıkar.

> Depoya farklı bir isim verirsen (örneğin `site`), adres `https://kullaniciadin.github.io/site` olur. Site bu şekilde de çalışır.

## Site adresini ayarlama (önemli)

Dosyalarda örnek adres olarak `https://dilaraerdal.github.io` kullanıldı. Kullanıcı adın farklıysa:

1. Siteyi yükledikten sonra `https://kullaniciadin.github.io/admin.html` adresine gir.
2. **Genel bilgiler** → **Site adresi** alanına kendi adresini yaz → **Değişiklikleri yayınla**.

Panel tüm sayfalardaki Google adreslerini, `sitemap.xml` ve `robots.txt` dosyalarını otomatik günceller.

## Yönetim paneli

### Erişim anahtarı (bir kez yapılır)

1. https://github.com/settings/personal-access-tokens/new adresine git.
2. **Token name:** "Site paneli", **Expiration:** 1 yıl.
3. **Repository access:** "Only select repositories" → sitenin deposunu seç.
4. **Permissions** → **Repository permissions** → **Contents:** "Read and write".
5. **Generate token** → çıkan anahtarı kopyala (bir daha gösterilmez).

### Giriş

`https://kullaniciadin.github.io/admin.html` adresine git, kullanıcı adını, depo adını, dalı (`main`) ve anahtarı gir. Kendi cihazındaysan "Bu cihazda beni hatırla"yı işaretleyebilirsin.

### Güvenlik

- Anahtar yalnızca senin tarayıcında tutulur ve sadece GitHub'a gönderilir. Koda ya da siteye yazılmaz.
- Panel sayfası herkese açık bir adreste durur ama anahtar olmadan hiçbir şey değiştirilemez.
- Anahtarını kimseyle paylaşma. Kaybettiğini düşünürsen GitHub'da silip yenisini oluştur.
- Başkasının bilgisayarında "beni hatırla"yı işaretleme ve işin bitince **Çıkış**'a bas.

### Panelde neler yapılır?

- **Yazılar:** yeni yazı, düzenleme, silme, kapak fotoğrafı, yazı içine fotoğraf. Biçimlendirme: `## Başlık`, `**kalın**`, `*italik*`, `- madde`, `> alıntı`.
- **Notlar:** tarih, not türü ve metin.
- **Galeri:** çoklu fotoğraf yükleme (otomatik küçültülür), kategori, açıklama, sıralama, kaldırma.
- **Projeler:** ad, açıklama, görsel, teknolojiler, bağlantı.
- **Genel bilgiler:** ad, slogan, ana sayfa yazısı, Hakkımda metni ve fotoğrafı, ilgi alanları gibi listeler, iletişim bilgileri, site adresi, Google doğrulama kodu.

Her kayıttan sonra site 1-2 dakika içinde güncellenir. Değişikliği hemen göremezsen sayfayı yenile.

## Google'da görünme (Search Console)

1. https://search.google.com/search-console adresine git → **Mülk ekle** → **URL öneki** → site adresini yaz.
2. Doğrulama yöntemi olarak **HTML etiketi**'ni seç ve verilen etiketi kopyala.
3. Panelde **Genel bilgiler** → **Google Search Console doğrulama kodu** alanına yapıştır → yayınla.
4. 1-2 dakika sonra Search Console'da **Doğrula**'ya bas.
5. Sol menüden **Site haritaları** → `sitemap.xml` yaz → **Gönder**.

Google'ın siteyi listelemesi birkaç gün ile birkaç hafta sürebilir.

## Elle düzenleme (isteğe bağlı)

Panel kullanmadan da GitHub'da dosyaya tıklayıp kalem simgesiyle düzenleyebilirsin:

- Kişisel bilgiler: `data/site.json`
- Notlar: `data/notes.json`, galeri: `data/gallery.json`, projeler: `data/projects.json`
- Renkler: `css/style.css` dosyasının en üstündeki değişkenler
- Menü: `js/main.js` içindeki `NAV` listesi

Blog yazılarını panelden eklemen önerilir, çünkü panel yazı sayfasını, listeyi ve site haritasını birlikte günceller.

## Bilmen gerekenler

- Dosyaları bilgisayarında **çift tıklayarak açarsan** içerik yüklenmez (tarayıcı güvenliği). Site GitHub Pages'te sorunsuz çalışır. Bilgisayarında denemek istersen klasörde `python3 -m http.server` çalıştırıp `http://localhost:8000` adresini aç.
- Panelden silinen yazı ya da fotoğrafların görsel dosyaları `images/uploads/` içinde kalır. İstersen GitHub'dan elle silebilirsin.
- Örnek görseller (`images/` altında) yer tutucudur. Panelden kendi fotoğraflarınla değiştir.
- Ücretsiz GitHub Pages'te depo boyutu için önerilen sınır 1 GB'dır. Panel fotoğrafları otomatik küçülttüğü için binlerce fotoğrafa yeter.
