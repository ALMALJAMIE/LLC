import type { Profile } from './auth';
import { CENTER } from './site';
import { fmtDate, money } from './db';
import mark from '../assets/llc-mark.png';

type Inv = { invoice_no: string; amount: number; currency: string; paid_at: string | null; created_at: string; reference: string | null; method: string | null; enrollment: { course: { title: string; code: string } | null } | null };

/** Opens a printable invoice (user saves it as PDF from the print dialog). */
export function printInvoice(p: Inv, profile: Profile | null) {
  const w = window.open('', '_blank');
  if (!w) return;
  const logo = new URL(mark, location.href).href;
  w.document.write(`<!doctype html><html><head><title>${p.invoice_no}</title><style>
  body{font-family:Poppins,Arial,sans-serif;color:#1e293b;margin:48px} .row{display:flex;justify-content:space-between;align-items:flex-start}
  h1{font-size:28px;margin:0;color:#0c3d88} .muted{color:#64748b;font-size:13px} table{width:100%;border-collapse:collapse;margin-top:32px}
  th{background:#0b1a3a;color:#fff;text-align:left;padding:10px;font-size:12px;text-transform:uppercase;letter-spacing:.05em} td{padding:12px 10px;border-bottom:1px solid #e2e8f0}
  .total{font-size:20px;font-weight:800;color:#0c3d88} .paid{display:inline-block;padding:4px 12px;border-radius:999px;background:#dcfce7;color:#15803d;font-weight:700;font-size:12px}
  </style></head><body>
  <div class="row"><div><img src="${logo}" style="height:56px"/><div style="margin-top:8px;font-weight:800;letter-spacing:.1em;color:#0c3d88">LANGUAGE LEAP <span style="color:#e9a823">CENTER</span></div>
  <div class="muted">${CENTER.email} · ${CENTER.phone}</div></div>
  <div style="text-align:right"><h1>INVOICE</h1><div class="muted">${p.invoice_no}</div><div class="muted">Date: ${fmtDate(p.paid_at ?? p.created_at)}</div><div style="margin-top:8px"><span class="paid">PAID</span></div></div></div>
  <div style="margin-top:32px"><div class="muted">Billed to</div><div style="font-weight:700">${profile?.full_name ?? ''}</div><div class="muted">${profile?.email ?? ''}${profile?.student_no ? ' · ' + profile.student_no : ''}</div></div>
  <table><tr><th>Description</th><th>Code</th><th style="text-align:right">Amount</th></tr>
  <tr><td>${p.enrollment?.course?.title ?? 'Course fee'}</td><td>${p.enrollment?.course?.code ?? ''}</td><td style="text-align:right">${money(p.amount, p.currency)}</td></tr></table>
  <div class="row" style="margin-top:24px"><div class="muted">Method: ${(p.method ?? '').replace('_', ' ')}${p.reference ? ' · Ref: ' + p.reference : ''}</div><div class="total">Total ${money(p.amount, p.currency)}</div></div>
  <p class="muted" style="margin-top:64px">Thank you for learning with ${CENTER.name}. This is a computer-generated invoice.</p>
  <script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}
