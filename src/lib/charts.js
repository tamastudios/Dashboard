/* ============================================================
   charts.js — mini gráficas en SVG, sin dependencias.
   Heredan el color con currentColor / variables CSS.
   ============================================================ */
import { esc } from './ui.js';

/**
 * Gráfico de barras vertical.
 * data: [{ label, value, color }]
 */
export function barChart(data, { height = 140, max = null } = {}) {
  const top = max ?? Math.max(1, ...data.map(d => d.value));
  const barW = 100 / (data.length * 2 - 1 || 1);
  let bars = '';
  data.forEach((d, i) => {
    const h = (d.value / top) * 100;
    const x = i * barW * 2;
    bars += `
      <rect x="${x}%" y="${100 - h}%" width="${barW}%" height="${h}%" rx="2"
        fill="${d.color || 'var(--primary)'}"><title>${esc(d.label)}: ${d.value}</title></rect>`;
  });
  const labels = data.map((d, i) =>
    `<div style="flex:1;text-align:center">${esc(d.label)}</div>`).join('');
  return `
    <div class="chart-bars">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:${height}px">${bars}</svg>
      <div class="chart-xlabels">${labels}</div>
    </div>`;
}

/**
 * Donut chart. data: [{ label, value, color }]
 * Devuelve el SVG + una leyenda.
 */
export function donutChart(data, { size = 150, thickness = 22, centerLabel = 'tareas', emptyText = 'Sin tareas todavía' } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  let arcs = '';
  if (total === 0) {
    arcs = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${thickness}"/>`;
  } else {
    for (const d of data) {
      if (d.value === 0) continue;
      const frac = d.value / total;
      const len = frac * circ;
      arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${d.color}" stroke-width="${thickness}"
        stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${cx} ${cy})"><title>${esc(d.label)}: ${d.value}</title></circle>`;
      offset += len;
    }
  }

  const legend = data.filter(d => d.value > 0).map(d =>
    `<div class="legend-item"><span class="legend-dot" style="background:${d.color}"></span>${esc(d.label)} <b>${d.value}</b></div>`
  ).join('') || `<div class="chart-empty">${esc(emptyText)}</div>`;

  return `
    <div class="chart-donut-wrap">
      <div class="chart-donut">
        <svg viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px;max-width:100%">${arcs}</svg>
        <div class="donut-center"><div class="donut-total">${total}</div><div class="donut-lbl">${esc(centerLabel)}</div></div>
      </div>
      <div class="chart-legend">${legend}</div>
    </div>`;
}

/** Barras horizontales (carga por persona). data: [{ label, value, color }] */
export function hbarChart(data, { max = null } = {}) {
  const top = max ?? Math.max(1, ...data.map(d => d.value));
  return `<div class="chart-hbars">` + data.map(d => `
    <div class="hbar-row">
      <div class="hbar-label">${esc(d.label)}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(d.value / top) * 100}%;background:${d.color || 'var(--primary)'}"></div></div>
      <div class="hbar-value">${d.value}</div>
    </div>`).join('') + `</div>`;
}
