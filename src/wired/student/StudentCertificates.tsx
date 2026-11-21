import QRCode from 'qrcode';
import { Award, Download, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Page, PageHero, Spinner } from '../../components/ui';
import mark from '../../assets/llc-mark.png';

type C = { id: number; serial: string; title: string; issued_at: string; course: { title: string; code: string } | null };

async function printCert(c: C, name: string) {
  const w = window.open('', '_blank'); if (!w) return;
  const verify = `${location.origin}${import.meta.env.BASE_URL}verify?c=${encodeURIComponent(c.serial)}`;
  const qr = await QRCode.toDataURL(verify, { margin: 0, width: 160 });
  const logo = new URL(mark, location.href).href;
  w.document.write(`<!doctype html><html><head><title>${c.serial}</title><style>@page{size:A4 landscape;margin:0}body{margin:0;font-family:Georgia,serif}
  .c{width:297mm;height:210mm;box-sizing:border-box;padding:18mm;background:#fff;position:relative}
  .b{border:3px solid #0c3d88;outline:8px solid #e9a823;outline-offset:6px;height:100%;box-sizing:border-box;text-align:center;padding:16mm}
  h1{font-size:44px;color:#0c3d88;margin:8px 0 0;letter-spacing:.08em} .n{font-size:40px;color:#0b1a3a;margin:18px 0;font-style:italic}
  .m{font-family:Arial,sans-serif;color:#475569;font-size:15px} .s{display:flex;justify-content:space-between;margin-top:22mm;font-family:Arial;font-size:12px;color:#64748b}
  </style></head><body><div class="c"><div class="b"><img src="${logo}" style="height:70px"/><div style="font-family:Arial;font-weight:800;letter-spacing:.15em;color:#0c3d88;margin-top:6px">LANGUAGE LEAP <span style="color:#e9a823">CENTER</span></div>
  <h1>CERTIFICATE</h1><div class="m">OF COMPLETION · This is to certify that</div><div class="n">${name}</div>
  <div class="m">has successfully completed</div><div style="font-size:26px;color:#0c3d88;margin-top:8px;font-weight:bold">${c.title}</div>
  <div class="s"><div>Issued: ${fmtDate(c.issued_at)}</div><div style="text-align:center"><img src="${qr}" style="height:22mm"/><div>Certificate No. ${c.serial}</div><div style="font-size:10px">Check at ${verify.replace(/^https?:\/\//, '')}</div></div><div>Language Leap Center</div></div></div></div>
  <script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}

export default function StudentCertificates() {
  const user = useAuth((s) => s.user);
  const { data, loading } = useData<C[]>(() => supabase.from('certificates').select('id,serial,title,issued_at, course:courses(title,code)').eq('student_id', user!.id).order('issued_at', { ascending: false }));
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Academic Credentials" badgeColor="green" title="My Certificates & Transcripts" illus="certificate" subtitle="Access your verified completion certificates, official grades, and detailed progress transcripts." />
      {loading ? <Spinner /> : !data?.length ? (
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm py-16 text-center"><ShieldCheck size={40} className="mx-auto text-slate-300 mb-3" /><h3 className="font-bold text-slate-800">No Certificates Recorded Yet</h3><p className="text-sm text-slate-400 max-w-sm mx-auto">Once your instructor completes and publishes your final evaluation, your certificate will appear here.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.map((c) => (
            <div key={c.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="h-28 bg-linear-to-br from-indigo-700 to-[#0b1a3a] relative grid place-items-center"><Award size={44} className="text-orange-400" /><div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-orange-400/20" /></div>
              <div className="p-6">
                <h3 className="text-lg font-extrabold text-slate-900">{c.title}</h3>
                <p className="text-xs text-slate-400 font-mono mt-1">{c.serial}</p>
                <p className="text-xs text-slate-500 mt-1">Issued {fmtDate(c.issued_at)}</p>
                <button onClick={() => printCert(c, user?.name ?? '')} className="mt-5 w-full py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold flex items-center justify-center gap-2"><Download size={16} /> Download PDF</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
