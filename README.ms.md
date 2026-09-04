# super-token-saver

**Satu-satunya plugin Claude Code yang benar-benar membaca kod sumber CC untuk mengetahui ke mana token anda pergi — dan membetulkannya secara automatik. Belanjakan lebih sedikit, kerja lebih lama.**

> Keputusan terukur: **pengurangan kos sebanyak 45%** pada beban kerja sebenar $326/hari → $180/hari. Delegasi SubTask automatik, pemulihan konteks tanpa kos, papan pemuka analitik penuh, dan pengawal tamat tempoh cache — dalam satu pemasangan, tanpa konfigurasi.

Berfungsi dengan **Max Plan ($200/bln)** dan **API bayar-per-penggunaan**. Plugin yang sama, ciri yang sama. Lebih kuat untuk setiap pengguna — terutama apabila setiap token adalah wang sebenar.

![Papan pemuka penggunaan — lihat dengan tepat ke mana token anda pergi](docs/images/usage-view-overview.png)

### Apa yang dilakukannya dalam 30 saat

| Ciri | Yang berlaku | Impak |
| ---- | ------------ | ----- |
| 🧠 Session Architect | Mendelegasi kerja berat ke SubTasks secara automatik (cache 37.5% lebih murah) | Konteks kekal kecil, kos menurun |
| 🪶 Concise Mode | Memangkas padding respons, mengekalkan kandungan | Lebih sedikit token output setiap respons |
| 🔄 /s-continue | Menggantikan /compact — sifar panggilan LLM, sifar kos, sifar kehilangan maklumat, dan kini turut memulihkan sesi **Codex** | Pemulihan konteks percuma pada kedua-dua tool |
| 🤝 /s-compact | Menulis serah tugas sesi yang dimuat secara automatik oleh /s-continue — menangkap penemuan sub-agent & hasil tool yang hilang daripada transkrip | Sesi seterusnya turut disambung dengan konteks tersembunyi |
| 📊 Status Line | Kos masa nyata, saiz konteks, had kadar — bawah 50ms | Lihat masalah sebelum ia menelan belanja |
| 📈 /usage-view | Papan pemuka HTML interaktif dengan analisis berkuasa AI | Forensik kos penuh dalam satu klik |
| ✂️ /setup-git-lite | Membuang 2,200 token tersembunyi yang CC suntikkan setiap sesi | ~$48/bln penjimatan dari arahan git sahaja |
| 🛡️ Token Guardian | Memberi amaran serta-merta apabila tamat tempoh cache menghantar semula konteks anda, atau menyekatnya dalam mod `block` | Tiada lagi kejutan $9 senyap |

---

## 😤 Masalahnya

**Kos tak kelihatan.** Tiada keterlihatan masa nyata. Tiada amaran "konteks anda di 800K". Tiada amaran "cache tamat tempoh 3 minit lalu". Anda tahu selepas kerosakan berlaku.

**Pembengkakan konteks.** Prompt yang sama pada konteks 200K berbanding 800K kosnya 4x lebih mahal. Setiap Read, Grep, Edit menghantar semula konteks penuh. Satu prompt kompleks mencetuskan 15+ panggilan API, setiap satu didarab dengan saiz konteks anda.

**Tamat tempoh cache.** Anda baru balik dari makan tengahari. Cache hilang. Satu prompt menghantar semula 900K token pada harga penuh. $9 sekali gus.

**Semuanya manual.** Pengurusan konteks, masa tamat tempoh cache, delegasi SubTask, pembersihan sesi. Tiada siapa boleh menjejak semua ini sambil mengekod dengan sesungguhnya.

**Max Plan ($200/bln)?** Semua di atas, ditambah had kadar tetingkap 5 jam yang menghentikan aliran kerja anda tanpa pemasa dan tanpa ETA.

**API bayar-per-penggunaan?** Semua di atas, kecuali tiada had atas. Satu cache miss = $9 wang sebenar. Sepuluh kali seminggu = $360/bln hanya kerana kesilapan. Selasa yang buruk dengan konteks yang bengkak boleh menelan belanja lebih daripada yang dibayar pelanggan Max Plan dalam sebulan.

super-token-saver mengendalikan semuanya secara automatik. **Pasang sekali. Selesai.**

---

## 🚀 Pemasangan

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Berfungsi secara automatik selepas dipasang. Tanpa konfigurasi. Memerlukan [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Untuk pemantauan langsung:

```
/setup-statusline install
```

Untuk memangkas 2,200 token tersembunyi dari arahan git terbina dalam CC ([butiran](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Ciri 1: Smart Session Architecture

**Pasang dan corak kerja yang dioptimumkan kos bermula secara automatik.**

Kebanyakan pengguna melakukan segala-galanya dalam sesi utama. Membaca fail, menghasilkan kod, menjalankan ujian. Setiap output terkumpul dalam konteks dan dihantar semula dengan setiap mesej. Sesi membengkak. Kos bertambah seperti bola salji.

Session Architect secara automatik menyuntik strategi delegasi pada permulaan sesi.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Peranan          | Reka bentuk, keputusan, semakan   | Pelaksanaan, penjanaan kod, pelbagai fail |
| Tahap cache      | 1 jam (ephemeral_1h)              | 5 minit                               |
| Kos tulis cache  | ＄10/MTok                          | ＄6.25/MTok                            |
| Saiz konteks     | ~94K purata                       | ~33K purata                           |

SubTasks mempunyai **penulisan cache 37.5% lebih murah** berbanding Main. Konteksnya juga jauh lebih kecil. Mendelegasi kerja berat ke SubTasks memangkas kos secara dramatik.

**Keputusan:** Konteks kekal di bawah 250K berbanding membesar hingga 600K+. Output kerja yang sama, separuh kos token. Sepenuhnya automatik.

---

## 🪶 Concise Mode

**Kandungan yang sama. Kurang padding. Aktif secara lalai.**

Hook SessionStart juga menyuntik peraturan gaya respons yang berjalan dalam **setiap sesi dan setiap model** — tanpa bendera, tanpa persediaan. Tiga perkara berubah:

- **Tiada pembukaan** — tiada "Biar saya semak…", "Saya akan…", mengulang soalan anda, atau meringkaskan apa yang sudah ditunjukkan diff
- **Format yang tepat untuk kandungan** — mata untuk senarai, prosa untuk penaakulan (pertukaran, kausaliti, rasional). Tiada yang dipaksakan
- **Ungkapan yang lebih padat** — mata yang sama, lebih sedikit perkataan. Prosa yang lebih jelas adalah prosa yang lebih pendek

Had keras: jangan sekali-kali hilangkan kandungan, langkau pengesahan, atau runtuhkan nuansa ke dalam satu ayat. Kandungan kekal penuh; hanya pembungkusnya yang mengecil.

Pasang sekali, terpakai di mana-mana.

---

## 🔄 Ciri 2: /s-continue — Pemulihan Konteks

**Menggantikan `/compact`. Sifar panggilan LLM. Sifar kos token. Sifar kehilangan maklumat.**

`/compact` menghantar keseluruhan konteks anda (~1M token) ke LLM untuk dimampatkan menjadi ringkasan 3.3%. Jika cache telah tamat tempoh, itu sahaja sudah mencetuskan cache semula penuh. Kehilangan maklumat tidak dapat dielakkan.

`/s-continue` mengambil pendekatan yang sama sekali berbeza. Ia memproses transkrip sesi sebelumnya dan memuatnya terus. Tiada panggilan LLM. Tiada kos. Perbualan asal dipulihkan seadanya.

|                         | /compact                                    | /s-continue                                   |
| ----------------------- | ------------------------------------------- | ------------------------------------------- |
| Cara ia berfungsi       | Menghantar konteks penuh ke LLM untuk diringkaskan | Memproses transkrip, membaca terus     |
| Panggilan LLM           | Diperlukan (biasanya 100K+ token)            | 0                                           |
| Kos token               | Tinggi                                       | 0                                           |
| Kehilangan maklumat     | Ya (ringkasan 3.3%)                          | Tiada (asal dikekalkan)                     |
| Kelajuan pemprosesan    | Puluhan saat                                 | < 1 saat (walaupun fail 60MB+)              |
| Apabila cache tamat tempoh | Kos cache semula penuh ditambah           | Tiada kesan                                 |
| Pemulihan pelbagai sesi | Tidak mungkin                                | Disokong                                    |

Penggunaan: `/clear` kemudian `/s-continue`. Anda akan melihat senarai sesi sebelumnya. Pilih satu untuk dipulihkan. Untuk pemulihan pantas: `/s-continue last`.

**Keputusan:** Sambung semula kerja sebelumnya tanpa kos. Tiada kehilangan maklumat. Memproses transkrip 60MB+ dalam kurang dari 1 saat.

---
### 🤝 Pasangannya: `/s-compact` — serah tugas lapisan tersembunyi

`/s-continue` memulihkan transkrip — apa yang anda dan Claude katakan. Tetapi pengetahuan paling berguna dalam satu sesi kerja selalunya berada DI LUAR dialog itu: apa yang ditemui oleh sub-agent (transkripnya adalah fail berasingan yang tidak sekali-kali dimuat oleh pemulihan), nombor penting dalam hasil tool (jumlah ujian, penanda aras), atau pengajaran daripada proses ("tidak dapat dihasilkan semula headless ← rupanya masalah pada build, bukan kod").

Jalankan `/s-compact` pada penghujung sesi dan ia akan menyuling lapisan tersembunyi itu menjadi satu serah tugas, disimpan ke `~/.claude/super-token-saver-data/<project>/handoff.md`. Pada sesi seterusnya, `/s-continue` memuatnya secara automatik di atas transkrip yang dipulihkan — tanpa perlu tampal manual.

|                     | `/s-continue` sahaja            | `/s-compact` + `/s-continue` (pasangan)         |
| Memulihkan          | Transkrip (apa yang disebut)     | Transkrip ditambah lapisan tersembunyi           |
| Penemuan sub-agent  | Hilang (fail berasingan)         | Disuling ke dalam serah tugas                     |
| Nombor hasil tool   | Hanya jika dipetik ke chat       | Diekstrak secara sengaja                          |
| Pengajaran proses   | —                                | Ditangkap supaya jalan buntu tidak diulang        |

Aliran kerja: tamatkan sesi dengan `/s-compact` → mulakan sesi seterusnya dengan `/s-continue`.

### 🔀 Dua tool, satu sejarah — sesi Codex turut dipulihkan di sini

Codex menulis sesinya ke `~/.codex/sessions/`; Claude Code menulis ke `~/.claude/projects/`. Tiada tool yang membaca fail tool yang satu lagi. Jadi sprint yang kehabisan bajet dalam Codex dahulu tidak dapat dicapai daripada Claude Code, dan begitu juga sebaliknya.

`/s-continue` kini menyenaraikan dan memulihkan kedua-duanya. Rollout Codex tidak diserahkan kepada parser kedua — sebaliknya ia ditulis semula ke bentuk yang ditulis oleh Claude Code, **satu baris output bagi setiap baris input**, supaya pipeline yang sama boleh melayani kedua-duanya dan setiap penanda `L{n}` masih menuju ke baris tepat dalam fail Codex asal. Diukur: rollout 12 MB, 1,540 baris diproses awal dalam **0.13 s**.

|                        | Sesi Claude Code | Sesi Codex |
| ---------------------- | ------------------- | ------------- |
| Disenaraikan oleh `/s-continue` | Ya | Ya, terhad kepada project semasa |
| Dipulihkan tanpa kos LLM | Ya | Ya |
| Cari `L{n}` ke fail asal | Ya | Ya — nombor baris adalah milik rollout itu sendiri |
| Pemulihan kehilangan konteks (`#0`) | `/compact`, auto-compact | Compaction dan thread rollback milik Codex sendiri |
| Serah tugas `/s-compact` | Dikongsi bagi setiap project — tulis dalam satu tool, muatkan dalam tool yang lain |

```
/s-continue codex                    hanya sesi Codex
/s-continue codex : rust migration   turn yang sepadan dengan sesuatu topik, dipulihkan sepenuhnya
```

Dua butiran inilah yang membezakan senarai yang betul daripada senarai yang kelihatan betul tetapi salah: `session_id` Codex sebenarnya ialah id **thread**, yang diwarisi oleh mana-mana sub-agent yang di-spawn, jadi sesi dikunci mengikut `payload.id` dan rollout sub-agent ditapis dengan cara yang sama seperti transkrip subtask Claude Code sudah ditapis. Manakala `<codex_internal_context source="goal">` disuntik secara automatik oleh sistem, jadi ia kekal dalam konteks yang dipulihkan tetapi tidak pernah dikira sebagai turn yang anda taip.

Plugin ini turut dipasang dalam Codex — lihat **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)). `usage-view`, `report-limit` dan `setup-statusline` buat masa ini kekal khusus untuk Claude Code sahaja.

---

## 📊 Ciri 3: Baris Status Langsung

**Pemantauan token/kos masa nyata. Overhead bawah 50ms.**

Jalankan `/setup-statusline install` sekali dan bar status berterusan muncul di bahagian bawah Claude Code.

**Operasi normal** — setiap metrik sekali imbas, tanpa peralihan konteks:

![Baris status dalam keadaan normal](docs/images/statusline-normal.png)

**Had kadar dicapai** — 5H bertukar merah pada 102%, kiraan undur menunjukkan tepat bila anda kembali, dan tindakan `/report-limit` satu ketik muncul secara automatik:

![Baris status apabila had kadar dilimitkan](docs/images/statusline-rate-limited.png)

| Penunjuk         | Yang ditunjukkan                             | 🟢 Normal | 🟡 Amaran | 🔴 Kritikal |
| ---------------- | -------------------------------------------- | --------- | --------- | ----------- |
| RUN (delta)      | Kos panggilan API terakhir                   | < ＄0.30   | >= ＄0.30  | >= ＄1.00    |
| RUN (kumulatif)  | Kos kumulatif untuk folder ini               | —         | —         | —           |
| 5H               | Penggunaan tetingkap 5 jam + kiraan undur reset | < 70%  | >= 70%    | >= 90%      |
| CTX              | Penggunaan tetingkap konteks                 | < 35%     | >= 35%    | >= 70%      |

Apabila mana-mana penunjuk mencapai amaran atau kritikal, petunjuk `→ /usage-view current` muncul secara automatik.

Untuk membuang: `/setup-statusline uninstall` (konfigurasi sebelumnya dipulihkan secara automatik).

**Keputusan:** Setiap masalah kos kelihatan dalam masa nyata. Overhead bawah 50ms — tiada kelewatan yang ketara.

> **Menggunakan API bayar-per-penggunaan?** Penunjuk 5H dan W disembunyikan secara automatik — anda tidak mempunyai tetingkap had kadar. Yang kekal adalah yang penting: RUN (kos masa nyata setiap giliran) dan CTX (saiz konteks). Dua tuil yang mengawal bil anda, sentiasa kelihatan.

---

## 📈 Papan Pemuka Penggunaan (/usage-view)

**Akhirnya jawab: "Ke mana semua wang itu pergi?"**

Pengguna Max Plan mencapai had kadar dan tertanya-tanya mengapa. Pengguna API membuka invois Anthropic dan tertanya-tanya bagaimana. Dalam kedua-dua kes, soalannya sama: sesi mana yang membakar token paling banyak? Bila kos melonjak? Apakah corak dalam penggunaan anda? Sehingga kini — semuanya tidak kelihatan.

`/usage-view` menunjukkan segalanya. Papan pemuka HTML interaktif dibuka dalam pelayar anda, membolehkan anda menganalisis corak penggunaan dan mengesan punca akar lonjakan kos. Tanpa kebergantungan luaran. Berfungsi secara bebas. Boleh dikongsi sebagai fail.

**$4,196 dalam 31 hari. Ke mana semuanya pergi?** Sekali pandang — jumlah kos, pecahan token mengikut jenis, nisbah kecekapan cache, dan bilangan sesi. Carta donut terus menunjukkan bahawa 65% perbelanjaan anda adalah pembacaan cache (yang normal dan sihat):

![Gambaran keseluruhan papan pemuka penggunaan](docs/images/usage-view-overview.png)

**Sebelum vs. selepas — diukur, bukan diteka.** Penanda "Plugin installed" berputus-putus oren membahagi garis masa kos anda kepada dua. Bar harian ditindih mengikut jenis token (Input/Output/Cache Write/Cache Read) supaya anda boleh melihat dengan tepat komponen mana yang berubah selepas pemasangan. Garis purata menunjukkan arah aliran:

![Arah aliran kos harian](docs/images/usage-view-daily-trend.png)

**Bila anda paling banyak membakar?** Kos mengikut jam berdasarkan masa hari dan pecahan hari dalam seminggu. Togol antara purata hari aktif, purata semua hari, atau maksimum. Ikon api menandai jam termahal anda — corak yang kelihatan (maraton lewat malam, lonjakan Rabu) terus ketara:

![Corak kos mengikut jam dan hari dalam seminggu](docs/images/usage-view-hourly-pattern.png)

**Adakah anda semakin cekap?** Nisbah Total/Output mengukur berapa banyak token digunakan bagi setiap token output yang dihasilkan. Lebih rendah lebih baik. Penanda "Plugin installed" membolehkan anda membandingkan sebelum vs. selepas. Lonjakan = cache miss atau but semula sesi:

![Arah aliran kecekapan](docs/images/usage-view-efficiency.png)

**Setiap panggilan API, diplot mengikut saiz konteks dan kos.** Ini adalah carta yang menjadikan struktur kos jelas. Setiap titik adalah satu panggilan API. Merah = Opus, biru = Sonnet, hijau = Haiku. Garis putus-putus adalah harga teori — jika titik anda di atas garis, anda membayar terlalu mahal. Togol ke paparan **User Turn** untuk melihat kos setiap giliran perbualan berbanding setiap panggilan API.
Layang-layangkan kursor ke mana-mana titik untuk melihat teks prompt sebenar, bilangan token, dan pecahan kos penuh (Input/Output/Cache Write/Cache Read):

![Kos mengikut Saiz Konteks — carta taburan](docs/images/usage-view-cost-scatter.png)

**Seberapa besar konteks anda?** Kebanyakan panggilan berkelompok di bawah 250K. Ekor panjang di atas 350K adalah tempat kos meledak — carta ini menunjukkan dengan tepat seberapa kerap anda berada dalam zon bahaya:

![Taburan Saiz Konteks](docs/images/usage-view-context-dist.png)

**Jadual pengekodan anda, dihargai mengikut jam.** Peta haba tetingkap 5 jam sepanjang 30 hari. Hijau (<$15/j), oren ($15-30/j), merah ($30+/j). Ikon tengkorak (💀) menandai tetingkap di mana anda mencapai had kadar. Gelongsor kos di bahagian atas menapis tetingkap murah supaya yang mahal terserlah — seret untuk mencari hari terburuk anda dengan serta-merta. Togol antara paparan tetingkap 5 jam dan blok 1 jam:

![Peta haba kalendar penggunaan mengikut jam](docs/images/usage-view-calendar.png)

**Klik mana-mana sel untuk menyelami sesi tetingkap tersebut.** Setiap sesi dalam slot masa tersebut, dengan kos, bilangan mesej, pecahan token, dan mesej pertama/terakhir sebenar daripada setiap perbualan. Kembangkan "Top Token Conversations" untuk melihat pertukaran spesifik mana yang paling banyak dibakar — setiap entri menunjukkan teks prompt, tag amaran kos, dan petunjuk pengoptimuman:

![Panel butiran sesi](docs/images/usage-view-session-drilldown.png)

**Analisis berkuasa AI (pilihan).** Apabila anda menjalankan `/usage-view` tanpa `--no-ai`, penganalisis AI membaca semua data papan pemuka anda — dengan rujukan harga API yang sudah tertanam — dan menghasilkan laporan bertulis: pendorong kos, anomali, cadangan pengoptimuman. Dipaparkan dalam bahasa OS anda secara automatik (23 bahasa, termasuk RTL; carta/jadual sentiasa LTR):

**Ke mana wang pergi** — jumlah perbelanjaan, pendorong kos mengikut jenis token, arah aliran mingguan, dan impak plugin dalam angka sebenar:

![Analisis AI — pecahan kos](docs/images/usage-view-ai-report-1.png)

**Bila dan bagaimana anda bekerja** — jam puncak, hari tersibuk, taburan panggilan API, dan corak had kadar yang mendedahkan peluang pengoptimuman:

![Analisis AI — corak kerja](docs/images/usage-view-ai-report-2.png)

**Apa yang perlu dilakukan** — cadangan konkrit berasaskan data yang disesuaikan dengan penggunaan sebenar anda. Peralihan model, pengurusan konteks, strategi sesi:

![Analisis AI — cadangan](docs/images/usage-view-ai-report-3.png)

**Kongsikan.** Keseluruhan papan pemuka adalah satu fail HTML kendiri — semua data tertanam, tiada pelayan diperlukan. Hantar kepada pasukan, pengurus, atau akauntan anda. Tanpa kebergantungan luaran. Berfungsi luar talian. Gunakan mod `private` untuk memadam semua teks prompt sebelum berkongsi — analitik kos kekal utuh sementara kandungan perbualan dibuang.

```
/usage-view                  # Semua masa, semua projek
/usage-view current          # Hanya tetingkap 5 jam semasa
/usage-view last 7 days      # 7 hari terakhir
/usage-view locale ja        # Bahasa Jepun
/usage-view --no-ai          # Langkau analisis AI (lebih pantas)
/usage-view private          # Padamkan teks prompt (selamat untuk dikongsi)
```

---

## 🔬 Penyelidikan Had Kadar (/report-limit)

**Projek berpaksikan komuniti untuk merekayasa balik formula had kadar.**

Anthropic tidak menerbitkan formula tepat untuk tetingkap 5 jam. Mari kita fikirkan bersama.

Apabila anda mencapai had kadar, jalankan `/report-limit`. Data penggunaan semasa anda secara automatik diserahkan sebagai GitHub Discussion. Lebih banyak data yang kami kumpulkan, lebih jelas formulanya.

---

## ✂️ Ciri 4: /setup-git-lite — Pangkas Arahan Git Terbina Dalam CC

**Kami membaca kod sumber Claude Code. Kami menemui 2,200 token tersembunyi yang disuntik setiap sesi yang anda bayar diam-diam.**

### Penemuan

Pada 2026-04-12, sebuah [isu GitHub](https://github.com/anthropics/claude-code/issues/47107) mendedahkan bahawa tetapan `includeGitInstructions` terbina dalam Claude Code secara senyap membakar token setiap sesi. Pembiakan bebas melalui [gist ini (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) mengesahkan angka-angkanya: **+6,031 token dalam penulisan cache** setiap sesi selepas setiap git commit, **+1,690 token dalam pembacaan cache** pada setiap panggilan API.

### Analisis sumber CC — ke mana token pergi

Kami mengesan token ke dua titik suntikan bebas dalam kod sumber Claude Code (v2.1.88):

**1. Snapshot `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` mengumpul branch + main branch + user.name + status penuh (sehingga 2000 aksara) + **5 commit terbaru**
- Digabungkan dan ditambah pada system prompt melalui `appendSystemContext` (`utils/api.ts:437`)
- Setiap commit baru, setiap fail yang diubah suai baru, setiap pertukaran branch mengubah teks → pembatalan sah cache awalan

**2. Arahan alur kerja Commit/PR (~1,700 tok) — penerangan alat Bash**
- `tools/BashTool/prompt.ts:53` menambah 60+ baris protokol keselamatan, prosedur commit langkah demi langkah, contoh HEREDOC, dan templat penciptaan PR ke penerangan alat `Bash`
- Di-cache bersama system prompt, tetapi dihantar sebagai parameter `tools[]`

### Mengapa ini mahal

Struktur cache (`utils/api.ts:321` `splitSysPromptPrefix`) mempunyai tiga laluan bergantung pada sama ada anda mempunyai alat MCP aktif:

- **Laluan A** (MCP aktif — kebanyakan pengguna): `gitStatus` berada dalam blok `cacheScope: 'org'`. Sebarang perubahan → keseluruhan blok di-cache semula pada permulaan sesi berikutnya → 6K tok `cache_create` miss.
- **Laluan B** (tanpa MCP): `gitStatus` masuk ke blok dinamik `cacheScope: null`, yang bermakna dihantar semula sebagai `input_tokens` baru pada setiap panggilan API — tiada cache miss, tetapi juga tiada penjimatan cache.
- **Laluan C** (pembekal 3P / beta eksperimental dilumpuhkan): sama seperti Laluan A.

Dalam sesi interaktif biasa, arahan commit/PR (1.7K tok) terkumpul **pada setiap panggilan API** melalui `cache_read`. Dalam sesi 100-panggilan dengan harga Opus 4.7, itu kira-kira **$0.08 setiap sesi** hanya untuk arahan yang kebanyakannya sudah dilindungi oleh latihan Claude.

### Cara super-token-saver mengendalikannya

`/setup-git-lite` melumpuhkan laluan asli dan menyuntik **pengganti 280-token yang dikurasi** melalui hook SessionStart. Kami mengekalkan tepat perkara-perkara yang mengatasi tingkah laku lalai Claude (peraturan keselamatan), dan membuang segala-galanya yang sudah diketahui Claude dari latihan (alur kerja langkah demi langkah, templat PR, corak penggunaan gh).

**Dikekalkan — 11 peraturan pengesampingan kritikal** (yang mengalihkan sifat membantu lalai Claude kepada kehati-hatian):
- Jangan sekali-kali commit/push/amend/PR/tag/merge tanpa permintaan eksplisit pengguna
- Jangan sekali-kali melangkau hook, force-push ke main/master, menjalankan operasi merosakkan, mengubah suai git config
- Jangan sekali-kali commit fail yang sepadan dengan `.env`, `credentials`, `*.pem`, `secret.*`
- Elakkan `git add -A` / `git add .`
- HEREDOC untuk mesej commit berbilang baris + trailer `Co-Authored-By: Claude`
- Jangan sekali-kali menggunakan bendera interaktif (-i), tiada commit kosong
- Jika hook pre-commit gagal → buat commit BARU (bukan `--amend`)

**Dibuang** — alur kerja commit langkah demi langkah (3 langkah), alur kerja PR langkah demi langkah (3 langkah), templat tajuk/isi PR, rujukan perintah `gh`, amaran bendera `-uall`, amaran `--no-edit` dengan rebase, kekangan `NEVER use TodoWrite or Agent tools during commit`. Ini adalah keverbosan alur kerja yang Claude susun dengan betul hanya dari latihan.

**Ditambah** — baris status git yang padat: branch + HEAD short-sha + subjek + status semasa (sehingga 20 fail yang diubah suai, jika tidak bilangannya). Tiada senarai commit terbaru (Claude boleh menjalankan `git log` atas permintaan).

### Penjimatan yang dijangka (harga Opus 4.7, $25/MTok output, $5/MTok input, $0.50/MTok baca cache)

| Item | Asal | Dengan setup-git-lite | Dijimat |
| ---- | ---- | --------------------- | ------- |
| Muat system prompt (setiap sesi baru) | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| Panggilan berulang dalam sesi yang sama | ~1,700 tok cache_read/panggilan | ~280 tok cache_read/panggilan | ~1,420 tok/panggilan |
| Sesi 100-panggilan (Opus 4.7) | — | — | **~$0.11 dijimat** |
| 20 sesi/hari × 22 hari bekerja | — | — | **~$48 dijimat/bln** |

### Penggunaan

```bash
/setup-git-lite status     # Diagnostik baca-sahaja — status semasa + apa yang akan berubah
/setup-git-lite install    # Lumpuhkan CC native + aktifkan hook minimal kami
/setup-git-lite revert     # Pulihkan lalai (agresif; lihat di bawah)
/setup-git-lite dismiss-banner    # Senyapkan petua cadangan sekali-sekala
/setup-git-lite undismiss-banner  # Aktifkan semula petua
/setup-git-lite help       # Penggunaan penuh
```

### Semantik pemasangan

`install` mengubah suai **dua** tempat untuk keteguhan:

1. `~/.claude/settings.json` — menambah `"includeGitInstructions": false`
2. Profil shell (`~/.zshrc`, `~/.bashrc`, dll.) — menambah blok penanda yang mengeksport `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Mana-mana satu sudah cukup untuk melumpuhkan CC native; kami menetapkan kedua-duanya agar pengesampingan persekitaran tidak secara tidak sengaja mengaktifkan semula tingkah laku asli. Perubahan shell hanya berkuat kuasa dalam shell baru.

### Semantik revert — agresif

`revert` **membuang SEMUA eksport `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` dari profil shell anda**, termasuk yang mungkin anda tambah secara manual sebelum memasang kemahiran ini. Ini disengajakan — anda menjalankan `revert`, jadi kami memulihkan lalai bersih. Kami sentiasa membuat sandaran berstempel masa profil shell terlebih dahulu.

Jika anda memerlukan pemboleh ubah persekitaran untuk sebab yang tidak berkaitan, catat sebelum menjalankan `revert` dan tambah semula selepasnya.

### Sebelum menyahpasang super-token-saver

**Jalankan `/setup-git-lite revert` terlebih dahulu**, atau anda akan ditinggalkan dengan `includeGitInstructions: false` dalam settings.json anda tetapi tanpa hook pengganti (Claude tidak mendapat panduan git langsung). Claude Code pada masa ini tidak mempunyai hook kitaran hayat penyahpasangan plugin, jadi kami tidak boleh mengautomasikan ini.

### Pertukaran

Yang anda kehilangan (dan mengapa biasanya tidak mengapa):
- Claude tidak lagi menerima `git status` / `git log -n 5` yang telah dikira sebelumnya pada permulaan sesi. Jika anda bertanya "apa yang berubah?" dalam sesi baru, Claude akan menjalankan perintah tersebut sendiri (satu panggilan alat tambahan, ~300 tok).
- Claude tidak lagi melihat prosedur commit 3-langkah kanonik CC. Dalam pengujian kami pada ratusan alur commit, pengetahuan tahap latihan mengendalikan kes kritikal (format HEREDOC, tiada `--amend`, tiada force-push) kerana kami mengekalkannya sebagai peraturan eksplisit.
- Templat isi PR (`## Summary` + `## Test plan`) tidak disuntik. Jika anda mengambil berat tentang format tersebut, masukkan ke dalam CLAUDE.md projek anda.

### Sepanduk cadangan

Apabila arahan git asli CC masih aktif pada mesin anda, super-token-saver menunjukkan petua satu perenggan pada permulaan sesi **~20% masa** (ditambah dalam output `/usage-view` dan `/report-limit`). Matikan secara kekal dengan `/setup-git-lite dismiss-banner`.

---

## 🛡️ Ciri 5: Token Guardian

**Memberitahu anda serta-merta apabila tamat tempoh cache menelan belanja. Boleh menyekat penghantaran semula $9 jika anda mahu.**

TTL cache prompt Claude Code ialah 1 jam. Pergi lebih lama daripada itu dan ia tamat tempoh. Mesej anda seterusnya menghantar semula keseluruhan konteks pada harga penuh. Pada 900K token, itu $9 sekali gus.

Token Guardian mengingati bila respons terakhir diterima. Jika lebih daripada 3,590 saat telah berlalu (TTL tolak penimbal 10 saat), ia boleh bertindak. **Ia dimatikan secara lalai, kerana Remote Control.** Mesej sekatan daripada hook dipaparkan secara tempatan sebagai mesej sistem yang tidak pernah diterima oleh klien jauh, jadi pengguna jauh melihat prompt hilang tanpa sebarang penjelasan. Daripada menghantar ciri pelindung yang berkelakuan berbeza bergantung di mana anda berada, kami mematikannya. Apabila Remote Control mula menghantar mesej hook, lalai itu akan dihidupkan semula. Sehingga itu, hidupkan sendiri menggunakan salah satu daripada dua mod.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude menyebut tamat tempoh dalam baris pertama responsnya
export CC_TOKEN_SAVER_CACHE_GUARD=block   # prompt ditolak sekali dengan mesej di bawah
```

Dalam mod `warn`, prompt diteruskan, dan Claude membuka responsnya dengan satu baris menyatakan cache telah tamat tempoh, giliran ini dicaj untuk keseluruhan konteks, dan selepas rehat sejam atau lebih laluan yang lebih murah untuk kembali ialah `/clear` → `/s-continue`. Ini sampai kepada klien jauh, kerana respons Claude dihantar walaupun mesej hook tidak.

Dalam mod `block`, prompt ditolak sekali dengan mesej di bawah. Hantar semula dan ia akan melalui. Gunakannya dalam terminal tempatan apabila anda mahukan sekatan keras.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Mesej sekatan dipaparkan dalam 23 bahasa, dipilih daripada lokal OS anda, dan tercetus sekali setiap tempoh tidak aktif.

**Ejen latar belakang tidak pernah disekat.** Hanya apa yang ditaip oleh manusia mendapat pemeriksaan. Laporan selesai daripada ejen dan tugas latar belakang -- yang kini secara rutin tiba lebih daripada sejam selepas dilancarkan -- terus lalu, jadi hasil ejen yang berjalan lama tidak pernah tertangguh atau hilang.

**Keputusan:** dalam mod amaran (`warn`) anda sentiasa tahu bila penghantaran semula $9 berlaku, dan mengapa. Dalam mod block, ia tidak berlaku langsung: setiap tamat tempoh yang ditangkap menyimpan $9, dan pada kadar sekali sehari itu bermakna $270/bln pembaziran tulen dihapuskan.

> **Jika anda menggunakan API bayar-per-penggunaan, ini lebih terasa.** Pelanggan Max Plan kehilangan $9 dalam penimbal $200. Anda kehilangan $9 wang sebenar — diam-diam, berulang kali, setiap kali anda pergi. Token Guardian dalam mod block menghentikannya setiap kali.

---

## 💡 Cara Cache Sebenarnya Berfungsi (Dan Mengapa Kebanyakan Pengguna Membazir 40%+)

Claude Code menghantar keseluruhan sejarah perbualan ke model pada setiap panggilan API. "Panggilan API" tidak bermakna "satu mesej yang anda taip." Satu prompt mencetuskan panggilan alat dalaman — Grep, Read, Edit, Write — dan setiap satu adalah panggilan API berasingan. Satu prompt boleh dengan mudah menyebabkan 10+ panggilan API.

Cache prompt mengurangkan kos ini sebanyak 90%. Tetapi cache mempunyai jangka hayat.

|                     | Main Session                               | SubTask                                    |
| ------------------- | ------------------------------------------ | ------------------------------------------ |
| TTL Cache           | 1 jam (ephemeral_1h)                       | 5 minit                                    |
| Tulis cache         | ＄10/MTok                                   | ＄6.25/MTok                                 |
| Baca cache          | ＄0.50/MTok                                 | ＄0.50/MTok                                 |
| Apabila cache tamat tempoh | Konteks penuh dihantar semula pada harga penuh | Kesan rendah (konteks kecil)         |

Walaupun dengan cache yang aktif, kos terkumpul. Berikut adalah senario ekstrem untuk menunjukkan perbezaannya.

### Senario: Pengekodan sehari penuh (3j pagi → 2j makan tengahari/mesyuarat → 3j petang)

Syarat: harga Opus 4, 1 prompt seminit, ~5 panggilan API setiap prompt (~300 panggilan/jam).

#### ❌ Tanpa super-token-saver

Kebanyakan kerja berlaku dalam Main session. Konteks membesar dengan cepat.

| Fasa        | Situasi                           | Saiz konteks               | Kos                                    |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Pagi 3j     | Pengekodan (kebanyakan dalam Main) | 100K → 600K (purata 350K) | 900 panggilan × 350K × ＄0.50/M = ＄157.50 |
| Makan tengahari/mesyuarat | Pergi 2 jam           | —                          | —                                      |
| Kembali     | Cache tamat tempoh → hantar semula penuh | 600K harga penuh    | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Kembali     | /compact (ringkaskan)             | 600K → dihantar ke LLM    | 600K × ＄0.50/M + output ringkasan = ~＄1.50 |
| Petang 3j   | Pengekodan diteruskan (konteks membesar semula) | 100K → 600K (purata 350K) | 900 panggilan × 350K × ＄0.50/M = ＄157.50 |
|             | Jumlah                            |                            | ~＄326                                  |

> Pada tahap penggunaan ini, anda berkemungkinan akan mencapai had kadar tetingkap 5 jam. **Kosnya buruk, tetapi masalah sebenar adalah kerja anda berhenti sepenuhnya. Ini adalah tepat saat Claude Code gelap.**

#### ✅ Dengan super-token-saver

Kerja berat didelegasi ke SubTasks. Main hanya mengendalikan reka bentuk/keputusan.

| Fasa        | Situasi                                       | Saiz konteks                  | Kos                               |
| ----------- | --------------------------------------------- | ----------------------------- | --------------------------------- |
| Pagi 3j     | Pengekodan (Main: reka bentuk, SubTask: pelaksanaan) | Main 100K → 300K (purata 200K) | 900 panggilan × 200K × ＄0.50/M = ＄90 |
| Makan tengahari/mesyuarat | Pergi 2 jam                     | —                             | —                                 |
| Kembali     | ⚡ Token Guardian (mod block) → /clear + /s-continue | —                            | ＄0 (tiada panggilan LLM)          |
| Petang 3j   | Pengekodan diteruskan                         | Main 100K → 300K (purata 200K) | 900 panggilan × 200K × ＄0.50/M = ＄90 |
|             | Jumlah                                        |                               | ~＄180                             |

#### 💰 Keputusan

> **＄326 → ＄180. ＄146 dijimat setiap hari. Pengurangan kos 45%.**
>
> **Max Plan:** Lebih sedikit token = anda tidak mencapai had kadar. Kerja anda tidak berhenti. Itulah perbezaan sebenar.
>
> **API bayar-per-penggunaan:** ＄146/hari × 22 hari bekerja = **＄3,200/bln terus dari invois anda.** Bulan yang berat tanpa plugin ini melepasi ＄7,000. Dengan plugin ini, di bawah ＄4,000. Output yang sama.

### Di mana super-token-saver berperanan

```
[Mula Sesi]
    │
    ├─ Session Architect → Menyuntik corak delegasi SubTask secara automatik
    │                       Mengekalkan konteks Main di bawah 250K
    │
[Bekerja]
    │
    ├─ Status Line → Pemantauan kos/konteks/had kadar masa nyata
    │                  Amaran serta-merta apabila memasuki zon amaran
    │
[Tidak aktif 1+ jam]
    │
    ├─ Token Guardian → Mengesan tamat tempoh cache, memberi amaran (atau menyekat dalam mod block)
    │
[But semula sesi]
    │
    └─ /s-continue → Memulihkan konteks sebelumnya tanpa kos (tanpa panggilan LLM)
```

---

## 🔧 Pasang Sumber & Penyesuaian

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver sepenuhnya sumber terbuka (Apache-2.0). JavaScript + Bash biasa — tiada binari yang dikompil, tiada panggilan API luaran, tiada telemetri. Setiap baris boleh diaudit. Setiap tuntutan dalam README ini dipetakan ke fail tertentu yang boleh anda baca.

- **hooks/** — Tukar ambang tamat tempoh cache, sesuaikan mesej amaran, ubah suai peraturan seni bina sesi
- **scripts/** — Logik analisis, pembina laporan, pemformatan baris status
- **skills/** — Cara /s-continue dan /usage-view berfungsi, templat prompt
- **locales/** — Tambah/edit terjemahan, tambah bahasa baru
- **skills/usage-view/** — Perubahan reka bentuk UI/UX papan pemuka

Jadikan milik anda. Fork, uji kaji, dan hantar PR jika anda jumpa sesuatu yang lebih baik.

---

## 🌐 Bahasa yang Disokong

23 bahasa disokong. Dipilih dengan merujuk silang 20 negara teratas mengikut penggunaan Claude Code dengan 20 bahasa teratas mengikut bilangan penutur global. Bahasa paparan dikesan secara automatik dari lokal OS anda. Anda juga boleh menentukan secara manual: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Terjemahan semasa dihasilkan oleh AI. Sumbangan penutur asli dialu-alukan — edit fail JSON untuk bahasa anda dalam `locales/` dan hantar PR.

---

## ⚖️ Kos Plugin Ini kepada Anda

Plugin menyuntik konteks pada permulaan sesi. Berikut adalah jumlah tepat:

| Suntikan | Bila | Token | Tujuan |
| -------- | ---- | ----- | ------- |
| Session Architect | SessionStart (sekali) | ~1,100 | Strategi delegasi SubTask + peraturan Concise Mode |
| Konteks Git (jika git-lite diaktifkan) | SessionStart (sekali) | ~280 | Menggantikan ~2,200 tok arahan git asli CC |
| Amaran tamat tempoh cache | Apabila tidak aktif > 59 minit (sekali) | ~200 | Menandakan penghantaran semula yang mahal, menunjukkan laluan yang lebih murah |
| Baris status | Setiap panggilan API | 0 | Dipaparkan dalam bar status terminal, bukan konteks perbualan |

**Overhead bersih setiap sesi: ~1,400 token (sekali, di-cache selepas panggilan pertama).**

Dengan harga Opus ($0.50/MTok baca cache), itu **$0.0007 setiap panggilan API** — kurang dari sepersepuluh sen. Dalam sesi 100-panggilan: $0.07.

Jika git-lite diaktifkan, plugin **menjimat** ~1,920 token setiap sesi (menggantikan 2,200 dengan 280). Kesan bersihnya negatif — plugin menggunakan lebih sedikit daripada yang dibuangnya.

**Untuk pengguna API bayar-per-penggunaan:** dengan perbelanjaan $3,000/bln, overhead plugin di bawah $2/bln. Satu penghantaran semula $9 yang disekat seminggu (pencegahan tamat tempoh cache) membayar setahun overhead dalam satu tangkapan.

---

## 💡 Petua

### Fahami cache dan anda akan lihat ke mana wang pergi

- **1 prompt ≠ 1 panggilan API.** Setiap kali Claude memanggil Grep, Read, atau Edit, keseluruhan konteks dihantar semula. Satu prompt boleh dengan mudah mencetuskan 10+ panggilan API. Tulis prompt yang jelas untuk mengurangkan panggilan alat yang tidak perlu dan memangkas kos.
- **Pemasa cache direset dari panggilan API terakhir, bukan prompt terakhir anda.** Terus bekerja dan cache tidak akan sekali-kali tamat tempoh. Bahayanya adalah pergi. Token Guardian memberitahu anda bila ia berlaku, dan dalam mod `block` ia menghentikan prompt sekali supaya anda boleh memilih: reset konteks, atau teruskan seadanya.
- **Saiz konteks = pengganda kos.** Panggilan API yang sama pada 200K berbanding 800K biayanya 4x lebih mahal. Apabila baris status [CTX] melepasi 35% (🟡), itu isyarat untuk mendelegasi lebih banyak ke SubTasks.

### Tabiat yang memangkas kos

- **Jadikan CLAUDE.md ringkas.** Ia dimuatkan ke dalam system prompt pada setiap panggilan API. Setiap baris menghabiskan wang.
- **Delegasikan kerja berat ke SubTasks.** Penjanaan kod, suntingan pelbagai fail, menjalankan ujian tidak sepatutnya berada dalam Main. SubTasks mempunyai konteks yang lebih kecil dan tahap cache yang lebih murah.
- **Pergi 1+ jam?** `/clear` → kembali → `/s-continue`. Konteks dipulihkan seharga $0.
- **[5H] melebihi 70% (🟡)?** Perlahan. Tukar kepada tugas semakan ringan atau tingkatkan delegasi SubTask untuk mengurangkan bilangan panggilan API Main.
- **Gunakan `/btw` untuk soalan sampingan.** Ia tidak masuk ke dalam sejarah perbualan, jadi konteks anda kekal ringkas.

### API bayar-per-penggunaan: tabiat yang paling penting

Semua di atas terpakai, ditambah keutamaan khusus API ini:

- **Pantau [CTX] seperti meter laju.** Tiada had kadar yang akan menghentikan anda — tetapi konteks pada 500K+ bermakna setiap panggilan API biayanya 2-3x lebih dari sepatutnya. `/clear` → `/s-continue` percuma dan menetapkan semula pengganda kos anda ke garis dasar.
- **Jalankan `/usage-view` setiap minggu.** Pengguna Max Plan mempunyai momen "aduh" semula jadi apabila mencapai had kadar. Anda tidak — kos naik secara senyap. Papan pemuka adalah sistem amaran awal anda.
- **Tetapkan belanjawan harian mental.** Tanpa had, hari $200 berlaku tanpa disedari. Penunjuk RUN baris status menjadikan kos setiap giliran kelihatan. Jika satu giliran melepasi $1 (🔴), konteks anda terlalu besar.

---

## 📚 Dokumentasi

- [Panduan Cache Prompt](guides/prompt-cache-guide.md) — Mengapa kebanyakan kos anda adalah cache, cara caching berfungsi merentas pembekal (Anthropic, OpenAI, Gemini), dan cara mengurusnya ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Analisis Kos Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Sekurang-kurangnya 24–38% lebih murah daripada Opus 5 pada kualiti yang sama, merentas 2,782 sesi
- [Analisis Kos Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Analisis Kos Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Perbandingan kos berdampingan merentas 8,563 panggilan API
- [Analisis Kos Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Lesen

Apache-2.0
