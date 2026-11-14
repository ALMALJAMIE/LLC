import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Month calendar card used on dashboards; `marks` are ISO dates (yyyy-mm-dd) with something on them. */
export default function MiniCalendar({ marks = [] }: { marks?: string[] }) {
  const [cur, setCur] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const today = new Date().toISOString().slice(0, 10);
  const first = (cur.getDay() + 6) % 7;
  const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
  const move = (n: number) => setCur(new Date(cur.getFullYear(), cur.getMonth() + n, 1));
  return (
    <div className="bg-white rounded-4xl p-6 lg:p-8 border border-slate-100 shadow-sm w-full relative z-20 hover:shadow-xl transition-shadow duration-300">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        <div className="flex gap-1 text-slate-400">
          <button onClick={() => move(-1)} className="p-1.5 hover:bg-slate-50 hover:text-slate-800 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
          <button onClick={() => move(1)} className="p-1.5 hover:bg-slate-50 hover:text-slate-800 rounded-lg transition-colors"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center mb-2">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <span key={d} className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-5 gap-x-1">
        {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const iso = new Date(Date.UTC(cur.getFullYear(), cur.getMonth(), i + 1)).toISOString().slice(0, 10);
          const isToday = iso === today;
          return (
            <div key={i} className="flex flex-col items-center justify-center relative group isolate">
              <div className={`w-9 h-9 flex flex-col items-center justify-center rounded-full text-sm font-bold transition-all cursor-default relative z-10 ${isToday ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}>
                <span>{i + 1}</span>
              </div>
              {marks.includes(iso) && <span className="absolute -bottom-1.5 w-1.5 h-1.5 rounded-full bg-orange-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
