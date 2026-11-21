import { useNavigate } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';

/** Shown to students who have not taken the placement test yet. */
export default function PlacementRequired({ compact = false }: { compact?: boolean }) {
  const nav = useNavigate();
  return (
    <div className={`rounded-3xl border border-indigo-100 bg-indigo-50 ${compact ? 'p-4' : 'p-6'} flex flex-wrap items-center gap-4`}>
      <span className="w-12 h-12 rounded-2xl bg-white text-indigo-600 grid place-items-center shrink-0"><BrainCircuit size={22} /></span>
      <div className="flex-1 min-w-56">
        <p className="font-extrabold text-slate-900">Take the placement test first</p>
        <p className="text-sm text-slate-600">You can browse every course and its details. To enroll and start studying, take the placement test so we can place you at the right level.</p>
      </div>
      <button onClick={() => nav('/student/assessments')} className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">Start the placement test</button>
    </div>
  );
}
