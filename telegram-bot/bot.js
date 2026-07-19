import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.TELEGRAM_BOT_TOKEN;
const cloudflareUrl = process.env.CLOUDFLARE_WORKER_URL || '';
const geminiAccessCode = process.env.GEMINI_ACCESS_CODE || '';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
  console.error('ERROR: Silakan masukkan TELEGRAM_BOT_TOKEN di file .env terlebih dahulu!');
  process.exit(1);
}

function getEffectiveApiKey(key) {
  const trimmed = (key || '').trim();
  if (['COBAGRATIS', 'TRIALGURU', 'COBADULU'].includes(trimmed)) {
    return 'TRIAL-MODULAJAR';
  }
  return trimmed;
}

// Inisialisasi Bot
const bot = new TelegramBot(token, { polling: true });
bot.setMyCommands([
  { command: '/start', description: 'Mulai pembuatan Modul Ajar baru' },
  { command: '/identitas', description: 'Lihat / ubah profil identitas penulis' },
  { command: '/cancel', description: 'Batalkan proses yang sedang berjalan' }
]).catch(err => console.error('Gagal memasang command menu:', err));
console.log('Telegram Bot Modul Ajar aktif dan mendengarkan...');

// Database Sesi di Memori
const sessions = new Map();

// Konstanta Data Pendukung
const DIMENSI_PM_LIST = [
  "Keimanan dan Ketakwaan terhadap Tuhan YME",
  "Kewargaan",
  "Penalaran Kritis",
  "Kreativitas",
  "Kolaborasi",
  "Kemandirian",
  "Kesehatan",
  "Komunikasi"
];

const METODE_PEMBELAJARAN = {
  pbl: {
    label: "Problem Based Learning (PBL)",
    metode: "Diskusi Kelompok, Tanya Jawab, Penugasan, Presentasi",
    pendekatan: "Saintifik dan Kolaboratif",
    alasanModel: "melatih peserta didik memecahkan masalah nyata secara sistematis dan reflektif",
    alasanMetode: "mendukung eksplorasi solusi secara kolaboratif dan penyampaian hasil analisis",
    alasanPendekatan: "mengarahkan peserta didik menemukan konsep melalui proses ilmiah dan kerja sama",
    sintaks: [
      { title: "Orientasi Peserta Didik pada Masalah", tahapPM: "Memahami" },
      { title: "Mengorganisasikan Peserta Didik untuk Belajar", tahapPM: "Memahami" },
      { title: "Membimbing Penyelidikan Individu/Kelompok", tahapPM: "Mengaplikasi" },
      { title: "Mengembangkan dan Menyajikan Hasil Karya", tahapPM: "Mengaplikasi" },
      { title: "Menganalisis dan Mengevaluasi Proses Pemecahan Masalah", tahapPM: "Merefleksi" }
    ]
  },
  pjbl: {
    label: "Project Based Learning (PjBL)",
    metode: "Diskusi Kelompok, Penugasan Proyek, Demonstrasi, Presentasi",
    pendekatan: "Kontekstual dan Kolaboratif",
    alasanModel: "melatih peserta didik menghasilkan produk nyata melalui proses perencanaan dan kolaborasi",
    alasanMetode: "mendukung proses perencanaan, pengerjaan, dan presentasi proyek secara bertahap",
    alasanPendekatan: "mengaitkan pembelajaran dengan konteks nyata dan kerja sama tim",
    sintaks: [
      { title: "Penentuan Pertanyaan Mendasar", tahapPM: "Memahami" },
      { title: "Mendesain Perencanaan Produk", tahapPM: "Memahami" },
      { title: "Menyusun Jadwal Pembuatan", tahapPM: "Mengaplikasi" },
      { title: "Memonitor Keaktifan dan Perkembangan Proyek", tahapPM: "Mengaplikasi" },
      { title: "Menguji Hasil", tahapPM: "Mengaplikasi" },
      { title: "Evaluasi Pengalaman Belajar", tahapPM: "Merefleksi" }
    ]
  },
  discovery: {
    label: "Discovery Learning",
    metode: "Tanya Jawab, Eksperimen/Percobaan, Diskusi, Penugasan",
    pendekatan: "Saintifik",
    alasanModel: "mendorong peserta didik menemukan sendiri konsep melalui pengamatan dan pengolahan data",
    alasanMetode: "memberi ruang eksplorasi aktif melalui percobaan dan diskusi temuan",
    alasanPendekatan: "menekankan proses ilmiah dalam menemukan konsep secara mandiri",
    sintaks: [
      { title: "Stimulation (Pemberian Rangsangan)", tahapPM: "Memahami" },
      { title: "Problem Statement (Identifikasi Masalah)", tahapPM: "Memahami" },
      { title: "Data Collection (Pengumpulan Data)", tahapPM: "Mengaplikasi" },
      { title: "Data Processing (Pengolahan Data)", tahapPM: "Mengaplikasi" },
      { title: "Verification (Pembuktian)", tahapPM: "Merefleksi" },
      { title: "Generalization (Menarik Kesimpulan)", tahapPM: "Merefleksi" }
    ]
  },
  inquiry: {
    label: "Inquiry Learning",
    metode: "Tanya Jawab, Eksperimen/Percobaan, Diskusi, Penugasan",
    pendekatan: "Saintifik",
    alasanModel: "melatih peserta didik menyelidiki dan menjawab masalah secara sistematis melalui pertanyaan dan data",
    alasanMetode: "mendukung proses penyelidikan melalui percobaan, tanya jawab, dan diskusi hasil",
    alasanPendekatan: "menekankan proses berpikir ilmiah dalam merumuskan dan menguji hipotesis",
    sintaks: [
      { title: "Orientasi", tahapPM: "Memahami" },
      { title: "Merumuskan Masalah", tahapPM: "Memahami" },
      { title: "Merumuskan Hipotesis", tahapPM: "Mengaplikasi" },
      { title: "Mengumpulkan Data", tahapPM: "Mengaplikasi" },
      { title: "Menguji Hipotesis dan Merumuskan Kesimpulan", tahapPM: "Merefleksi" }
    ]
  },
  cooperative: {
    label: "Cooperative Learning (STAD)",
    metode: "Diskusi Kelompok, Kerja Kelompok, Kuis, Presentasi",
    pendekatan: "Kolaboratif",
    alasanModel: "melatih kerja sama dan tanggung jawab peserta didik dalam kelompok kecil yang heterogen",
    alasanMetode: "mendukung interaksi aktif dan saling membantu antaranggota kelompok",
    alasanPendekatan: "menekankan pembelajaran melalui kolaborasi dan saling ketergantungan positif",
    sintaks: [
      { title: "Penyampaian Tujuan dan Motivasi", tahapPM: "Memahami" },
      { title: "Pembagian Kelompok", tahapPM: "Memahami" },
      { title: "Presentasi dari Guru", tahapPM: "Mengaplikasi" },
      { title: "Kegiatan Belajar dalam Tim (Kerja Kelompok)", tahapPM: "Mengaplikasi" },
      { title: "Kuis/Evaluasi dan Penghargaan Kelompok", tahapPM: "Merefleksi" }
    ]
  },
  gbl: {
    label: "Game Based Learning",
    metode: "Permainan/Games, Diskusi, Tanya Jawab, Demonstrasi",
    pendekatan: "Menyenangkan (Joyful Learning) dan Kolaboratif",
    alasanModel: "membuat proses belajar lebih menyenangkan sekaligus melatih pemahaman konsep melalui permainan",
    alasanMetode: "mendukung keterlibatan aktif peserta didik lewat tantangan dan diskusi hasil permainan",
    alasanPendekatan: "menekankan suasana belajar yang menggembirakan dan kerja sama antarpeserta didik",
    sintaks: [
      { title: "Pengenalan Aturan dan Tujuan Permainan", tahapPM: "Memahami" },
      { title: "Pembagian Kelompok/Tim", tahapPM: "Memahami" },
      { title: "Pelaksanaan Permainan/Tantangan", tahapPM: "Mengaplikasi" },
      { title: "Diskusi dan Refleksi Hasil Permainan", tahapPM: "Merefleksi" },
      { title: "Penguatan Konsep dan Evaluasi", tahapPM: "Merefleksi" }
    ]
  }
};

const AI_SYSTEM_INSTRUCTION = `Anda adalah asisten ahli penyusun Modul Ajar untuk guru sekolah di Indonesia, menguasai Kurikulum Merdeka serta Kerangka Pembelajaran Mendalam (Naskah Akademik Kemendikdasmen 2025) dengan 3 prinsip (Berkesadaran/Mindful, Bermakna/Meaningful, Menggembirakan/Joyful) dan 3 tahap pengalaman belajar (Memahami, Mengaplikasi, Merefleksi).

Tugas: berdasarkan CP, TP, dan kelas yang diberikan guru, susun SELURUH komponen modul ajar secara lengkap, kontekstual, operasional, dan siap pakai di kelas, dalam Bahasa Indonesia baku bergaya dokumen resmi.

Aturan wajib:
- Pemetaan Fase Kurikulum Merdeka: Kelas 1-2 = Fase A, Kelas 3-4 = Fase B, Kelas 5-6 = Fase C, Kelas 7-9 = Fase D, Kelas 10 = Fase E, Kelas 11-12 = Fase F.
- Field "fase" berformat seperti: "Fase C, V (Lima), I (Ganjil)" — sesuaikan angka romawi kelas dan semester dari konteks (jika semester tidak disebutkan, asumsikan Ganjil).
- "badge" adalah teks berisi nama mata pelajaran dan kelas, huruf besar, dipisah dengan karakter newline (\\n) di antara mata pelajaran dan kelas (contoh: "KODING DAN KECERDASAN ARTIFISIAL\\nKELAS 5").
- "langkahPembelajaran": jika prompt pengguna TIDAK menyertakan instruksi "METODE/MODEL PEMBELAJARAN YANG WAJIB DIGUNAKAN", susun 5-7 tahap runtut (Pendahuluan, beberapa tahap Inti, Penutup) dengan tahapPM dibagi rata antara Memahami, Mengaplikasi, dan Merefleksi. Jika prompt pengguna MENYERTAKAN instruksi tersebut, WAJIB ikuti persis jumlah tahap, judul tahap, dan tahapPM yang diberikan dalam instruksi itu (jangan menambah/mengurangi/mengganti nama tahap). Pada kedua kasus, total durasi harus konsisten dengan field "alokasi". Field "content" setiap tahap berisi beberapa poin instruksi konkret, satu baris satu poin, dipisah karakter newline. Aplikasi akan otomatis menomori setiap baris tersebut sebagai daftar bernomor, jadi JANGAN PERNAH menambahkan angka atau simbol penomoran/bullet manual sendiri (mis. "1.", "2)", "-", "•") di awal baris manapun — tulis kalimatnya langsung tanpa prefix apa pun.
- Pada tahap Pendahuluan, WAJIB selalu menyertakan satu poin di awal yang berbunyi kurang lebih: "Guru mengajak salah satu murid untuk memimpin doa sebelum memulai pembelajaran." (bukan guru sendiri yang memimpin doa, melainkan salah satu murid, mencerminkan pembiasaan kemandirian dan kepemimpinan siswa).
- Tahap Pendahuluan pada "langkahPembelajaran" WAJIB memuat "Pertanyaan Pemantik" berupa MINIMAL 3 pertanyaan terbuka yang relevan dengan materi/TP untuk memantik rasa ingin tahu dan mengaitkan dengan pengalaman murid sehari-hari. Tulis satu baris berisi kalimat pengantar (mis. "Guru mengajukan Pertanyaan Pemantik:"), lalu setiap pertanyaan pemantik pada baris-baris SETELAHNYA WAJIB diawali penanda ">>" (dua tanda lebih-besar tanpa spasi, mis. ">>Pernahkah kalian melihat robot yang bisa berbicara seperti manusia?") — ini akan otomatis dirender sebagai sub-nomor bercetak miring oleh aplikasi. Penanda ">>" HANYA dipakai untuk pertanyaan pemantik, jangan dipakai di baris lain manapun.
- "praktik" (Praktik Pedagogis) WAJIB selalu diisi dalam bentuk satu paragraf narasi terpadu (bukan poin-poin/baris terpisah), dengan pola: "Pembelajaran ini menerapkan model [nama model] yang bertujuan untuk [alasan singkat]. Aktivitas didukung oleh metode [daftar metode] guna [alasan singkat]. Seluruh proses ini dijalankan melalui pendekatan [nama pendekatan] untuk [alasan singkat]." Setiap bagian alasan WAJIB berupa 1 kalimat pendek yang menjelaskan mengapa pilihan tersebut relevan/cocok dengan CP dan TP yang diberikan guru (bukan kalimat generik yang bisa dipakai untuk materi apa saja). Jika prompt pengguna menyertakan instruksi "MODEL PEMBELAJARAN YANG WAJIB DIGUNAKAN", gunakan model, metode, dan pendekatan yang ditentukan di situ dengan menyusunnya ke dalam pola narasi di atas.
- Mode pengerjaan tugas/aktivitas murid (individu, berpasangan, atau kelompok) TIDAK boleh selalu default kelompok — pilih yang paling sesuai dengan karakter TP dan aktivitasnya. Jika materi/tugasnya memang lebih cocok dikerjakan sendiri (mis. melatih pemahaman/keterampilan personal, asesmen individu, refleksi diri), gunakan mode individu; gunakan kelompok/berpasangan hanya jika aktivitasnya memang menuntut kolaborasi/diskusi. Terapkan pilihan ini secara konsisten pada "langkahPembelajaran" (field "content"), "praktik", "kemitraan", dan "lingkungan" agar tidak kontradiktif satu sama lain.
- "dpl": narasi 1 baris per Dimensi Profil Lulusan terpilih, format "Nama Dimensi: penjelasan singkat keterkaitannya dengan materi.", dipisah newline. Pilih 2-4 dimensi paling relevan dari 8 pilihan pada schema.
- "rubrik1" dan "rubrik2": setiap baris = "Aspek | Indikator | Level4 | Level3 | Level2 | Level1", antar baris dipisah newline. rubrik1 tentang sikap, rubrik2 tentang produk/kinerja hasil belajar.
- "sarana": setiap baris = "Nama Sarana/Media | Fungsinya", dipisah newline.
- "cp" dan "tp" pada output adalah versi rapi dari CP/TP yang diberikan guru, tanpa mengubah makna aslinya.
- "catatan": WAJIB selalu diisi (jangan kosong), berupa 1-2 kalimat catatan reflektif guru yang merangkum esensi/penekanan pedagogis modul ini (mis. penekanan konseptual, urutan belajar, atau pesan penting bagi murid), gaya bahasa naratif profesional.
- Landasan Nilai Qur'ani/Hadits: pilih HANYA SATU sumber yang paling relevan dan paling kuat kaitannya dengan tema/materi TP — JANGAN mengisi keduanya sekaligus. Tentukan lewat field "sumberNilai" ("Quran" atau "Hadits").
- Jika "sumberNilai" = "Quran": isi "quranArab" (teks Arab lengkap dengan harakat, satu ayat yang relevan) dan "quranTerjemah" WAJIB diisi dengan terjemahan Bahasa Indonesia yang akurat dan dikenal luas (gunakan terjemahan Kemenag atau setara), diapit tanda kutip — jangan pernah mengutip ayat tanpa artinya. Isi "quranRef" format "QS. [Nama Surah]: [nomor ayat]". Kosongkan "haditsArab", "haditsTerjemah", "haditsRef" (string kosong).
- Jika "sumberNilai" = "Hadits": isi "haditsArab" (teks Arab satu hadits pendek yang relevan dan masyhur/shahih) dan "haditsTerjemah" WAJIB diisi dengan terjemahan Indonesianya — jangan pernah mengutip teks hadits tanpa artinya. Isi "haditsRef" (perawi, mis. "HR. Bukhari"). Kosongkan "quranArab", "quranTerjemah", "quranRef" (string kosong).
- "promptLKPD": Buatkan satu instruksi prompt bahasa Inggris/Indonesia yang sangat detail, kreatif, dan spesifik untuk dimasukkan ke pembuat gambar AI (seperti DALL-E, Midjourney, atau ChatGPT Image Generator) guna merancang Lembar Kerja Peserta Didik (LKPD/Worksheet) visual yang menarik. Sesuaikan dengan jenjang sekolah (SD: penuh ilustrasi lucu/kartun, SMP/SMA: infografis/diagram/desain modern clean) dan topik/TP pembelajaran ini. Prompt harus menjelaskan tata letak, elemen visual, ruang kosong untuk menulis, judul lembar kerja, dan aktivitas konkret yang sesuai dengan materi. Di bagian atas lembar kerja wajib disediakan kolom identitas: jika aktivitas LKPD berupa tugas kelompok, wajib sertakan kolom untuk "Nama Kelompok" dan "Kelas/Anggota"; jika berupa tugas individu, wajib sertakan kolom untuk "Nama" dan "Kelas".
- JANGAN PERNAH menggunakan emoji atau simbol dekoratif sejenis di bagian mana pun dalam modul ajar.
- Jangan menyertakan markdown atau teks di luar JSON.`;

function geminiSchema() {
  const STR = { type: "STRING" };
  return {
    type: "OBJECT",
    properties: {
      judul: STR, badge: STR, mapel: STR, jenjang: STR, fase: STR, elemenSingkat: STR, alokasi: STR,
      cp: STR, tp: STR, dpl: STR,
      dimensiProfilLulusan: { type: "ARRAY", items: { type: "STRING", enum: DIMENSI_PM_LIST } },
      prinsipMindful: STR, prinsipMeaningful: STR, prinsipJoyful: STR, teknologiDigital: STR,
      praktik: STR, kemitraan: STR, lingkungan: STR,
      langkahPembelajaran: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            title: STR, durasi: STR,
            tahapPM: { type: "STRING", enum: ["Memahami", "Mengaplikasi", "Merefleksi"] },
            content: STR
          },
          required: ["title", "durasi", "tahapPM", "content"]
        }
      },
      asAwal: STR, asFormatif: STR, asSumatif: STR,
      rubrik1Judul: STR, rubrik1: STR, rubrik2Judul: STR, rubrik2: STR, skorMaks: STR, kkm: STR,
      sarana: STR, sudahKKM: STR, belumKKM: STR, catatan: STR, promptLKPD: STR,
      sumberNilai: { type: "STRING", enum: ["Quran", "Hadits"] },
      quranArab: STR, quranTerjemah: STR, quranRef: STR,
      haditsArab: STR, haditsTerjemah: STR, haditsRef: STR, quranKait: STR
    },
    required: ["judul", "badge", "mapel", "jenjang", "fase", "elemenSingkat", "alokasi", "cp", "tp", "dpl",
      "dimensiProfilLulusan", "prinsipMindful", "prinsipMeaningful", "prinsipJoyful", "teknologiDigital",
      "praktik", "kemitraan", "lingkungan", "langkahPembelajaran", "asAwal", "asFormatif", "asSumatif",
      "rubrik1Judul", "rubrik1", "rubrik2Judul", "rubrik2", "skorMaks", "kkm", "sarana", "sudahKKM", "belumKKM", "catatan",
      "sumberNilai", "quranKait", "promptLKPD"]
  };
}

function buildAIPrompt(mapel, jenjang, kelas, cp, tp, keyword, metodeKey) {
  const keywordText = keyword ? `\nKONTEKS / KEYWORD TAMBAHAN:\n${keyword}\n\nPastikan seluruh konten modul (termasuk langkah pembelajaran dan asesmen) sangat relevan dengan konteks/keyword di atas.\n` : "";

  let metodeText = "";
  const metode = metodeKey ? METODE_PEMBELAJARAN[metodeKey] : null;
  if (metode) {
    const daftarTahap = metode.sintaks.map((s, i) => `${i + 1}. ${s.title} (tahapPM: ${s.tahapPM})`).join("\n");
    metodeText = `\nMODEL PEMBELAJARAN YANG WAJIB DIGUNAKAN: ${metode.label}
Field "praktik" WAJIB diisi dalam bentuk satu paragraf narasi terpadu berikut (jangan dipisah per baris), dengan bagian alasan di dalam tanda kurung sudut ditulis ulang menjadi penjelasan spesifik yang benar-benar relevan dengan CP/TP guru di atas:
Pembelajaran ini menerapkan model ${metode.label} yang bertujuan untuk <alasan spesifik kenapa model ini cocok untuk CP/TP di atas>. Aktivitas didukung oleh metode ${metode.metode.toLowerCase()} guna <alasan spesifik kenapa metode-metode ini cocok untuk CP/TP di atas>. Seluruh proses ini dijalankan melalui pendekatan ${metode.pendekatan.toLowerCase()} untuk <alasan spesifik kenapa pendekatan ini cocok untuk CP/TP di atas>.
Field "langkahPembelajaran" WAJIB mengikuti PERSIS ${metode.sintaks.length} tahap sintaks resmi model ini berikut, dengan judul tahap ("title") dan nilai "tahapPM" persis seperti daftar berikut (urutan tidak boleh diubah, jangan gunakan label Pendahuluan/Inti/Penutup generik):
${daftarTahap}
Meskipun judul tahap mengikuti sintaks resmi di atas, tahap pertama tetap WAJIB memuat poin doa dan Pertanyaan Pemantik sesuai aturan pada instruksi sistem.\n`;
  } else if (metodeKey === 'lainnya') {
    metodeText = `\nCatatan: guru memilih metode "Lainnya" — tentukan sendiri metode/praktik pedagogis yang paling relevan dengan CP/TP di atas dan gunakan struktur tahap generik (Pendahuluan, Inti, Penutup) seperti biasa.\n`;
  }

  return `Susun seluruh komponen Modul Ajar berikut berdasarkan data dari guru:

MATA PELAJARAN (tetap, jangan diubah, gunakan persis ini): ${mapel}
JENJANG SEKOLAH (tetap, jangan diubah, gunakan persis ini): ${jenjang}
KELAS: ${kelas}${keywordText}${metodeText}
CAPAIAN PEMBELAJARAN (CP):
${cp}

TUJUAN PEMBELAJARAN (TP):
${tp}

Field "mapel" dan "jenjang" pada JSON output WAJIB diisi persis sama dengan nilai tetap di atas (tidak boleh diubah/ditebak sendiri).

Ikuti seluruh aturan pada instruksi sistem. Kembalikan hanya JSON sesuai schema yang diberikan.`;
}

// Database Identitas User (Persistent via user_data.json)
const USER_DB_PATH = path.join(__dirname, 'user_data.json');
const userDb = new Map();

function loadUserDb() {
  try {
    if (fs.existsSync(USER_DB_PATH)) {
      const raw = fs.readFileSync(USER_DB_PATH, 'utf-8');
      const obj = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) {
        userDb.set(Number(k), v);
      }
    }
  } catch (e) {
    console.error('Gagal membaca user_data.json:', e);
  }
}

function saveUserDb() {
  try {
    const obj = {};
    for (const [k, v] of userDb.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(USER_DB_PATH, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.error('Gagal menulis user_data.json:', e);
  }
}

// Muat database user saat bot startup
loadUserDb();

// Handler Command Utama
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  if (userDb.has(chatId)) {
    const profile = userDb.get(chatId);
    // User sudah memiliki profil lengkap, langsung lewati input identitas dan mulai ke MAPEL
    sessions.set(chatId, { 
      state: 'MAPEL', 
      data: { 
        paperSize: 'a4', 
        orientation: 'portrait', 
        penyusun: profile.penyusun || '', 
        instansi: profile.instansi || '', 
        tahun: profile.tahun || '',
        accessCode: profile.accessCode || ''
      } 
    });
    
    bot.sendMessage(chatId, `Halo *${profile.penyusun}*! Selamat datang kembali. 😊\n\nKita akan membuat Modul Ajar baru menggunakan profil Anda:\n• *Sekolah:* ${profile.instansi}\n• *Tahun Pelajaran:* ${profile.tahun}\n\n📌 *Daftar Perintah yang Tersedia:*\n• /start - Memulai pembuatan Modul Ajar baru\n• /identitas - Melihat / menyunting profil identitas penulis\n• /cancel - Membatalkan proses yang sedang berjalan\n\nSilakan masukkan *Mata Pelajaran* (contoh: _Koding dan Kecerdasan Artifisial_ atau _Matematika_):`, { 
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });
  } else {
    // Pengguna baru / belum memasukkan profil lengkap
    sessions.set(chatId, { state: 'AUTH_CODE', data: { paperSize: 'a4', orientation: 'portrait', penyusun: '', instansi: '', tahun: '', accessCode: '' } });
    bot.sendMessage(chatId, `Selamat datang di *Generator Modul Ajar Bot*! 📋\n\nSaya akan memandu Anda membuat Modul Ajar Kurikulum Merdeka secara instan.\n\n📌 *Daftar Perintah yang Tersedia:*\n• /start - Memulai pembuatan Modul Ajar baru\n• /identitas - Melihat / menyunting profil identitas penulis\n• /cancel - Membatalkan proses yang sedang berjalan\n\nUntuk memulai pertama kali, silakan masukkan *Kode Akses Premium* Anda:`, { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/identitas/, (msg) => {
  const chatId = msg.chat.id;
  
  if (userDb.has(chatId)) {
    const profile = userDb.get(chatId);
    const msgText = `📋 *Profil Identitas Penulis Anda*\n\n` +
      `• *Nama Penyusun (Guru):* ${profile.penyusun}\n` +
      `• *Nama Instansi (Sekolah):* ${profile.instansi}\n` +
      `• *Tahun Pelajaran:* ${profile.tahun}\n` +
      `• *Kode Akses Premium:* \`${profile.accessCode}\`\n\n` +
      `Ingin mengubah profil Anda? Klik tombol di bawah ini:`;

    bot.sendMessage(chatId, msgText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Ubah Profil 📝', callback_data: 'profile:edit' }]
        ]
      }
    });
  } else {
    bot.sendMessage(chatId, `Anda belum memiliki profil terdaftar. Silakan kirim /start untuk mendaftar pertama kali.`, { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  sessions.delete(chatId);
  bot.sendMessage(chatId, 'Pembuatan modul dibatalkan. Kirim /start untuk mulai lagi.');
});

// Listener Pesan Percakapan
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : '';

  // Lewati jika pesan adalah command
  if (text.startsWith('/')) return;

  const session = sessions.get(chatId);
  if (!session) return;

  const { state, data } = session;

  switch (state) {
    case 'AUTH_CODE':
      bot.sendMessage(chatId, '⏳ *Memverifikasi kode akses Anda...*', { parse_mode: 'Markdown' });
      
      const verifyCode = getEffectiveApiKey(text);
      const deviceId = `tg-${chatId}`;
      const verifyUrl = `${cloudflareUrl.endsWith('/') ? cloudflareUrl.slice(0, -1) : cloudflareUrl}/v1beta/models`;

      try {
        const res = await fetch(verifyUrl, {
          headers: { 
            'Authorization': `Bearer ${verifyCode}`,
            'X-Device-ID': deviceId
          }
        });

        if (res.ok) {
          data.accessCode = text;
          session.state = 'PENYUSUN';
          bot.sendMessage(chatId, `✅ *Kode akses valid!*\nSesi Anda telah terverifikasi.\n\nSekarang silakan masukkan *Nama Penyusun (Guru)*:`, { parse_mode: 'Markdown' });
        } else {
          bot.sendMessage(chatId, `❌ *Kode akses salah atau tidak valid.*\n\nSilakan coba masukkan kembali kode akses yang benar:`);
        }
      } catch (e) {
        console.error('Verifikasi Error:', e);
        bot.sendMessage(chatId, `⚠️ *Gagal menghubungi server verifikasi.* Periksa koneksi internet Anda.\n\nSilakan kirim kode akses Anda kembali untuk mencoba lagi:`);
      }
      break;

    case 'PENYUSUN':
      data.penyusun = text;
      session.state = 'INSTANSI';
      bot.sendMessage(chatId, `Nama Penyusun disimpan: *${data.penyusun}*\n\nSilakan masukkan *Nama Instansi / Sekolah*:`, { parse_mode: 'Markdown' });
      break;

    case 'INSTANSI':
      data.instansi = text;
      session.state = 'TAHUN';
      
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const defaultTahun = `${currentYear}/${nextYear}`;
      
      bot.sendMessage(chatId, `Nama Instansi disimpan: *${data.instansi}*\n\nMasukkan *Tahun Pelajaran* (contoh: _${defaultTahun}_):`, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: `${currentYear}/${nextYear}` }],
            [{ text: `${currentYear - 1}/${currentYear}` }]
          ],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
      break;

    case 'TAHUN':
      data.tahun = text;
      
      // Simpan ke database user
      userDb.set(chatId, {
        accessCode: data.accessCode,
        penyusun: data.penyusun,
        instansi: data.instansi,
        tahun: data.tahun
      });
      saveUserDb();

      session.state = 'MAPEL';
      bot.sendMessage(chatId, `Tahun Pelajaran disimpan: *${data.tahun}*\n\nProfil Anda telah disimpan ke database! Selanjutnya, silakan masukkan *Mata Pelajaran* (contoh: _Koding dan Kecerdasan Artifisial_ atau _Matematika_):`, {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      });
      break;

    case 'MAPEL':
      data.mapel = text;
      session.state = 'JENJANG';
      bot.sendMessage(chatId, `Mata pelajaran disimpan: *${data.mapel}*\n\nSekarang pilih *Jenjang Sekolah* Anda:`, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: 'SD' }, { text: 'SMP' }],
            [{ text: 'SMA' }, { text: 'SMK' }],
            [{ text: 'Lainnya' }]
          ],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
      break;

    case 'JENJANG':
      data.jenjang = text;
      session.state = 'KELAS';
      
      // Berikan opsi kelas cepat berdasarkan jenjang
      let kelasButtons = [];
      if (text === 'SD') {
        kelasButtons = [[{ text: '1' }, { text: '2' }, { text: '3' }], [{ text: '4' }, { text: '5' }, { text: '6' }]];
      } else if (text === 'SMP') {
        kelasButtons = [[{ text: '7' }, { text: '8' }, { text: '9' }]];
      } else if (text === 'SMA' || text === 'SMK') {
        kelasButtons = [[{ text: '10' }, { text: '11' }, { text: '12' }]];
      } else {
        kelasButtons = [[{ text: '1' }, { text: '7' }, { text: '10' }]];
      }

      bot.sendMessage(chatId, `Jenjang sekolah disimpan: *${data.jenjang}*\n\nMasukkan *Kelas / Grade* (contoh: _5_ atau _10_):`, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: kelasButtons,
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
      break;

    case 'KELAS':
      data.kelas = text;
      session.state = 'CP';
      bot.sendMessage(chatId, `Kelas disimpan: *${data.kelas}*\n\nSilakan *copy & paste Capaian Pembelajaran (CP)* dari mata pelajaran Anda:`, {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      });
      break;

    case 'CP':
      data.cp = text;
      session.state = 'TP';
      bot.sendMessage(chatId, `CP disimpan (panjang: ${data.cp.length} karakter).\n\nSilakan *copy & paste Tujuan Pembelajaran (TP)* Anda:`, {
        parse_mode: 'Markdown'
      });
      break;

    case 'TP':
      data.tp = text;
      session.state = 'METODE';
      
      // Memilih metode dengan inline keyboard
      bot.sendMessage(chatId, `TP disimpan (panjang: ${data.tp.length} karakter).\n\nPilih *Model Pembelajaran* yang ingin Anda terapkan:`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "Problem Based Learning (PBL)", callback_data: "metode:pbl" }],
            [{ text: "Project Based Learning (PjBL)", callback_data: "metode:pjbl" }],
            [{ text: "Discovery Learning", callback_data: "metode:discovery" }],
            [{ text: "Inquiry Learning", callback_data: "metode:inquiry" }],
            [{ text: "Cooperative Learning (STAD)", callback_data: "metode:cooperative" }],
            [{ text: "Game Based Learning", callback_data: "metode:gbl" }],
            [{ text: "Model Lainnya / Sesuai AI", callback_data: "metode:lainnya" }]
          ]
        }
      });
      break;

    case 'KEYWORD':
      if (text.toLowerCase() === '/skip' || text.toLowerCase() === 'skip') {
        data.keyword = '';
      } else {
        data.keyword = text;
      }
      
      session.state = 'CONFIRM';
      showConfirmation(chatId, data);
      break;

    default:
      break;
  }
});

// Listener Inline Keyboard Callback
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const dataAction = callbackQuery.data;

  // Tangani profile:edit terlebih dahulu karena session mungkin belum dibuat
  if (dataAction === 'profile:edit') {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Mengedit profil Anda... 📝' });
    
    // Hapus tombol dari pesan sebelumnya
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: message.message_id });

    const currentProfile = userDb.get(chatId) || { accessCode: '' };
    sessions.set(chatId, { 
      state: 'PENYUSUN', 
      data: { 
        paperSize: 'a4', 
        orientation: 'portrait', 
        penyusun: '', 
        instansi: '', 
        tahun: '',
        accessCode: currentProfile.accessCode 
      } 
    });
    
    bot.sendMessage(chatId, `Silakan masukkan *Nama Penyusun (Guru)* baru Anda:`, { parse_mode: 'Markdown' });
    return;
  }

  const session = sessions.get(chatId);
  if (!session) return;

  if (dataAction.startsWith('metode:')) {
    const key = dataAction.split(':')[1];
    session.data.metodeKey = key;
    session.state = 'KEYWORD';
    const label = key === 'lainnya' ? 'Sesuai AI' : METODE_PEMBELAJARAN[key].label;
    
    bot.answerCallbackQuery(callbackQuery.id, { text: `Model terpilih: ${label}` });
    
    bot.sendMessage(chatId, `Model terpilih: *${label}*\n\nApakah ada *Keyword / Konteks tambahan*? (Contoh: _diferensiasi_, _berbasis lingkungan_, _fokus pada pembagian_, dll).\n\nKirim pesan teks kustom Anda, atau ketik *skip* jika tidak ada tambahan.`, {
      parse_mode: 'Markdown'
    });
  } 
  else if (dataAction === 'toggle:papersize') {
    session.data.paperSize = session.data.paperSize === 'a4' ? 'f4' : 'a4';
    bot.answerCallbackQuery(callbackQuery.id, { text: `Kertas diubah ke ${session.data.paperSize.toUpperCase()}` });
    editConfirmation(chatId, message.message_id, session.data);
  }
  else if (dataAction === 'toggle:orientation') {
    session.data.orientation = session.data.orientation === 'portrait' ? 'landscape' : 'portrait';
    const label = session.data.orientation === 'portrait' ? 'Portrait (Tegak)' : 'Landscape (Mendatar)';
    bot.answerCallbackQuery(callbackQuery.id, { text: `Orientasi diubah ke ${label}` });
    editConfirmation(chatId, message.message_id, session.data);
  }
  else if (dataAction === 'action:generate') {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Memulai pembuatan Modul Ajar... 🚀' });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: message.message_id });
    await generateModulAjar(chatId, session.data);
  } 
  else if (dataAction === 'action:reset') {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Proses dibatalkan' });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: message.message_id });
    sessions.delete(chatId);
    bot.sendMessage(chatId, 'Proses dibatalkan. Silakan kirim /start untuk mulai lagi.');
  }
});

function showConfirmation(chatId, data) {
  const modelText = data.metodeKey === 'lainnya' ? 'Sesuai AI' : METODE_PEMBELAJARAN[data.metodeKey].label;
  const keywordText = data.keyword ? data.keyword : 'Tidak ada';
  const paperText = data.paperSize.toUpperCase();
  const orientText = data.orientation === 'portrait' ? 'Tegak (Portrait)' : 'Mendatar (Landscape)';

  const msgText = `📋 *Ringkasan Permintaan Modul Ajar*\n\n` +
    `• *Mata Pelajaran:* ${data.mapel}\n` +
    `• *Jenjang:* ${data.jenjang}\n` +
    `• *Kelas:* ${data.kelas}\n` +
    `• *Model Pembelajaran:* ${modelText}\n` +
    `• *Konteks Tambahan:* ${keywordText}\n` +
    `• *Ukuran Kertas:* ${paperText}\n` +
    `• *Orientasi:* ${orientText}\n` +
    `• *CP:* _${data.cp.substring(0, 100)}..._\n` +
    `• *TP:* _${data.tp.substring(0, 100)}..._\n\n` +
    `Anda dapat mengubah ukuran kertas dan orientasi menggunakan tombol di bawah, lalu klik *Buat Modul Ajar* jika sudah sesuai.`;

  bot.sendMessage(chatId, msgText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: `📄 Kertas: ${paperText}`, callback_data: 'toggle:papersize' },
          { text: `🔄 Orientasi: ${data.orientation === 'portrait' ? 'Prt' : 'Lnd'}`, callback_data: 'toggle:orientation' }
        ],
        [
          { text: 'Ya, Buat Modul Ajar! 🚀', callback_data: 'action:generate' },
          { text: 'Batal ❌', callback_data: 'action:reset' }
        ]
      ]
    }
  });
}

function editConfirmation(chatId, messageId, data) {
  const modelText = data.metodeKey === 'lainnya' ? 'Sesuai AI' : METODE_PEMBELAJARAN[data.metodeKey].label;
  const keywordText = data.keyword ? data.keyword : 'Tidak ada';
  const paperText = data.paperSize.toUpperCase();
  const orientText = data.orientation === 'portrait' ? 'Tegak (Portrait)' : 'Mendatar (Landscape)';

  const msgText = `📋 *Ringkasan Permintaan Modul Ajar*\n\n` +
    `• *Mata Pelajaran:* ${data.mapel}\n` +
    `• *Jenjang:* ${data.jenjang}\n` +
    `• *Kelas:* ${data.kelas}\n` +
    `• *Model Pembelajaran:* ${modelText}\n` +
    `• *Konteks Tambahan:* ${keywordText}\n` +
    `• *Ukuran Kertas:* ${paperText}\n` +
    `• *Orientasi:* ${orientText}\n` +
    `• *CP:* _${data.cp.substring(0, 100)}..._\n` +
    `• *TP:* _${data.tp.substring(0, 100)}..._\n\n` +
    `Anda dapat mengubah ukuran kertas dan orientasi menggunakan tombol di bawah, lalu klik *Buat Modul Ajar* jika sudah sesuai.`;

  bot.editMessageText(msgText, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: `📄 Kertas: ${paperText}`, callback_data: 'toggle:papersize' },
          { text: `🔄 Orientasi: ${data.orientation === 'portrait' ? 'Prt' : 'Lnd'}`, callback_data: 'toggle:orientation' }
        ],
        [
          { text: 'Ya, Buat Modul Ajar! 🚀', callback_data: 'action:generate' },
          { text: 'Batal ❌', callback_data: 'action:reset' }
        ]
      ]
    }
  });
}

// Logika Call Gemini API & Format Output
async function generateModulAjar(chatId, data) {
  bot.sendMessage(chatId, '⏳ *Sedang memproses permintaan Anda ke Gemini AI...*\nProses ini biasanya membutuhkan waktu sekitar 10-30 detik. Silakan tunggu.', { parse_mode: 'Markdown' });

  if (!cloudflareUrl) {
    bot.sendMessage(chatId, '❌ *Error:* CLOUDFLARE_WORKER_URL belum disetting di file .env server bot.');
    return;
  }

  const promptText = buildAIPrompt(data.mapel, data.jenjang, data.kelas, data.cp, data.tp, data.keyword, data.metodeKey);
  
  // Format pemanggilan Cloudflare Worker
  const cleanUrl = cloudflareUrl.endsWith('/') ? cloudflareUrl.slice(0, -1) : cloudflareUrl;
  const url = `${cleanUrl}/v1beta/models/${geminiModel}:generateContent`;

  const requestBody = {
    systemInstruction: { parts: [{ text: AI_SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: geminiSchema(),
      temperature: 0.6
    }
  };

  const authCode = getEffectiveApiKey(data.accessCode || geminiAccessCode);
  const deviceId = `tg-${chatId}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authCode}`,
        'X-Device-ID': deviceId
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = await response.json();
        detail = errJson?.error?.message || '';
      } catch (e) {}
      throw new Error(`Worker HTTP Error ${response.status}: ${detail}`);
    }

    const resJson = await response.json();
    const resultText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error('Hasil respons dari Gemini kosong.');
    }

    const modulData = JSON.parse(resultText);
    const baseFileName = `Modul_Ajar_${modulData.mapel.replace(/\s+/g, '_')}_Kelas_${modulData.kelas}`;

    // Generate PDF menggunakan Puppeteer
    bot.sendMessage(chatId, '🖨️ *Sedang merender layout dokumen ke format PDF...*', { parse_mode: 'Markdown' });
    const pdfFileName = `${baseFileName}.pdf`;
    const pdfFilePath = path.join(__dirname, pdfFileName);
    
    let pdfGenerated = false;
    try {
      await renderPDFFromHtml(modulData, data.paperSize || 'a4', data.orientation || 'portrait', data.penyusun, data.instansi, data.tahun, pdfFilePath);
      pdfGenerated = true;
    } catch (pdfError) {
      console.error('PDF Render Error:', pdfError);
      bot.sendMessage(chatId, '⚠️ *Gagal merender PDF:* ' + pdfError.message, { parse_mode: 'Markdown' });
    }

    if (pdfGenerated) {
      // Kirim pesan sukses dan ringkasan singkat
      const summaryMsg = `✅ *Modul Ajar Berhasil Dibuat!*\n\n` +
        `• *Judul:* ${modulData.judul}\n` +
        `• *Fase/Kelas:* ${modulData.fase}\n` +
        `• *Alokasi Waktu:* ${modulData.alokasi}\n` +
        `• *Landasan Nilai:* ${modulData.sumberNilai === 'Quran' ? modulData.quranRef : modulData.haditsRef}\n\n` +
        `File dokumen lengkap hasil generate telah saya lampirkan di bawah ini dalam format **PDF (Siap Cetak)**.`;

      await bot.sendMessage(chatId, summaryMsg, { parse_mode: 'Markdown' });
      
      // Kirim file PDF
      await bot.sendDocument(chatId, pdfFilePath, {}, {
        filename: pdfFileName,
        contentType: 'application/pdf'
      });
      fs.unlinkSync(pdfFilePath);
    }

    // Hapus sesi
    sessions.delete(chatId);

  } catch (error) {
    console.error('Gemini Generate Error:', error);
    bot.sendMessage(chatId, `❌ *Gagal membuat modul ajar:*\n_${error.message}_\n\nCoba kirim /start untuk mengulangi.`);
  }
}

// Fungsi Render PDF dari HTML via Puppeteer
async function renderPDFFromHtml(modulData, paperSize, orientation, penyusun, instansi, tahun, pdfPath) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Load local index.html
    const indexPath = path.resolve(__dirname, '../index.html');
    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });

    // Inject data ke DOM index.html dan panggil applyAIResult
    await page.evaluate((data, size, orient, pUser, pInst, pTahun) => {
      // Set the profile inputs
      const penyusunEl = document.getElementById('penyusun');
      const guruNamaEl = document.getElementById('guruNama');
      const instansiEl = document.getElementById('instansi');
      const tahunEl = document.getElementById('tahun');
      if (penyusunEl) penyusunEl.value = pUser || '';
      if (guruNamaEl) guruNamaEl.value = pUser || '';
      if (instansiEl) instansiEl.value = pInst || '';
      if (tahunEl) tahunEl.value = pTahun || '';

      // 1. Terapkan data hasil AI ke field input
      applyAIResult(data);
      
      // 2. Set ukuran kertas dan orientasi
      const sizeEl = document.getElementById('paperSize');
      const orientEl = document.getElementById('orientation');
      if (sizeEl) sizeEl.value = size;
      if (orientEl) orientEl.value = orient;

      // 3. Update style halaman
      updatePageStyle();
      
      // 4. Set zoom ke 1 agar tidak terpotong (scale 100%)
      const zoomEl = document.getElementById('zoom');
      if (zoomEl) {
        zoomEl.value = '1';
        applyZoom();
      }
    }, modulData, paperSize, orientation, penyusun, instansi, tahun);

    // Berikan jeda sedikit agar layout dan font Google Fonts selesai loading sempurna
    await new Promise(resolve => setTimeout(resolve, 800));

    // A4: 210x297 mm, F4: 215x330 mm
    const w = paperSize === 'f4' ? (orientation === 'portrait' ? '215mm' : '330mm') : (orientation === 'portrait' ? '210mm' : '297mm');
    const h = paperSize === 'f4' ? (orientation === 'portrait' ? '330mm' : '215mm') : (orientation === 'portrait' ? '297mm' : '210mm');

    // Render ke PDF
    await page.pdf({
      path: pdfPath,
      width: w,
      height: h,
      printBackground: true,
      preferCSSPageSize: true
    });
  } finally {
    await browser.close();
  }
}

// Formatter Markdown
function formatModulAjarToMarkdown(r, data) {
  let output = '';

  output += `# MODUL AJAR KURIKULUM MERDEKA\n`;
  output += `## ${r.judul.toUpperCase()}\n\n`;

  output += `### I. INFORMASI UMUM\n`;
  output += `* **Penyusun:** ${data.penyusun || '-'}\n`;
  output += `* **Instansi:** ${data.instansi || '-'}\n`;
  output += `* **Tahun Pelajaran:** ${data.tahun || '-'}\n`;
  output += `* **Mata Pelajaran:** ${r.mapel}\n`;
  output += `* **Jenjang:** ${r.jenjang}\n`;
  output += `* **Fase/Kelas/Semester:** ${r.fase}\n`;
  output += `* **Alokasi Waktu:** ${r.alokasi}\n`;
  output += `* **Elemen:** ${r.elemenSingkat}\n\n`;

  output += `#### Landasan Nilai Karakter (Nilai Qur'ani/Hadits):\n`;
  if (r.sumberNilai === 'Quran') {
    output += `* **Surah & Ayat:** ${r.quranRef}\n`;
    output += `* **Teks Arab:** \`${r.quranArab}\`\n`;
    output += `* **Terjemahan:** _"${r.quranTerjemah}"_\n`;
  } else {
    output += `* **Hadits:** ${r.haditsRef}\n`;
    output += `* **Teks Arab:** \`${r.haditsArab}\`\n`;
    output += `* **Terjemahan:** _"${r.haditsTerjemah}"_\n`;
  }
  output += `* **Keterkaitan Materi:** ${r.quranKait}\n\n`;

  output += `### II. KOMPONEN INTI\n\n`;
  output += `#### A. Identifikasi Capaian & Tujuan\n`;
  output += `1. **Capaian Pembelajaran (CP):**\n   ${r.cp}\n\n`;
  output += `2. **Tujuan Pembelajaran (TP):**\n   ${r.tp}\n\n`;
  output += `3. **Dimensi Profil Pelajar Pancasila:**\n`;
  r.dimensiProfilLulusan.forEach(dim => {
    output += `   - ${dim}\n`;
  });
  output += `\n   *Narasi Keterkaitan:* \n   ${r.dpl}\n\n`;

  output += `#### B. Kerangka Pembelajaran Mendalam (PM) & Desain Pedagogis\n`;
  output += `* **Prinsip Berkesadaran (Mindful):**\n  ${r.prinsipMindful}\n\n`;
  output += `* **Prinsip Bermakna (Meaningful):**\n  ${r.prinsipMeaningful}\n\n`;
  output += `* **Prinsip Menggembirakan (Joyful):**\n  ${r.prinsipJoyful}\n\n`;
  output += `* **Praktik Pedagogis (Model & Metode):**\n  ${r.praktik}\n\n`;
  output += `* **Kemitraan dengan Orang Tua:**\n  ${r.kemitraan}\n\n`;
  output += `* **Lingkungan Belajar:**\n  ${r.lingkungan}\n\n`;
  output += `* **Pemanfaatan Teknologi Digital:**\n  ${r.teknologiDigital}\n\n`;

  output += `#### C. Sarana & Media Pembelajaran\n`;
  output += `| Nama Sarana/Media | Fungsi/Kegunaan |\n`;
  output += `| :--- | :--- |\n`;
  const saranaLines = (r.sarana || '').split('\n');
  saranaLines.forEach(line => {
    if (line.includes('|')) {
      const parts = line.split('|');
      output += `| ${parts[0].trim()} | ${parts[1].trim()} |\n`;
    } else if (line.trim()) {
      output += `| ${line.trim()} | - |\n`;
    }
  });
  output += `\n`;

  output += `### III. LANGKAH-LANGKAH PEMBELAJARAN\n\n`;
  r.langkahPembelajaran.forEach((tahap, tIdx) => {
    output += `#### Tahap ${tIdx + 1}: ${tahap.title} (${tahap.durasi}) - _Tahap PM: ${tahap.tahapPM}_\n`;
    const points = tahap.content.split('\n');
    points.forEach((point, pIdx) => {
      if (point.startsWith('>>')) {
        output += `   _>> ${point.substring(2).trim()}_\n`;
      } else if (point.trim()) {
        output += `   ${pIdx + 1}. ${point.trim()}\n`;
      }
    });
    output += `\n`;
  });

  output += `### IV. ASESMEN & EVALUASI\n\n`;
  output += `#### A. Rencana Asesmen\n`;
  output += `* **Asesmen Awal (Diagnostic):** ${r.asAwal}\n`;
  output += `* **Asesmen Formatif (Proses):** ${r.asFormatif}\n`;
  output += `* **Asesmen Sumatif (Akhir):** ${r.asSumatif}\n\n`;

  output += `#### B. Rubrik Penilaian\n\n`;
  output += `##### 1. ${r.rubrik1Judul || 'Rubrik Sikap & Karakter'}\n`;
  output += `| Aspek | Indikator | Level 4 (Sangat Baik) | Level 3 (Baik) | Level 2 (Cukup) | Level 1 (Perlu Bimbingan) |\n`;
  output += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  const rub1Lines = (r.rubrik1 || '').split('\n');
  rub1Lines.forEach(line => {
    if (line.includes('|')) {
      const p = line.split('|').map(s => s.trim());
      output += `| ${p[0] || ''} | ${p[1] || ''} | ${p[2] || ''} | ${p[3] || ''} | ${p[4] || ''} | ${p[5] || ''} |\n`;
    }
  });
  output += `\n`;

  output += `##### 2. ${r.rubrik2Judul || 'Rubrik Produk & Unjuk Kerja'}\n`;
  output += `| Aspek | Indikator | Level 4 (Sangat Baik) | Level 3 (Baik) | Level 2 (Cukup) | Level 1 (Perlu Bimbingan) |\n`;
  output += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  const rub2Lines = (r.rubrik2 || '').split('\n');
  rub2Lines.forEach(line => {
    if (line.includes('|')) {
      const p = line.split('|').map(s => s.trim());
      output += `| ${p[0] || ''} | ${p[1] || ''} | ${p[2] || ''} | ${p[3] || ''} | ${p[4] || ''} | ${p[5] || ''} |\n`;
    }
  });
  output += `\n`;

  output += `* **Skor Maksimal:** ${r.skorMaks} | **KKM (Kriteria Ketercapaian):** ${r.kkm}\n\n`;

  output += `### V. RENCANA TINDAK LANJUT & REFLEKSI\n\n`;
  output += `* **Tindak Lanjut Peserta Didik yang Mencapai KKM:**\n  ${r.sudahKKM}\n\n`;
  output += `* **Tindak Lanjut Peserta Didik yang Belum Mencapai KKM:**\n  ${r.belumKKM}\n\n`;
  output += `* **Catatan Reflektif Guru:**\n  ${r.catatan}\n`;

  return output;
}
