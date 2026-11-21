import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';

/** Attendance QR that changes every 20 seconds, so a photo of it cannot be passed to someone who is not in class. */
export default function CheckinQR({ sessionId, size = 240 }: { sessionId: number; size?: number }) {
  const [code, setCode] = useState<{ code: string; seconds_left: number; open: boolean } | null>(null);
  const [left, setLeft] = useState(0);
  const [img, setImg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const { data, error } = await supabase.rpc('attendance_code', { p_session: sessionId });
      if (stop) return;
      if (error) { setErr(error.message); return; }
      const c = data as { code: string; seconds_left: number; open: boolean };
      setCode(c); setLeft(c.seconds_left);
      const url = `${location.origin}${import.meta.env.BASE_URL}student/live-attendance?code=${c.code}`;
      setImg(await QRCode.toDataURL(url, { width: size * 2, margin: 1, color: { dark: '#0b1a3a' } }));
      timer = setTimeout(load, Math.max(1, c.seconds_left) * 1000 + 300);
    };
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [sessionId, size]);
  useEffect(() => { const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000); return () => clearInterval(t); }, []);
  if (err) return <p className="text-sm text-red-500">{err}</p>;
  return (
    <div className="text-center">
      {img ? <img src={img} alt="QR" style={{ width: size, height: size }} className="mx-auto rounded-2xl border border-slate-100" /> : <div style={{ width: size, height: size }} className="mx-auto rounded-2xl bg-slate-100 animate-pulse" />}
      <p className="text-3xl font-black tracking-[0.3em] font-mono mt-3" data-no-i18n>{code?.code ?? '······'}</p>
      <div className="mx-auto mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden" style={{ width: size }}><div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${(left / 20) * 100}%` }} /></div>
      <p className="text-xs text-slate-400 mt-2">{code && !code.open ? 'Check-in opens 15 minutes before the class.' : 'The code changes every 20 seconds. Students scan it or type it now.'}</p>
    </div>
  );
}
