import { esc, statusBadge, safeUrl, toast, ICONS } from '../lib/ui.js';
import { pageHeader, statsRow, dataTable, emptyState } from '../lib/components.js';
import { access } from '../lib/mock.js';

export function renderAccess(root) {
  const byType = t => access.filter(a => a.type === t).length;

  root.innerHTML = `
    ${pageHeader({
      title: 'Accesos',
      subtitle: 'Dominios, hostings, CMS y APIs por cliente',
      actions: `<button class="btn btn-primary" id="ac-new">${ICONS.plus} Nuevo acceso</button>`
    })}

    <div class="card" style="margin-bottom:18px;display:flex;gap:12px;align-items:flex-start;font-size:.86rem;color:var(--muted)">
      <span style="flex:none;color:var(--green)">${ICONS.access}</span>
      <span><strong style="color:var(--ink)">Seguridad:</strong> aquí no se guardan contraseñas en texto plano. Solo se registra la referencia (usuario/sistema) y dónde está la credencial. Preparado para integrarse con un gestor seguro como <strong>Bitwarden</strong> o <strong>1Password</strong>.</span>
    </div>

    ${statsRow([
      { num: byType('Dominio'), label: 'Dominios', icon: ICONS.globe, color: 'blue' },
      { num: byType('Hosting'), label: 'Hostings', icon: ICONS.tools, color: 'purple' },
      { num: byType('CMS'), label: 'CMS', icon: ICONS.documents, color: 'orange' },
      { num: byType('API') + byType('Externa'), label: 'APIs / externas', icon: ICONS.link, color: 'green' }
    ])}

    <div id="ac-body"></div>`;

  const body = root.querySelector('#ac-body');
  body.innerHTML = access.length ? dataTable({
    columns: [
      { label: 'Cliente', render: a => `<span class="cell-strong">${esc(a.client)}</span>` },
      { label: 'Tipo', render: a => `<span class="pill">${esc(a.type)}</span>` },
      { label: 'Sistema', render: a => esc(a.system) },
      { label: 'Referencia', render: a => `<span class="cell-mono cell-muted">${esc(a.ref)}</span>` },
      { label: 'Gestor', render: a => a.vault && a.vault !== '—' ? `<span class="pill" style="color:var(--green)">${ICONS.access} ${esc(a.vault)}</span>` : '<span class="cell-muted">—</span>' },
      { label: 'Estado', render: a => statusBadge(a.status) }
    ],
    rows: access
  }) : emptyState({ icon: '🔐', title: 'Sin accesos registrados', text: 'Registra los accesos de cada cliente de forma segura.' });

  root.querySelector('#ac-new').addEventListener('click', () => toast('Integración con gestor seguro próximamente'));
}
