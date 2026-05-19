const DISMISS_KEY = 'doom_pwa_install_dismissed_v1';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // ignore
  }
}

export function initPwaInstallPrompt(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (readDismissed()) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Instalar juego');
  banner.innerHTML = `
    <p class="pwa-install-banner__text">Instalar juego para pantalla completa sin barras del navegador.</p>
    <div class="pwa-install-banner__actions">
      <button type="button" class="pwa-install-banner__install">Instalar</button>
      <button type="button" class="pwa-install-banner__dismiss" aria-label="Cerrar">×</button>
    </div>
  `;

  const installBtn = banner.querySelector('.pwa-install-banner__install') as HTMLButtonElement;
  const dismissBtn = banner.querySelector('.pwa-install-banner__dismiss') as HTMLButtonElement;

  const hide = (): void => {
    banner.classList.add('pwa-install-banner--hidden');
    window.setTimeout(() => banner.remove(), 320);
  };

  dismissBtn.addEventListener('click', () => {
    writeDismissed();
    hide();
  });

  installBtn.addEventListener('click', () => {
    if (!deferredPrompt) return;
    void deferredPrompt.prompt();
    void deferredPrompt.userChoice.finally(() => {
      deferredPrompt = null;
      writeDismissed();
      hide();
    });
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    if (!document.body.contains(banner)) document.body.appendChild(banner);
    banner.classList.remove('pwa-install-banner--hidden');
  });

  window.addEventListener('appinstalled', () => {
    writeDismissed();
    hide();
  });
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL ?? '/';
  const swUrl = `${base}sw.js`;
  try {
    await navigator.serviceWorker.register(swUrl, { scope: base });
  } catch {
    // PWA remains optional; game runs without SW.
  }
}
