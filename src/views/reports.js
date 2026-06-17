/* ============================================================
   reports.js — Informes de incidencias resueltas (PDF).
   Cuando un ticket se marca como resuelto/cerrado y se anota el
   trabajo realizado, aquí se lista y se genera el informe en PDF.
   ============================================================ */
import { esc, fmtDate, relTime, statusBadge, toast, ICONS } from '../lib/ui.js';
import { getIssuer } from '../lib/issuer.js';
import { state, profileById, companyById } from '../lib/store.js';

export function renderReports(root) {
  const resolved = state.supportRequests
    .filter(t => t.status === 'resuelto' || t.status === 'cerrado')
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = resolved.filter(t => (t.updated_at || '').slice(0, 7) === month);

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Informes</h1><div class="sub">Informe de cada incidencia resuelta · descargable en PDF</div></div>
    </div>
    <div class="stats-grid">
      ${kpi(resolved.length, 'Incidencias resueltas', ICONS.check, 'green')}
      ${kpi(thisMonth.length, 'Resueltas este mes', ICONS.reports, 'blue')}
      ${kpi(resolved.filter(t => !t.resolution).length, 'Sin informe redactado', ICONS.alert, 'orange')}
    </div>
    <div id="rp-body"></div>`;

  const body = root.querySelector('#rp-body');
  if (!resolved.length) {
    body.innerHTML = `<div class="empty"><div class="ico">📄</div><h3>Aún no hay incidencias resueltas</h3><p>Cuando resuelvas un ticket y anotes qué se ha hecho, aquí podrás descargar el informe en PDF.</p></div>`;
    return;
  }

  body.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Cliente / solicitante</th><th>Asunto</th><th>Resuelto</th><th>Responsable</th><th>Informe</th><th></th></tr></thead>
    <tbody>${resolved.map(t => {
      const comp = companyById(t.company_id);
      const cliente = comp?.name || t.client_name || t.name;
      const owner = profileById(t.assigned_to);
      return `<tr data-id="${esc(t.id)}">
        <td><div class="cell-strong">${esc(cliente)}</div><div class="cell-muted">${esc(t.name)}</div></td>
        <td>${esc(t.subject || '(sin asunto)')}</td>
        <td class="cell-muted" style="white-space:nowrap">${fmtDate(t.updated_at)}</td>
        <td>${owner ? esc((owner.name || owner.email).split(' ')[0]) : '<span class="cell-muted">—</span>'}</td>
        <td>${t.resolution ? '<span class="pill" style="color:var(--green)">✓ Redactado</span>' : '<span class="pill" style="color:var(--orange)">Pendiente</span>'}</td>
        <td><div class="row-actions"><button class="icon-btn pdf" title="Descargar informe PDF">${ICONS.download}</button></div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;

  body.querySelectorAll('tbody tr').forEach(tr => {
    const t = state.supportRequests.find(x => x.id === tr.dataset.id);
    if (t) tr.querySelector('.pdf').addEventListener('click', () => incidentReportPDF(t));
  });
}

const kpi = (num, label, icon, color) =>
  `<div class="card stat-card"><div class="stat-icon" style="background:var(--${color}-soft);color:var(--${color})">${icon}</div><div class="num">${esc(num)}</div><div class="lbl">${esc(label)}</div></div>`;

/* ---------- PDF del informe de incidencia ---------- */
export function incidentReportPDF(t) {
  const is = getIssuer();
  const comp = companyById(t.company_id);
  const cliente = comp?.name || t.client_name || '';
  const owner = profileById(t.assigned_to);
  const ref = String(t.id || '').slice(0, 8).toUpperCase();

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ${esc(ref)}</title>
<style>
  *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;margin:0;padding:40px;font-size:13px;line-height:1.6}
  .top{display:flex;justify-content:space-between;gap:30px;margin-bottom:30px;border-bottom:2px solid #e2e8f0;padding-bottom:18px}
  h1{font-size:22px;margin:0 0 4px}.muted{color:#64748b}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:18px 0 24px}
  .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8}
  .val{font-weight:600}
  .sec{margin-top:22px}.sec h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:0 0 8px}
  .box{background:#f8fafc;border:1px solid #eef2f7;border-radius:10px;padding:14px;white-space:pre-wrap}
  .foot{margin-top:40px;font-size:10.5px;color:#94a3b8;text-align:center}
  @media print{body{padding:0}@page{margin:18mm}}
</style></head><body>
  <div class="top">
    <div>
      <div style="font-weight:800;font-size:17px">${esc(is.name || 'TAMA Studios')}</div>
      ${is.email ? `<div class="muted">${esc(is.email)}</div>` : ''}${is.phone ? `<div class="muted">${esc(is.phone)}</div>` : ''}
    </div>
    <div style="text-align:right">
      <h1>INFORME DE INCIDENCIA</h1>
      <div class="muted">Ref. <strong style="color:#1e293b">#${esc(ref)}</strong></div>
    </div>
  </div>

  <div class="grid">
    <div><div class="lbl">Cliente</div><div class="val">${esc(cliente || '—')}</div></div>
    <div><div class="lbl">Solicitante</div><div class="val">${esc(t.name)} · ${esc(t.email)}</div></div>
    <div><div class="lbl">Recibido</div><div class="val">${fmtDate(t.created_at)}</div></div>
    <div><div class="lbl">Resuelto</div><div class="val">${fmtDate(t.updated_at)}</div></div>
    <div><div class="lbl">Responsable</div><div class="val">${esc(owner ? (owner.name || owner.email) : '—')}</div></div>
    <div><div class="lbl">Asunto</div><div class="val">${esc(t.subject || '—')}</div></div>
  </div>

  <div class="sec"><h2>Solicitud del cliente</h2><div class="box">${esc(t.message || '—')}</div></div>
  <div class="sec"><h2>Trabajo realizado</h2><div class="box">${esc(t.resolution || 'No se ha redactado la resolución.')}</div></div>

  <div class="foot">Informe generado con el Dashboard de TAMA Studios · ${fmtDate(new Date().toISOString())}</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { toast('Permite las ventanas emergentes para descargar el PDF', 'err'); return; }
  w.document.open(); w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch (e) {} }, 350);
}
