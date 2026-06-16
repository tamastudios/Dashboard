import { esc, fmtEUR, fmtDate, statusBadge, toast, ICONS } from '../lib/ui.js';
import { renderTablePage, progressBar } from '../lib/components.js';
import { projects } from '../lib/mock.js';

const TYPES = { web: 'Web', agente: 'Agente IA', automatizacion: 'Automatización', mantenimiento: 'Mantenimiento' };
const TYPE_COLOR = { web: 'blue', agente: 'purple', automatizacion: 'orange', mantenimiento: 'gray' };
const ST = ['progreso', 'revision', 'pendiente_cliente', 'pausado', 'entregado', 'activo'];

export function renderProjects(root) {
  const activos = projects.filter(p => !['entregado'].includes(p.status));
  const margin = projects.reduce((s, p) => s + ((p.budget || 0) - (p.cost || 0)), 0);
  const budgetTotal = projects.reduce((s, p) => s + (p.budget || 0), 0);

  renderTablePage(root, {
    title: 'Proyectos',
    subtitle: `${projects.length} proyectos · ${fmtEUR(budgetTotal)} contratado`,
    primaryAction: { label: 'Nuevo proyecto', onClick: () => toast('Disponible al conectar la base de datos') },
    stats: [
      { num: activos.length, label: 'Proyectos activos', icon: ICONS.projects, color: 'blue' },
      { num: fmtEUR(budgetTotal), label: 'Facturación contratada', icon: ICONS.euro, color: 'green' },
      { num: fmtEUR(margin), label: 'Rentabilidad estimada', icon: ICONS.dashboard, color: 'purple' },
      { num: projects.filter(p => p.status === 'revision').length, label: 'En revisión', icon: ICONS.qa, color: 'orange' }
    ],
    search: { placeholder: 'Buscar proyecto…', keys: ['name', 'client', 'owner'] },
    selects: [
      { id: 'type', label: 'Todos los tipos', options: Object.entries(TYPES).map(([v, l]) => ({ value: v, label: l })), match: (r, v) => r.type === v },
      { id: 'status', label: 'Todos los estados', options: ST.map(s => ({ value: s, label: s })), match: (r, v) => r.status === v }
    ],
    columns: [
      { label: 'Proyecto', render: p => `<div class="cell-strong">${esc(p.name)}</div><div class="cell-muted">${esc(p.client)}</div>` },
      { label: 'Tipo', render: p => `<span class="chip chip-${TYPE_COLOR[p.type]}"><span class="dot"></span>${esc(TYPES[p.type] || p.type)}</span>` },
      { label: 'Estado', render: p => statusBadge(p.status) },
      { label: 'Progreso', width: true, render: p => `<div style="display:flex;align-items:center;gap:8px">${progressBar(p.progress)}<span class="cell-muted">${p.progress}%</span></div>` },
      { label: 'Entrega', nowrap: true, render: p => `<span class="cell-muted">${fmtDate(p.due)}</span>` },
      { label: 'Rentab.', align: 'right', nowrap: true, render: p => { const m = (p.budget || 0) - (p.cost || 0); return `<span class="cell-mono" style="color:${m >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtEUR(m)}</span>`; } },
      { label: 'Resp.', render: p => esc(p.owner) }
    ],
    rows: projects,
    empty: { icon: '📁', title: 'Sin proyectos', text: 'Tus proyectos de web, IA y automatización aparecerán aquí.' }
  });
}
