import { useLang } from '../lib/i18n';

export default function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, toggle } = useLang();
  return (
    <button data-no-i18n onClick={toggle} title={lang === 'ar' ? 'English' : 'العربية'}
      className={`h-9 min-w-9 px-2 grid place-items-center rounded-full border text-sm font-bold transition-colors ${dark ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-orange-500 hover:bg-orange-50'}`}>
      {lang === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}
