/* ============================================================
   mock.js — datos de ejemplo estructurados para las secciones
   que aún no tienen tabla en Supabase. Sirven para diseñar la
   interfaz; sustituibles por datos reales más adelante.
   Cada array imita lo que devolvería Supabase (filas con id).
   ============================================================ */

export const OWNERS = ['Nil', 'Marc'];
export const SERVICES = ['Desarrollo web', 'Agente IA', 'Automatización', 'Mantenimiento', 'SEO', 'Branding'];

/* ---------- Leads (pipeline comercial) ---------- */
const _leads = [
  { id: 'l1', name: 'Clínica Dental Sonrisa', contact: 'Laura Gómez',  source: 'Instagram',   service: 'Desarrollo web', value: 3200, status: 'nuevo',       next_action: 'Llamar para briefing', next_date: '2026-06-19', owner: 'Nil',  created_at: '2026-06-14' },
  { id: 'l2', name: 'Gimnasio Pulse',         contact: 'Iván Ruiz',    source: 'Referido',     service: 'Agente IA',      value: 4800, status: 'contactado',  next_action: 'Enviar propuesta',     next_date: '2026-06-18', owner: 'Marc', created_at: '2026-06-12' },
  { id: 'l3', name: 'Inmobiliaria Costa',     contact: 'Sara Pons',    source: 'Google Ads',   service: 'Automatización', value: 2600, status: 'cualificado', next_action: 'Reunión técnica',      next_date: '2026-06-20', owner: 'Nil',  created_at: '2026-06-10' },
  { id: 'l4', name: 'Bufete Lex',             contact: 'Andrés Vela',  source: 'LinkedIn',     service: 'Desarrollo web', value: 5400, status: 'propuesta',   next_action: 'Seguimiento propuesta', next_date: '2026-06-17', owner: 'Marc', created_at: '2026-06-08' },
  { id: 'l5', name: 'Cafetería Aroma',        contact: 'Marta Gil',    source: 'Web',          service: 'Agente IA',      value: 1900, status: 'nuevo',       next_action: 'Primer contacto',      next_date: '2026-06-19', owner: 'Nil',  created_at: '2026-06-15' },
  { id: 'l6', name: 'Talleres Mecánicos RM',  contact: 'Rubén Mata',   source: 'Referido',     service: 'Mantenimiento',  value: 1200, status: 'ganado',      next_action: 'Onboarding',           next_date: '2026-06-16', owner: 'Marc', created_at: '2026-06-02' },
  { id: 'l7', name: 'Floristería Verde',      contact: 'Nuria Sanz',   source: 'Instagram',    service: 'Desarrollo web', value: 1500, status: 'perdido',     next_action: '—',                    next_date: '', owner: 'Nil',  created_at: '2026-05-28' }
];

/* ---------- Presupuestos ---------- */
const _quotes = [
  { id: 'q1', number: 'PRE-2026-014', client: 'Bufete Lex',          service: 'Desarrollo web', value: 5400, status: 'enviado',  sent_at: '2026-06-10', expires_at: '2026-06-24' },
  { id: 'q2', number: 'PRE-2026-013', client: 'Gimnasio Pulse',      service: 'Agente IA',      value: 4800, status: 'pendiente', sent_at: '2026-06-12', expires_at: '2026-06-26' },
  { id: 'q3', number: 'PRE-2026-012', client: 'El Tridente',         service: 'Mantenimiento',  value: 1200, status: 'aceptado', sent_at: '2026-06-01', expires_at: '2026-06-15' },
  { id: 'q4', number: 'PRE-2026-011', client: 'Inmobiliaria Costa',  service: 'Automatización', value: 2600, status: 'enviado',  sent_at: '2026-06-09', expires_at: '2026-06-23' },
  { id: 'q5', number: 'PRE-2026-010', client: 'Floristería Verde',   service: 'Desarrollo web', value: 1500, status: 'rechazado', sent_at: '2026-05-22', expires_at: '2026-06-05' },
  { id: 'q6', number: 'PRE-2026-009', client: 'Clínica Vet. Cantabria', service: 'Agente IA',   value: 3900, status: 'aceptado', sent_at: '2026-05-18', expires_at: '2026-06-01' }
];

/* ---------- Proyectos ---------- */
const _projects = [
  { id: 'p1', name: 'Web corporativa',        client: 'El Tridente',            type: 'web',            status: 'progreso', owner: 'Nil',  due: '2026-06-28', progress: 70, budget: 3200, cost: 1100 },
  { id: 'p2', name: 'Agente reservas WhatsApp',client: 'Clínica Vet. Cantabria', type: 'agente',         status: 'revision', owner: 'Marc', due: '2026-06-22', progress: 88, budget: 3900, cost: 1500 },
  { id: 'p3', name: 'Automatización leads',    client: 'Inmobiliaria Costa',     type: 'automatizacion', status: 'pendiente_cliente', owner: 'Nil', due: '2026-07-05', progress: 40, budget: 2600, cost: 800 },
  { id: 'p4', name: 'Tienda online',           client: 'Floristería Verde',      type: 'web',            status: 'pausado',  owner: 'Marc', due: '2026-07-15', progress: 25, budget: 4200, cost: 900 },
  { id: 'p5', name: 'Mantenimiento mensual',   client: 'TOT Pizza',              type: 'mantenimiento',  status: 'activo',   owner: 'Nil',  due: '2026-12-31', progress: 100, budget: 1200, cost: 300 },
  { id: 'p6', name: 'Agente soporte interno',  client: 'Gimnasio Pulse',         type: 'agente',         status: 'entregado',owner: 'Marc', due: '2026-06-05', progress: 100, budget: 4800, cost: 1700 }
];

/* ---------- Webs ---------- */
const _webs = [
  { id: 'w1', name: 'El Tridente',          client: 'El Tridente',            domain: 'eltridente.es',        hosting: 'GitHub Pages', tech: 'Vite + JS',     design: 'aprobado',  dev: 'progreso',   seo: 'pendiente', analytics: 'no', status: 'desarrollo' },
  { id: 'w2', name: 'TOT Pizza',            client: 'TOT Pizza',              domain: 'totpizza.cafe',        hosting: 'Netlify',      tech: 'Astro',         design: 'aprobado',  dev: 'publicado',  seo: 'ok',        analytics: 'GA4', status: 'publicado' },
  { id: 'w3', name: 'Clínica Vet. Cantabria', client: 'Clínica Vet. Cantabria', domain: 'vetcantabria.com',  hosting: 'Vercel',       tech: 'Next.js',       design: 'aprobado',  dev: 'publicado',  seo: 'ok',        analytics: 'GA4', status: 'mantenimiento' },
  { id: 'w4', name: 'Floristería Verde',    client: 'Floristería Verde',      domain: '—',                    hosting: '—',            tech: 'WooCommerce',   design: 'revision',  dev: 'pendiente',  seo: 'pendiente', analytics: 'no', status: 'desarrollo' }
];

/* ---------- Agentes IA ---------- */
const _agents = [
  { id: 'a1', name: 'Reservas Vet',     client: 'Clínica Vet. Cantabria', type: 'Atención al cliente', channel: 'WhatsApp', model: 'GPT-4o mini', kb: 'Servicios + horarios', integrations: 'Calendar, CRM', conversations: 412, errors: 3, cost_month: 28, status: 'revision' },
  { id: 'a2', name: 'Pedidos Pizza',    client: 'TOT Pizza',              type: 'Ventas',              channel: 'Web',      model: 'GPT-4o mini', kb: 'Carta + promos',       integrations: 'Stripe',        conversations: 1380, errors: 7, cost_month: 41, status: 'activo' },
  { id: 'a3', name: 'Soporte Gym',      client: 'Gimnasio Pulse',         type: 'Soporte interno',     channel: 'Interno',  model: 'GPT-4o',      kb: 'Procedimientos',       integrations: 'Notion',        conversations: 220, errors: 1, cost_month: 35, status: 'activo' },
  { id: 'a4', name: 'Captación leads',  client: 'Inmobiliaria Costa',     type: 'Comercial',           channel: 'Web',      model: 'GPT-4o mini', kb: 'Catálogo inmuebles',   integrations: 'Make, Email',   conversations: 0,   errors: 0, cost_month: 0,  status: 'desarrollo' }
];

/* ---------- Entregas / QA ---------- */
const _qa = [
  { id: 'qa1', project: 'Web corporativa · El Tridente',          type: 'web',    review: 'progreso', bugs: 2, internal_ok: false, client_ok: false },
  { id: 'qa2', project: 'Agente reservas · Clínica Vet.',         type: 'agente', review: 'revision', bugs: 1, internal_ok: true,  client_ok: false },
  { id: 'qa3', project: 'Agente soporte · Gimnasio Pulse',        type: 'agente', review: 'aprobado', bugs: 0, internal_ok: true,  client_ok: true },
  { id: 'qa4', project: 'Tienda online · Floristería Verde',      type: 'web',    review: 'pendiente_cliente', bugs: 4, internal_ok: false, client_ok: false }
];

/* ---------- Tickets ---------- */
const _tickets = [
  { id: 't1', code: 'TK-128', client: 'TOT Pizza',              project: 'Pedidos Pizza',  type: 'Bug',        priority: 'alta',    status: 'abierto',  owner: 'Nil',  created_at: '2026-06-15' },
  { id: 't2', code: 'TK-127', client: 'Clínica Vet. Cantabria', project: 'Web',            type: 'Cambio',     priority: 'media',   status: 'progreso', owner: 'Marc', created_at: '2026-06-14' },
  { id: 't3', code: 'TK-126', client: 'Gimnasio Pulse',         project: 'Soporte Gym',    type: 'Consulta',   priority: 'baja',    status: 'resuelto', owner: 'Nil',  created_at: '2026-06-12' },
  { id: 't4', code: 'TK-125', client: 'El Tridente',            project: 'Web corporativa',type: 'Incidencia', priority: 'urgente', status: 'abierto',  owner: 'Marc', created_at: '2026-06-16' },
  { id: 't5', code: 'TK-124', client: 'TOT Pizza',              project: 'Web',            type: 'Cambio',     priority: 'media',   status: 'cerrado',  owner: 'Nil',  created_at: '2026-06-08' }
];

/* ---------- Mantenimiento ---------- */
const _maintenance = [
  { id: 'm1', client: 'TOT Pizza',              plan: 'Web Plus',   webs: 1, agents: 1, hours_inc: 4, hours_used: 1.5, renewal: '2026-07-01', status: 'activo' },
  { id: 'm2', client: 'Clínica Vet. Cantabria', plan: 'Web + IA',   webs: 1, agents: 1, hours_inc: 6, hours_used: 5.5, renewal: '2026-06-25', status: 'pendiente_renovar' },
  { id: 'm3', client: 'El Tridente',            plan: 'Básico',     webs: 1, agents: 0, hours_inc: 2, hours_used: 0.5, renewal: '2026-08-01', status: 'activo' },
  { id: 'm4', client: 'Gimnasio Pulse',         plan: 'IA Care',    webs: 0, agents: 1, hours_inc: 3, hours_used: 3,   renewal: '2026-06-30', status: 'pendiente_renovar' }
];

/* ---------- Herramientas / stack ---------- */
const _tools = [
  { id: 'tl1', name: 'OpenAI',          category: 'IA',         cost_month: 60, renewal: 'Mensual', client: 'Interno', status: 'activo' },
  { id: 'tl2', name: 'Supabase',        category: 'Backend',    cost_month: 25, renewal: 'Mensual', client: 'Interno', status: 'activo' },
  { id: 'tl3', name: 'Vercel',          category: 'Hosting',    cost_month: 20, renewal: 'Mensual', client: 'Interno', status: 'activo' },
  { id: 'tl4', name: 'Figma',           category: 'Diseño',     cost_month: 12, renewal: 'Mensual', client: 'Interno', status: 'activo' },
  { id: 'tl5', name: 'Make',            category: 'Automatización', cost_month: 16, renewal: 'Mensual', client: 'Interno', status: 'activo' },
  { id: 'tl6', name: 'Stripe',          category: 'Pagos',      cost_month: 0,  renewal: 'Por uso', client: 'Interno', status: 'activo' },
  { id: 'tl7', name: 'Google Analytics',category: 'Analítica',  cost_month: 0,  renewal: '—',       client: 'Varios',  status: 'activo' },
  { id: 'tl8', name: 'WordPress',       category: 'CMS',        cost_month: 8,  renewal: 'Anual',   client: 'Floristería Verde', status: 'activo' }
];

/* ---------- Documentos ---------- */
const _documents = [
  { id: 'd1', name: 'Contrato · El Tridente',           type: 'Contrato',  client: 'El Tridente',            project: 'Web corporativa', date: '2026-06-01' },
  { id: 'd2', name: 'Briefing · Clínica Vet.',          type: 'Briefing',  client: 'Clínica Vet. Cantabria', project: 'Agente reservas', date: '2026-05-20' },
  { id: 'd3', name: 'Propuesta · Bufete Lex',           type: 'Propuesta', client: 'Bufete Lex',             project: '—',               date: '2026-06-10' },
  { id: 'd4', name: 'Manual de uso · Pedidos Pizza',    type: 'Manual',    client: 'TOT Pizza',              project: 'Pedidos Pizza',   date: '2026-05-12' },
  { id: 'd5', name: 'Doc. técnica · Automatización',    type: 'Técnica',   client: 'Inmobiliaria Costa',     project: 'Automatización',  date: '2026-06-09' }
];

/* ---------- Informes ---------- */
const _reports = [
  { id: 'r1', name: 'Rendimiento web · TOT Pizza',      type: 'cliente',  period: 'Mayo 2026', date: '2026-06-02' },
  { id: 'r2', name: 'Conversaciones IA · Clínica Vet.',  type: 'cliente',  period: 'Mayo 2026', date: '2026-06-02' },
  { id: 'r3', name: 'Leads generados',                   type: 'interno',  period: 'Mayo 2026', date: '2026-06-01' },
  { id: 'r4', name: 'Tickets resueltos',                 type: 'interno',  period: 'Mayo 2026', date: '2026-06-01' },
  { id: 'r5', name: 'Costes IA',                         type: 'interno',  period: 'Mayo 2026', date: '2026-06-01' }
];

/* ---------- Accesos (sin contraseñas en claro) ---------- */
const _access = [
  { id: 'ac1', client: 'TOT Pizza',              type: 'Hosting', system: 'Netlify',     ref: 'team@totpizza.cafe',   vault: 'Bitwarden', status: 'ok' },
  { id: 'ac2', client: 'Clínica Vet. Cantabria', type: 'Dominio', system: 'IONOS',        ref: 'admin@vetcantabria',   vault: 'Bitwarden', status: 'ok' },
  { id: 'ac3', client: 'El Tridente',            type: 'CMS',     system: 'GitHub',       ref: 'tamastudios',          vault: 'Bitwarden', status: 'ok' },
  { id: 'ac4', client: 'TOT Pizza',              type: 'API',     system: 'Stripe',       ref: 'sk_live_••••',         vault: 'Bitwarden', status: 'ok' },
  { id: 'ac5', client: 'Inmobiliaria Costa',     type: 'Externa', system: 'Make',         ref: 'pendiente',            vault: '—',         status: 'pendiente' }
];

/* ============================================================
   Interruptor de datos de demostración.
   false  → secciones nuevas vacías (estados vacíos profesionales)
   true   → se rellenan con los ejemplos de arriba (solo para demos)
   Nada de esto toca Supabase: Empresas y Facturas usan datos reales.
   ============================================================ */
export const USE_MOCK = false;
const _empty = [];
export const leads       = USE_MOCK ? _leads       : _empty;
export const quotes      = USE_MOCK ? _quotes      : _empty;
export const projects    = USE_MOCK ? _projects    : _empty;
export const webs        = USE_MOCK ? _webs        : _empty;
export const agents      = USE_MOCK ? _agents      : _empty;
export const qa          = USE_MOCK ? _qa          : _empty;
export const tickets     = USE_MOCK ? _tickets     : _empty;
export const maintenance = USE_MOCK ? _maintenance : _empty;
export const tools       = USE_MOCK ? _tools       : _empty;
export const documents   = USE_MOCK ? _documents   : _empty;
export const reports     = USE_MOCK ? _reports     : _empty;
export const access      = USE_MOCK ? _access      : _empty;
