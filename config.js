// ============================================================================
// FILE: config.js
// Pusat Konfigurasi Supabase & Utiliti Umum - PantauBelajar
// ============================================================================

const SUPABASE_URL = 'https://hypajvsnlalytainfjjn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cGFqdnNubGFseXRhaW5mampuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MjkyMzcsImV4cCI6MjEwODMwNTIzN30.iwGl4NxMeo_O5QCoeik7NlI__FBpFdPrLBaaQPmrY6Q';

// Inisialisasi Klien Supabase
const db = typeof supabase !== 'undefined' 
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

// Alias tambahan jika ada bahagian skrip yang memanggil supabaseClient
const supabaseClient = db;

// Konfigurasi Lalai Aplikasi PantauBelajar
const APP_CONFIG = {
    namaAplikasi: "PantauBelajar",
    tahunAjaranDefault: "2025/2026",
    semesterDefault: "Semester Ganjil",
    periodeDefault: "Semester Ganjil 2026",
    kelasDefault: "X-A",
    kkmDefault: {
        "Matematika": 75,
        "Informatika": 78,
        "IPA": 75,
        "Bahasa Indonesia": 75,
        "Sejarah": 75
    }
};

// Fungsi Notifikasi Toast Moden
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const bgColors = {
        success: 'bg-slate-900 border-emerald-500 text-white',
        error: 'bg-rose-950 border-rose-500 text-rose-100',
        info: 'bg-indigo-950 border-indigo-400 text-indigo-100'
    };

    toast.className = `fixed bottom-6 right-6 px-5 py-3.5 rounded-xl shadow-2xl border-l-4 text-sm font-medium z-50 transition-all duration-300 flex items-center gap-2.5 ${bgColors[type] || bgColors.success}`;
    toast.innerHTML = `
        <span>${type === 'error' ? '⚠️' : (type === 'info' ? 'ℹ️' : '✅')}</span>
        <span>${message}</span>
    `;
    toast.classList.remove('hidden');

    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

// Pembantu untuk membuat inisial nama pada Avatar Profil
function getInitials(name) {
    if (!name) return 'S';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
