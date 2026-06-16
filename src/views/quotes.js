import { esc, fmtEUR, fmtDate, statusBadge, todayISO, toast, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { quotes } from '../lib/mock.js';

const ST = ['enviado', 'pendiente', 'aceptado', 'rechazado'];

export function renderQuotes(root) {
  const sum = arr => arr.reduce((s, q) => s + (q.value || 0), 0);
  const accepted = quotes.filter(q => q.status === 'aceptado');
  const live = quotes.filter(q => q.status === 'enviado' || q.status === 'pendiente');

  renderTablePage(root, {
    title: 'Presupuestos',
    subtitle: `${quotes.length} presupuestos · ${fmtEUR(sum(quotes))} propuesto`,
    primaryAction: { label: 'Nuevo presupuesto', onClick: () => toast('Disponible al conectar la base de datos') },
    stats: [
      { num: live.length, label: 'En proceso', icon: ICONS.quotes, color: 'blue' },
      { num: fmtEUR(sum(live)), label: 'Valor en proceso', icon: ICONS.euro, color: 'orange' },
      { num: accepted.length, label: 'Aceptados', icon: ICONS.check, color: 'green' },
      { num: fmtEUR(sum(accepted)), label: 'Valor aceptado', icon: ICONS.dashboard, color: 'purple' }
    ],
    search: { placeholder: 'Buscar presupuesto…', keys: ['number', 'client', 'service'] },
    selects: [{ id: 'status', label: 'Todos los estados', options: ST.map(s => ({ value: s, label: statusBadgeLabel(s) })), match: (r, v) => r.status === v }],
    columns: [
      { label: 'Nº', nowrap: true, render: q => `<span class="cell-strong">${esc(q.number)}</span>` },
      { label: 'Cliente', render: q => esc(q.client) },
      { label: 'Servicio', render: q => esc(q.service) },
      { label: 'Valor', align: 'right', nowrap: true, render: q => `<span class="cell-mono">${fmtEUR(q.value)}</span>` },
      { label: 'Enviado', nowrap: true, render: q => `<span class="cell-muted">${fmtDate(q.sent_at)}</span>` },
      { label: 'Vence', nowrap: true, render: q => { const od = (q.status === 'enviado' || q.status === 'pendiente') && q.expires_at < todayISO(); return `<span style="${od ? 'color:var(--red);font-weight:600' : 'color:var(--muted)'}">${fmtDate(q.expires_at)}${od ? ' ⚠' : ''}</span>`; } },
      { label: 'Estado', render: q => statusBadge(q.status) }
    ],
    rows: quotes,
    empty: { icon: '📄', title: 'Sin presupuestos', text: 'Crea tu primer presupuesto para clientes.' }
  });
}

function statusBadgeLabel(s) {
  return { enviado: 'Enviado', pendiente: 'Pendiente', aceptado: 'Aceptado', rechazado: 'Rechazado' }[s] || s;
}
