/* ============================================================
   quotes.js — Presupuestos (funcional, con PDF)
   ============================================================ */
import {
  esc, el, openModal, toast, confirmDialog, debounce, fmtDate, fmtEUR,
  todayISO, statusBadge, STATUS_META, ICONS
} from '../lib/ui.js';
import { getIssuer, setIssuer } from '../lib/issuer.js';
import {
  state, isStaff, companyById, createQuote, updateQuote, deleteQuote, nextQuoteNumber
} from '../lib/store.js';

const ST = ['borrador', 'enviado', 'aceptado', 'rechazado'];
const VAT_RATES = [21, 10, 4, 0];
let filters = { q: '', status: 'all' };

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
function computeTotals(items, vatRate) {
  const subtotal = round2((items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0));
  const vat_amount = round2(subtotal * (Number(vatRate) || 0) / 100);
  return { subtotal, vat_amount, total: round2(subtotal + vat_amount) };
}

export function renderQuotes(root) {
  const all = state.quotes;
  const sum = arr => arr.reduce((s, q) => s + (Number(q.total) || 0), 0);
  const live = all.filter(q => q.status === 'enviado' || q.status === 'borrador');
  const accepted = all.filter(q => q.status === 'aceptado');

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Presupuestos</h1><div class="sub">${all.length} presupuestos · ${fmtEUR(sum(all))} propuesto</div></div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="q-issuer">${ICONS.settings} Datos de emisor</button>
        ${isStaff() ? `<button class="btn btn-primary" id="q-new">${ICONS.plus} Nuevo presupuesto</button>` : ''}
      </div>
    </div>
    <div class="stats-grid">
      ${kpi(live.length, 'En proceso', ICONS.quotes, 'blue')}
      ${kpi(fmtEUR(sum(live)), 'Valor en proceso', ICONS.euro, 'orange')}
      ${kpi(accepted.length, 'Aceptados', ICONS.check, 'green')}
      ${kpi(fmtEUR(sum(accepted)), 'Valor aceptado', ICONS.dashboard, 'purple')}
    </div>
    <div class="filters">
      <input type="search" id="f-q" placeholder="Buscar nº o cliente…" value="${esc(filters.q)}">
      <select id="f-status"><option value="all">Todos los estados</option>${ST.map(s => `<option value="${s}"${filters.status === s ? ' selected' : ''}>${STATUS_META[s].label}</option>`).join('')}</select>
    </div>
    <div id="q-body"></div>`;

  root.querySelector('#q-issuer').addEventListener('click', issuerModal);
  root.querySelector('#q-new')?.addEventListener('click', () => quoteModal());
  root.querySelector('#f-q').addEventListener('input', debounce(e => { filters.q = e.target.value; paint(root); }, 180));
  root.querySelector('#f-status').addEventListener('change', e => { filters.status = e.target.value; paint(root); });
  paint(root);
}

const kpi = (num, label, icon, color) =>
  `<div class="card stat-card"><div class="stat-icon" style="background:var(--${color}-soft);color:var(--${color})">${icon}</div><div class="num">${esc(num)}</div><div class="lbl">${esc(label)}</div></div>`;

function paint(root) {
  const body = root.querySelector('#q-body');
  let list = [...state.quotes];
  if (filters.q) { const q = filters.q.toLowerCase(); list = list.filter(x => (x.number || '').toLowerCase().includes(q) || (x.client_name || '').toLowerCase().includes(q)); }
  if (filters.status !== 'all') list = list.filter(x => x.status === filters.status);
  list.sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || '') || (b.number || '').localeCompare(a.number || ''));

  if (!list.length) {
    body.innerHTML = state.quotes.length
      ? `<div class="empty"><div class="ico">🔍</div><h3>Sin resultados</h3><p>Ningún presupuesto coincide con los filtros.</p></div>`
      : `<div class="empty"><div class="ico">📝</div><h3>Aún no hay presupuestos</h3><p>Crea tu primer presupuesto: añade conceptos y precios y se calcula solo.</p>${isStaff() ? `<button class="btn btn-primary" id="empty-new">${ICONS.plus} Nuevo presupuesto</button>` : ''}<p style="margin-top:10px;font-size:.78rem;color:var(--muted)">Si es la primera vez, ejecuta <code>supabase/quotes.sql</code>.</p></div>`;
    body.querySelector('#empty-new')?.addEventListener('click', () => quoteModal());
    return;
  }

  body.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Nº</th><th>Cliente</th><th>Emisión</th><th>Vence</th><th style="text-align:right">Total</th><th>Estado</th><th></th></tr></thead>
    <tbody>${list.map(q => {
      const od = q.status === 'enviado' && q.expires_at && q.expires_at < todayISO();
      return `<tr data-id="${esc(q.id)}">
        <td class="cell-strong" style="white-space:nowrap">${esc(q.number)}</td>
        <td>${esc(q.client_name)}</td>
        <td class="cell-muted" style="white-space:nowrap">${fmtDate(q.issue_date)}</td>
        <td style="white-space:nowrap;color:${od ? 'var(--red)' : 'var(--muted)'}">${q.expires_at ? fmtDate(q.expires_at) : '—'}${od ? ' ⚠' : ''}</td>
        <td style="text-align:right;font-weight:600;white-space:nowrap">${fmtEUR(q.total)}</td>
        <td>${isStaff()
          ? `<select class="mini-select q-st" data-id="${esc(q.id)}">${ST.map(s => `<option value="${s}"${q.status === s ? ' selected' : ''}>${STATUS_META[s].label}</option>`).join('')}</select>`
          : statusBadge(q.status)}</td>
        <td><div class="row-actions">
          <button class="icon-btn pdf" title="Descargar PDF">${ICONS.download}</button>
          ${isStaff() ? `<button class="icon-btn edit" title="Editar">${ICONS.edit}</button><button class="icon-btn del" title="Eliminar" style="color:var(--red)">${ICONS.trash}</button>` : ''}
        </div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;

  body.querySelectorAll('tbody tr').forEach(tr => {
    const q = state.quotes.find(x => x.id === tr.dataset.id);
    if (!q) return;
    tr.querySelector('.pdf').addEventListener('click', e => { e.stopPropagation(); quotePDF(q); });
    if (!isStaff()) return;
    tr.querySelector('.q-st').addEventListener('click', e => e.stopPropagation());
    tr.querySelector('.q-st').addEventListener('change', async e => { try { await updateQuote(q.id, { status: e.target.value }); toast('Estado actualizado'); } catch { toast('No se pudo actualizar', 'err'); } });
    tr.querySelector('.edit').addEventListener('click', e => { e.stopPropagation(); quoteModal(q); });
    tr.querySelector('.del').addEventListener('click', async e => { e.stopPropagation(); if (await confirmDialog(`Se eliminará el presupuesto "${q.number}".`)) { try { await deleteQuote(q.id); toast('Presupuesto eliminado'); } catch { toast('No se pudo eliminar', 'err'); } } });
    tr.addEventListener('click', () => quoteModal(q));
  });
}

/* ---------- modal crear/editar ---------- */
function quoteModal(quote = null) {
  const isEdit = !!quote;
  const q = quote || {};
  let items = Array.isArray(q.items) && q.items.length ? q.items.map(it => ({ concept: it.concept || '', qty: it.qty ?? 1, price: it.price ?? 0 })) : [{ concept: '', qty: 1, price: 0 }];
  const companyOpt = `<option value="">— Cliente manual —</option>` + state.companies.map(c => `<option value="${c.id}"${q.company_id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

  const body = el('form', { id: 'quote-form', novalidate: '' });
  body.innerHTML = `
    <div class="form-grid">
      <div class="fld"><label>Nº *</label><input name="number" value="${esc(q.number || nextQuoteNumber())}" required><span class="err">El número es obligatorio.</span></div>
      <div class="fld"><label>Estado</label><select name="status">${ST.map(s => `<option value="${s}"${(q.status || 'borrador') === s ? ' selected' : ''}>${STATUS_META[s].label}</option>`).join('')}</select></div>
      <div class="fld"><label>Fecha</label><input type="date" name="issue_date" value="${esc(q.issue_date || todayISO())}"></div>
      <div class="fld"><label>Válido hasta</label><input type="date" name="expires_at" value="${esc(q.expires_at || '')}"></div>
    </div>
    <div class="fld"><label>Cliente</label><select name="company_id" id="q-company">${companyOpt}</select></div>
    <div class="form-grid">
      <div class="fld"><label>Nombre / razón social *</label><input name="client_name" id="q-client-name" value="${esc(q.client_name || '')}" required><span class="err">El cliente es obligatorio.</span></div>
      <div class="fld"><label>NIF / CIF</label><input name="client_tax_id" value="${esc(q.client_tax_id || '')}"></div>
      <div class="fld"><label>Email</label><input type="email" name="client_email" id="q-client-email" value="${esc(q.client_email || '')}"></div>
      <div class="fld"><label>Dirección</label><input name="client_address" value="${esc(q.client_address || '')}"></div>
    </div>
    <label style="font-weight:600;font-size:.82rem;display:block;margin:6px 0 8px">Conceptos</label>
    <div id="q-items"></div>
    <button type="button" class="btn btn-ghost btn-sm" id="q-add-item" style="margin-top:6px">${ICONS.plus} Añadir línea</button>
    <div class="form-grid" style="margin-top:14px">
      <div class="fld"><label>IVA</label><select name="vat_rate">${VAT_RATES.map(r => `<option value="${r}"${Number(q.vat_rate ?? 21) === r ? ' selected' : ''}>${r}%</option>`).join('')}</select></div>
    </div>
    <div class="fld"><label>Notas (condiciones, validez, forma de pago…)</label><textarea name="notes">${esc(q.notes || '')}</textarea></div>
    <div id="q-totals" class="inv-totals"></div>`;

  const foot = el('div', { style: 'display:flex;gap:10px' });
  const cancel = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  const save = el('button', { class: 'btn btn-primary', type: 'submit', form: 'quote-form' }, isEdit ? 'Guardar' : 'Crear presupuesto');
  foot.append(cancel, save);
  const m = openModal({ title: isEdit ? `Editar ${esc(q.number || '')}` : 'Nuevo presupuesto', body, footer: foot, wide: true });
  cancel.addEventListener('click', m.close);

  const itemsBox = body.querySelector('#q-items');
  const totalsBox = body.querySelector('#q-totals');
  function renderItems() {
    itemsBox.innerHTML = items.map((it, i) => `
      <div class="inv-item-row" data-idx="${i}">
        <input class="it-concept" placeholder="Concepto / servicio" value="${esc(it.concept)}">
        <input class="it-qty" type="number" min="0" step="0.5" value="${esc(it.qty)}" title="Cantidad">
        <input class="it-price" type="number" min="0" step="0.01" value="${esc(it.price)}" title="Precio (€)">
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
    const t = computeTotals(items, vat);
    totalsBox.innerHTML = `
      <div class="inv-tot-row"><span>Base imponible</span><span>${fmtEUR(t.subtotal)}</span></div>
      <div class="inv-tot-row"><span>IVA (${vat}%)</span><span>${fmtEUR(t.vat_amount)}</span></div>
      <div class="inv-tot-row total"><span>Total</span><span>${fmtEUR(t.total)}</span></div>`;
  }
  renderItems(); renderTotals();
  body.querySelector('#q-add-item').addEventListener('click', () => { items.push({ concept: '', qty: 1, price: 0 }); renderItems(); renderTotals(); });
  body.querySelector('[name=vat_rate]').addEventListener('change', renderTotals);
  body.querySelector('#q-company').addEventListener('change', e => {
    const c = companyById(e.target.value); if (!c) return;
    const n = body.querySelector('#q-client-name'), m2 = body.querySelector('#q-client-email');
    if (!n.value.trim()) n.value = c.name || ''; if (!m2.value.trim() && c.email) m2.value = c.email;
  });

  body.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(body);
    const number = fd.get('number').trim();
    const client_name = fd.get('client_name').trim();
    if (!number) { body.querySelectorAll('.fld')[0].classList.add('invalid'); return; }
    if (!client_name) { body.querySelector('#q-client-name').closest('.fld').classList.add('invalid'); return; }
    const cleanItems = items.map(it => ({ concept: (it.concept || '').trim(), qty: Number(it.qty) || 0, price: Number(it.price) || 0 })).filter(it => it.concept || it.qty || it.price);
    const vat_rate = Number(fd.get('vat_rate'));
    const fields = {
      number, company_id: fd.get('company_id') || null, client_name,
      client_tax_id: fd.get('client_tax_id').trim() || null, client_address: fd.get('client_address').trim() || null,
      client_email: fd.get('client_email').trim() || null, issue_date: fd.get('issue_date') || todayISO(),
      expires_at: fd.get('expires_at') || null, items: cleanItems, vat_rate,
      notes: fd.get('notes').trim() || null, status: fd.get('status'), ...computeTotals(cleanItems, vat_rate)
    };
    save.disabled = true;
    try { if (isEdit) { await updateQuote(q.id, fields); toast('Presupuesto actualizado'); } else { await createQuote(fields); toast('Presupuesto creado'); } m.close(); }
    catch (err) { toast(err.message || 'Error al guardar', 'err'); save.disabled = false; }
  });
}

/* ---------- datos de emisor ---------- */
function issuerModal() {
  const is = getIssuer();
  const body = el('form', { id: 'issuer-form' });
  body.innerHTML = `
    <p style="color:var(--muted);font-size:.84rem;margin-bottom:14px">Aparecen como emisor en tus presupuestos y facturas PDF. Se guardan en este navegador.</p>
    <div class="fld"><label>Nombre / razón social</label><input name="name" value="${esc(is.name)}"></div>
    <div class="form-grid">
      <div class="fld"><label>NIF / DNI</label><input name="tax_id" value="${esc(is.tax_id)}"></div>
      <div class="fld"><label>Email</label><input type="email" name="email" value="${esc(is.email)}"></div>
      <div class="fld"><label>Teléfono</label><input name="phone" value="${esc(is.phone)}"></div>
      <div class="fld"><label>IBAN</label><input name="iban" value="${esc(is.iban)}"></div>
    </div>
    <div class="fld"><label>Dirección</label><input name="address" value="${esc(is.address)}"></div>`;
  const foot = el('div', { style: 'display:flex;gap:10px' });
  const cancel = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  const save = el('button', { class: 'btn btn-primary', type: 'submit', form: 'issuer-form' }, 'Guardar');
  foot.append(cancel, save);
  const m = openModal({ title: 'Datos de emisor', body, footer: foot });
  cancel.addEventListener('click', m.close);
  body.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(body);
    setIssuer({ name: fd.get('name').trim(), tax_id: fd.get('tax_id').trim(), email: fd.get('email').trim(), phone: fd.get('phone').trim(), iban: fd.get('iban').trim(), address: fd.get('address').trim() });
    toast('Datos de emisor guardados'); m.close();
  });
}

/* ---------- PDF ---------- */
function quotePDF(q) {
  const is = getIssuer();
  const items = Array.isArray(q.items) ? q.items : [];
  const meta = STATUS_META[q.status] || { label: q.status, color: 'gray' };
  const row = (it) => `<tr><td>${esc(it.concept || '')}</td><td class="r">${esc(it.qty)}</td><td class="r">${fmtEUR(it.price)}</td><td class="r">${fmtEUR((Number(it.qty) || 0) * (Number(it.price) || 0))}</td></tr>`;
  const line = (l, v, cls = '') => `<tr class="${cls}"><td>${esc(l)}</td><td class="r">${v}</td></tr>`;
  const bc = meta.color === 'green' ? 'green' : meta.color === 'red' ? 'red' : meta.color === 'orange' ? 'orange' : 'gray';

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto ${esc(q.number)}</title>
<style>
  *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;margin:0;padding:40px;font-size:13px;line-height:1.5}
  .top{display:flex;justify-content:space-between;gap:30px;margin-bottom:34px}
  h1{font-size:26px;margin:0 0 4px}.muted{color:#64748b}
  .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase}
  .b-green{background:#dcfce7;color:#15803d}.b-orange{background:#ffedd5;color:#c2410c}.b-red{background:#fee2e2;color:#b91c1c}.b-gray{background:#f1f5f9;color:#475569}
  .party h3{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 6px}.party .nm{font-weight:700;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{text-align:left;font-size:10.5px;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0;padding:8px 10px}
  td{padding:9px 10px;border-bottom:1px solid #f1f5f9}.r{text-align:right;white-space:nowrap}
  .totals{width:300px;margin-left:auto}.totals td{border:none;padding:5px 10px}
  .totals .total td{border-top:2px solid #e2e8f0;font-weight:800;font-size:16px;padding-top:10px}
  .notes{margin-top:26px;font-size:12px;color:#475569;border-top:1px solid #e2e8f0;padding-top:14px;white-space:pre-wrap}
  .foot{margin-top:40px;font-size:10.5px;color:#94a3b8;text-align:center}
  @media print{body{padding:0}@page{margin:18mm}}
</style></head><body>
  <div class="top">
    <div>
      <div style="font-weight:800;font-size:18px">${esc(is.name || '')}</div>
      ${is.tax_id ? `<div class="muted">${esc(is.tax_id)}</div>` : ''}${is.address ? `<div class="muted">${esc(is.address)}</div>` : ''}
      ${is.email ? `<div class="muted">${esc(is.email)}</div>` : ''}${is.phone ? `<div class="muted">${esc(is.phone)}</div>` : ''}
    </div>
    <div style="text-align:right">
      <h1>PRESUPUESTO</h1>
      <div class="muted">Nº <strong style="color:#1e293b">${esc(q.number)}</strong></div>
      <div class="muted">Fecha: ${fmtDate(q.issue_date)}</div>
      ${q.expires_at ? `<div class="muted">Válido hasta: ${fmtDate(q.expires_at)}</div>` : ''}
      <div style="margin-top:8px"><span class="badge b-${bc}">${esc(meta.label)}</span></div>
    </div>
  </div>
  <div class="party" style="margin-bottom:26px">
    <h3>Para</h3>
    <div class="nm">${esc(q.client_name || '')}</div>
    ${q.client_tax_id ? `<div class="muted">${esc(q.client_tax_id)}</div>` : ''}${q.client_address ? `<div class="muted">${esc(q.client_address)}</div>` : ''}${q.client_email ? `<div class="muted">${esc(q.client_email)}</div>` : ''}
  </div>
  <table><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead>
    <tbody>${items.map(row).join('') || '<tr><td colspan="4" class="muted">Sin conceptos</td></tr>'}</tbody></table>
  <table class="totals">
    ${line('Base imponible', fmtEUR(q.subtotal))}
    ${line(`IVA (${Number(q.vat_rate)}%)`, fmtEUR(q.vat_amount))}
    ${line('TOTAL', fmtEUR(q.total), 'total')}
  </table>
  ${q.notes ? `<div class="notes">${esc(q.notes)}</div>` : ''}
  <div class="foot">Presupuesto generado con el Dashboard de TAMA Studios</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { toast('Permite las ventanas emergentes para descargar el PDF', 'err'); return; }
  w.document.open(); w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch (e) {} }, 350);
}
