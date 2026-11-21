import type { Profile } from './auth';
import { CENTER, useSite } from './site';
import { fmtDate, money } from './db';
import mark from '../assets/llc-mark.png';

export type InvoiceData = {
  invoice_no: string; amount: number; currency: string; status: string; paid_at: string | null; created_at: string; due_at?: string | null;
  reference: string | null; method: string | null; description?: string | null; kind?: string;
  subtotal?: number | null; discount?: number | null; tax?: number | null; refunded_amount?: number | null;
  lines?: { description: string; qty: number; unit: number }[] | null;
  enrollment?: { course: { title: string; code: string } | null } | null;
};
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Opens a printable invoice / receipt (the user saves it as PDF from the print dialog). */
export function printInvoice(p: InvoiceData, profile: Pick<Profile, 'full_name' | 'email'> & { student_no?: string | null } | null) {
  const w = window.open('', '_blank');
  if (!w) return;
  const b = useSite.getState().billing;
  const logo = new URL(mark, location.href).href;
  const lines = p.lines?.length ? p.lines : [{ description: p.description ?? p.enrollment?.course?.title ?? 'Course fee', qty: 1, unit: Number(p.subtotal ?? p.amount) }];
  const paid = p.status === 'paid' || p.status === 'refunded';
  const badge = p.status === 'refunded' ? ['REFUNDED', '#fee2e2', '#b91c1c'] : paid ? ['PAID', '#dcfce7', '#15803d'] : p.status === 'pending' ? ['DUE', '#ffedd5', '#c2410c'] : [p.status.toUpperCase(), '#f1f5f9', '#475569'];
  const sum = (l: string, v: string, strong = false) => `<tr><td></td><td style="text-align:right;${strong ? 'font-weight:800;font-size:18px;color:#0c3d88' : 'color:#64748b'}">${l}</td><td style="text-align:right;${strong ? 'font-weight:800;font-size:18px;color:#0c3d88' : ''}">${v}</td></tr>`;
  w.document.write(`<!doctype html><html><head><title>${esc(p.invoice_no)}</title><style>
  body{font-family:Poppins,Arial,sans-serif;color:#1e293b;margin:48px} .row{display:flex;justify-content:space-between;align-items:flex-start}
  h1{font-size:28px;margin:0;color:#0c3d88} .muted{color:#64748b;font-size:13px} table{width:100%;border-collapse:collapse;margin-top:32px}
  th{background:#0b1a3a;color:#fff;text-align:left;padding:10px;font-size:12px;text-transform:uppercase;letter-spacing:.05em} td{padding:10px;border-bottom:1px solid #e2e8f0}
  .badge{display:inline-block;padding:4px 12px;border-radius:999px;background:${badge[1]};color:${badge[2]};font-weight:700;font-size:12px}
  </style></head><body>
  <div class="row"><div><img src="${logo}" style="height:56px"/><div style="margin-top:8px;font-weight:800;letter-spacing:.1em;color:#0c3d88">LANGUAGE LEAP <span style="color:#e9a823">CENTER</span></div>
  <div class="muted">${esc(b.companyName)}${b.registrationNo ? ' · Reg. ' + esc(b.registrationNo) : ''}</div>
  ${b.address ? `<div class="muted">${esc(b.address)}</div>` : ''}<div class="muted">${esc(CENTER.email)} · ${esc(CENTER.phone)}</div></div>
  <div style="text-align:right"><h1>${paid ? 'RECEIPT' : 'INVOICE'}</h1><div class="muted">${esc(p.invoice_no)}</div><div class="muted">Date: ${fmtDate(p.paid_at ?? p.created_at)}</div>
  ${!paid && p.due_at ? `<div class="muted">Due: ${fmtDate(p.due_at)}</div>` : ''}<div style="margin-top:8px"><span class="badge">${badge[0]}</span></div></div></div>
  <div style="margin-top:32px"><div class="muted">Billed to</div><div style="font-weight:700">${esc(profile?.full_name)}</div><div class="muted">${esc(profile?.email)}${profile?.student_no ? ' · ' + esc(profile.student_no) : ''}</div></div>
  <table><tr><th>Description</th><th style="text-align:right">Qty × Price</th><th style="text-align:right">Amount</th></tr>
  ${lines.map((l) => `<tr><td>${esc(l.description)}</td><td style="text-align:right">${l.qty} × ${money(l.unit, p.currency)}</td><td style="text-align:right">${money(Number(l.qty) * Number(l.unit), p.currency)}</td></tr>`).join('')}
  ${sum('Subtotal', money(p.subtotal ?? p.amount, p.currency))}
  ${Number(p.discount) > 0 ? sum('Discount', '− ' + money(p.discount, p.currency)) : ''}
  ${Number(p.tax) > 0 ? sum(`${esc(b.taxLabel)}`, money(p.tax, p.currency)) : ''}
  ${sum('Total', money(p.amount, p.currency), true)}
  ${Number(p.refunded_amount) > 0 ? sum('Refunded', '− ' + money(p.refunded_amount, p.currency)) : ''}
  </table>
  <div class="muted" style="margin-top:16px">${p.method ? 'Method: ' + esc(p.method.replace('_', ' ')) : ''}${p.reference ? ' · Ref: ' + esc(p.reference) : ''}</div>
  ${!paid ? `<div style="margin-top:24px;padding:16px;border:1px solid #e2e8f0;border-radius:12px"><b>Pay by bank transfer</b><div class="muted">${esc(CENTER.bank.bankName)} · ${esc(CENTER.bank.accountName)} · ${esc(CENTER.bank.accountNo)}</div><div class="muted">Please write ${esc(p.invoice_no)} as the reference.</div></div>` : ''}
  <p class="muted" style="margin-top:64px">Thank you for learning with ${esc(CENTER.name)}. This is a computer-generated document. Refund policy: ${esc(location.origin + import.meta.env.BASE_URL)}legal/refunds</p>
  <script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}
