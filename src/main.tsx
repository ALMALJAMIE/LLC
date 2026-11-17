import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import '@fontsource/poppins/900.css';
import '@fontsource/plus-jakarta-sans/300.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cairo/800.css';
import './index.css';
import { initI18n } from './lib/i18n';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
initI18n();

// Auto-update: when the tab is reopened after a new deploy, reload so nobody keeps running an old copy.
// (Only on returning to the tab, never in the middle of filling a form.)
const current = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map((s) => s.src.split('/').pop()).join();
async function checkVersion() {
  try {
    const html = await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: 'no-store' }).then((r) => r.text());
    const latest = [...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map((m) => m[1].split('/').pop()).join();
    // reload at most once per new version, so a stale cache can never cause a reload loop
    if (current && latest && latest !== current && sessionStorage.getItem('llc-reloaded-for') !== latest) {
      sessionStorage.setItem('llc-reloaded-for', latest);
      location.reload();
    }
  } catch { /* offline: try again later */ }
}
if (import.meta.env.PROD) {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion(); });
}
