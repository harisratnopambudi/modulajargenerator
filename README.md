# 📋 Generator Modul Ajar

Aplikasi web satu-file (client-side, tanpa backend) untuk membantu guru menyusun **Modul Ajar Kurikulum Merdeka** yang lengkap, rapi, dan siap cetak — dilengkapi fitur **pengisian otomatis menggunakan AI (Google Gemini)** via Cloudflare Worker.

Dibuat oleh **Haris DevLab** — SD Plus 2 Al-Muhajirin, Purwakarta.

---

## ✨ Fitur Utama

- **Generate Modul dengan AI** — Cukup isi Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP), dan Kelas, lalu AI (Gemini) akan menyusun seluruh komponen modul ajar secara instan.
- **Keamanan API Key via Cloudflare Worker** — Panggilan AI dialihkan melalui Cloudflare Worker terenkripsi untuk menyembunyikan API key Google Gemini yang asli demi keamanan data.
- **Sistem Kode Akses & Trial Terbatas** — Mendukung input kode akses premium atau kode uji coba (trial) khusus yang dilengkapi dengan:
  - **Kunci Perangkat (Device Lock)**: Menggunakan header custom `X-Device-ID` agar kode trial terkunci ke 1 perangkat setelah digunakan dan tidak bisa disalahgunakan di perangkat lain.
  - **Batas Waktu**: Masa aktif kode trial dibatasi selama 1 jam dari pertama kali login di perangkat tersebut.
- **Session Timeout 5 Jam** — Untuk keamanan akun, session kode akses di browser akan otomatis kedaluwarsa dan terhapus dalam waktu 5 jam, meminta pengguna untuk memasukkan ulang kodenya.
- **Penyimpanan Otomatis Profil & Dokumen** — Secara otomatis menyimpan data profil guru, instansi, tahun pelajaran, jenjang, mata pelajaran, fase/kelas, serta tanda tangan guru & kepala sekolah ke dalam `localStorage` browser sehingga tidak perlu diketik berulang-ulang saat reload.
- **Ganti Tema Warna & Kustom Hue** — Menyediakan 13 preset tema warna pastel premium (Mint, Sage, Sky, Lavender, Lilac, Sakura, Rose, Coral, Cream, Butter, Ocean, Steel, dan Hijau Original) atau kustomisasi warna bebas menggunakan **Slider Hue**.
- **Tutorial Interaktif (Onboarding Walkthrough)** — Memandu pengguna baru saat pertama kali membuka aplikasi melalui sorotan visual (spotlight highlight) dan meredupkan (blur) area sekitar secara dinamis. Dapat diulang kapan saja melalui panel informasi.
- **Toggle Banner & Logo Yayasan** — Fleksibilitas untuk menyembunyikan atau memunculkan banner kop dan logo yayasan pada dokumen.
- **Tombol Cetak Melayang (Fixed Print)** — Tombol cetak berwarna merah mencolok yang selalu melayang di pojok kanan atas preview pane, memudahkan akses cetak kapan saja tanpa perlu scroll ke atas.
- **Cetak / Simpan sebagai PDF** — Layout dokumen yang dioptimalkan khusus untuk print (bebas border canvas/titik grid) baik ukuran A4 maupun F4 / Folio.

---

## 📁 Struktur Folder

```
├── index.html        # Aplikasi utama (buka file ini di browser)
└── img/
    ├── logosekolah.png  # Logo sekolah default (kop kiri)
    ├── logoyayasan.png  # Logo yayasan default (kop kanan)
    └── banner.png       # Banner akreditasi / Kurikulum Merdeka (tampil di atas dokumen)
```

> **Catatan**: Anda dapat menimpa file di dalam folder `img/` dengan file logo milik sekolah Anda secara permanen. Pengguna juga dapat mengunggah logo kustom sementara langsung dari aplikasi pada panel **Identitas Modul**.

---

## 🚀 Cara Pakai

1. **Clone / download** repository ini ke komputer Anda.
2. Buka file `index.html` langsung di browser Anda (disarankan Google Chrome atau Microsoft Edge).
3. **Mengisi Kode Akses**:
   - Jika Anda memiliki kode premium, masukkan pada form yang disediakan.
   - Jika ingin mencoba, Anda dapat memasukkan kode trial khusus yang dibagikan oleh administrator.
4. **Menyusun Modul**:
   - Cari dan unduh dokumen CP terbaru (disediakan link cepat menuju **Kepka BSKAP No. 046/2025** langsung di bawah input CP).
   - Masukkan CP, TP, dan Kelas di panel **Generate Modul**, pilih model pembelajaran (opsional), lalu klik **Generate Modul**.
   - AI akan otomatis mengisi semua kolom dokumen di sebelah kanan dalam hitungan detik.
5. **Kustomisasi & Cetak**:
   - Ubah tema warna atau kustom warna dokumen sesuai selera sekolah Anda.
   - Klik tombol **Cetak / Simpan PDF** di pojok kanan atas.
   - **PENTING**: Saat dialog print browser muncul, pastikan Anda **mencentang opsi "Background graphics" / "Grafik latar belakang"** agar warna kop, warna tabel, dan logo ikut tercetak dengan sempurna.

---

## 🛠️ Teknologi & API

- **Frontend**: HTML5, Vanilla CSS3 (Custom Variables/Themes), Vanilla JavaScript (ES6+).
- **AI Engine**: Google Gemini API via [Cloudflare Workers Proxy](https://workers.cloudflare.com/).
- **Database Sesi**: Cloudflare Workers KV (`TRIAL_STORE`) untuk tracking device lock dan durasi trial.
- **Fonts**: [Inter](https://fonts.google.com/specimen/Inter) & [Amiri (Quranic Arabic)](https://fonts.google.com/specimen/Amiri) dari Google Fonts.
- **Icons**: SVG inline.

---

## 📄 Lisensi

Silakan digunakan, dimodifikasi, dan disebarluaskan untuk kebutuhan akademis sekolah, madrasah, atau dinas pendidikan masing-masing.
