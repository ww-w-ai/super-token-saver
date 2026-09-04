# super-token-saver

**Token'larınızın nereye gittiğini bulmak için CC'nin kaynak kodunu gerçekten okuyan ve bunu otomatik olarak düzelten tek Claude Code eklentisi. Daha az harcayın, daha uzun süre kodlayın.**

> Ölçülen sonuç: Gerçek bir $326/gün iş yükünde **%45 maliyet azalması** → $180/gün. Tek bir kurulumda, sıfır yapılandırmayla otomatik SubTask devri, sıfır maliyetli context geri yükleme, eksiksiz bir analitik panosu ve cache süre sonuna karşı bir koruma.

**Max Plan ($200/ay)** ve **API kullandıkça öde** ile çalışır. Aynı eklenti, aynı özellikler. Her kullanıcı için daha güçlü — özellikle her token gerçek para olduğunda.

![Kullanım panosu — token'larınızın tam olarak nereye gittiğini görün](docs/images/usage-view-overview.png)

### 30 saniyede ne yapar

| Özellik | Ne olur | Etki |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Ağır işleri SubTask'lara otomatik devreder (%37,5 daha ucuz cache) | Context küçük kalır, maliyetler düşer |
| 🪶 Concise Mode | Yanıt dolgusunu keser, özü korur | Yanıt başına daha az output token |
| 🔄 /s-continue | /compact'ın yerini alır — sıfır LLM çağrısı, sıfır maliyet, sıfır bilgi kaybı, üstelik artık **Codex** oturumlarını da geri yüklüyor | İki araçta birden ücretsiz context geri yükleme |
| 🤝 /s-compact | /s-continue'nun otomatik yüklediği bir oturum devir notu yazar — transcript'in kaybettiği sub-agent bulgularını ve araç çıktılarını yakalar | Bir sonraki oturum gizli context ile de devam eder |
| 📊 Status Line | Gerçek zamanlı maliyet, context boyutu, hız sınırı — 50ms altında | Sorunları size mal olmadan önce görün |
| 📈 /usage-view | Yapay zeka destekli analizle etkileşimli HTML panosu | Tek tıklamayla eksiksiz maliyet analizi |
| ✂️ /setup-git-lite | CC'nin her oturuma eklediği 2.200 gizli token'ı kaldırır | Yalnızca git talimatlarından ayda ~$48 tasarruf |
| 🛡️ Token Guardian | Cache süresinin dolması context'inizi yeniden gönderdiği anda sizi uyarır veya `block` modunda bunu engeller | Artık sessiz $9 sürprizleri yok |

---

## 😤 Sorun

**Görünmez maliyetler.** Gerçek zamanlı görünürlük yok. "Context'iniz 800K'da" uyarısı yok. "Cache 3 dakika önce sona erdi" bildirimi yok. Hasardan sonra öğreniyorsunuz.

**Context şişmesi.** 200K'lık context'te aynı prompt, 800K'daki kadar 4 kat daha fazla maliyete yol açar. Her Read, Grep, Edit tüm context'i yeniden gönderir. Karmaşık bir prompt 15'ten fazla API çağrısını tetikler ve her biri context boyutunuzla çarpılır.

**Cache süresinin dolması.** Öğle yemeğinden dönüyorsunuz. Cache gitmiş. Bir istek 900K token'ı tam fiyatıyla yeniden gönderir. Tek seferde $9.

**Her şey manuel.** Context yönetimi, cache süre sonu zamanlaması, SubTask devri, oturum temizliği. Gerçekten kodlarken tüm bunları kimse takip edemez.

**Max Plan ($200/ay)?** Tüm bunlar, artı zamanlayıcı ve tahmini süre olmaksızın iş akışınızı durduran 5 saatlik hız sınırı.

**API kullandıkça öde?** Tüm bunlar, ancak bir tavan yok. Bir cache ıskalama = $9 gerçek para. Haftada on kez = $360/ay yalnızca kazalar. Şişirilmiş context'li kötü bir Salı, Max Plan abonelerinin bir ayda ödediğinden daha fazlasına mal olabilir.

super-token-saver tümünü otomatik olarak halleder. **Bir kez kurun. Bitti.**

---

## 🚀 Kurulum

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Kurulumdan sonra otomatik olarak çalışır. Sıfır yapılandırma. [Claude Code](https://claude.ai/claude-code) v2.1.71+ gerektirir.

Canlı izleme için:

```
/setup-statusline install
```

CC'nin yerleşik git talimatlarından 2.200 gizli token kırpmak için ([ayrıntılar](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Özellik 1: Akıllı Oturum Mimarisi

**Kurun ve maliyet optimize edilmiş çalışma kalıpları otomatik olarak devreye girer.**

Çoğu kullanıcı her şeyi Main oturumda yapar. Dosya okuma, kod üretimi, test çalıştırmaları. Her çıktı context'e yığılır ve her mesajla yeniden gönderilir. Oturum şişer. Maliyetler kartopu gibi büyür.

Session Architect, oturum başlangıcında otomatik olarak bir devir stratejisi ekler.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rol              | Tasarım, kararlar, inceleme       | Uygulama, kod üretimi, çoklu dosya    |
| Cache katmanı    | 1 saat (ephemeral_1h)             | 5 dakika                              |
| Cache yazma maliyeti | ＄10/MTok                      | ＄6.25/MTok                            |
| Context boyutu   | ~94K ortalama                     | ~33K ortalama                         |

SubTask'ların Main'e kıyasla **%37,5 daha ucuz cache yazma** maliyeti vardır. Context de çok daha küçüktür. Ağır işlerin SubTask'lara devredilmesi maliyetleri önemli ölçüde azaltır.

**Sonuç:** Context, 600K+'ya büyümek yerine 250K'nın altında kalır. Aynı iş çıktısı, token maliyetinin yarısı. Tamamen otomatik.

---

## 🪶 Concise Mode

**Aynı içerik. Daha az dolgu. Varsayılan olarak açık.**

SessionStart hook'u aynı zamanda **her oturumda ve her modelde** çalışan bir yanıt stili kuralı ekler — bayrak yok, kurulum yok. Üç şey değişir:

- **Önsöz çıkar** — "Hemen kontrol edeyim…", "Şimdi yapacağım…", sorunuzu tekrarlamak veya diff'in zaten gösterdiklerini özetlemek yok
- **İçeriğe uygun biçim** — listeler için madde işaretleri, akıl yürütme için düz metin (takas, nedensellik, gerekçe). Hiçbiri zorlanmaz
- **Daha sıkı ifade** — aynı nokta, daha az kelime. Daha açık düz metin, daha kısa düz metindir

Sert sınır: asla içerik düşürme, doğrulamayı atlama veya nüansı tek bir cümleye sıkıştırma. Öz tam kalır; yalnızca paket küçülür.

Bir kez kurun, her yerde uygulanır.

---

## 🔄 Özellik 2: /s-continue — Context Geri Yükleme

**`/compact`'ın yerini alır. Sıfır LLM çağrısı. Sıfır token maliyeti. Sıfır bilgi kaybı.**

`/compact`, tüm context'inizi (~1M token) LLM'ye göndererek %3,3'lük bir özette sıkıştırır. Cache sona ermişse, bu tek başına tam bir yeniden önbelleklemeyi tetikler. Bilgi kaybı kaçınılmazdır.

`/s-continue` tamamen farklı bir yaklaşım benimsemektedir. Önceki oturum transkriptini ön işler ve doğrudan yükler. LLM çağrısı yok. Maliyet yok. Orijinal konuşma olduğu gibi geri yüklenir.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Nasıl çalışır           | Özet için tüm context'i LLM'ye gönderir | Transkripti ön işler, doğrudan okur |
| LLM çağrıları           | Gerekli (genellikle 100K+ token)  | 0                                |
| Token maliyeti          | Yüksek                            | 0                                |
| Bilgi kaybı             | Evet (%3,3 özet)                  | Yok (orijinal korunur)           |
| İşleme hızı             | Onlarca saniye                    | < 1 sn (60MB+ dosyalar dahil)    |
| Cache sona erdiğinde    | Üstüne tam yeniden önbellekleme maliyeti | Etki yok                    |
| Çok oturumlu geri yükleme | Mümkün değil                    | Desteklenir                      |

Kullanım: `/clear` ardından `/s-continue`. Önceki oturumların listesini göreceksiniz. Geri yüklemek için birini seçin. Hızlı kurtarma için: `/s-continue last`.

**Sonuç:** Önceki çalışmaya sıfır maliyetle devam edin. Bilgi kaybı yok. 60MB+ transkriptleri 1 saniyenin altında işler.

---
### 🤝 Eşi: `/s-compact` — gizli katmanı devret

`/s-continue` transkripti geri yükler — siz ve Claude'un söylediklerini. Ama bir çalışma oturumunun en yararlı bilgisi genellikle o diyaloğun DIŞINDA yaşar: bir sub-agent'ın bulduğu bir şey (transkripti geri yüklemenin asla yüklemediği ayrı bir dosyadır), araç çıktısındaki belirleyici bir sayı (bir test sayısı, bir benchmark), ya da süreçten çıkarılan bir ders ("headless'ta tekrar üretilemedi ← sorun koddan değil build'den kaynaklanıyordu").

Bir oturumun sonunda `/s-compact` çalıştırın; tam olarak bu gizli katmanı damıtıp `~/.claude/super-token-saver-data/<project>/handoff.md` içine kaydedilen bir devir notuna dönüştürür. Bir sonraki oturumda, `/s-continue` bunu geri yüklenen transkriptin üzerine otomatik olarak yükler — yapıştırmaya gerek yok.

|                     | Tek başına `/s-continue`        | `/s-compact` + `/s-continue` (ikili)            |
| Kurtardığı          | Transkript (söylenenler)         | Transkript artı gizli katman                     |
| Sub-agent bulguları | Kaybolur (ayrı dosyalar)         | Devir notuna damıtılır                            |
| Araç çıktısı sayılar | Sadece sohbete aktarıldıysa      | Bilinçli olarak çıkarılır                         |
| Süreç dersleri       | —                                | Çıkmaz sokaklar tekrarlanmasın diye yakalanır     |

İş akışı: Bir oturumu `/s-compact` ile bitirin → bir sonrakini `/s-continue` ile başlatın.


### 🔀 İki araç, tek geçmiş — Codex oturumları da burada geri yüklenir

Codex oturumlarını `~/.codex/sessions/` içine yazar; Claude Code kendi oturumlarını `~/.claude/projects/` içine yazar. İkisi de diğerinin dosyalarını okumaz. Bu yüzden Codex'te bütçesi biten bir sprint Claude Code'dan erişilemez oluyordu — tersi de geçerliydi.

`/s-continue` artık ikisini de listeliyor ve geri yüklüyor. Bir Codex rollout'u ikinci bir parser'a teslim edilmiyor — Claude Code'un yazdığı biçime, **girdi satırı başına bir çıktı satırı** olacak şekilde yeniden yazılıyor; böylece aynı pipeline her ikisine de hizmet veriyor ve her `L{n}` işareti hâlâ orijinal Codex dosyasındaki tam olarak aynı satırı gösteriyor. Ölçüldü: 12 MB, 1,540-line bir rollout **0.13 s**'de ön işlemden geçiyor.

|                             | Claude Code oturumu | Codex oturumu |
| --------------------------- | ---------------------- | --------------- |
| `/s-continue` tarafından listelenir | Evet | Evet, geçerli projeyle sınırlı |
| Sıfır LLM maliyetiyle geri yüklenir | Evet | Evet |
| Orijinale `L{n}` ile atlama | Evet | Evet — satır numaraları rollout'un kendisine ait |
| Context kaybı (`#0`) sonrası geri yükleme | `/compact`, otomatik compact | Codex sıkıştırması ve thread geri alma |
| `/s-compact` devir notu | Proje başına paylaşılır — birinde yazın, diğerinde yükleyin |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Doğru bir listeyle inandırıcı görünen yanlış bir liste arasındaki farkı yaratan iki ayrıntı var: Codex'te `session_id`, tetiklenen bir sub-agent'ın devraldığı **thread** id'sidir; bu yüzden oturumlar `payload.id` üzerinden anahtarlanır ve sub-agent rollout'ları, Claude Code'un kendi alt görev transkriptlerini zaten filtrelediği yöntemle elenir. `<codex_internal_context source="goal">` ise sistem tarafından eklenir; bu yüzden geri yüklenen context'te kalır ama sizin yazdığınız bir tur olarak asla sayılmaz.

Eklenti Codex'e de kuruluyor — bkz. **[README-CODEX.md](./README-CODEX.md)**
([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)).
`usage-view`, `report-limit` ve `setup-statusline` şimdilik yalnızca Claude Code'da.
---

## 📊 Özellik 3: Canlı Durum Çubuğu

**Gerçek zamanlı token/maliyet izleme. 50ms altında ek yük.**

`/setup-statusline install`'ı bir kez çalıştırın ve Claude Code'un altında kalıcı bir durum çubuğu belirir.

**Normal işlem** — tek bakışta her ölçüt, sıfır bağlam geçişi:

![Normal durumda durum çubuğu](docs/images/statusline-normal.png)

**Hız sınırına ulaşıldı** — 5H %102'de kırmızıya döner, geri sayım tam olarak ne zaman döneceğinizi gösterir ve tek dokunuşluk `/report-limit` eylemi otomatik olarak çıkar:

![Hız sınırlandığında durum çubuğu](docs/images/statusline-rate-limited.png)

| Gösterge         | Neyi gösterir                       | 🟢 Normal | 🟡 Uyarı | 🔴 Kritik |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Son API çağrısının maliyeti         | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | Bu klasör için birikimli maliyet    | —         | —          | —           |
| 5H               | 5 saatlik pencere kullanımı + sıfırlama geri sayımı | < 70%     | >= 70%     | >= 90%      |
| CTX              | Context penceresi kullanımı         | < 35%     | >= 35%     | >= 70%      |

Herhangi bir gösterge uyarı veya kritik seviyeye ulaştığında, otomatik olarak `→ /usage-view current` ipucu belirir.

Kaldırmak için: `/setup-statusline uninstall` (önceki yapılandırma otomatik olarak geri yüklenir).

**Sonuç:** Her maliyet sorunu gerçek zamanlı olarak görünür. 50ms altında ek yük — fark edilebilir gecikme yok.

> **API kullandıkça ödedeyseniz?** 5H ve W göstergeleri otomatik olarak gizlenir — hız sınırı pencereleriniz yok. Kalan şey önemli olan: RUN (lür başına gerçek zamanlı maliyet) ve CTX (context boyutu). Faturanızı kontrol eden iki kaldıraç, her zaman görünür.

---

## 📈 Kullanım Panosu (/usage-view)

**Sonunda yanıtlayın: "Tüm o para nereye gitti?"**

Max Plan kullanıcıları hız sınırına çarpar ve neden diye merak eder. API kullanıcıları Anthropic faturasını açar ve nasıl diye merak eder. Her iki durumda da soru aynıdır: hangi oturum en fazla token yaktı? Maliyetler ne zaman fırladı? Kullanımınızda hangi kalıplar var? Şimdiye kadar — hepsi görünmezdi.

`/usage-view` her şeyi gösterir. Tarayıcınızda etkileşimli bir HTML panosu açılır, kullanım kalıplarını analiz etmenizi ve maliyet artışlarının temel nedenini izlemenizi sağlar. Dış bağımlılık yok. Bağımsız çalışır. Dosya olarak paylaşılabilir.

**31 günde $4.196. Hepsi nereye gitti?** Tek bakış — toplam maliyet, türe göre token dökümü, cache verimlilik oranı ve oturum sayısı. Halka grafiği, harcamanızın %65'inin cache okumalarından (normal ve sağlıklı) oluştuğunu anında gösterir:

![Kullanım panosuna genel bakış](docs/images/usage-view-overview.png)

**Önce ve sonra — ölçülmüş, tahmin edilmemiş.** Turuncu kesik çizgili "Plugin installed" işareti maliyet zaman çizelgenizi ikiye böler. Günlük çubuklar token türüne göre yığınlanır (Input/Output/Cache Write/Cache Read), böylece kurulumdan sonra tam olarak hangi bileşenin değiştiğini görebilirsiniz. Ortalama çizgisi eğilimi gösterir:

![Günlük maliyet eğilimi](docs/images/usage-view-daily-trend.png)

**En çok ne zaman yakıyorsunuz?** Günün saatine göre saatlik maliyet ve haftanın günü dökümü. Aktif gün ortalaması, tüm gün ortalaması veya maksimum arasında geçiş yapın. Ateş simgeleri en pahalı saatlerinizi işaretler — belirgin kalıplar (gece geç saatlerde çalışma, Çarşamba artışları) anında göze çarpar:

![Saatlik ve haftanın günü maliyet kalıbı](docs/images/usage-view-hourly-pattern.png)

**Daha verimli oluyor musunuz?** Total/Output oranı, üretilen her output token için tüketilen token sayısını ölçer. Düşük daha iyidir. "Plugin installed" işareti önce ve sonrayı karşılaştırmanıza olanak tanır. Artışlar = cache ıskalamalar veya oturum yeniden başlatmaları:

![Verimlilik eğilimi](docs/images/usage-view-efficiency.png)

**Her API çağrısı, context boyutuna ve maliyete göre çizildi.** Bu, maliyet yapısını netleştiren grafiktir. Her nokta bir API çağrısıdır. Kırmızı = Opus, mavi = Sonnet, yeşil = Haiku. Kesik çizgiler teorik fiyatlandırmadır — noktalarınız çizginin üzerindeyse fazla ödüyorsunuz. API çağrısı başına değil, konuşma turu başına maliyet görmek için **User Turn** görünümüne geçin.
Gerçek prompt metnini, token sayısını ve tam maliyet dökümünü (Input/Output/Cache Write/Cache Read) görmek için herhangi bir noktanın üzerine gelin:

![Context Boyutuna Göre Maliyet — dağılım grafiği](docs/images/usage-view-cost-scatter.png)

**Context'leriniz ne kadar büyük?** Çoğu çağrı 250K'nın altında kümelenir. 350K'nın üzerindeki uzun kuyruk, maliyetlerin patladığı yerdir — bu grafik tam olarak ne sıklıkla tehlike bölgesinde olduğunuzu gösterir:

![Context Boyutu Dağılımı](docs/images/usage-view-context-dist.png)

**Kodlama takviminiz, saate göre fiyatlandırılmış.** 30 gün boyunca 5 saatlik pencere ısı haritası. Yeşil (<$15/s), turuncu ($15-30/s), kırmızı ($30+/s). Kafatası simgesi (💀), hız sınırına ulaştığınız pencereleri işaretler. Üstteki maliyet kaydırıcısı ucuz pencereleri filtreler, böylece pahalılar öne çıkar — en kötü günleri anında bulmak için sürükleyin. 5 saatlik pencere ve 1 saatlik blok görünümleri arasında geçiş yapın:

![Saatlik kullanım takvimi ısı haritası](docs/images/usage-view-calendar.png)

**O penceredeki oturumların ayrıntılarını açmak için herhangi bir hücreye tıklayın.** O zaman dilimindeki her oturum, maliyet, mesaj sayısı, token dökümü ve her konuşmadan gerçek ilk/son mesajlarla birlikte. En fazla token yakan belirli alışverişleri görmek için "Top Token Conversations"ı genişletin — her giriş prompt metnini, maliyet uyarı etiketlerini ve optimizasyon ipuçlarını gösterir:

![Oturum ayrıntı paneli](docs/images/usage-view-session-drilldown.png)

**Yapay zeka destekli analiz (isteğe bağlı).** `/usage-view`'ı `--no-ai` olmadan çalıştırdığınızda, bir yapay zeka analisti tüm pano verilerinizi okur — API fiyatlandırma referansı dahil — ve yazılı bir rapor üretir: maliyet sürücüleri, anomaliler, optimizasyon önerileri. OS dilinizde otomatik olarak görüntülenir (23 dil, RTL dahil; grafikler/tablolar her zaman LTR kalır):

**Para nereye gitti** — toplam harcama, token türüne göre maliyet sürücüleri, haftalık eğilim ve gerçek sayılarla ölçülen eklenti etkisi:

![Yapay zeka analizi — maliyet dökümü](docs/images/usage-view-ai-report-1.png)

**Ne zaman ve nasıl çalışıyorsunuz** — yoğun saatler, en yoğun günler, API çağrısı dağılımı ve optimizasyon fırsatlarını ortaya çıkaran hız sınırı kalıpları:

![Yapay zeka analizi — çalışma kalıpları](docs/images/usage-view-ai-report-2.png)

**Ne yapmalısınız** — gerçek kullanımınıza göre uyarlanmış somut, veri destekli öneriler. Model değiştirme, context yönetimi, oturum stratejisi:

![Yapay zeka analizi — öneriler](docs/images/usage-view-ai-report-3.png)

**Paylaşın.** Panoların tamamı, tüm veriler gömülü olarak tek bir bağımsız HTML dosyasıdır — sunucu gerekmez. Ekibinize, yöneticinize veya muhasebecinize gönderin. Dış bağımlılık yok. Çevrimdışı çalışır. Paylaşmadan önce tüm prompt metnini çıkarmak için `private` modunu kullanın — konuşma içeriğini kaldırırken maliyet analitiğini korur.

```
/usage-view                  # Tüm zamanlar, tüm projeler
/usage-view current          # Yalnızca mevcut 5 saatlik pencere
/usage-view last 7 days      # Son 7 gün
/usage-view locale ja        # Japonca
/usage-view --no-ai          # Yapay zeka analizini atla (daha hızlı)
/usage-view private          # Prompt metnini sil (paylaşmak için güvenli)
```

---

## 🔬 Hız Sınırı Araştırması (/report-limit)

**Hız sınırı formülünü tersine mühendislik yapmak için topluluk güdümlü proje.**

Anthropic, 5 saatlik pencere için tam formülü yayımlamıyor. Birlikte çözelim.

Hız sınırına ulaştığınızda `/report-limit`'i çalıştırın. Mevcut kullanım verileriniz otomatik olarak bir GitHub Discussion olarak gönderilir. Ne kadar çok veri toplarsak, formül o kadar netleşir.

---

## ✂️ Özellik 4: /setup-git-lite — CC'nin Yerleşik Git Talimatlarını Kırpın

**Claude Code'un kaynak kodunu okuduk. Her oturum için sessizce ödediğiniz 2.200 gizli token bulduk.**

### Keşif

2026-04-12'de bir [GitHub issue](https://github.com/anthropics/claude-code/issues/47107), Claude Code'un yerleşik `includeGitInstructions` ayarının her oturumda sessizce token yaktığını ortaya koydu. [Bu gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) aracılığıyla bağımsız yeniden üretim sayıları doğruladı: her git commit sonrasında oturum başına cache yazmada **+6.031 token**, her API çağrısında cache okumada **+1.690 token**.

### CC kaynak analizi — token'lar nereye gider

Token'ları Claude Code kaynak kodundaki (v2.1.88) iki bağımsız enjeksiyon noktasına kadar izledik:

**1. `gitStatus` anlık görüntüsü (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()`, dal + ana dal + user.name + tam durum (2000 karaktere kadar) + **son 5 commit**'i toplar
- `appendSystemContext` (`utils/api.ts:437`) aracılığıyla system prompt'a birleştirilip eklenir
- Her yeni commit, her yeni değiştirilen dosya, her dal geçişi metni değiştirir → ön ek cache geçersizleştirmesi

**2. Commit/PR iş akışı talimatları (~1.700 tok) — Bash aracı açıklaması**
- `tools/BashTool/prompt.ts:53`, `Bash` aracının açıklamasına 60'tan fazla satır güvenlik protokolü, adım adım commit prosedürü, HEREDOC örnekleri ve PR oluşturma şablonları ekler
- System prompt ile birlikte önbelleğe alınır, ancak `tools[]` parametresi olarak gönderilir

### Neden pahalı

Cache yapısı (`utils/api.ts:321` `splitSysPromptPrefix`), aktif MCP araçlarınız olup olmadığına göre üç yola sahiptir:

- **Yol A** (MCP etkin — çoğu kullanıcı): `gitStatus`, `cacheScope: 'org'` bloğunun içindedir. Herhangi bir değişiklik → bir sonraki oturum başlangıcında tüm blok yeniden önbelleğe alınır → 6K tok `cache_create` ıskalama.
- **Yol B** (MCP yok): `gitStatus`, `cacheScope: null` dinamik bloğuna gider, yani her API çağrısında yeni `input_tokens` olarak yeniden gönderilir — cache ıskalama yok, ama cache tasarrufu da yok.
- **Yol C** (3. taraf sağlayıcı / deneysel betalar devre dışı): Yol A ile aynı.

Tipik etkileşimli oturumlarda, commit/PR talimatları (1,7K tok) `cache_read` aracılığıyla **her API çağrısında** birikir. Opus 4.7 fiyatlandırmasında 100 çağrılık bir oturumda, bu yalnızca Claude'un eğitiminin büyük ölçüde zaten kapsadığı talimatlar için oturum başına yaklaşık **$0,08**'dir.

### super-token-saver nasıl halleder

`/setup-git-lite`, yerel yolu devre dışı bırakır ve SessionStart hook'u aracılığıyla **özenle seçilmiş 280 token'lık bir yedek** ekler. Claude'un varsayılan davranışını geçersiz kılan şeyleri tam olarak koruduk (güvenlik kuralları) ve Claude'un eğitimden zaten bildiği her şeyi bıraktık (adım adım iş akışları, PR şablonları, gh kullanım kalıpları).

**Korunan — 11 kritik geçersiz kılma kuralı** (Claude'un varsayılan yardımseverliğini dikkat moduna geçirenler):
- Açık kullanıcı isteği olmadan asla commit/push/amend/PR/tag/merge yapma
- Asla hook atlamak, main/master'a zorla itmek, yıkıcı işlemler çalıştırmak, git config değiştirmek
- `.env`, `credentials`, `*.pem`, `secret.*` ile eşleşen dosyaları asla commit yapma
- `git add -A` / `git add .`'den kaçın
- Çok satırlı commit mesajları için HEREDOC + `Co-Authored-By: Claude` son eki
- Asla etkileşimli bayraklar kullanma (-i), boş commit yok
- Ön commit hook başarısız olursa → YENİ bir commit oluştur (`--amend` değil)

**Bırakılanlar** — adım adım commit iş akışı (3 adım), adım adım PR iş akışı (3 adım), PR başlık/gövde şablonu, `gh` komut referansları, `-uall` bayrağı uyarısı, yeniden temel oluşturmayla `--no-edit` uyarısı, `NEVER use TodoWrite or Agent tools during commit` kısıtlaması. Bunlar, Claude'un yalnızca eğitimden doğru şekilde oluşturduğu iş akışı ayrıntısıdır.

**Eklenen** — kompakt git durum satırı: dal + HEAD kısa-sha + konu + mevcut durum (20'ye kadar değiştirilen dosya, aksi takdirde sayım). Son commit listesi yok (Claude isteğe bağlı olarak `git log` çalıştırabilir).

### Beklenen tasarruflar (Opus 4.7 fiyatlandırması, $25/MTok output, $5/MTok input, $0,50/MTok cache okuma)

| Öğe | Orijinal | setup-git-lite ile | Tasarruf |
| ---- | -------- | ------------------- | ----- |
| System prompt yükleme (her yeni oturum) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Aynı oturumdaki tekrar çağrılar | ~1.700 tok cache_read/çağrı | ~280 tok cache_read/çağrı | ~1.420 tok/çağrı |
| 100 çağrılık oturum (Opus 4.7) | — | — | **~$0,11 tasarruf** |
| 20 oturum/gün × 22 iş günü | — | — | **~ayda $48 tasarruf** |

### Kullanım

```bash
/setup-git-lite status     # Salt okunur tanı — mevcut durum + ne değişeceği
/setup-git-lite install    # CC yerelini devre dışı bırak + minimal hook'umuzu etkinleştir
/setup-git-lite revert     # Varsayılanı geri yükle (agresif; aşağıya bakın)
/setup-git-lite dismiss-banner    # Ara sıra gelen öneri ipucunu sustur
/setup-git-lite undismiss-banner  # İpucunu yeniden etkinleştir
/setup-git-lite help       # Tam kullanım
```

### Kurulum semantiği

`install`, sağlamlık için **iki** yeri değiştirir:

1. `~/.claude/settings.json` — `"includeGitInstructions": false` ekler
2. Shell profili (`~/.zshrc`, `~/.bashrc`, vb.) — `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`'i dışa aktaran bir işaret bloğu ekler

İkisinden biri CC yerelini devre dışı bırakmak için yeterlidir; bir ortam geçersiz kılmasının yanlışlıkla yerel davranışı yeniden etkinleştirmemesi için ikisini de ayarlarız. Shell değişikliği yalnızca yeni shell'lerde geçerli olur.

### Geri dönme semantiği — agresif

`revert`, **tüm `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` dışa aktarmalarını shell profilinizden kaldırır**, bu skill'i kurmadan önce manuel olarak eklemiş olabilecekleriniz dahil. Bu kasıtlıdır — `revert` çalıştırdınız, bu yüzden temiz varsayılanı geri yükleriz. Shell profilinin zaman damgalı bir yedeğini her zaman önce oluştururuz.

Env değişkenine ilgisiz nedenlerle ihtiyacınız varsa, `revert`'i çalıştırmadan önce not alın ve sonra tekrar ekleyin.

### super-token-saver'ı kaldırmadan önce

**Önce `/setup-git-lite revert`'i çalıştırın**, aksi takdirde settings.json'da `includeGitInstructions: false` ile bırakılırsınız ama yedek hook olmadan (Claude hiç git kılavuzu almaz). Claude Code'un şu anda eklenti kaldırma yaşam döngüsü hook'u yok, bu yüzden bunu otomatikleştiremeyiz.

### Takas noktaları

Kaybettikleriniz (ve neden genellikle sorun olmadığı):
- Claude artık oturum başlangıcında önceden hesaplanmış `git status` / `git log -n 5` almaz. Yeni bir oturumda "ne değişti?" diye sorarsanız, Claude bu komutları kendisi çalıştırır (bir ekstra araç çağrısı, ~300 tok).
- Claude artık CC'nin kanonik 3 adımlı commit prosedürünü görmez. Yüzlerce commit akışı boyunca yaptığımız testlerde, eğitim düzeyi bilgisi kritik vakaları halleder (HEREDOC biçimlendirmesi, `--amend` yok, force-push yok) çünkü bunları açık kurallar olarak tutuyoruz.
- PR gövde şablonu (`## Summary` + `## Test plan`) eklenmez. Tam olarak bu formatı önemsiyorsanız, projenizin CLAUDE.md dosyasına koyun.

### Öneri başlığı

Makinenizde CC yerel git talimatları hâlâ etkinken, super-token-saver oturum başlangıcında **~%20 oranında** bir paragraf ipucu gösterir (ayrıca `/usage-view` ve `/report-limit` çıktılarında). `/setup-git-lite dismiss-banner` ile kalıcı olarak kapatın.

---

## 🛡️ Özellik 5: Token Guardian

**Cache süresinin dolması size paraya mal olduğu anda haber verir. İsterseniz $9'lık yeniden gönderimi engelleyebilir.**

Claude Code'un prompt cache'i 1 saat yaşar. Bundan daha uzun süre uzaklaşırsanız sona erer. Bir sonraki mesajınız tüm context'i tam fiyatıyla yeniden gönderir. 900K token'da bu tek seferde $9 demektir.

Token Guardian, son yanıtın ne zaman geldiğini hatırlar. 3.590 saniyeden fazla (TTL eksi 10 saniyelik tampon) geçmişse devreye girebilir. **Remote Control yüzünden varsayılan olarak kapalıdır.** Bir hook'un engelleme mesajı yerel olarak, uzak istemcinin asla almadığı bir sistem mesajı biçiminde render edilir; bu yüzden uzaktaki bir kullanıcı prompt'un hiçbir açıklama olmadan yok olduğunu görmüştü. Nerede oturduğunuza göre farklı davranan bir koruma sunmak yerine, onu kapattık. Remote Control hook mesajlarını iletmeye başladığında, varsayılan yeniden açılacak. O zamana kadar, iki moddan biriyle kendiniz açabilirsiniz.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude süresinin dolduğunu ilk satırında belirtir
export CC_TOKEN_SAVER_CACHE_GUARD=block   # prompt aşağıdaki mesajla bir kez reddedilir
```

`warn` modunda prompt geçer ve Claude yanıtına tek bir satırla başlar — cache'in sona erdiğini, bu turun tam bir yeniden gönderim olarak faturalandırıldığını ve bir saat veya daha uzun bir aradan sonra daha ucuz yolun `/clear` → `/s-continue` olduğunu söyler. Bu mesaj uzak istemciye gerçekten ulaşır, çünkü hook mesajları iletilmese de Claude'un yanıtı iletilir.

`block` modunda prompt, aşağıdaki mesajla bir kez reddedilir. Yeniden gönderin, geçecektir. Sert durdurmayı istediğinizde bunu yerel bir terminalde kullanın.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Engelleme mesajı OS yerel ayarınıza göre seçilen 23 dilde gösterilir ve her boşta kalma süresi için yalnızca bir kez tetiklenir.

**Arka plan ajanları asla engellenmez.** Yalnızca bir insanın yazdığı prompt'lar denetlenir. Arka plan ajanlarından ve görevlerinden gelen tamamlanma raporları -- ki bunlar artık genellikle başlatılmalarından bir saatten fazla süre sonra gelir -- doğrudan geçer. Uzun süre çalışan bir ajanın sonucu asla beklemede kalmaz veya kaybolmaz.

**Sonuç:** uyarı modunda $9'lık bir yeniden gönderimin ne zaman ve neden gerçekleştiğini her zaman bilirsiniz. Block modunda ise hiç gerçekleşmez: yakalanan her cache süre sonu $9 tasarruf demektir ve günde bir yakalamada bu $270/ay saf israfın ortadan kalkmasıdır.

> **API kullandıkça ödedeyseniz, bu daha sert çarpar.** Max Plan aboneleri $200'lük bir tampon içinde $9 kaybeder. Siz $9 gerçek para kaybedersiniz — sessizce, tekrar tekrar, her uzaklaştığınızda. Token Guardian'ın block modu her seferinde durdurur.

---

## 💡 Cache Gerçekte Nasıl Çalışır (Ve Çoğu Kullanıcının Neden %40'tan Fazlasını Buna Harcadığı)

Claude Code, her API çağrısında modele tüm konuşma geçmişini gönderir. "API çağrısı", "yazdığınız bir mesaj" anlamına gelmez. Tek bir prompt dahili araç çağrılarını tetikler — Grep, Read, Edit, Write — ve her biri ayrı bir API çağrısıdır. Tek bir prompt kolayca 10'dan fazla API çağrısına neden olabilir.

Prompt cache bu maliyeti %90 azaltır. Ama cache'in bir ömrü vardır.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 saat (ephemeral_1h)                 | 5 dakika                               |
| Cache yazma         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache okuma         | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Cache sona erdiğinde | Tam context tam fiyatıyla yeniden gönderilir | Düşük etki (context küçüktür)       |

Cache canlı olsa bile maliyetler birikir. Farkı göstermek için aşırı bir senaryo.

### Senaryo: Tam günlük kodlama (sabah 3 saat → öğle/toplantı 2 saat → öğleden sonra 3 saat)

Koşullar: Opus 4 fiyatlandırması, dakikada 1 prompt, prompt başına ~5 API çağrısı (~300 çağrı/saat).

#### ❌ super-token-saver olmadan

Çoğu çalışma Main oturumda gerçekleşir. Context hızla büyür.

| Aşama       | Durum                             | Context boyutu              | Maliyet                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Sabah 3s    | Kodlama (çoğunlukla Main'de)      | 100K → 600K (ort 350K)     | 900 çağrı × 350K × ＄0.50/M = ＄157.50  |
| Öğle/top.   | 2 saat uzakta                     | —                          | —                                      |
| Dönüş       | Cache sona erdi → tam yeniden gönderim | 600K tam fiyat        | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Dönüş       | /compact (özetle)                 | 600K → LLM'ye gönderildi  | 600K × ＄0.50/M + özet çıktısı = ~＄1.50 |
| Öğleden sonra 3s | Kodlama devam (context yeniden büyür) | 100K → 600K (ort 350K) | 900 çağrı × 350K × ＄0.50/M = ＄157.50 |
|             | Toplam                            |                            | ~＄326                                  |

> Bu kullanım düzeyinde, büyük olasılıkla 5 saatlik pencere hız sınırına ulaşacaksınız. **Maliyet kötü, ama asıl sorun çalışmanızın tamamen durmasıdır. Claude Code'un tam olarak karardığı an budur.**

#### ✅ super-token-saver ile

Ağır çalışma SubTask'lara devredilir. Main yalnızca tasarım/kararları yönetir.

| Aşama       | Durum                                        | Context boyutu                | Maliyet                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Sabah 3s    | Kodlama (Main: tasarım, SubTask: uygulama)   | Main 100K → 300K (ort 200K) | 900 çağrı × 200K × ＄0.50/M = ＄90 |
| Öğle/top.   | 2 saat uzakta                                | —                           | —                                  |
| Dönüş       | ⚡ Token Guardian (block modu) → /clear + /s-continue | —                        | ＄0 (LLM çağrısı yok)              |
| Öğleden sonra 3s | Kodlama devam eder                      | Main 100K → 300K (ort 200K) | 900 çağrı × 200K × ＄0.50/M = ＄90 |
|             | Toplam                                       |                             | ~＄180                              |

#### 💰 Sonuç

> **＄326 → ＄180. Günde ＄146 tasarruf. %45 maliyet azalması.**
>
> **Max Plan:** Daha az token = hız sınırına ulaşmazsınız. Çalışmanız durmaz. İşte gerçek fark budur.
>
> **API kullandıkça öde:** ＄146/gün × 22 iş günü = **faturanızdan doğrudan ＄3.200/ay.** Bu eklenti olmadan yoğun bir ay ＄7.000'i aşar. Onunla ＄4.000'in altında. Aynı çıktı.

### super-token-saver nerede devreye girer

```
[Session Start]
    │
    ├─ Session Architect → SubTask devir kalıbını otomatik ekler
    │                       Main context'i 250K altında tutar
    │
[Çalışırken]
    │
    ├─ Status Line → Gerçek zamanlı maliyet/context/hız sınırı izleme
    │                  Uyarı bölgesine girildiğinde anında uyarı
    │
[1+ saat boşta]
    │
    ├─ Token Guardian → Cache süresinin dolmasını algılar, uyarır (veya block modunda engeller)
    │
[Oturum yeniden başlatma]
    │
    └─ /s-continue → Önceki context'i sıfır maliyetle geri yükler (LLM çağrısı yok)
```

---

## 🔧 Kaynaktan Kurulum ve Özelleştirme

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver tamamen açık kaynaklıdır (Apache-2.0). Düz JavaScript + Bash — derlenmiş ikili yok, harici API çağrısı yok, telemetri yok. Her satır denetlenebilir. Bu README'deki her iddia, okuyabileceğiniz belirli bir dosyayla eşleşir.

- **hooks/** — Cache süre sonu eşiğini değiştirin, uyarı mesajlarını özelleştirin, oturum mimarisi kurallarını değiştirin
- **scripts/** — Analiz mantığı, rapor oluşturucu, durum çubuğu biçimlendirme
- **skills/** — /s-continue ve /usage-view'ın nasıl çalıştığı, prompt şablonları
- **locales/** — Çevirileri ekleyin/düzenleyin, yeni diller ekleyin
- **skills/usage-view/** — Pano UI/UX tasarım değişiklikleri

Kendinizinkini yapın. Fork edin, deneyin ve daha iyi bir şey bulursanız PR gönderin.

---

## 🌐 Desteklenen Diller

23 dil desteklenir. Claude Code kullanımına göre ilk 20 ülke ile küresel konuşmacı sayısına göre ilk 20 dil çapraz referanslanarak seçilmiştir. Görüntüleme dili, OS yerel ayarınızdan otomatik olarak algılanır. Manuel olarak da belirtebilirsiniz: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Mevcut çeviriler yapay zeka tarafından oluşturulmuştur. Anadili konuşan katkılar memnuniyetle karşılanır — `locales/` içindeki diliniz için JSON dosyasını düzenleyin ve bir PR gönderin.

---

## ⚖️ Bu Eklentinin Size Maliyeti

Eklenti, oturum başlangıcında context ekler. İşte tam olarak ne kadar:

| Ekleme | Ne zaman | Token | Amaç |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (bir kez) | ~1.100 | SubTask devir stratejisi + concise mode kuralları |
| Git context (git-lite etkinse) | SessionStart (bir kez) | ~280 | CC'nin yerel ~2.200 tok git talimatlarının yerini alır |
| Cache süre sonu uyarısı | Boşta > 59 dakikada (bir kez) | ~200 | Pahalı yeniden gönderimi işaretler, daha ucuz yolu gösterir |
| Status line | Her API çağrısı | 0 | Terminal durum çubuğuna render edilir, konuşma context'ine değil |

**Oturum başına net ek yük: ~1.400 token (bir kez, ilk çağrıdan sonra önbelleğe alınır).**

Opus fiyatlandırmasında ($0,50/MTok cache okuma), bu **API çağrısı başına $0,0007**'dir — bir sentin onda birinden az. 100 çağrılık bir oturumda: $0,07.

git-lite etkinse, eklenti oturum başına ~1.920 token **tasarruf eder** (2.200'ü 280 ile değiştirir). Net etki negatiftir — eklenti kaldırdığından daha az tüketir.

**API kullandıkça öde kullanıcıları için:** aylık $3.000 harcamada, eklenti ek yükü ayda $2'nin altındadır. Yalnızca cache süre sonu önlemesinden elde edilen tasarruf (haftada bir engellenen $9'lık yeniden gönderim), tek bir yakalamada bir yıllık ek yük maliyetini karşılar.

---

## 💡 İpuçları

### Cache'i anlayın ve paranın nereye gittiğini görün

- **1 prompt ≠ 1 API çağrısı.** Claude her Grep, Read veya Edit çağrısında tüm context yeniden gönderilir. Tek bir prompt kolayca 10'dan fazla API çağrısını tetikler. Gereksiz araç çağrılarını azaltmak ve maliyetleri düşürmek için net promptlar yazın.
- **Cache zamanlayıcısı son API çağrısından sıfırlanır, son prompt'unuzdan değil.** Çalışmaya devam edin ve cache asla sona ermez. Tehlike uzaklaşmaktır. Token Guardian bunun ne zaman gerçekleştiğini söyler ve `block` modunda prompt'u bir kez durdurur, böylece seçebilirsiniz: context'i sıfırla veya olduğu gibi devam et.
- **Context boyutu = maliyet çarpanı.** 200K'da aynı API çağrısı, 800K'da 4 kat daha pahalıdır. Durum çubuğu [CTX] %35'i (🟡) geçtiğinde, bu SubTask'lara daha fazla devretme sinyalidir.

### Maliyetleri düşüren alışkanlıklar

- **CLAUDE.md'yi kısa tutun.** Her API çağrısında system prompt'a yüklenir. Her satır para harcar.
- **Ağır işleri SubTask'lara devredin.** Kod üretimi, çoklu dosya düzenlemeleri, test çalıştırmaları Main'e ait değil. SubTask'ların daha küçük context ve daha ucuz cache katmanı vardır.
- **1+ saat uzaktaysanız?** `/clear` → dönün → `/s-continue`. Context $0 ile geri yüklendi.
- **[5H] %70'in üzerinde (🟡)?** Yavaşlayın. Hafif inceleme görevlerine geçin veya Main'in API çağrısı sayısını azaltmak için SubTask devrini artırın.
- **Yan sorular için `/btw` kullanın.** Konuşma geçmişine girmez, bu yüzden context'iniz kısa kalır.

### API kullandıkça öde: en önemli alışkanlıklar

Yukarıdakilerin hepsi geçerlidir, artı bu API'ye özgü öncelikler:

- **[CTX]'i hız göstergesi gibi izleyin.** Hiçbir hız sınırı sizi durdurmaz — ancak 500K+'da context, her API çağrısının olması gerekenden 2-3 kat daha fazlaya mal olduğu anlamına gelir. `/clear` → `/s-continue` ücretsizdir ve maliyet çarpanınızı taban çizgisine sıfırlar.
- **Haftalık `/usage-view` çalıştırın.** Max Plan kullanıcıları hız sınırına çarptıklarında doğal bir "ah" anına sahiptir. Siz değil — maliyetler sessizce tırmanır. Pano erken uyarı sisteminizdir.
- **Zihinsel bir günlük bütçe belirleyin.** Bir tavan olmadan, $200'lük günler fark edilmeden gerçekleşir. Durum çubuğunun RUN göstergesi tur başına maliyeti görünür kılar. Tek bir tur $1'ı (🔴) aşarsa, context'iniz çok büyüktür.

---

## 📚 Belgeler

- [Prompt Cache Kılavuzu](guides/prompt-cache-guide.md) — Maliyetinizin büyük bölümünün neden cache olduğu, sağlayıcılar genelinde caching'in nasıl çalıştığı (Anthropic, OpenAI, Gemini) ve nasıl yönetileceği ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Fable 5.1 - Opus 5 Maliyet Analizi](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Aynı kalitede Opus 5'ten en az %24–38 daha ucuz, 2.782 oturum üzerinden
- [Fable 5.1 - Opus 5 Maliyet Analizi (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Opus 4.7 - 4.6 Maliyet Analizi](guides/opus-4-7-vs-4-6-cost-analysis.md) — 8.563 API çağrısı genelinde yan yana maliyet karşılaştırması
- [Opus 4.7 - 4.6 Maliyet Analizi (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Lisans

Apache-2.0
