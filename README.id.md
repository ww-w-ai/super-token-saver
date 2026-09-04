# super-token-saver

**Satu-satunya plugin Claude Code yang benar-benar membaca kode sumber CC untuk menemukan ke mana token Anda pergi — dan memperbaikinya secara otomatis. Keluarkan lebih sedikit, bekerja lebih lama.**

> Hasil terukur: **pengurangan biaya 45%** pada beban kerja nyata $326/hari → $180/hari. Delegasi SubTask otomatis, pemulihan konteks tanpa biaya, dasbor analitik lengkap, dan guard untuk kedaluwarsa cache — dalam satu instalasi, tanpa konfigurasi.

Bekerja dengan **Max Plan ($200/bln)** dan **API bayar-per-penggunaan**. Plugin yang sama, fitur yang sama. Lebih kuat untuk setiap pengguna — terutama saat setiap token adalah uang nyata.

![Dasbor penggunaan — lihat persis ke mana token Anda pergi](docs/images/usage-view-overview.png)

### Yang dilakukannya dalam 30 detik

| Fitur | Yang terjadi | Dampak |
| ----- | ------------ | ------ |
| 🧠 Session Architect | Mendelegasikan pekerjaan berat ke SubTasks secara otomatis (cache 37,5% lebih murah) | Konteks tetap kecil, biaya turun |
| 🪶 Concise Mode | Memangkas padding respons, mempertahankan substansi | Lebih sedikit token output per respons |
| 🔄 /s-continue | Menggantikan /compact — nol panggilan LLM, nol biaya, nol kehilangan informasi, dan kini juga memulihkan sesi **Codex** | Pemulihan konteks gratis di kedua tool |
| 🤝 /s-compact | Menulis serah terima sesi yang otomatis dimuat /s-continue — menangkap temuan sub-agent & hasil tool yang hilang dari transcript | Sesi berikutnya juga resume dengan konteks tersembunyi |
| 📊 Status Line | Biaya real-time, ukuran konteks, batas rate — di bawah 50ms | Lihat masalah sebelum menguras kantong |
| 📈 /usage-view | Dasbor HTML interaktif dengan analisis bertenaga AI | Forensik biaya lengkap dalam satu klik |
| ✂️ /setup-git-lite | Menghapus 2.200 token tersembunyi yang CC suntikkan setiap sesi | ~$48/bln hemat dari instruksi git saja |
| 🛡️ Token Guardian | Memperingatkan Anda tepat saat kedaluwarsa cache mengirim ulang konteks Anda, atau memblokirnya dalam mode `block` | Tidak ada lagi kejutan $9 yang tersembunyi |

---

## 😤 Masalahnya

**Biaya tak terlihat.** Tidak ada visibilitas real-time. Tidak ada peringatan "konteks Anda di 800K". Tidak ada peringatan "cache kedaluwarsa 3 menit lalu". Anda mengetahuinya setelah kerusakan terjadi.

**Pembengkakan konteks.** Prompt yang sama pada konteks 200K versus 800K biayanya 4x lebih mahal. Setiap Read, Grep, Edit mengirim ulang konteks penuh. Satu prompt kompleks memicu 15+ panggilan API, masing-masing dikalikan dengan ukuran konteks Anda.

**Kedaluwarsa cache.** Anda baru pulang dari makan siang. Cache hilang. Satu prompt mengirim ulang 900K token dengan harga penuh. $9 dalam sekali tembak.

**Semuanya manual.** Manajemen konteks, waktu kedaluwarsa cache, delegasi SubTask, pembersihan sesi. Tidak ada yang bisa melacak semua ini sambil benar-benar mengoding.

**Max Plan ($200/bln)?** Semua di atas, ditambah batas rate jendela 5 jam yang menghentikan alur kerja Anda tanpa timer dan tanpa ETA.

**API bayar-per-penggunaan?** Semua di atas, kecuali tidak ada batas atas. Satu cache miss = $9 uang nyata. Sepuluh kali seminggu = $360/bln hanya karena kecelakaan. Selasa yang buruk dengan konteks bengkak bisa lebih mahal dari yang dibayar pelanggan Max Plan dalam sebulan.

super-token-saver menangani semuanya secara otomatis. **Instal sekali. Selesai.**

---

## 🚀 Instalasi

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Bekerja otomatis setelah instalasi. Tanpa konfigurasi. Memerlukan [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Untuk pemantauan langsung:

```
/setup-statusline install
```

Untuk memangkas 2.200 token tersembunyi dari instruksi git bawaan CC ([detail](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Fitur 1: Smart Session Architecture

**Instal dan pola kerja yang dioptimalkan biaya langsung berjalan otomatis.**

Sebagian besar pengguna melakukan segalanya di sesi utama. Membaca file, menghasilkan kode, menjalankan tes. Setiap output menumpuk di konteks dan dikirim ulang dengan setiap pesan. Sesi membengkak. Biaya menumpuk seperti bola salju.

Session Architect secara otomatis menyuntikkan strategi delegasi di awal sesi.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Peran            | Desain, keputusan, tinjauan       | Implementasi, pembuatan kode, multi-file |
| Tingkat cache    | 1 jam (ephemeral_1h)              | 5 menit                               |
| Biaya tulis cache | ＄10/MTok                         | ＄6.25/MTok                            |
| Ukuran konteks   | ~94K rata-rata                    | ~33K rata-rata                        |

SubTasks memiliki **penulisan cache 37,5% lebih murah** dari Main. Konteksnya juga jauh lebih kecil. Mendelegasikan pekerjaan berat ke SubTasks memotong biaya secara dramatis.

**Hasil:** Konteks tetap di bawah 250K alih-alih tumbuh ke 600K+. Output pekerjaan yang sama, setengah biaya token. Sepenuhnya otomatis.

---

## 🪶 Concise Mode

**Konten yang sama. Lebih sedikit padding. Aktif secara default.**

Hook SessionStart juga menyuntikkan aturan gaya respons yang berjalan di **setiap sesi dan setiap model** — tanpa bendera, tanpa pengaturan. Tiga hal berubah:

- **Tanpa pembuka** — tidak ada "Biar saya periksa…", "Saya akan…", mengulang pertanyaan Anda, atau merangkum apa yang sudah ditunjukkan diff
- **Format yang tepat untuk konten** — poin untuk daftar, prosa untuk penalaran (pertukaran, kausalitas, alasan). Tidak ada yang dipaksakan
- **Ekspresi yang lebih padat** — poin yang sama, lebih sedikit kata. Prosa yang lebih jelas adalah prosa yang lebih pendek

Batasan keras: jangan pernah menghilangkan konten, melewati verifikasi, atau menyederhanakan nuansa menjadi satu kalimat. Substansi tetap penuh; hanya pembungkusnya yang mengecil.

Instal sekali, berlaku di mana saja.

---

## 🔄 Fitur 2: /s-continue — Pemulihan Konteks

**Menggantikan `/compact`. Nol panggilan LLM. Nol biaya token. Nol kehilangan informasi.**

`/compact` mengirimkan seluruh konteks Anda (~1M token) ke LLM untuk dikompres menjadi ringkasan 3,3%. Jika cache telah kedaluwarsa, itu saja sudah memicu re-cache penuh. Kehilangan informasi tidak terhindarkan.

`/s-continue` mengambil pendekatan yang sama sekali berbeda. Ini memproses transkrip sesi sebelumnya dan memuatnya langsung. Tidak ada panggilan LLM. Tidak ada biaya. Percakapan asli dipulihkan apa adanya.

|                         | /compact                                    | /s-continue                                   |
| ----------------------- | ------------------------------------------- | ------------------------------------------- |
| Cara kerja              | Mengirim konteks penuh ke LLM untuk diringkas | Memproses transkrip, membaca langsung      |
| Panggilan LLM           | Diperlukan (biasanya 100K+ token)            | 0                                           |
| Biaya token             | Tinggi                                       | 0                                           |
| Kehilangan informasi    | Ya (ringkasan 3,3%)                          | Tidak ada (asli dipertahankan)              |
| Kecepatan pemrosesan    | Puluhan detik                                | < 1 detik (bahkan file 60MB+)               |
| Saat cache kedaluwarsa  | Biaya re-cache penuh ditambahkan             | Tidak ada dampak                            |
| Pemulihan multi-sesi    | Tidak mungkin                                | Didukung                                    |

Penggunaan: `/clear` lalu `/s-continue`. Anda akan melihat daftar sesi sebelumnya. Pilih satu untuk dipulihkan. Untuk pemulihan cepat: `/s-continue last`.

**Hasil:** Lanjutkan pekerjaan sebelumnya tanpa biaya. Tidak ada kehilangan informasi. Memproses transkrip 60MB+ dalam kurang dari 1 detik.

---
### 🤝 Pasangannya: `/s-compact` — serah terima lapisan tersembunyi

`/s-continue` memulihkan transkrip — apa yang Anda dan Claude katakan. Tapi pengetahuan paling berguna dari sesi kerja seringkali hidup DI LUAR dialog itu: apa yang ditemukan sub-agent (transkripnya adalah file terpisah yang tidak pernah dimuat oleh pemulihan), angka penting dalam hasil tool (jumlah test, benchmark), atau pelajaran dari proses ("tidak bisa direproduksi headless ← ternyata masalahnya di build, bukan kode").

Jalankan `/s-compact` di akhir sesi dan ia akan menyaring persis lapisan tersembunyi itu menjadi sebuah serah terima, disimpan ke `~/.claude/super-token-saver-data/<project>/handoff.md`. Di sesi berikutnya, `/s-continue` otomatis memuatnya di atas transkrip yang dipulihkan — tanpa perlu menempel manual.

|                     | `/s-continue` sendiri           | `/s-compact` + `/s-continue` (satu paket)       |
| Memulihkan          | Transkrip (apa yang dikatakan)   | Transkrip plus lapisan tersembunyi               |
| Temuan sub-agent    | Hilang (file terpisah)           | Disaring ke dalam serah terima                    |
| Angka hasil tool    | Hanya jika dikutip ke chat       | Diekstrak secara sengaja                          |
| Pelajaran proses    | —                                | Ditangkap agar jalan buntu tidak diulang          |

Alur kerja: akhiri sesi dengan `/s-compact` → mulai sesi berikutnya dengan `/s-continue`.

### 🔀 Dua tool, satu riwayat — sesi Codex juga dipulihkan di sini

Codex menulis sesinya ke `~/.codex/sessions/`; Claude Code menulis ke `~/.claude/projects/`. Tidak ada tool yang membaca milik tool lain. Jadi sprint yang kehabisan budget di Codex dulu tidak bisa dijangkau dari Claude Code, begitu juga sebaliknya.

`/s-continue` kini mendaftar dan memulihkan keduanya. Rollout Codex tidak diserahkan ke parser kedua — ia ditulis ulang ke bentuk yang ditulis Claude Code, **satu baris output untuk setiap baris input**, sehingga pipeline yang sama melayani keduanya dan setiap penanda `L{n}` tetap menunjuk ke baris persis di file Codex aslinya. Hasil pengukuran: rollout 12 MB dengan 1,540 baris diproses dalam **0.13 s**.

|                        | Sesi Claude Code | Sesi Codex |
| ---------------------- | ------------------- | ------------- |
| Terdaftar di `/s-continue` | Ya | Ya, dibatasi pada project saat ini |
| Dipulihkan tanpa biaya LLM | Ya | Ya |
| Pencarian `L{n}` ke file asli | Ya | Ya — nomor baris milik rollout itu sendiri |
| Pemulihan kehilangan konteks (`#0`) | `/compact`, auto-compact | Compaction dan thread rollback milik Codex sendiri |
| Serah terima `/s-compact` | Dibagikan per project — tulis di satu tool, muat di tool lainnya |

```
/s-continue codex                    hanya sesi Codex
/s-continue codex : rust migration   turn yang cocok dengan sebuah topik, dipulihkan utuh
```

Dua detail inilah yang membedakan daftar yang benar dari daftar yang tampak benar tapi salah: `session_id` milik Codex sebenarnya adalah id **thread**, yang diwarisi oleh sub-agent mana pun yang di-spawn, sehingga sesi dikunci berdasarkan `payload.id` dan rollout sub-agent disaring dengan cara yang sama seperti transkrip subtask Claude Code sudah disaring. Sementara `<codex_internal_context source="goal">` disisipkan otomatis oleh sistem, sehingga tetap ada di konteks yang dipulihkan tapi tidak pernah dihitung sebagai turn yang Anda ketik.

Plugin ini juga terpasang di dalam Codex — lihat **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)). `usage-view`, `report-limit`, dan `setup-statusline` untuk saat ini masih khusus Claude Code.

---

## 📊 Fitur 3: Status Line Langsung

**Pemantauan token/biaya real-time. Overhead di bawah 50ms.**

Jalankan `/setup-statusline install` sekali dan bilah status persisten muncul di bagian bawah Claude Code.

**Operasi normal** — setiap metrik sekilas, tanpa peralihan konteks:

![Status line dalam kondisi normal](docs/images/statusline-normal.png)

**Batas rate tercapai** — 5H berubah merah pada 102%, hitung mundur menunjukkan persis kapan Anda kembali, dan aksi `/report-limit` satu ketukan muncul secara otomatis:

![Status line saat dibatasi rate](docs/images/statusline-rate-limited.png)

| Indikator        | Yang ditampilkan                            | 🟢 Normal | 🟡 Peringatan | 🔴 Kritis  |
| ---------------- | ------------------------------------------- | --------- | ------------- | ---------- |
| RUN (delta)      | Biaya panggilan API terakhir                | < ＄0.30   | >= ＄0.30      | >= ＄1.00   |
| RUN (kumulatif)  | Biaya kumulatif untuk folder ini            | —         | —             | —          |
| 5H               | Penggunaan jendela 5 jam + hitung mundur reset | < 70%  | >= 70%        | >= 90%     |
| CTX              | Penggunaan jendela konteks                  | < 35%     | >= 35%        | >= 70%     |

Ketika indikator apa pun mencapai peringatan atau kritis, petunjuk `→ /usage-view current` muncul secara otomatis.

Untuk menghapus: `/setup-statusline uninstall` (konfigurasi sebelumnya dipulihkan otomatis).

**Hasil:** Setiap masalah biaya terlihat secara real-time. Overhead di bawah 50ms — tidak ada keterlambatan yang terasa.

> **Menggunakan API bayar-per-penggunaan?** Indikator 5H dan W tersembunyi otomatis — Anda tidak memiliki jendela batas rate. Yang tersisa adalah yang penting: RUN (biaya real-time per giliran) dan CTX (ukuran konteks). Dua tuas yang mengontrol tagihan Anda, selalu terlihat.

---

## 📈 Dasbor Penggunaan (/usage-view)

**Akhirnya jawab: "Ke mana semua uang itu pergi?"**

Pengguna Max Plan mencapai batas rate dan bertanya-tanya mengapa. Pengguna API membuka tagihan Anthropic dan bertanya-tanya bagaimana. Bagaimanapun, pertanyaannya sama: sesi mana yang membakar token terbanyak? Kapan biaya melonjak? Pola apa yang ada dalam penggunaan Anda? Sampai sekarang — semuanya tidak terlihat.

`/usage-view` menampilkan segalanya. Dasbor HTML interaktif terbuka di browser Anda, memungkinkan Anda menganalisis pola penggunaan dan menelusuri akar penyebab lonjakan biaya. Tidak ada dependensi eksternal. Bekerja mandiri. Dapat dibagikan sebagai file.

**$4.196 dalam 31 hari. Ke mana semuanya pergi?** Sekali pandang — total biaya, rincian token berdasarkan jenis, rasio efisiensi cache, dan jumlah sesi. Diagram donat langsung menunjukkan bahwa 65% pengeluaran Anda adalah pembacaan cache (yang normal dan sehat):

![Gambaran umum dasbor penggunaan](docs/images/usage-view-overview.png)

**Sebelum vs. sesudah — diukur, bukan ditebak.** Penanda "Plugin installed" berputus-putus oranye membagi garis waktu biaya Anda menjadi dua. Batang harian ditumpuk berdasarkan jenis token (Input/Output/Cache Write/Cache Read) sehingga Anda dapat melihat persis komponen mana yang berubah setelah instalasi. Garis rata-rata menunjukkan tren:

![Tren biaya harian](docs/images/usage-view-daily-trend.png)

**Kapan Anda paling banyak membakar?** Biaya per jam berdasarkan waktu hari dan rincian hari dalam seminggu. Beralih antara rata-rata hari aktif, rata-rata semua hari, atau maksimum. Ikon api menandai jam termahal Anda — pola yang terlihat (maraton larut malam, lonjakan Rabu) langsung terlihat jelas:

![Pola biaya per jam dan hari dalam seminggu](docs/images/usage-view-hourly-pattern.png)

**Apakah Anda semakin efisien?** Rasio Total/Output mengukur berapa banyak token yang dikonsumsi per token output yang dihasilkan. Lebih rendah lebih baik. Penanda "Plugin installed" memungkinkan Anda membandingkan sebelum vs. sesudah. Lonjakan = cache miss atau restart sesi:

![Tren efisiensi](docs/images/usage-view-efficiency.png)

**Setiap panggilan API, diplot berdasarkan ukuran konteks dan biaya.** Ini adalah bagan yang membuat struktur biaya menjadi jelas. Setiap titik adalah satu panggilan API. Merah = Opus, biru = Sonnet, hijau = Haiku. Garis putus-putus adalah harga teoritis — jika titik Anda di atas garis, Anda membayar terlalu mahal. Beralih ke tampilan **User Turn** untuk melihat biaya per giliran percakapan alih-alih per panggilan API.
Arahkan kursor ke titik manapun untuk melihat teks prompt sebenarnya, jumlah token, dan rincian biaya lengkap (Input/Output/Cache Write/Cache Read):

![Biaya berdasarkan Ukuran Konteks — diagram sebar](docs/images/usage-view-cost-scatter.png)

**Seberapa besar konteks Anda?** Sebagian besar panggilan mengelompok di bawah 250K. Ekor panjang di atas 350K adalah tempat biaya meledak — bagan ini menunjukkan persis seberapa sering Anda berada di zona bahaya:

![Distribusi Ukuran Konteks](docs/images/usage-view-context-dist.png)

**Jadwal pengodean Anda, dihargai per jam.** Peta panas jendela 5 jam selama 30 hari. Hijau (<$15/j), oranye ($15-30/j), merah ($30+/j). Ikon tengkorak (💀) menandai jendela di mana Anda mencapai batas rate. Slider biaya di bagian atas menyaring jendela murah sehingga yang mahal terlihat — seret untuk menemukan hari terburuk Anda seketika. Beralih antara tampilan jendela 5 jam dan blok 1 jam:

![Peta panas kalender penggunaan per jam](docs/images/usage-view-calendar.png)

**Klik sel mana pun untuk menelusuri sesi jendela tersebut.** Setiap sesi dalam slot waktu tersebut, dengan biaya, jumlah pesan, rincian token, dan pesan pertama/terakhir aktual dari setiap percakapan. Perluas "Top Token Conversations" untuk melihat pertukaran spesifik mana yang paling banyak dibakar — setiap entri menampilkan teks prompt, tag peringatan biaya, dan petunjuk optimasi:

![Panel detail sesi](docs/images/usage-view-session-drilldown.png)

**Analisis bertenaga AI (opsional).** Saat Anda menjalankan `/usage-view` tanpa `--no-ai`, analis AI membaca seluruh data dasbor Anda — dengan referensi harga API yang sudah tertanam — dan menghasilkan laporan tertulis: pendorong biaya, anomali, rekomendasi optimasi. Ditampilkan dalam bahasa OS Anda secara otomatis (23 bahasa, termasuk RTL; bagan/tabel selalu LTR):

**Ke mana uang pergi** — total pengeluaran, pendorong biaya berdasarkan jenis token, tren mingguan, dan dampak plugin dalam angka nyata:

![Analisis AI — rincian biaya](docs/images/usage-view-ai-report-1.png)

**Kapan dan bagaimana Anda bekerja** — jam puncak, hari tersibuk, distribusi panggilan API, dan pola batas rate yang mengungkap peluang optimasi:

![Analisis AI — pola kerja](docs/images/usage-view-ai-report-2.png)

**Apa yang harus dilakukan** — rekomendasi konkret berbasis data yang disesuaikan dengan penggunaan aktual Anda. Peralihan model, manajemen konteks, strategi sesi:

![Analisis AI — rekomendasi](docs/images/usage-view-ai-report-3.png)

**Bagikan.** Seluruh dasbor adalah satu file HTML mandiri — semua data tertanam, tidak perlu server. Kirim ke tim, manajer, atau akuntan Anda. Tidak ada dependensi eksternal. Bekerja offline. Gunakan mode `private` untuk menghapus semua teks prompt sebelum berbagi — analitik biaya tetap utuh sementara konten percakapan dihapus.

```
/usage-view                  # Semua waktu, semua proyek
/usage-view current          # Hanya jendela 5 jam saat ini
/usage-view last 7 days      # 7 hari terakhir
/usage-view locale ja        # Bahasa Jepang
/usage-view --no-ai          # Lewati analisis AI (lebih cepat)
/usage-view private          # Hapus teks prompt (aman untuk dibagikan)
```

---

## 🔬 Riset Batas Rate (/report-limit)

**Proyek berbasis komunitas untuk merekayasa balik formula batas rate.**

Anthropic tidak mempublikasikan formula tepat untuk jendela 5 jam. Mari kita cari tahu bersama.

Saat Anda mencapai batas rate, jalankan `/report-limit`. Data penggunaan Anda saat ini secara otomatis dikirimkan sebagai GitHub Discussion. Semakin banyak data yang kami kumpulkan, semakin jelas formulanya.

---

## ✂️ Fitur 4: /setup-git-lite — Pangkas Instruksi Git Bawaan CC

**Kami membaca kode sumber Claude Code. Kami menemukan 2.200 token tersembunyi yang disuntikkan setiap sesi yang Anda bayar diam-diam.**

### Penemuan

Pada 2026-04-12, sebuah [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) mengungkapkan bahwa pengaturan `includeGitInstructions` bawaan Claude Code diam-diam membakar token setiap sesi. Reproduksi independen melalui [gist ini (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) mengonfirmasi angka-angkanya: **+6.031 token dalam penulisan cache** per sesi setelah setiap git commit, **+1.690 token dalam pembacaan cache** pada setiap panggilan API.

### Analisis sumber CC — ke mana token pergi

Kami menelusuri token ke dua titik injeksi independen dalam kode sumber Claude Code (v2.1.88):

**1. Snapshot `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` mengumpulkan branch + main branch + user.name + status penuh (hingga 2000 karakter) + **5 commit terbaru**
- Digabungkan dan ditambahkan ke system prompt melalui `appendSystemContext` (`utils/api.ts:437`)
- Setiap commit baru, setiap file yang dimodifikasi baru, setiap pergantian branch mengubah teks → invalidasi cache prefix

**2. Instruksi alur kerja Commit/PR (~1.700 tok) — deskripsi alat Bash**
- `tools/BashTool/prompt.ts:53` menambahkan 60+ baris protokol keamanan, prosedur commit langkah demi langkah, contoh HEREDOC, dan template pembuatan PR ke deskripsi alat `Bash`
- Di-cache bersama system prompt, tetapi dikirim sebagai parameter `tools[]`

### Mengapa ini mahal

Struktur cache (`utils/api.ts:321` `splitSysPromptPrefix`) memiliki tiga jalur berdasarkan apakah Anda memiliki alat MCP aktif:

- **Jalur A** (MCP aktif — sebagian besar pengguna): `gitStatus` berada dalam blok `cacheScope: 'org'`. Perubahan apa pun → seluruh blok di-cache ulang pada awal sesi berikutnya → 6K tok `cache_create` miss.
- **Jalur B** (tanpa MCP): `gitStatus` masuk ke blok dinamis `cacheScope: null`, yang berarti dikirim ulang sebagai `input_tokens` baru pada setiap panggilan API — tidak ada cache miss, tetapi juga tidak ada penghematan cache.
- **Jalur C** (penyedia 3P / beta eksperimental dinonaktifkan): sama dengan Jalur A.

Dalam sesi interaktif khas, instruksi commit/PR (1,7K tok) terakumulasi **pada setiap panggilan API** melalui `cache_read`. Dalam sesi 100-panggilan dengan harga Opus 4.7, itu kira-kira **$0,08 per sesi** hanya untuk instruksi yang sebagian besar sudah dicakup oleh pelatihan Claude.

### Cara super-token-saver menanganinya

`/setup-git-lite` menonaktifkan jalur native dan menyuntikkan **pengganti 280-token yang dikurasi** melalui hook SessionStart. Kami mempertahankan persis hal-hal yang mengesampingkan perilaku default Claude (aturan keamanan), dan menghapus semua yang sudah diketahui Claude dari pelatihan (alur kerja langkah demi langkah, template PR, pola penggunaan gh).

**Dipertahankan — 11 aturan pengesampingan kritis** (yang mengubah sifat membantu default Claude menjadi kehati-hatian):
- Jangan pernah commit/push/amend/PR/tag/merge tanpa permintaan eksplisit pengguna
- Jangan pernah melewati hook, force-push ke main/master, menjalankan operasi destruktif, memodifikasi git config
- Jangan pernah commit file yang cocok dengan `.env`, `credentials`, `*.pem`, `secret.*`
- Hindari `git add -A` / `git add .`
- HEREDOC untuk pesan commit multi-baris + trailer `Co-Authored-By: Claude`
- Jangan pernah menggunakan flag interaktif (-i), tidak ada commit kosong
- Jika pre-commit hook gagal → buat commit BARU (bukan `--amend`)

**Dihapus** — alur kerja commit langkah demi langkah (3 langkah), alur kerja PR langkah demi langkah (3 langkah), template judul/isi PR, referensi perintah `gh`, peringatan flag `-uall`, peringatan `--no-edit` dengan rebase, batasan `NEVER use TodoWrite or Agent tools during commit`. Ini adalah verbositas alur kerja yang Claude susun dengan benar hanya dari pelatihan.

**Ditambahkan** — baris status git yang kompak: branch + HEAD short-sha + subjek + status saat ini (hingga 20 file yang dimodifikasi, jika tidak jumlahnya). Tidak ada daftar commit terbaru (Claude dapat menjalankan `git log` sesuai permintaan).

### Penghematan yang diharapkan (harga Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok baca cache)

| Item | Asli | Dengan setup-git-lite | Dihemat |
| ---- | ----- | --------------------- | ------- |
| Muat system prompt (per sesi baru) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Panggilan berulang dalam sesi yang sama | ~1.700 tok cache_read/panggilan | ~280 tok cache_read/panggilan | ~1.420 tok/panggilan |
| Sesi 100-panggilan (Opus 4.7) | — | — | **~$0,11 dihemat** |
| 20 sesi/hari × 22 hari kerja | — | — | **~$48 dihemat/bln** |

### Penggunaan

```bash
/setup-git-lite status     # Diagnostik baca-saja — status saat ini + apa yang akan berubah
/setup-git-lite install    # Nonaktifkan CC native + aktifkan hook minimal kami
/setup-git-lite revert     # Pulihkan default (agresif; lihat di bawah)
/setup-git-lite dismiss-banner    # Matikan tip rekomendasi sesekali
/setup-git-lite undismiss-banner  # Aktifkan kembali tip
/setup-git-lite help       # Penggunaan lengkap
```

### Semantik instalasi

`install` memodifikasi **dua** tempat untuk ketahanan:

1. `~/.claude/settings.json` — menambahkan `"includeGitInstructions": false`
2. Profil shell (`~/.zshrc`, `~/.bashrc`, dll.) — menambahkan blok penanda yang mengekspor `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Salah satu saja sudah cukup untuk menonaktifkan CC native; kami mengatur keduanya agar pengesampingan lingkungan tidak secara tidak sengaja mengaktifkan kembali perilaku native. Perubahan shell hanya berlaku di shell baru.

### Semantik revert — agresif

`revert` **menghapus SEMUA ekspor `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` dari profil shell Anda**, termasuk yang mungkin Anda tambahkan secara manual sebelum menginstal keterampilan ini. Ini disengaja — Anda menjalankan `revert`, jadi kami memulihkan default bersih. Kami selalu membuat cadangan berstempel waktu dari profil shell terlebih dahulu.

Jika Anda membutuhkan variabel lingkungan untuk alasan yang tidak terkait, catat sebelum menjalankan `revert` dan tambahkan kembali setelahnya.

### Sebelum menghapus instalasi super-token-saver

**Jalankan `/setup-git-lite revert` terlebih dahulu**, atau Anda akan disisakan dengan `includeGitInstructions: false` di settings.json Anda tetapi tanpa hook pengganti (Claude tidak mendapat panduan git sama sekali). Claude Code saat ini tidak memiliki hook siklus hidup penghapusan plugin, jadi kami tidak dapat mengotomatiskan ini.

### Pertukaran

Yang Anda kehilangan (dan mengapa biasanya tidak apa-apa):
- Claude tidak lagi menerima `git status` / `git log -n 5` yang sudah dihitung sebelumnya saat awal sesi. Jika Anda bertanya "apa yang berubah?" di sesi baru, Claude akan menjalankan perintah-perintah tersebut sendiri (satu panggilan alat tambahan, ~300 tok).
- Claude tidak lagi melihat prosedur commit 3-langkah kanonik CC. Dalam pengujian kami pada ratusan alur commit, pengetahuan tingkat pelatihan menangani kasus kritis (format HEREDOC, tidak ada `--amend`, tidak ada force-push) karena kami mempertahankannya sebagai aturan eksplisit.
- Template isi PR (`## Summary` + `## Test plan`) tidak disuntikkan. Jika Anda peduli dengan format tersebut, masukkan ke CLAUDE.md proyek Anda.

### Spanduk rekomendasi

Saat instruksi git native CC masih aktif di mesin Anda, super-token-saver menampilkan tip satu paragraf di awal sesi **~20% dari waktu** (plus di output `/usage-view` dan `/report-limit`). Matikan secara permanen dengan `/setup-git-lite dismiss-banner`.

---

## 🛡️ Fitur 5: Token Guardian

**Memberi tahu Anda tepat saat kedaluwarsa cache mulai memakan biaya. Bisa memblokir pengiriman ulang $9 itu jika Anda memintanya.**

TTL cache prompt Claude Code adalah 1 jam. Pergi lebih lama dari itu dan cache kedaluwarsa. Pesan berikutnya mengirim ulang seluruh konteks dengan harga penuh. Pada 900K token, itu $9 dalam sekali tembak.

Token Guardian mengingat kapan respons terakhir tiba. Jika lebih dari 3.590 detik telah berlalu (TTL dikurangi buffer 10 detik), ia bisa turun tangan. **Ia nonaktif secara default, karena Remote Control.** Pesan blokir dari hook dirender secara lokal sebagai pesan sistem yang tidak pernah diterima klien remote, sehingga pengguna remote melihat prompt-nya menghilang tanpa penjelasan. Daripada mengirimkan pelindung yang berperilaku berbeda tergantung di mana Anda berada, kami menonaktifkannya. Ketika Remote Control mulai meneruskan pesan hook, default akan aktif kembali. Sampai saat itu, aktifkan sendiri dengan salah satu dari dua mode.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude menyebutkan kedaluwarsa di baris pertamanya
export CC_TOKEN_SAVER_CACHE_GUARD=block   # prompt ditolak satu kali dengan pesan di bawah
```

Dalam mode `warn`, prompt tetap diteruskan, dan Claude membuka jawabannya dengan satu baris yang menyebutkan bahwa cache sudah kedaluwarsa, giliran ini ditagih sebagai pengiriman ulang seluruh konteks, dan setelah jeda satu jam atau lebih, `/clear` → `/s-continue` adalah cara yang lebih murah untuk kembali. Yang ini memang sampai ke klien remote, karena jawaban Claude diteruskan meskipun pesan hook tidak.

Dalam mode `block`, prompt ditolak satu kali dengan pesan di bawah. Kirim lagi dan ia akan lewat. Gunakan ini di terminal lokal saat Anda menginginkan penghentian tegas.

```
🚨 Cache kedaluwarsa (68m 23s tidak aktif)

Cache prompt telah kedaluwarsa. Melanjutkan akan mengirim ulang seluruh konteks.
Biaya dapat meningkat signifikan.

👉 /context — Periksa penggunaan konteks saat ini sebelum memutuskan
👉 /clear → /s-continue — Reset, lalu pulihkan konteks sebelumnya (disarankan, termurah)
👉 Kirim ulang — Lanjutkan apa adanya (biaya re-cache penuh dikenakan)
```

Pesan blokir ditampilkan dalam 23 bahasa, dipilih dari lokal OS Anda, dan muncul sekali per periode tidak aktif.

**Agen latar belakang tidak pernah diblokir.** Hanya prompt yang diketik manusia yang mendapat pemeriksaan ini. Laporan penyelesaian dari agen dan tugas latar belakang -- yang belakangan ini sering tiba lebih dari satu jam setelah diluncurkan -- lewat begitu saja. Hasil agen yang berjalan lama tidak pernah tertahan atau hilang.

**Hasil:** dalam mode warn Anda selalu tahu kapan dan mengapa pengiriman ulang $9 terjadi. Dalam mode block itu tidak pernah terjadi: setiap kedaluwarsa yang tertangkap menghemat $9, dan dengan satu tangkapan per hari itu $270/bln pemborosan murni yang hilang.

> **Di skema bayar-per-penggunaan ini terasa lebih berat.** Pelanggan Max Plan kehilangan $9 dalam buffer $200. Anda kehilangan $9 uang nyata — diam-diam, setiap kali Anda pergi. Mode block menghentikannya setiap saat.

---

## 💡 Cara Cache Sebenarnya Bekerja (Dan Mengapa Sebagian Besar Pengguna Membuang 40%+)

Claude Code mengirimkan seluruh riwayat percakapan ke model pada setiap panggilan API. "Panggilan API" tidak berarti "satu pesan yang Anda ketik." Satu prompt memicu panggilan alat internal — Grep, Read, Edit, Write — dan masing-masing adalah panggilan API terpisah. Satu prompt bisa dengan mudah menyebabkan 10+ panggilan API.

Cache prompt mengurangi biaya ini sebesar 90%. Namun cache memiliki masa pakai.

|                     | Main Session                               | SubTask                                    |
| ------------------- | ------------------------------------------ | ------------------------------------------ |
| TTL Cache           | 1 jam (ephemeral_1h)                       | 5 menit                                    |
| Tulis cache         | ＄10/MTok                                   | ＄6.25/MTok                                 |
| Baca cache          | ＄0.50/MTok                                 | ＄0.50/MTok                                 |
| Saat cache kedaluwarsa | Konteks penuh dikirim ulang dengan harga penuh | Dampak rendah (konteks kecil)          |

Bahkan dengan cache yang aktif, biaya menumpuk. Berikut skenario ekstrem untuk menunjukkan perbedaannya.

### Skenario: Pengodean sehari penuh (3 jam pagi → 2 jam makan siang/rapat → 3 jam sore)

Kondisi: harga Opus 4, 1 prompt per menit, ~5 panggilan API per prompt (~300 panggilan/jam).

#### ❌ Tanpa super-token-saver

Sebagian besar pekerjaan terjadi di Main session. Konteks tumbuh cepat.

| Fase        | Situasi                           | Ukuran konteks             | Biaya                                   |
| ----------- | --------------------------------- | -------------------------- | --------------------------------------- |
| Pagi 3j     | Pengodean (sebagian besar di Main) | 100K → 600K (rata-rata 350K) | 900 panggilan × 350K × ＄0.50/M = ＄157.50 |
| Makan siang/rapat | Pergi 2 jam                  | —                          | —                                       |
| Kembali     | Cache kedaluwarsa → kirim ulang penuh | 600K harga penuh       | 600K × ＄5/M + 600K × ＄10/M = ＄9        |
| Kembali     | /compact (ringkasan)              | 600K → dikirim ke LLM     | 600K × ＄0.50/M + output ringkasan = ~＄1.50 |
| Sore 3j     | Pengodean berlanjut (konteks tumbuh lagi) | 100K → 600K (rata-rata 350K) | 900 panggilan × 350K × ＄0.50/M = ＄157.50 |
|             | Total                             |                            | ~＄326                                   |

> Pada tingkat penggunaan ini, Anda kemungkinan akan mencapai batas rate jendela 5 jam. **Biayanya buruk, tapi masalah nyatanya adalah pekerjaan Anda berhenti sepenuhnya. Ini persis saat Claude Code mati.**

#### ✅ Dengan super-token-saver

Pekerjaan berat didelegasikan ke SubTasks. Main hanya menangani desain/keputusan.

| Fase        | Situasi                                       | Ukuran konteks              | Biaya                               |
| ----------- | --------------------------------------------- | --------------------------- | ----------------------------------- |
| Pagi 3j     | Pengodean (Main: desain, SubTask: implementasi) | Main 100K → 300K (rata-rata 200K) | 900 panggilan × 200K × ＄0.50/M = ＄90 |
| Makan siang/rapat | Pergi 2 jam                             | —                           | —                                   |
| Kembali     | ⚡ Token Guardian (mode block) → /clear + /s-continue | —                        | ＄0 (tanpa panggilan LLM)            |
| Sore 3j     | Pengodean berlanjut                           | Main 100K → 300K (rata-rata 200K) | 900 panggilan × 200K × ＄0.50/M = ＄90 |
|             | Total                                         |                             | ~＄180                               |

#### 💰 Hasil

> **＄326 → ＄180. ＄146 dihemat per hari. Pengurangan biaya 45%.**
>
> **Max Plan:** Lebih sedikit token = Anda tidak mencapai batas rate. Pekerjaan Anda tidak berhenti. Itulah perbedaan nyatanya.
>
> **API bayar-per-penggunaan:** ＄146/hari × 22 hari kerja = **＄3.200/bln langsung dari tagihan Anda.** Bulan berat tanpa plugin ini melewati ＄7.000. Dengan plugin ini, di bawah ＄4.000. Output yang sama.

### Di mana super-token-saver berperan

```
[Mulai Sesi]
    │
    ├─ Session Architect → Menyuntikkan pola delegasi SubTask secara otomatis
    │                       Menjaga konteks Main di bawah 250K
    │
[Bekerja]
    │
    ├─ Status Line → Pemantauan biaya/konteks/batas rate real-time
    │                  Peringatan instan saat memasuki zona peringatan
    │
[Tidak aktif 1+ jam]
    │
    ├─ Token Guardian → Mendeteksi kedaluwarsa cache, memperingatkan (atau memblokir dalam mode block)
    │
[Restart sesi]
    │
    └─ /s-continue → Memulihkan konteks sebelumnya tanpa biaya (tanpa panggilan LLM)
```

---

## 🔧 Instal Sumber & Kustomisasi

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver sepenuhnya open-source (Apache-2.0). JavaScript + Bash biasa — tidak ada binary yang dikompilasi, tidak ada panggilan API eksternal, tidak ada telemetri. Setiap baris dapat diaudit. Setiap klaim dalam README ini dipetakan ke file spesifik yang dapat Anda baca.

- **hooks/** — Ubah ambang kedaluwarsa cache, kustomisasi pesan peringatan, modifikasi aturan arsitektur sesi
- **scripts/** — Logika analisis, pembuat laporan, format status line
- **skills/** — Cara kerja /s-continue dan /usage-view, template prompt
- **locales/** — Tambah/edit terjemahan, tambah bahasa baru
- **skills/usage-view/** — Perubahan desain UI/UX dasbor

Jadikan milik Anda. Fork, eksperimen, dan kirim PR jika Anda menemukan sesuatu yang lebih baik.

---

## 🌐 Bahasa yang Didukung

23 bahasa didukung. Dipilih dengan merujuk silang 20 negara teratas berdasarkan penggunaan Claude Code dengan 20 bahasa teratas berdasarkan jumlah penutur global. Bahasa tampilan terdeteksi otomatis dari lokal OS Anda. Anda juga dapat menentukan secara manual: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Terjemahan saat ini dihasilkan oleh AI. Kontribusi penutur asli disambut — edit file JSON untuk bahasa Anda di `locales/` dan kirimkan PR.

---

## ⚖️ Biaya Plugin Ini untuk Anda

Plugin menyuntikkan konteks saat awal sesi. Berikut persis berapa banyak:

| Injeksi | Kapan | Token | Tujuan |
| ------- | ----- | ----- | ------- |
| Session Architect | SessionStart (sekali) | ~1.100 | Strategi delegasi SubTask + aturan Concise Mode |
| Konteks Git (jika git-lite diaktifkan) | SessionStart (sekali) | ~280 | Menggantikan ~2.200 tok instruksi git native CC |
| Peringatan kedaluwarsa cache | Saat tidak aktif > 59 menit (sekali) | ~200 | Menandai pengiriman ulang yang mahal, menampilkan jalan yang lebih murah |
| Status line | Setiap panggilan API | 0 | Ditampilkan di bilah status terminal, bukan konteks percakapan |

**Overhead bersih per sesi: ~1.400 token (sekali, di-cache setelah panggilan pertama).**

Dengan harga Opus ($0,50/MTok baca cache), itu **$0,0007 per panggilan API** — kurang dari sepersepuluh sen. Dalam sesi 100-panggilan: $0,07.

Jika git-lite diaktifkan, plugin **menghemat** ~1.920 token per sesi (menggantikan 2.200 dengan 280). Efek bersihnya negatif — plugin mengonsumsi lebih sedikit dari yang dihapusnya.

**Untuk pengguna API bayar-per-penggunaan:** dengan pengeluaran $3.000/bln, overhead plugin di bawah $2/bln. Satu pengiriman ulang $9 yang diblokir per minggu (pencegahan kedaluwarsa cache) membayar setahun overhead dalam satu tangkapan.

---

## 💡 Tips

### Pahami cache dan Anda akan melihat ke mana uang pergi

- **1 prompt ≠ 1 panggilan API.** Setiap kali Claude memanggil Grep, Read, atau Edit, seluruh konteks dikirim ulang. Satu prompt bisa dengan mudah memicu 10+ panggilan API. Tulis prompt yang jelas untuk mengurangi panggilan alat yang tidak perlu dan memangkas biaya.
- **Timer cache direset dari panggilan API terakhir, bukan prompt terakhir Anda.** Terus bekerja dan cache tidak akan pernah kedaluwarsa. Bahayanya adalah pergi. Token Guardian memberi tahu Anda saat itu terjadi, dan dalam mode `block` menghentikan prompt sekali sehingga Anda bisa memilih: reset konteks, atau lanjutkan apa adanya.
- **Ukuran konteks = pengganda biaya.** Panggilan API yang sama pada 200K versus 800K biayanya 4x lebih mahal. Ketika status line [CTX] melewati 35% (🟡), itu sinyal Anda untuk mendelegasikan lebih banyak ke SubTasks.

### Kebiasaan yang memangkas biaya

- **Jaga CLAUDE.md tetap ramping.** File ini dimuat ke system prompt pada setiap panggilan API. Setiap baris menghabiskan uang.
- **Delegasikan pekerjaan berat ke SubTasks.** Pembuatan kode, pengeditan multi-file, menjalankan tes tidak termasuk dalam Main. SubTasks memiliki konteks yang lebih kecil dan tingkat cache yang lebih murah.
- **Pergi 1+ jam?** `/clear` → kembali → `/s-continue`. Konteks dipulihkan seharga $0.
- **[5H] di atas 70% (🟡)?** Perlambat. Beralih ke tugas tinjauan ringan atau tingkatkan delegasi SubTask untuk mengurangi jumlah panggilan API Main.
- **Gunakan `/btw` untuk pertanyaan sampingan.** Ini tidak masuk ke riwayat percakapan, sehingga konteks Anda tetap ramping.

### API bayar-per-penggunaan: kebiasaan yang paling penting

Semua di atas berlaku, ditambah prioritas khusus API ini:

- **Pantau [CTX] seperti speedometer.** Tidak ada batas rate yang akan menghentikan Anda — tetapi konteks di 500K+ berarti setiap panggilan API biayanya 2-3x lebih dari seharusnya. `/clear` → `/s-continue` gratis dan mengatur ulang pengganda biaya Anda ke baseline.
- **Jalankan `/usage-view` setiap minggu.** Pengguna Max Plan memiliki momen "aduh" alami saat mencapai batas rate. Anda tidak — biaya naik diam-diam. Dasbor adalah sistem peringatan dini Anda.
- **Tetapkan anggaran harian mental.** Tanpa batas, hari $200 terjadi tanpa disadari. Indikator RUN status line membuat biaya per giliran terlihat. Jika satu giliran melewati $1 (🔴), konteks Anda terlalu besar.

---

## 📚 Dokumentasi

- [Panduan Cache Prompt](guides/prompt-cache-guide.md) — Mengapa sebagian besar biaya Anda adalah cache, cara kerja caching di berbagai penyedia (Anthropic, OpenAI, Gemini), dan cara mengelolanya ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Analisis Biaya Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Setidaknya 24–38% lebih murah dari Opus 5 pada kualitas yang sama, dari 2.782 sesi
- [Analisis Biaya Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Analisis Biaya Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Perbandingan biaya berdampingan dari 8.563 panggilan API
- [Analisis Biaya Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Lisensi

Apache-2.0
