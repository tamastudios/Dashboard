/* ============================================================
   prospector.js — Buscador de clientes potenciales
   Usa Google Places API (New) para encontrar negocios locales
   en Sabadell / Terrassa / Barcelona y zona.
   ============================================================ */
import { esc, toast, debounce, safeUrl, openModal, confirmDialog, ICONS } from '../lib/ui.js';
import { state, loadProspects, saveProspect, updateProspect, deleteProspect,
         prospectByPlaceId, createCompany } from '../lib/store.js';

/* ---------- datos de zonas ---------- */
const ZONES = [
  { id: 'Sabadell',            lat: 41.5432, lng: 2.1093 },
  { id: 'Terrassa',            lat: 41.5630, lng: 2.0089 },
  { id: 'Cerdanyola del Vallès',lat: 41.4937, lng: 2.1418 },
  { id: 'Barberà del Vallès',  lat: 41.5189, lng: 2.1264 },
  { id: 'Ripollet',            lat: 41.5089, lng: 2.1582 },
  { id: 'Rubí',                lat: 41.4934, lng: 2.0322 },
  { id: 'Sant Cugat del Vallès',lat: 41.4721, lng: 2.0868 },
  { id: 'Montcada i Reixac',   lat: 41.4829, lng: 2.1843 },
  { id: 'Badalona',            lat: 41.4500, lng: 2.2471 },
  { id: 'Hospitalet de Llobregat', lat: 41.3619, lng: 2.0998 },
  { id: 'Barcelona',           lat: 41.3851, lng: 2.1734 },
];

/* ---------- categorías de negocio ---------- */
const CATEGORIES = [
  { value: 'restaurant',           label: 'Restaurantes' },
  { value: 'bar',                  label: 'Bares y cafeterías' },
  { value: 'hair_care',            label: 'Peluquerías' },
  { value: 'beauty_salon',         label: 'Salones de belleza' },
  { value: 'gym',                  label: 'Gimnasios' },
  { value: 'dental_clinic',        label: 'Clínicas dentales' },
  { value: 'veterinary_care',      label: 'Veterinarias' },
  { value: 'physiotherapist',      label: 'Fisioterapeutas' },
  { value: 'lawyer',               label: 'Abogados' },
  { value: 'real_estate_agency',   label: 'Inmobiliarias' },
  { value: 'car_repair',           label: 'Talleres de coches' },
  { value: 'plumber',              label: 'Fontaneros' },
  { value: 'electrician',          label: 'Electricistas' },
  { value: 'florist',              label: 'Floristerías' },
  { value: 'optician',             label: 'Ópticas' },
  { value: 'clothing_store',       label: 'Tiendas de ropa' },
  { value: 'bakery',               label: 'Panaderías' },
  { value: 'accounting',           label: 'Contabilidad / Gestorías' },
  { value: 'insurance_agency',     label: 'Seguros' },
  { value: 'travel_agency',        label: 'Agencias de viaje' },
  { value: 'home_goods_store',     label: 'Tiendas de decoración' },
  { value: 'furniture_store',      label: 'Muebles' },
  { value: 'photography_studio',   label: 'Fotógrafos / Estudios' },
  { value: 'spa',                  label: 'Spas y centros wellness' },
  { value: 'nail_salon',           label: 'Centros de uñas' },
  { value: 'laundry',              label: 'Lavanderías' },
  { value: 'locksmith',            label: 'Cerrajeros' },
];

const TYPE_LABELS = {
  restaurant: 'Restaurante', bar: 'Bar', hair_care: 'Peluquería',
  beauty_salon: 'Salón de belleza', gym: 'Gimnasio', dental_clinic: 'Clínica dental',
  veterinary_care: 'Veterinaria', physiotherapist: 'Fisioterapeuta', lawyer: 'Abogado',
  real_estate_agency: 'Inmobiliaria', car_repair: 'Taller', plumber: 'Fontanero',
  electrician: 'Electricista', florist: 'Floristería', optician: 'Óptica',
  clothing_store: 'Tienda de ropa', bakery: 'Panadería', accounting: 'Contabilidad',
  insurance_agency: 'Seguros', travel_agency: 'Agencia de viajes',
  home_goods_store: 'Decoración', furniture_store: 'Muebles',
  photography_studio: 'Fotografía', spa: 'Spa', nail_salon: 'Uñas', laundry: 'Lavandería',
  locksmith: 'Cerrajero', food: 'Comida', store: 'Tienda', health: 'Salud',
  establishment: 'Negocio', point_of_interest: 'Punto de interés',
};

/* ---------- dominios considerados "web pobre" (redes sociales) ---------- */
const SOCIAL_DOMAINS = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'linktr.ee', 'bio.link', 'taplink.cc', 'beacons.ai', 'linkinbio'];
const isSocialWeb = url => !!url && SOCIAL_DOMAINS.some(d => url.toLowerCase().includes(d));

/* ---------- estado local del módulo ---------- */
let tab = 'buscar';  // 'buscar' | 'guardados' | 'vetados'
let searchState = {
  query: '',
  zone: 'Sabadell',
  radius: 3000,
  category: '',
  maxResults: 20,
  // filtros de presencia digital
  noWebsite: false,
  socialWebOnly: false,
  hasRealWeb: false,
  // filtros de valoración
  lowRating: false,
  highRating: false,
  // filtros de reseñas
  fewReviews: false,
  manyReviews: false,
  // otros
  noPhone: false,
  results: [],
  loading: false,
  searched: false,
};
let savedFilter = { q: '', sort: 'recent' };

/* ============================================================
   ENTRY POINT
   ============================================================ */
export async function renderProspector(root) {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Prospector</h1>
        <div class="sub">Encuentra clientes potenciales en tu zona</div>
      </div>
    </div>

    <div class="prosp-tabs">
      <button class="prosp-tab ${tab === 'buscar' ? 'active' : ''}" data-tab="buscar">
        ${ICONS.search} Buscar
      </button>
      <button class="prosp-tab ${tab === 'guardados' ? 'active' : ''}" data-tab="guardados">
        ${ICONS.bookmark} Guardados
        <span class="prosp-tab-badge" id="badge-saved"></span>
      </button>
      <button class="prosp-tab ${tab === 'vetados' ? 'active' : ''}" data-tab="vetados">
        ${ICONS.ban} Vetados
        <span class="prosp-tab-badge red" id="badge-vetoed"></span>
      </button>
    </div>

    <div id="prosp-body"></div>`;

  root.querySelectorAll('.prosp-tab[data-tab]').forEach(btn =>
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab;
      root.querySelectorAll('.prosp-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      renderTab(root, apiKey);
    }));

  // cargar prospectos una sola vez (sin emit para evitar bucle de re-render)
  if (!state.prospectsLoaded) {
    try { await loadProspects(); } catch { /* tolera si tabla no existe aún */ }
  }

  updateBadges(root);
  renderTab(root, apiKey);
}

function updateBadges(root) {
  const saved  = state.prospects.filter(p => p.status === 'saved').length;
  const vetoed = state.prospects.filter(p => p.status === 'vetoed').length;
  const bs = root.querySelector('#badge-saved');
  const bv = root.querySelector('#badge-vetoed');
  if (bs) { bs.textContent = saved  || ''; bs.hidden = !saved; }
  if (bv) { bv.textContent = vetoed || ''; bv.hidden = !vetoed; }
}

function renderTab(root, apiKey) {
  const body = root.querySelector('#prosp-body');
  if (tab === 'buscar')    renderSearchTab(body, apiKey);
  else if (tab === 'guardados') renderSavedTab(body, root);
  else                     renderVetoedTab(body, root);
}

/* ============================================================
   TAB: BUSCAR
   ============================================================ */
function renderSearchTab(body, apiKey) {
  if (!apiKey) {
    body.innerHTML = `
      <div class="prosp-setup">
        <div class="prosp-setup-ico">${ICONS.prospector}</div>
        <h3>Configura tu clave de Google Places</h3>
        <p>Para buscar negocios necesitas una clave de la <strong>Google Places API (New)</strong>.</p>
        <ol class="prosp-setup-steps">
          <li>Abre <strong>Google Cloud Console</strong> → APIs y servicios → Credenciales</li>
          <li>Crea o copia una clave de API</li>
          <li>Activa la API <strong>Places API (New)</strong></li>
          <li>Restringe la clave a tu dominio para mayor seguridad</li>
          <li>Añade <code>VITE_GOOGLE_PLACES_API_KEY=tu-clave</code> a tu archivo <code>.env</code></li>
          <li>Reinicia el servidor de desarrollo</li>
        </ol>
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="prosp-layout">
      <div class="prosp-sidebar">
        <div class="prosp-form">
          <label class="prosp-label">Tipo de negocio</label>
          <input type="text" id="ps-query" class="prosp-input" placeholder="peluquería, restaurante, taller…"
            value="${esc(searchState.query)}" />

          <label class="prosp-label">Categoría</label>
          <select id="ps-category" class="prosp-select">
            <option value="">Todas las categorías</option>
            ${CATEGORIES.map(c => `<option value="${c.value}"${searchState.category === c.value ? ' selected' : ''}>${c.label}</option>`).join('')}
          </select>

          <label class="prosp-label">Zona</label>
          <select id="ps-zone" class="prosp-select">
            ${ZONES.map(z => `<option value="${z.id}"${searchState.zone === z.id ? ' selected' : ''}>${z.id}</option>`).join('')}
          </select>

          <div class="prosp-row">
            <div style="flex:1">
              <label class="prosp-label">Radio</label>
              <select id="ps-radius" class="prosp-select">
                <option value="1000"${searchState.radius === 1000 ? ' selected' : ''}>1 km</option>
                <option value="2000"${searchState.radius === 2000 ? ' selected' : ''}>2 km</option>
                <option value="3000"${searchState.radius === 3000 ? ' selected' : ''}>3 km</option>
                <option value="5000"${searchState.radius === 5000 ? ' selected' : ''}>5 km</option>
                <option value="10000"${searchState.radius === 10000 ? ' selected' : ''}>10 km</option>
              </select>
            </div>
            <div style="flex:1">
              <label class="prosp-label">Resultados</label>
              <select id="ps-max" class="prosp-select">
                <option value="10"${searchState.maxResults === 10 ? ' selected' : ''}>10</option>
                <option value="20"${searchState.maxResults === 20 ? ' selected' : ''}>20</option>
                <option value="30"${searchState.maxResults === 30 ? ' selected' : ''}>30</option>
                <option value="50"${searchState.maxResults === 50 ? ' selected' : ''}>50</option>
              </select>
            </div>
          </div>

          <div class="prosp-filter-group">
            <div class="prosp-filter-title">${ICONS.globe} Presencia web</div>
            <label class="prosp-check">
              <input type="checkbox" id="ps-no-web" ${searchState.noWebsite ? 'checked' : ''} />
              <span>Sin página web</span>
            </label>
            <label class="prosp-check">
              <input type="checkbox" id="ps-social-web" ${searchState.socialWebOnly ? 'checked' : ''} />
              <span>Web solo en redes sociales</span>
            </label>
            <label class="prosp-check">
              <input type="checkbox" id="ps-real-web" ${searchState.hasRealWeb ? 'checked' : ''} />
              <span>Con web propia</span>
            </label>
          </div>

          <div class="prosp-filter-group">
            <div class="prosp-filter-title">${ICONS.star} Valoración</div>
            <label class="prosp-check">
              <input type="checkbox" id="ps-low-rating" ${searchState.lowRating ? 'checked' : ''} />
              <span>Baja (&lt; 4 ★) — necesitan mejorar</span>
            </label>
            <label class="prosp-check">
              <input type="checkbox" id="ps-high-rating" ${searchState.highRating ? 'checked' : ''} />
              <span>Alta (≥ 4.5 ★) — negocio activo</span>
            </label>
          </div>

          <div class="prosp-filter-group">
            <div class="prosp-filter-title">Reseñas</div>
            <label class="prosp-check">
              <input type="checkbox" id="ps-few-reviews" ${searchState.fewReviews ? 'checked' : ''} />
              <span>Pocas reseñas (&lt; 30)</span>
            </label>
            <label class="prosp-check">
              <input type="checkbox" id="ps-many-reviews" ${searchState.manyReviews ? 'checked' : ''} />
              <span>Muchas reseñas (≥ 100)</span>
            </label>
            <div class="prosp-filter-note">
              Si responden o no a reseñas solo puedes verlo directamente en Maps — usa el botón <strong>Reseñas</strong> en cada negocio.
            </div>
          </div>

          <div class="prosp-filter-group">
            <div class="prosp-filter-title">Otros</div>
            <label class="prosp-check">
              <input type="checkbox" id="ps-no-phone" ${searchState.noPhone ? 'checked' : ''} />
              <span>Sin teléfono registrado</span>
            </label>
          </div>

          <button class="btn btn-primary prosp-search-btn" id="ps-search">
            ${ICONS.search} Buscar negocios
          </button>
        </div>
      </div>

      <div class="prosp-results" id="ps-results">
        ${renderResultsArea()}
      </div>
    </div>`;

  // eventos del formulario
  body.querySelector('#ps-query').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(body, apiKey); });
  body.querySelector('#ps-query').addEventListener('input', e => { searchState.query = e.target.value; });
  body.querySelector('#ps-category').addEventListener('change', e => { searchState.category = e.target.value; });
  body.querySelector('#ps-zone').addEventListener('change', e => { searchState.zone = e.target.value; });
  body.querySelector('#ps-radius').addEventListener('change', e => { searchState.radius = +e.target.value; });
  body.querySelector('#ps-max').addEventListener('change', e => { searchState.maxResults = +e.target.value; });
  body.querySelector('#ps-no-web').addEventListener('change', e => { searchState.noWebsite = e.target.checked; });
  body.querySelector('#ps-social-web').addEventListener('change', e => { searchState.socialWebOnly = e.target.checked; });
  body.querySelector('#ps-real-web').addEventListener('change', e => { searchState.hasRealWeb = e.target.checked; });
  body.querySelector('#ps-low-rating').addEventListener('change', e => { searchState.lowRating = e.target.checked; });
  body.querySelector('#ps-high-rating').addEventListener('change', e => { searchState.highRating = e.target.checked; });
  body.querySelector('#ps-few-reviews').addEventListener('change', e => { searchState.fewReviews = e.target.checked; });
  body.querySelector('#ps-many-reviews').addEventListener('change', e => { searchState.manyReviews = e.target.checked; });
  body.querySelector('#ps-no-phone').addEventListener('change', e => { searchState.noPhone = e.target.checked; });
  body.querySelector('#ps-search').addEventListener('click', () => doSearch(body, apiKey));

  // Si ya hay resultados (re-render por emit), reconectar los botones de las cards
  if (searchState.searched && !searchState.loading) attachResultsEvents(body, apiKey);
}

function renderResultsArea() {
  if (searchState.loading) {
    return `<div class="prosp-loading">
      <div class="prosp-spinner"></div>
      <p>${esc(searchState.loadingMsg || `Buscando negocios en ${searchState.zone}…`)}</p>
      <div class="prosp-progress"><div class="prosp-progress-bar" id="ps-progress-bar" style="width:${searchState.loadingPct || 10}%"></div></div>
    </div>`;
  }
  if (!searchState.searched) {
    return `<div class="prosp-empty-state">
      <div class="prosp-empty-ico">${ICONS.prospector}</div>
      <h3>Encuentra tu próximo cliente</h3>
      <p>Selecciona zona y radio, añade un tipo de negocio o categoría si quieres filtrar, y pulsa Buscar. Sin filtros te mostramos hasta 50 negocios de la zona.</p>
    </div>`;
  }

  const results = applyClientFilters(searchState.results);

  if (!results.length) {
    return `<div class="prosp-empty-state">
      <div class="prosp-empty-ico">🔍</div>
      <h3>Sin resultados</h3>
      <p>No se encontraron negocios con los filtros actuales. Prueba a ampliar el radio o quitar algún filtro.</p>
    </div>`;
  }

  const total = searchState.results.length;
  const filtered = results.length;
  return `
    <div class="prosp-results-head">
      <span>${filtered} negocio${filtered === 1 ? '' : 's'}${filtered !== total ? ` (filtrados de ${total})` : ''} · ${esc(searchState.zone)}</span>
    </div>
    <div class="prosp-grid">
      ${results.map(p => placeCard(p)).join('')}
    </div>`;
}

function applyClientFilters(places) {
  return places.filter(p => {
    const web = p.websiteUri || null;
    const social = isSocialWeb(web);
    // presencia web
    if (searchState.noWebsite && web) return false;
    if (searchState.socialWebOnly && (!web || !social)) return false;
    if (searchState.hasRealWeb && (!web || social)) return false;
    // valoración
    if (searchState.lowRating && (p.rating == null || p.rating >= 4)) return false;
    if (searchState.highRating && (p.rating == null || p.rating < 4.5)) return false;
    // reseñas
    if (searchState.fewReviews && (p.userRatingCount == null || p.userRatingCount >= 30)) return false;
    if (searchState.manyReviews && (p.userRatingCount == null || p.userRatingCount < 100)) return false;
    // otros
    if (searchState.noPhone && p.nationalPhoneNumber) return false;
    return true;
  });
}

function placeCard(place) {
  const pid = esc(place.id);
  const prospect = prospectByPlaceId(place.id);
  const isSaved  = prospect?.status === 'saved';
  const isVetoed = prospect?.status === 'vetoed';

  const stars = place.rating ? renderStars(place.rating) : '';
  const ratingBadge = place.rating
    ? `<span class="prosp-rating ${place.rating < 4 ? 'low' : ''}">${stars} ${place.rating.toFixed(1)}</span>`
    : '<span class="prosp-rating none">Sin valoración</span>';

  const reviewBadge = place.userRatingCount != null
    ? `<span class="prosp-reviews ${place.userRatingCount < 30 ? 'few' : ''}">${place.userRatingCount} reseña${place.userRatingCount === 1 ? '' : 's'}</span>`
    : '';

  const webUrl = place.websiteUri || null;
  const social = isSocialWeb(webUrl);
  const webBadge = !webUrl
    ? `<span class="prosp-badge no-web">${ICONS.globe} Sin web</span>`
    : social
      ? `<a class="prosp-badge social-web" href="${esc(safeUrl(webUrl))}" target="_blank" rel="noopener nofollow" title="${esc(webUrl)}" onclick="event.stopPropagation()">${ICONS.globe} Solo redes sociales</a>`
      : `<a class="prosp-badge web" href="${esc(safeUrl(webUrl))}" target="_blank" rel="noopener nofollow" title="${esc(webUrl)}" onclick="event.stopPropagation()">${ICONS.globe} Tiene web propia</a>`;

  const typeLabel = getTypeLabel(place.types);

  return `
    <div class="prosp-card ${isVetoed ? 'vetoed' : ''}" data-place-id="${pid}">
      <div class="prosp-card-head">
        <div class="prosp-card-meta">${ratingBadge}${reviewBadge}</div>
        ${isVetoed ? '<span class="prosp-badge vetoed-tag">' + ICONS.ban + ' Vetado</span>' : ''}
        ${isSaved && !isVetoed ? '<span class="prosp-badge saved-tag">' + ICONS.bookmark + ' Guardado</span>' : ''}
      </div>
      <div class="prosp-card-name">${esc(place.displayName?.text || 'Sin nombre')}</div>
      ${typeLabel ? `<div class="prosp-card-type">${esc(typeLabel)}</div>` : ''}
      <div class="prosp-card-addr">${ICONS.map} ${esc(place.formattedAddress || '—')}</div>
      ${place.nationalPhoneNumber ? `<div class="prosp-card-phone">${ICONS.phone} ${esc(place.nationalPhoneNumber)}</div>` : ''}
      <div class="prosp-card-badges">${webBadge}</div>
      <div class="prosp-card-actions">
        <a class="btn btn-ghost btn-sm" href="${esc(place.googleMapsUri || '#')}" target="_blank" rel="noopener nofollow" onclick="event.stopPropagation()">${ICONS.map} Maps</a>
        ${place.googleMapsUri ? `<a class="btn btn-ghost btn-sm" href="${esc(place.googleMapsUri.replace('/maps/place/', '/maps/place/').replace('?', '/reviews?') || '#')}" target="_blank" rel="noopener nofollow" title="Ver si responden a reseñas" onclick="event.stopPropagation()">★ Reseñas</a>` : ''}
        ${!isVetoed ? `
          <button class="btn btn-sm ${isSaved ? 'btn-ghost saved-active' : 'btn-primary'} btn-save" data-pid="${pid}" title="${isSaved ? 'Ya guardado' : 'Guardar'}">
            ${ICONS.bookmark} ${isSaved ? 'Guardado' : 'Guardar'}
          </button>
          <button class="btn btn-sm btn-ghost btn-veto" data-pid="${pid}" title="Vetar">
            ${ICONS.ban}
          </button>
        ` : `
          <button class="btn btn-sm btn-ghost btn-unvote" data-pid="${pid}" title="Desvetar">
            Desvetar
          </button>
        `}
      </div>
    </div>`;
}

function renderStars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(Math.min(full, 5)) + '☆'.repeat(Math.max(0, 5 - full));
}

function getTypeLabel(types) {
  if (!types?.length) return '';
  for (const t of types) {
    const label = TYPE_LABELS[t];
    if (label && t !== 'establishment' && t !== 'point_of_interest' && t !== 'food') return label;
  }
  return TYPE_LABELS[types[0]] || '';
}

/* ============================================================
   BÚSQUEDA GOOGLE PLACES API (New)
   Busca hasta 50 negocios en 3 tandas automáticas de 20.
   Sin query ni categoría muestra todos los negocios de la zona.
   ============================================================ */
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
  'places.websiteUri', 'places.rating', 'places.userRatingCount',
  'places.types', 'places.googleMapsUri', 'nextPageToken'
].join(',');

const MAX_RESULTS = 50;
const PROGRESS_MSGS = [
  'Buscando negocios…',
  'Cargando más resultados…',
  'Últimos resultados…',
];

function buildTextQuery(zone) {
  const q = searchState.query.trim();
  if (q) return `${q} en ${zone.id}`;
  if (searchState.category) {
    const cat = CATEGORIES.find(c => c.value === searchState.category);
    return `${cat?.label || searchState.category} en ${zone.id}`;
  }
  return `negocios en ${zone.id}`;
}

function setLoadingProgress(body, step) {
  searchState.loadingMsg = PROGRESS_MSGS[Math.min(step, 2)];
  searchState.loadingPct = Math.round(((step + 1) / 3) * 85);
  const bar = body.querySelector('#ps-progress-bar');
  const txt = body.querySelector('.prosp-loading p');
  if (bar) bar.style.width = searchState.loadingPct + '%';
  if (txt) txt.textContent = searchState.loadingMsg;
}

async function fetchBatch(apiKey, zone, pageToken = null) {
  const reqBody = {
    textQuery: buildTextQuery(zone),
    maxResultCount: 20,
    languageCode: 'es',
    locationBias: { circle: { center: { latitude: zone.lat, longitude: zone.lng }, radius: searchState.radius } }
  };
  if (searchState.category) reqBody.includedType = searchState.category;
  if (pageToken) reqBody.pageToken = pageToken;

  // La clave va en la URL (query param) para evitar problemas CORS con cabeceras custom
  const url = `https://places.googleapis.com/v1/places:searchText?key=${encodeURIComponent(apiKey)}&fields=${encodeURIComponent(FIELD_MASK)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function doSearch(body, apiKey) {
  const zone = ZONES.find(z => z.id === searchState.zone) || ZONES[0];

  searchState.loading = true;
  searchState.searched = true;
  searchState.results = [];
  searchState.loadingMsg = PROGRESS_MSGS[0];
  searchState.loadingPct = 10;
  updateResultsPanel(body);

  try {
    let all = [];
    let pageToken = null;

    const target = searchState.maxResults;
    for (let step = 0; step < Math.ceil(target / 20) && all.length < target; step++) {
      setLoadingProgress(body, step);
      const data = await fetchBatch(apiKey, zone, pageToken);
      const batch = data.places || [];
      all = [...all, ...batch];
      pageToken = data.nextPageToken || null;
      if (!pageToken || batch.length === 0) break;
    }

    searchState.results = all.slice(0, target);
  } catch (err) {
    searchState.results = [];
    toast(`Error en la búsqueda: ${err.message}`, 'err');
    console.error('[Prospector]', err);
  } finally {
    searchState.loading = false;
    updateResultsPanel(body);
    attachResultsEvents(body, apiKey);
  }
}

function updateResultsPanel(body) {
  const panel = body.querySelector('#ps-results');
  if (panel) panel.innerHTML = renderResultsArea();
}

function attachResultsEvents(body, apiKey) {
  body.querySelectorAll('.btn-save').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const pid = btn.dataset.pid;
      const place = searchState.results.find(p => p.id === pid);
      if (!place) return;

      const existing = prospectByPlaceId(pid);
      if (existing?.status === 'saved') {
        openNotesModal(existing, body, apiKey);
        return;
      }

      btn.disabled = true;
      try {
        await saveProspect(buildProspectFields(place, 'saved'));
        toast(`"${place.displayName?.text}" guardado`);
      } catch (err) {
        toast('No se pudo guardar', 'err');
      }
      updateResultsPanel(body);
      attachResultsEvents(body, apiKey);
    });
  });

  body.querySelectorAll('.btn-veto').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const pid = btn.dataset.pid;
      const place = searchState.results.find(p => p.id === pid);
      if (!place) return;
      btn.disabled = true;
      try {
        const existing = prospectByPlaceId(pid);
        if (existing) {
          await updateProspect(existing.id, { status: 'vetoed' });
        } else {
          await saveProspect(buildProspectFields(place, 'vetoed'));
        }
        toast(`"${place.displayName?.text}" vetado`);
      } catch (err) {
        toast('No se pudo vetar', 'err');
      }
      updateResultsPanel(body);
      attachResultsEvents(body, apiKey);
    });
  });

  body.querySelectorAll('.btn-unvote').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const pid = btn.dataset.pid;
      const existing = prospectByPlaceId(pid);
      if (!existing) return;
      try {
        await deleteProspect(existing.id);
        toast('Prospecto desvetado');
      } catch (err) {
        toast('No se pudo desvetar', 'err');
      }
      updateResultsPanel(body);
      attachResultsEvents(body, apiKey);
    });
  });
}

function buildProspectFields(place, status) {
  return {
    place_id:     place.id,
    name:         place.displayName?.text || 'Sin nombre',
    address:      place.formattedAddress || null,
    website:      place.websiteUri || null,
    phone:        place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    rating:       place.rating ?? null,
    rating_count: place.userRatingCount ?? null,
    types:        place.types || [],
    maps_url:     place.googleMapsUri || null,
    zone:         searchState.zone,
    status,
  };
}

/* ============================================================
   TAB: GUARDADOS
   ============================================================ */
function renderSavedTab(body, root) {
  const saved = state.prospects.filter(p => p.status === 'saved');

  body.innerHTML = `
    <div class="prosp-list-head">
      <div class="filters">
        <input type="search" id="saved-q" placeholder="Filtrar guardados…" value="${esc(savedFilter.q)}" />
        <select id="saved-sort">
          <option value="recent"${savedFilter.sort === 'recent' ? ' selected' : ''}>Más recientes</option>
          <option value="name"${savedFilter.sort === 'name' ? ' selected' : ''}>Nombre A-Z</option>
          <option value="rating"${savedFilter.sort === 'rating' ? ' selected' : ''}>Mejor valorados</option>
          <option value="no-web"${savedFilter.sort === 'no-web' ? ' selected' : ''}>Sin web primero</option>
        </select>
      </div>
    </div>
    <div id="saved-list"></div>`;

  body.querySelector('#saved-q').addEventListener('input', debounce(e => {
    savedFilter.q = e.target.value; paintSaved(body, root);
  }, 200));
  body.querySelector('#saved-sort').addEventListener('change', e => {
    savedFilter.sort = e.target.value; paintSaved(body, root);
  });

  paintSaved(body, root);
}

function paintSaved(body, root) {
  const list = body.querySelector('#saved-list');
  let items = state.prospects.filter(p => p.status === 'saved');

  if (savedFilter.q) {
    const q = savedFilter.q.toLowerCase();
    items = items.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q) ||
      (p.zone || '').toLowerCase().includes(q));
  }

  if (savedFilter.sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
  else if (savedFilter.sort === 'rating') items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  else if (savedFilter.sort === 'no-web') items.sort((a, b) => (a.website ? 1 : 0) - (b.website ? 1 : 0));
  else items.sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (!items.length) {
    list.innerHTML = `<div class="empty">
      <div class="ico">${ICONS.bookmark}</div>
      <h3>No hay guardados</h3>
      <p>Busca negocios y guarda los que te parezcan interesantes.</p>
    </div>`;
    return;
  }

  list.innerHTML = `<div class="prosp-saved-grid">${items.map(p => savedCard(p)).join('')}</div>`;

  list.querySelectorAll('.btn-edit-notes').forEach(btn =>
    btn.addEventListener('click', () => {
      const p = state.prospects.find(x => x.id === btn.dataset.id);
      if (p) openNotesModal(p, body, null, () => { paintSaved(body, root); updateBadges(root); });
    }));

  list.querySelectorAll('.btn-to-company').forEach(btn =>
    btn.addEventListener('click', async () => {
      const p = state.prospects.find(x => x.id === btn.dataset.id);
      if (!p) return;
      try {
        await createCompany({
          name: p.name,
          phone: p.phone || '',
          website: p.website || '',
          status: 'prospecto',
          priority: 'media',
          notes: `Zona: ${p.zone || ''}${p.address ? '\nDirección: ' + p.address : ''}${p.notes ? '\n\n' + p.notes : ''}`,
        });
        toast(`"${p.name}" añadido como empresa`);
      } catch (err) {
        toast('No se pudo crear la empresa', 'err');
      }
    }));

  list.querySelectorAll('.btn-veto-saved').forEach(btn =>
    btn.addEventListener('click', async () => {
      const p = state.prospects.find(x => x.id === btn.dataset.id);
      if (!p) return;
      if (await confirmDialog(`Vetar "${p.name}" — ya no aparecerá en guardados.`, { confirmLabel: 'Vetar', danger: true })) {
        try {
          await updateProspect(p.id, { status: 'vetoed' });
          toast(`"${p.name}" vetado`);
          paintSaved(body, root);
          updateBadges(root);
        } catch { toast('Error al vetar', 'err'); }
      }
    }));

  list.querySelectorAll('.btn-del-saved').forEach(btn =>
    btn.addEventListener('click', async () => {
      const p = state.prospects.find(x => x.id === btn.dataset.id);
      if (!p) return;
      if (await confirmDialog(`Eliminar "${p.name}" de guardados.`)) {
        try {
          await deleteProspect(p.id);
          toast('Eliminado');
          paintSaved(body, root);
          updateBadges(root);
        } catch { toast('Error al eliminar', 'err'); }
      }
    }));
}

function savedCard(p) {
  const stars = p.rating ? renderStars(p.rating) : '';
  const ratingTxt = p.rating ? `${stars} ${p.rating.toFixed(1)} (${p.rating_count ?? 0} reseñas)` : 'Sin valoración';
  const webBadge = p.website
    ? `<a class="prosp-badge web" href="${esc(safeUrl(p.website))}" target="_blank" rel="noopener nofollow" onclick="event.stopPropagation()">${ICONS.globe} ${esc(p.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>`
    : `<span class="prosp-badge no-web">${ICONS.globe} Sin web</span>`;

  return `
    <div class="prosp-saved-card">
      <div class="prosp-saved-top">
        <div>
          <div class="prosp-card-name">${esc(p.name)}</div>
          ${p.zone ? `<div class="prosp-card-type">${esc(p.zone)}</div>` : ''}
          <div class="prosp-card-addr">${ICONS.map} ${esc(p.address || '—')}</div>
          ${p.phone ? `<div class="prosp-card-phone">${ICONS.phone} ${esc(p.phone)}</div>` : ''}
          <div class="prosp-card-rating">${esc(ratingTxt)}</div>
          <div class="prosp-card-badges" style="margin-top:8px">${webBadge}</div>
        </div>
        <div class="prosp-saved-actions-top">
          ${p.maps_url ? `<a class="icon-btn" href="${esc(safeUrl(p.maps_url))}" target="_blank" rel="noopener nofollow" title="Ver en Maps">${ICONS.map}</a>` : ''}
        </div>
      </div>
      ${p.notes ? `<div class="prosp-notes">${esc(p.notes)}</div>` : ''}
      <div class="prosp-saved-actions">
        <button class="btn btn-sm btn-ghost btn-edit-notes" data-id="${esc(p.id)}">${ICONS.edit} Notas</button>
        <button class="btn btn-sm btn-primary btn-to-company" data-id="${esc(p.id)}">${ICONS.plus} Añadir como empresa</button>
        <button class="btn btn-sm btn-ghost btn-veto-saved" data-id="${esc(p.id)}" style="color:var(--orange)" title="Vetar">${ICONS.ban}</button>
        <button class="btn btn-sm btn-ghost btn-del-saved" data-id="${esc(p.id)}" style="color:var(--red)" title="Eliminar">${ICONS.trash}</button>
      </div>
    </div>`;
}

/* ============================================================
   TAB: VETADOS
   ============================================================ */
function renderVetoedTab(body, root) {
  const vetoed = state.prospects.filter(p => p.status === 'vetoed');

  if (!vetoed.length) {
    body.innerHTML = `<div class="empty">
      <div class="ico">${ICONS.ban}</div>
      <h3>Sin vetados</h3>
      <p>Los negocios que vetes aparecerán aquí para que no vuelvan a molestarte.</p>
    </div>`;
    return;
  }

  body.innerHTML = `<div class="prosp-saved-grid">
    ${vetoed.map(p => `
      <div class="prosp-saved-card vetoed">
        <div class="prosp-saved-top">
          <div>
            <div class="prosp-card-name">${esc(p.name)}</div>
            ${p.zone ? `<div class="prosp-card-type">${esc(p.zone)}</div>` : ''}
            <div class="prosp-card-addr">${ICONS.map} ${esc(p.address || '—')}</div>
            ${p.phone ? `<div class="prosp-card-phone">${ICONS.phone} ${esc(p.phone)}</div>` : ''}
            ${p.website ? `<div class="prosp-card-badges" style="margin-top:6px"><a class="prosp-badge web" href="${esc(safeUrl(p.website))}" target="_blank" rel="noopener nofollow">${ICONS.globe} Tiene web</a></div>` : `<div class="prosp-card-badges" style="margin-top:6px"><span class="prosp-badge no-web">${ICONS.globe} Sin web</span></div>`}
          </div>
        </div>
        <div class="prosp-saved-actions">
          <button class="btn btn-sm btn-ghost btn-unvote-saved" data-id="${esc(p.id)}">Desvetar</button>
          <button class="btn btn-sm btn-ghost btn-del-vetoed" data-id="${esc(p.id)}" style="color:var(--red)">${ICONS.trash} Eliminar</button>
        </div>
      </div>`).join('')}
  </div>`;

  body.querySelectorAll('.btn-unvote-saved').forEach(btn =>
    btn.addEventListener('click', async () => {
      const p = state.prospects.find(x => x.id === btn.dataset.id);
      if (!p) return;
      try {
        await updateProspect(p.id, { status: 'saved' });
        toast(`"${p.name}" restaurado a guardados`);
        renderVetoedTab(body, root);
        updateBadges(root.closest('#view')?.parentElement || document.querySelector('.view')?.parentElement || document);
      } catch { toast('Error', 'err'); }
    }));

  body.querySelectorAll('.btn-del-vetoed').forEach(btn =>
    btn.addEventListener('click', async () => {
      const p = state.prospects.find(x => x.id === btn.dataset.id);
      if (!p) return;
      if (await confirmDialog(`Eliminar "${p.name}" de la lista.`)) {
        try {
          await deleteProspect(p.id);
          toast('Eliminado');
          renderVetoedTab(body, root);
          updateBadges(root.closest('#view')?.parentElement || document.querySelector('.view')?.parentElement || document);
        } catch { toast('Error al eliminar', 'err'); }
      }
    }));
}

/* ============================================================
   MODAL DE NOTAS
   ============================================================ */
function openNotesModal(prospect, body, apiKey, onSave) {
  const foot = document.createElement('div');
  foot.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';
  const cancel = document.createElement('button');
  cancel.className = 'btn btn-ghost';
  cancel.textContent = 'Cancelar';
  const save = document.createElement('button');
  save.className = 'btn btn-primary';
  save.textContent = 'Guardar notas';
  foot.append(cancel, save);

  const m = openModal({
    title: prospect.name,
    body: `
      <label class="form-label">Notas internas</label>
      <textarea id="notes-ta" class="form-input" rows="5" placeholder="Por qué es interesante, cuándo contactar…"
        style="width:100%;resize:vertical">${esc(prospect.notes || '')}</textarea>`,
    footer: foot,
  });

  cancel.addEventListener('click', m.close);
  save.addEventListener('click', async () => {
    const notes = m.body.querySelector('#notes-ta').value.trim();
    save.disabled = true;
    try {
      await updateProspect(prospect.id, { notes });
      toast('Notas guardadas');
      m.close();
      onSave?.();
      if (body && apiKey) { updateResultsPanel(body); attachResultsEvents(body, apiKey); }
    } catch { toast('Error al guardar', 'err'); save.disabled = false; }
  });
}
