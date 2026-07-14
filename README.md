# 📋 Generator Modul Ajar

Aplikasi web satu-file (client-side, tanpa backend) untuk membantu guru menyusun **Modul Ajar Kurikulum Merdeka** yang lengkap, rapi, dan siap cetak — dilengkapi fitur **pengisian otomatis menggunakan AI (Google Gemini)**.

Dibuat oleh **Haris DevLab** — SD Plus 2 Al-Muhajirin, Purwakarta.

## ✨ Fitur

- **Generate otomatis dengan AI** — cukup isi Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP), dan Kelas, lalu AI (Gemini) akan menyusun seluruh komponen modul ajar: identitas, Dimensi Profil Lulusan, prinsip Pembelajaran Mendalam (Mindful, Meaningful, Joyful), langkah-langkah pembelajaran lengkap dengan pertanyaan pemantik, asesmen, rubrik penilaian, sarana/media, hingga landasan nilai Qur'ani/Hadits beserta terjemahannya.
- **Editor manual lengkap** — setiap komponen modul ajar tetap bisa diisi/diedit secara manual tanpa AI.
- **Live preview** — tampilan dokumen langsung diperbarui saat data diketik.
- **Kustomisasi ukuran & orientasi kertas** — A4 / F4, Portrait / Landscape.
- **Cetak / Simpan sebagai PDF** langsung dari browser.
- **Logo sekolah & banner akreditasi** — logo sekolah dan banner logo Kurikulum Merdeka tampil otomatis di kepala dokumen, dan bisa diganti sesuai kebutuhan.

## 📁 Struktur Folder

```
├── index.html        # Aplikasi utama (buka file ini di browser)
└── img/
    ├── logo.png       # Logo sekolah (tampil di pojok kiri atas dokumen)
    └── banner.png     # Banner akreditasi / logo Kurikulum Merdeka (tampil di atas dokumen)
```

> Jika ingin mengganti logo sekolah atau banner, cukup timpa file `img/logo.png` dan `img/banner.png` dengan gambar baru — tidak perlu mengubah kode di `index.html`. Logo sekolah juga bisa diganti sementara langsung dari aplikasi lewat tombol unggah pada bagian **Identitas Modul**.

## 🚀 Cara Pakai

1. **Clone / download** repository ini.
2. Buka file `index.html` langsung di browser (Chrome/Edge disarankan), tidak perlu server atau instalasi apa pun.
3. **(Opsional, untuk pengisian otomatis dengan AI)**
   - Buka bagian **Generator Otomatis dengan AI** di panel kiri.
   - Buat API key gratis di [Google AI Studio](https://aistudio.google.com/apikey).
   - Tempelkan API key, isi CP, TP, dan Kelas, lalu klik **✨ Generate Otomatis dengan AI**.
   - API key hanya dipakai langsung dari browser ke Google, tidak melewati server manapun, dan bisa disimpan secara lokal di browser Anda (opsional).
4. Lengkapi/edit data pada tiap bagian sesuai kebutuhan.
5. Atur ukuran kertas dan orientasi pada toolbar di atas pratinjau.
6. Klik **🖨️ Cetak / Simpan PDF** untuk mencetak atau menyimpan modul ajar sebagai PDF.
   - Saat dialog cetak muncul, pastikan opsi **"Background graphics" / "Grafik latar belakang"** dicentang agar warna dan gambar ikut tercetak.

## 🛠️ Teknologi

- HTML, CSS, dan JavaScript murni (vanilla) — tanpa framework, tanpa build process.
- [Google Gemini API](https://ai.google.dev/) untuk fitur penyusunan otomatis.
- Font [Inter](https://fonts.google.com/specimen/Inter) & [Amiri](https://fonts.google.com/specimen/Amiri) dari Google Fonts.

## ⚠️ Catatan

- Aplikasi ini berjalan sepenuhnya di sisi klien (browser). Tidak ada data yang dikirim ke server mana pun selain permintaan langsung ke Gemini API saat fitur AI digunakan.
- Ayat Al-Qur'an/Hadits beserta terjemahan yang dipilih AI tetap perlu diperiksa ulang keakuratannya sebelum dicetak/digunakan.

## 📄 Lisensi

Silakan digunakan dan dimodifikasi sesuai kebutuhan sekolah/madrasah masing-masing.
