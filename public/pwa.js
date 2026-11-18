(function initPantauBelajarPWA() {
    'use strict';

    let deferredPrompt = null;
    let wasOffline = !navigator.onLine;

    function isStandaloneMode() {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true
        );
    }

    function isIOSDevice() {
        const ua = (window.navigator.userAgent || '').toLowerCase();
        return /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function isInIframe() {
        try {
            return window.self !== window.top;
        } catch {
            return true;
        }
    }

    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/sw.js', { scope: '/' })
                .then((registration) => {
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    });
                })
                .catch((err) => {
                    console.warn('SW registration skipped/failed:', err?.message || err);
                });
        });
    }

    // 2. Sync Install Button Visibility & Labels
    function updateInstallButtonsUI() {
        const standalone = isStandaloneMode();
        const ios = isIOSDevice();
        const buttons = document.querySelectorAll('[data-pwa-install-trigger]');

        buttons.forEach((btn) => {
            if (standalone) {
                btn.classList.add('hidden');
                return;
            }
            const compactMode = btn.getAttribute('data-pwa-compact') === 'true';
            // In topbar compact slot, only show when native prompt or iOS is ready so mobile header stays clean
            if (compactMode && !deferredPrompt && !ios) {
                btn.classList.add('hidden');
                return;
            }

            btn.classList.remove('hidden');
            const labelEl = btn.querySelector('[data-pwa-label]');
            if (labelEl) {
                if (deferredPrompt) {
                    labelEl.textContent = compactMode ? 'Install' : '📲 Install Aplikasi';
                } else if (ios) {
                    labelEl.textContent = compactMode ? 'Pasang App' : '📲 Pasang di iPhone/iPad';
                } else {
                    labelEl.textContent = compactMode ? 'Pasang' : '📲 Pasang Aplikasi (PWA)';
                }
            }
        });
    }

    // 3. Install Guide Modal (for iOS Safari & Desktop/Iframe fallback)
    function ensureGuideModal() {
        let modal = document.getElementById('pwa-install-guide-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'pwa-install-guide-modal';
        modal.className = 'hidden fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div class="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                        <img src="/pwa-192x192.png" alt="PantauBelajar" class="w-9 h-9 rounded-xl shadow-sm" />
                        <div>
                            <h3 class="font-extrabold text-sm text-slate-900 dark:text-white">Pasang PantauBelajar</h3>
                            <p class="text-[11px] text-slate-500 dark:text-slate-400">Akses cepat seperti aplikasi native dari Layar Utama</p>
                        </div>
                    </div>
                    <button type="button" id="pwa-guide-close-x" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
                </div>
                <div id="pwa-guide-body" class="p-4 sm:p-5 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed"></div>
                <div class="px-4 sm:px-5 pb-4 sm:pb-5 flex justify-end gap-2">
                    <button type="button" id="pwa-guide-close-btn" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs">Mengerti</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeModal = () => modal.classList.add('hidden');
        modal.querySelector('#pwa-guide-close-x').addEventListener('click', closeModal);
        modal.querySelector('#pwa-guide-close-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        return modal;
    }

    function openInstallGuideModal() {
        const modal = ensureGuideModal();
        const body = modal.querySelector('#pwa-guide-body');

        if (isIOSDevice()) {
            body.innerHTML = `
                <div class="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 font-bold">
                    Panduan Safari iPhone / iPad:
                </div>
                <ol class="list-decimal pl-4 space-y-2">
                    <li>Buka halaman ini langsung di browser <b>Safari</b> (bukan di dalam preview/browser lain).</li>
                    <li>Ketuk ikon <b>Bagikan (Share)</b> <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">⬆️</span> di bilah bawah/atas Safari.</li>
                    <li>Gulir ke bawah lalu pilih <b>Tambahkan ke Layar Utama (Add to Home Screen)</b>.</li>
                    <li>Ketuk <b>Tambah (Add)</b> di pojok kanan atas.</li>
                </ol>
            `;
        } else {
            const iframeNote = isInIframe()
                ? `<div class="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px]">
                    Anda sedang membuka aplikasi di dalam jendela preview (iframe). Untuk memunculkan tombol instalasi otomatis, buka link aplikasi langsung di tab browser Chrome / Edge.
                   </div>`
                : '';

            body.innerHTML = `
                ${iframeNote}
                <div class="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 font-bold">
                    Panduan Chrome / Edge (Android & Desktop):
                </div>
                <ol class="list-decimal pl-4 space-y-2">
                    <li>Buka menu browser <b>(⋮)</b> di pojok kanan atas atau klik ikon <b>Install App (⊕)</b> di kanan bilah alamat URL.</li>
                    <li>Pilih <b>Install app / Tambahkan ke Layar Utama</b>.</li>
                    <li>Aplikasi <b>PantauBelajar</b> akan terpasang dengan ikon penuh tanpa bilah alamat browser.</li>
                </ol>
            `;
        }

        modal.classList.remove('hidden');
    }

    async function handleInstallClick() {
        if (isStandaloneMode()) return;

        if (deferredPrompt) {
            try {
                await deferredPrompt.prompt();
                const choice = await deferredPrompt.userChoice;
                if (choice && choice.outcome === 'accepted') {
                    deferredPrompt = null;
                    updateInstallButtonsUI();
                }
            } catch (err) {
                console.warn('PWA prompt error:', err);
                openInstallGuideModal();
            }
            return;
        }

        openInstallGuideModal();
    }

    // Expose global helper for onclick bindings
    window.triggerPWAInstall = handleInstallClick;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        updateInstallButtonsUI();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        updateInstallButtonsUI();
        if (typeof window.showToast === 'function') {
            window.showToast('Aplikasi PantauBelajar berhasil dipasang ke perangkat!');
        }
    });

    // 4. Offline / Online Connectivity Indicator
    function ensureOfflineBanner() {
        let banner = document.getElementById('pwa-offline-banner');
        if (banner) return banner;

        banner = document.createElement('div');
        banner.id = 'pwa-offline-banner';
        banner.className = 'hidden fixed bottom-4 left-4 z-[110] max-w-[calc(100vw-2rem)] flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg border border-amber-400';
        banner.innerHTML = `
            <span class="h-2.5 w-2.5 rounded-full bg-white animate-pulse shrink-0"></span>
            <span>Mode Offline — Menampilkan shell aplikasi. Sambungkan internet untuk sinkronisasi data.</span>
        `;
        document.body.appendChild(banner);
        return banner;
    }

    function syncConnectivityUI() {
        const banner = ensureOfflineBanner();
        const online = navigator.onLine;
        if (!online) {
            wasOffline = true;
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
            if (wasOffline) {
                wasOffline = false;
                if (typeof window.showToast === 'function') {
                    window.showToast('Koneksi internet kembali terhubung.');
                }
            }
        }
    }

    window.addEventListener('online', syncConnectivityUI);
    window.addEventListener('offline', syncConnectivityUI);

    document.addEventListener('DOMContentLoaded', () => {
        updateInstallButtonsUI();
        syncConnectivityUI();
    });
})();
