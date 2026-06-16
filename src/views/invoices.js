/* ============================================================
   invoices.js — Facturas (autónomos)
   · Resumen financiero del periodo (base, IVA, IRPF, cobrado…)
   · Listado de facturas con estado de cobro
   · Crear / editar facturas con líneas y totales en vivo
   · Descargar en PDF (impresión nativa del navegador)
   · Datos del emisor (se guardan en este dispositivo)
   ============================================================ */
import {
  esc, el, openModal, toast, confirmDialog, debounce, fmtDate, fmtEUR,
  todayISO, chip, ICONS, INVOICE_STATUSES, invoiceStatusMeta
} from '../lib/ui.js';
import {
  state, isStaff, companyById,
  createInvoice, updateInvoice, deleteInvoice, nextInvoiceNumber
} from '../lib/store.js';

let filters = { q: '', status: 'all', period: 'year' };

/* ---------- datos del emisor (este dispositivo) ---------- */
const ISSUER_KEY = 'tama_invoice_issuer';
const ISSUER_DEFAULT = { name: 'TAMA Studios', tax_id: '', address: '', email: '', phone: '', iban: '' };
function getIssuer() {
  try { return { ...ISSUER_DEFAULT, ...JSON.parse(localStorage.getItem(ISSUER_KEY) || '{}') }; }
  catch { return { ...ISSUER_DEFAULT }; }
}
function setIssuer(o) { localStorage.setItem(ISSUER_KEY, JSON.stringify(o)); }

/* ---------- cálculo de totales ---------- */
const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
function computeTotals(items, vatRate, irpfRate) {
  const subtotal = round2((items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0));
  const vat_amount = round2(subtotal * (Number(vatRate) || 0) / 100);
  const irpf_amount = round2(subtotal * (Number(irpfRate) || 0) / 100);
  const total = round2(subtotal + vat_amount - irpf_amount);
  return { subtotal, vat_amount, irpf_amount, total };
}

/* ---------- rango del periodo seleccionado ---------- */
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periodRange(period) {
  const now = new Date();
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return [isoOf(new Date(now.getFullYear(), q * 3, 1)), isoOf(new Date(now.getFullYear(), q * 3 + 3, 1))];
  }
  if (period === 'year') {
    return [`${now.getFullYear()}-01-01`, `${now.getFullYear() + 1}-01-01`];
  }
  return ['0000-01-01', '9999-01-01']; // todo
}
function periodLabel(period) {
  const now = new Date();
  if (period === 'quarter') return `${Math.floor(now.getMonth() / 3) + 1}.º trimestre ${now.getFullYear()}`;
  if (period === 'year') return `Año ${now.getFullYear()}`;
  return 'Histórico completo';
}

/* ============================================================
   VISTA
   ============================================================ */
export function renderInvoices(root) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Facturas</h1>
        <div class="sub">Facturación y control de cobros · ${esc(periodLabel(filters.period))}</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="inv-issuer">${ICONS.settings} Datos de emisor</button>
        ${isStaff() ? `<button class="btn btn-primary" id="inv-new">${ICONS.plus} Nueva factura</button>` : ''}
      </div>
    </div>

    <div id="inv-summary"></div>

    <div class="filters">
      <input type="search" id="f-q" placeholder="Buscar nº o cliente…" value="${esc(filters.q)}" />
      <select id="f-period">
        <option value="quarter"${filters.period === 'quarter' ? ' selected' : ''}>Trimestre actual</option>
        <option value="year"${filters.period === 'year' ? ' selected' : ''}>Año actual</option>
        <option value="all"${filters.period === 'all' ? ' selected' : ''}>Todo</option>
      </select>
      <select id="f-status">
        <option value="all">Todos los estados</option>
        ${INVOICE_STATUSES.map(s => `<option value="${s.id}"${filters.status === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}
      </select>
    </div>

    <div id="inv-body"></div>`;

  root.querySelector('#inv-issuer').addEventListener('click', issuerModal);
  root.querySelector('#inv-new')?.addEventListener('click', () => invoiceModal());
  root.querySelector('#f-q').addEventListener('input', debounce(e => { filters.q = e.target.value; paint(root); }, 200));
  root.querySelector('#f-period').addEventListener('change', e => {
    filters.period = e.target.value;
    root.querySelector('.page-head .sub').textContent = `Facturación y control de cobros · ${periodLabel(filters.period)}`;
    paint(root);
  });
  root.querySelector('#f-status').addEventListener('change', e => { filters.status = e.target.value; paint(root); });
  paint(root);
}

function paint(root) {
  const [start, end] = periodRange(filters.period);
  const inPeriod = state.invoices.filter(i => (i.issue_date || '') >= start && (i.issue_date || '') < end);

  /* ----- resumen financiero (excluye borradores) ----- */
  const fin = inPeriod.filter(i => i.status !== 'borrador');
  const sum = (arr, k) => round2(arr.reduce((s, i) => s + (Number(i[k]) || 0), 0));
  const base = sum(fin, 'subtotal');
  const iva = sum(fin, 'vat_amount');
  const irpf = sum(fin, 'irpf_amount');
  const totalFact = sum(fin, 'total');
  const cobrado = sum(fin.filter(i => i.status === 'pagada'), 'total');
  const pendiente = sum(fin.filter(i => i.status === 'pendiente' || i.status === 'vencida'), 'total');

  const summary = root.querySelector('#inv-summary');
  const card = (num, lbl, icon, color, hint = '') => `
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--${color}-soft);color:var(--${color})">${icon}</div>
      <div class="num">${esc(num)}</div>
      <div class="lbl">${esc(lbl)}</div>
      ${hint ? `<div class="lbl" style="color:var(--muted);font-size:.72rem;margin-top:2px">${esc(hint)}</div>` : ''}
    </div>`;
  summary.innerHTML = `
    <div class="stats-grid">
      ${card(fmtEUR(base), 'Base imponible', ICONS.euro, 'blue')}
      ${card(fmtEUR(iva), 'IVA repercutido', ICONS.invoices, 'orange', 'A ingresar (modelo 303)')}
      ${card(fmtEUR(irpf), 'IRPF retenido', ICONS.activity, 'purple', 'Lo adelantan tus clientes')}
      ${card(fmtEUR(cobrado), 'Cobrado', ICONS.check, 'green')}
      ${card(fmtEUR(pendiente), 'Pendiente de cobro', ICONS.clock, 'red')}
      ${card(fmtEUR(totalFact), 'Total facturado', ICONS.dashboard, 'gray')}
    </div>
    <div class="card" style="margin:0 0 18px;display:flex;gap:10px;align-items:flex-start;font-size:.86rem;color:var(--muted)">
      <span style="flex:none;color:var(--orange)">${ICONS.alert}</span>
      <span>El <strong>IVA repercutido</strong> es lo que deberás liquidar con Hacienda cada trimestre (modelo 303), menos el IVA de tus gastos deducibles —que aún no registramos aquí—. El <strong>IRPF retenido</strong> ya te lo adelantan tus clientes y se descuenta en tu declaración.</span>
    </div>`;

  /* ----- listado ----- */
  let list = [...inPeriod];
  if (filters.status !== 'all') list = list.filter(i => i.status === filters.status);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(i =>
      (i.number || '').toLowerCase().includes(q) ||
      (i.client_name || '').toLowerCase().includes(q));
  }
  list.sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || '') || (b.number || '').localeCompare(a.number || ''));

  const body = root.querySelector('#inv-body');
  if (!list.length) {
    body.innerHTML = state.invoices.length
      ? `<div class="empty"><div class="ico">🔍</div><h3>Sin resultados</h3><p>Ninguna factura coincide con los filtros.</p></div>`
      : `<div class="empty"><div class="ico">🧾</div><h3>Aún no hay facturas</h3><p>Crea tu primera factura para empezar a llevar el control de cobros.</p>${isStaff() ? `<button class="btn btn-primary" id="empty-new">${ICONS.plus} Nueva factura</button>` : ''}<p style="margin-top:12px;font-size:.78rem;color:var(--muted)">Si es la primera vez, ejecuta <code>supabase/invoices.sql</code> en Supabase.</p></div>`;
    body.querySelector('#empty-new')?.addEventListener('click', () => invoiceModal());
    return;
  }

  body.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Nº</th><th>Cliente</th><th>Emisión</th><th>Vencimiento</th>
        <th style="text-align:right">Total</th><th>Estado</th><th></th>
      </tr></thead>
      <tbody>
        ${list.map(i => {
          const overdue = i.status === 'pendiente' && i.due_date && i.due_date < todayISO();
          return `<tr data-id="${esc(i.id)}">
            <td style="font-weight:600;white-space:nowrap">${esc(i.number)}</td>
            <td>
              <div>${esc(i.client_name)}</div>
              ${i.client_tax_id ? `<div style="font-size:.78rem;color:var(--muted)">${esc(i.client_tax_id)}</div>` : ''}
            </td>
            <td style="color:var(--muted);font-size:.85rem;white-space:nowrap">${fmtDate(i.issue_date)}</td>
            <td style="font-size:.85rem;white-space:nowrap;color:${overdue ? 'var(--red)' : 'var(--muted)'}">${i.due_date ? fmtDate(i.due_date) : '—'}${overdue ? ' ⚠' : ''}</td>
            <td style="text-align:right;font-weight:600;white-space:nowrap">${fmtEUR(i.total)}</td>
            <td>
              ${isStaff()
                ? `<select class="inv-status mini-select" data-id="${esc(i.id)}">
                     ${INVOICE_STATUSES.map(s => `<option value="${s.id}"${i.status === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}
                   </select>`
                : chip(invoiceStatusMeta(i.status))}
            </td>
            <td><div class="row-actions">
              <button class="icon-btn pdf" title="Descargar PDF">${ICONS.download}</button>
              ${isStaff() ? `<button class="icon-btn edit" title="Editar">${ICONS.edit}</button>
              <button class="icon-btn del" title="Eliminar" style="color:var(--red)">${ICONS.trash}</button>` : ''}
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;

  body.querySelectorAll('tbody tr').forEach(tr => {
    const inv = state.invoices.find(x => x.id === tr.dataset.id);
    if (!inv) return;
    tr.querySelector('.pdf').addEventListener('click', e => { e.stopPropagation(); invoicePDF(inv); });
    if (!isStaff()) return;
    tr.querySelector('.edit').addEventListener('click', e => { e.stopPropagation(); invoiceModal(inv); });
    tr.querySelector('.del').addEventListener('click', async e => {
      e.stopPropagation();
      if (await confirmDialog(`Se eliminará la factura "${inv.number}".`)) {
        try { await deleteInvoice(inv.id); toast('Factura eliminada'); }
        catch { toast('No se pudo eliminar', 'err'); }
      }
    });
    tr.querySelector('.inv-status').addEventListener('change', async e => {
      e.stopPropagation();
      const status = e.target.value;
      const fields = { status };
      if (status === 'pagada') fields.paid_date = inv.paid_date || todayISO();
      else fields.paid_date = null;
      try { await updateInvoice(inv.id, fields); toast('Estado actualizado'); }
      catch { toast('No se pudo actualizar', 'err'); paint(root); }
    });
    tr.querySelector('.inv-status').addEventListener('click', e => e.stopPropagation());
  });
}

/* ============================================================
   MODAL: crear / editar factura
   ============================================================ */
const VAT_RATES = [21, 10, 4, 0];
const IRPF_RATES = [0, 7, 15];

export function invoiceModal(invoice = null) {
  const isEdit = !!invoice;
  const inv = invoice || {};
  let items = Array.isArray(inv.items) && inv.items.length
    ? inv.items.map(it => ({ concept: it.concept || '', qty: it.qty ?? 1, price: it.price ?? 0 }))
    : [{ concept: '', qty: 1, price: 0 }];

  const companyOpt = `<option value="">— Cliente manual —</option>` +
    state.companies.map(c => `<option value="${c.id}"${inv.company_id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

  const body = el('form', { id: 'invoice-form', novalidate: '' });
  body.innerHTML = `
    <div class="form-grid">
      <div class="fld">
        <label>Nº de factura *</label>
        <input name="number" value="${esc(inv.number || nextInvoiceNumber())}" required />
        <span class="err">El número es obligatorio.</span>
      </div>
      <div class="fld"><label>Estado</label><select name="status">
        ${INVOICE_STATUSES.map(s => `<option value="${s.id}"${(inv.status || 'pendiente') === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}
      </select></div>
      <div class="fld"><label>Fecha de emisión</label><input type="date" name="issue_date" value="${esc(inv.issue_date || todayISO())}" /></div>
      <div class="fld"><label>Vencimiento</label><input type="date" name="due_date" value="${esc(inv.due_date || '')}" /></div>
    </div>

    <div class="fld"><label>Cliente</label><select name="company_id" id="inv-company">${companyOpt}</select></div>
    <div class="form-grid">
      <div class="fld">
        <label>Nombre / razón social *</label>
        <input name="client_name" id="inv-client-name" value="${esc(inv.client_name || '')}" required />
        <span class="err">El cliente es obligatorio.</span>
      </div>
      <div class="fld"><label>NIF / CIF</label><input name="client_tax_id" value="${esc(inv.client_tax_id || '')}" /></div>
      <div class="fld"><label>Email</label><input type="email" name="client_email" id="inv-client-email" value="${esc(inv.client_email || '')}" /></div>
      <div class="fld"><label>Dirección</label><input name="client_address" value="${esc(inv.client_address || '')}" /></div>
    </div>

    <label style="font-weight:600;font-size:.82rem;display:block;margin:6px 0 8px">Conceptos</label>
    <div id="inv-items"></div>
    <button type="button" class="btn btn-ghost btn-sm" id="inv-add-item" style="margin-top:6px">${ICONS.plus} Añadir línea</button>

    <div class="form-grid" style="margin-top:14px">
      <div class="fld"><label>IVA</label><select name="vat_rate">
        ${VAT_RATES.map(r => `<option value="${r}"${Number(inv.vat_rate ?? 21) === r ? ' selected' : ''}>${r}%</option>`).join('')}
      </select></div>
      <div class="fld"><label>Retención IRPF</label><select name="irpf_rate">
        ${IRPF_RATES.map(r => `<option value="${r}"${Number(inv.irpf_rate ?? 0) === r ? ' selected' : ''}>${r}%</option>`).join('')}
      </select></div>
    </div>

    <div class="fld"><label>Notas (forma de pago, IBAN, observaciones…)</label><textarea name="notes">${esc(inv.notes || '')}</textarea></div>

    <div id="inv-totals" class="inv-totals"></div>
  `;

  const foot = el('div', { style: 'display:flex;gap:10px' });
  const cancel = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  const save = el('button', { class: 'btn btn-primary', type: 'submit', form: 'invoice-form' },
    isEdit ? 'Guardar cambios' : 'Crear factura');
  foot.append(cancel, save);

  const m = openModal({ title: isEdit ? `Editar factura ${esc(inv.number || '')}` : 'Nueva factura', body, footer: foot, wide: true });
  cancel.addEventListener('click', m.close);

  const itemsBox = body.querySelector('#inv-items');
  const totalsBox = body.querySelector('#inv-totals');

  function renderItems() {
    itemsBox.innerHTML = items.map((it, idx) => `
      <div class="inv-item-row" data-idx="${idx}">
        <input class="it-concept" placeholder="Concepto / descripción" value="${esc(it.concept)}" />
        <input class="it-qty" type="number" min="0" step="0.01" value="${esc(it.qty)}" title="Cantidad" />
        <input class="it-price" type="number" min="0" step="0.01" value="${esc(it.price)}" title="Precio unidad (€)" />
        <span class="it-sub">${fmtEUR((Number(it.qty) || 0) * (Number(it.price) || 0))}</span>
        <button type="button" class="icon-btn it-del" title="Quitar" ${items.length === 1 ? 'disabled' : ''}>${ICONS.trash}</button>
      </div>`).join('');
    itemsBox.querySelectorAll('.inv-item-row').forEach(row => {
      const i = Number(row.dataset.idx);
      row.querySelector('.it-concept').addEventListener('input', e => { items[i].concept = e.target.value; });
      row.querySelector('.it-qty').addEventListener('input', e => { items[i].qty = e.target.value; row.querySelector('.it-sub').textContent = fmtEUR((Number(items[i].qty) || 0) * (Number(items[i].price) || 0)); renderTotals(); });
      row.querySelector('.it-price').addEventListener('input', e => { items[i].price = e.target.value; row.querySelector('.it-sub').textContent = fmtEUR((Number(items[i].qty) || 0) * (Number(items[i].price) || 0)); renderTotals(); });
      row.querySelector('.it-del').addEventListener('click', () => { items.splice(i, 1); renderItems(); renderTotals(); });
    });
  }
  function renderTotals() {
    const vat = Number(body.querySelector('[name=vat_rate]').value);
    const irpf = Number(body.querySelector('[name=irpf_rate]').value);
    const t = computeTotals(items, vat, irpf);
    totalsBox.innerHTML = `
      <div class="inv-tot-row"><span>Base imponible</span><span>${fmtEUR(t.subtotal)}</span></div>
      <div class="inv-tot-row"><span>IVA (${vat}%)</span><span>${fmtEUR(t.vat_amount)}</span></div>
      ${irpf ? `<div class="inv-tot-row"><span>Retención IRPF (${irpf}%)</span><span>−${fmtEUR(t.irpf_amount)}</span></div>` : ''}
      <div class="inv-tot-row total"><span>Total a cobrar</span><span>${fmtEUR(t.total)}</span></div>`;
  }

  renderItems();
  renderTotals();
  body.querySelector('#inv-add-item').addEventListener('click', () => { items.push({ concept: '', qty: 1, price: 0 }); renderItems(); renderTotals(); });
  body.querySelector('[name=vat_rate]').addEventListener('change', renderTotals);
  body.querySelector('[name=irpf_rate]').addEventListener('change', renderTotals);

  // al elegir empresa, rellena nombre/email si están vacíos
  body.querySelector('#inv-company').addEventListener('change', e => {
    const c = companyById(e.target.value);
    if (!c) return;
    const nameI = body.querySelector('#inv-client-name');
    const mailI = body.querySelector('#inv-client-email');
    if (!nameI.value.trim()) nameI.value = c.name || '';
    if (!mailI.value.trim() && c.email) mailI.value = c.email;
  });

  body.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(body);
    const number = fd.get('number').trim();
    const client_name = fd.get('client_name').trim();
    if (!number) { body.querySelectorAll('.fld')[0].classList.add('invalid'); return; }
    if (!client_name) { body.querySelector('#inv-client-name').closest('.fld').classList.add('invalid'); return; }

    const cleanItems = items
      .map(it => ({ concept: (it.concept || '').trim(), qty: Number(it.qty) || 0, price: Number(it.price) || 0 }))
      .filter(it => it.concept || it.qty || it.price);
    const vat_rate = Number(fd.get('vat_rate'));
    const irpf_rate = Number(fd.get('irpf_rate'));
    const totals = computeTotals(cleanItems, vat_rate, irpf_rate);
    const status = fd.get('status');

    const fields = {
      number,
      company_id: fd.get('company_id') || null,
      client_name,
      client_tax_id: fd.get('client_tax_id').trim() || null,
      client_address: fd.get('client_address').trim() || null,
      client_email: fd.get('client_email').trim() || null,
      issue_date: fd.get('issue_date') || todayISO(),
      due_date: fd.get('due_date') || null,
      items: cleanItems,
      vat_rate, irpf_rate,
      notes: fd.get('notes').trim() || null,
      status,
      paid_date: status === 'pagada' ? (inv.paid_date || todayISO()) : null,
      ...totals
    };

    save.disabled = true;
    try {
      if (isEdit) { await updateInvoice(inv.id, fields); toast('Factura actualizada'); }
      else { await createInvoice(fields); toast('Factura creada'); }
      m.close();
    } catch (err) {
      toast(err.message || 'Error al guardar', 'err');
      save.disabled = false;
    }
  });
}

/* ============================================================
   MODAL: datos del emisor (este dispositivo)
   ============================================================ */
function issuerModal() {
  const is = getIssuer();
  const body = el('form', { id: 'issuer-form' });
  body.innerHTML = `
    <p style="color:var(--muted);font-size:.84rem;margin-bottom:14px">Estos datos aparecen como emisor en tus facturas PDF. Se guardan en este navegador.</p>
    <div class="fld"><label>Nombre / razón social</label><input name="name" value="${esc(is.name)}" /></div>
    <div class="form-grid">
      <div class="fld"><label>NIF / DNI</label><input name="tax_id" value="${esc(is.tax_id)}" /></div>
      <div class="fld"><label>Email</label><input type="email" name="email" value="${esc(is.email)}" /></div>
      <div class="fld"><label>Teléfono</label><input name="phone" value="${esc(is.phone)}" /></div>
      <div class="fld"><label>IBAN</label><input name="iban" value="${esc(is.iban)}" placeholder="ES.." /></div>
    </div>
    <div class="fld"><label>Dirección</label><input name="address" value="${esc(is.address)}" /></div>
  `;
  const foot = el('div', { style: 'display:flex;gap:10px' });
  const cancel = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  const save = el('button', { class: 'btn btn-primary', type: 'submit', form: 'issuer-form' }, 'Guardar');
  foot.append(cancel, save);
  const m = openModal({ title: 'Datos de emisor', body, footer: foot });
  cancel.addEventListener('click', m.close);
  body.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(body);
    setIssuer({
      name: fd.get('name').trim(), tax_id: fd.get('tax_id').trim(), email: fd.get('email').trim(),
      phone: fd.get('phone').trim(), iban: fd.get('iban').trim(), address: fd.get('address').trim()
    });
    toast('Datos de emisor guardados');
    m.close();
  });
}

/* ============================================================
   PDF — se genera HTML imprimible y se usa la impresión nativa
   (el usuario elige "Guardar como PDF")
   ============================================================ */
export function invoicePDF(inv) {
  const is = getIssuer();
  const items = Array.isArray(inv.items) ? inv.items : [];
  const meta = invoiceStatusMeta(inv.status);
  const row = (it) => `<tr>
    <td>${esc(it.concept || '')}</td>
    <td class="r">${esc(it.qty)}</td>
    <td class="r">${fmtEUR(it.price)}</td>
    <td class="r">${fmtEUR((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
  </tr>`;
  const line = (lbl, val, cls = '') => `<tr class="${cls}"><td>${esc(lbl)}</td><td class="r">${val}</td></tr>`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Factura ${esc(inv.number)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;margin:0;padding:40px;font-size:13px;line-height:1.5}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:30px;margin-bottom:34px}
  h1{font-size:26px;margin:0 0 4px;letter-spacing:-.02em}
  .muted{color:#64748b}
  .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
  .b-green{background:#dcfce7;color:#15803d}.b-orange{background:#ffedd5;color:#c2410c}
  .b-red{background:#fee2e2;color:#b91c1c}.b-gray{background:#f1f5f9;color:#475569}
  .parties{display:flex;justify-content:space-between;gap:30px;margin-bottom:28px}
  .party{font-size:12.5px}
  .party h3{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 6px}
  .party .nm{font-weight:700;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;border-bottom:2px solid #e2e8f0;padding:8px 10px}
  td{padding:9px 10px;border-bottom:1px solid #f1f5f9}
  .r{text-align:right;white-space:nowrap}
  .totals{width:300px;margin-left:auto}
  .totals td{border:none;padding:5px 10px}
  .totals .total td{border-top:2px solid #e2e8f0;font-weight:800;font-size:16px;padding-top:10px}
  .notes{margin-top:30px;font-size:12px;color:#475569;border-top:1px solid #e2e8f0;padding-top:14px;white-space:pre-wrap}
  .foot{margin-top:40px;font-size:10.5px;color:#94a3b8;text-align:center}
  @media print{body{padding:0}@page{margin:18mm}}
</style></head><body>
  <div class="top">
    <div>
      <div class="nm" style="font-weight:800;font-size:18px">${esc(is.name || '')}</div>
      ${is.tax_id ? `<div class="muted">${esc(is.tax_id)}</div>` : ''}
      ${is.address ? `<div class="muted">${esc(is.address)}</div>` : ''}
      ${is.email ? `<div class="muted">${esc(is.email)}</div>` : ''}
      ${is.phone ? `<div class="muted">${esc(is.phone)}</div>` : ''}
    </div>
    <div style="text-align:right">
      <h1>FACTURA</h1>
      <div class="muted">Nº <strong style="color:#1e293b">${esc(inv.number)}</strong></div>
      <div class="muted">Emisión: ${fmtDate(inv.issue_date)}</div>
      ${inv.due_date ? `<div class="muted">Vencimiento: ${fmtDate(inv.due_date)}</div>` : ''}
      <div style="margin-top:8px"><span class="badge b-${meta.color === 'orange' ? 'orange' : meta.color === 'green' ? 'green' : meta.color === 'red' ? 'red' : 'gray'}">${esc(meta.label)}</span></div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Facturar a</h3>
      <div class="nm">${esc(inv.client_name || '')}</div>
      ${inv.client_tax_id ? `<div class="muted">${esc(inv.client_tax_id)}</div>` : ''}
      ${inv.client_address ? `<div class="muted">${esc(inv.client_address)}</div>` : ''}
      ${inv.client_email ? `<div class="muted">${esc(inv.client_email)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead>
    <tbody>${items.map(row).join('') || '<tr><td colspan="4" class="muted">Sin conceptos</td></tr>'}</tbody>
  </table>

  <table class="totals">
    ${line('Base imponible', fmtEUR(inv.subtotal))}
    ${line(`IVA (${Number(inv.vat_rate)}%)`, fmtEUR(inv.vat_amount))}
    ${Number(inv.irpf_amount) ? line(`Retención IRPF (${Number(inv.irpf_rate)}%)`, '−' + fmtEUR(inv.irpf_amount)) : ''}
    ${line('TOTAL', fmtEUR(inv.total), 'total')}
  </table>

  ${inv.notes ? `<div class="notes">${esc(inv.notes)}</div>` : ''}
  ${is.iban ? `<div class="notes">Pago por transferencia · IBAN: ${esc(is.iban)}</div>` : ''}

  <div class="foot">Factura generada con el Dashboard de TAMA Studios</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { toast('Permite las ventanas emergentes para descargar el PDF', 'err'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // espera al render antes de abrir el diálogo de impresión / guardar como PDF
  setTimeout(() => { try { w.print(); } catch (e) {} }, 350);
}
