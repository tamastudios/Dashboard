/* ============================================================
   mock.js — datos de ejemplo para las secciones que aún no
   tienen tabla en Supabase (Proyectos, Webs, Agentes IA, QA).
   Leads, Presupuestos, Tickets, Facturas y Empresas usan datos
   REALES de Supabase, no de aquí.

   USE_MOCK = false → secciones vacías (estados vacíos).
   USE_MOCK = true  → se rellenan con los ejemplos (solo demos).
   ============================================================ */
export const OWNERS = ['Nil', 'Marc'];
export const SERVICES = ['Desarrollo web', 'Agente IA', 'Automatización', 'Mantenimiento', 'SEO', 'Branding'];

const _projects = [
  { id: 'p1', name: 'Web corporativa',        client: 'El Tridente',            type: 'web',            status: 'progreso', owner: 'Nil',  due: '2026-06-28', progress: 70, budget: 3200, cost: 1100 },
  { id: 'p2', name: 'Agente reservas WhatsApp',client: 'Clínica Vet. Cantabria', type: 'agente',         status: 'revision', owner: 'Marc', due: '2026-06-22', progress: 88, budget: 3900, cost: 1500 },
  { id: 'p3', name: 'Automatización leads',    client: 'Inmobiliaria Costa',     type: 'automatizacion', status: 'pendiente_cliente', owner: 'Nil', due: '2026-07-05', progress: 40, budget: 2600, cost: 800 },
  { id: 'p4', name: 'Tienda online',           client: 'Floristería Verde',      type: 'web',            status: 'pausado',  owner: 'Marc', due: '2026-07-15', progress: 25, budget: 4200, cost: 900 },
  { id: 'p5', name: 'Agente soporte interno',  client: 'Gimnasio Pulse',         type: 'agente',         status: 'entregado',owner: 'Marc', due: '2026-06-05', progress: 100, budget: 4800, cost: 1700 }
];

const _webs = [
  { id: 'w1', name: 'El Tridente',          client: 'El Tridente',            domain: 'eltridente.es',        hosting: 'GitHub Pages', tech: 'Vite + JS',   design: 'aprobado', dev: 'progreso',  seo: 'pendiente', analytics: 'no',  status: 'desarrollo' },
  { id: 'w2', name: 'TOT Pizza',            client: 'TOT Pizza',              domain: 'totpizza.cafe',        hosting: 'Netlify',      tech: 'Astro',       design: 'aprobado', dev: 'publicado', seo: 'ok',        analytics: 'GA4', status: 'publicado' },
  { id: 'w3', name: 'Clínica Vet. Cantabria', client: 'Clínica Vet. Cantabria', domain: 'vetcantabria.com',  hosting: 'Vercel',       tech: 'Next.js',     design: 'aprobado', dev: 'publicado', seo: 'ok',        analytics: 'GA4', status: 'mantenimiento' }
];

const _agents = [
  { id: 'a1', name: 'Reservas Vet',  client: 'Clínica Vet. Cantabria', type: 'Atención al cliente', channel: 'WhatsApp', model: 'GPT-4o mini', kb: 'Servicios + horarios', integrations: 'Calendar, CRM', conversations: 412,  errors: 3, cost_month: 28, status: 'revision' },
  { id: 'a2', name: 'Pedidos Pizza', client: 'TOT Pizza',              type: 'Ventas',              channel: 'Web',      model: 'GPT-4o mini', kb: 'Carta + promos',       integrations: 'Stripe',        conversations: 1380, errors: 7, cost_month: 41, status: 'activo' },
  { id: 'a3', name: 'Soporte Gym',   client: 'Gimnasio Pulse',         type: 'Soporte interno',     channel: 'Interno',  model: 'GPT-4o',      kb: 'Procedimientos',       integrations: 'Notion',        conversations: 220,  errors: 1, cost_month: 35, status: 'activo' }
];

const _qa = [
  { id: 'qa1', project: 'Web corporativa · El Tridente',     type: 'web',    review: 'progreso',          bugs: 2, internal_ok: false, client_ok: false },
  { id: 'qa2', project: 'Agente reservas · Clínica Vet.',    type: 'agente', review: 'revision',          bugs: 1, internal_ok: true,  client_ok: false },
  { id: 'qa3', project: 'Tienda online · Floristería Verde', type: 'web',    review: 'pendiente_cliente', bugs: 4, internal_ok: false, client_ok: false }
];

export const USE_MOCK = false;
const _empty = [];
export const projects = USE_MOCK ? _projects : _empty;
export const webs     = USE_MOCK ? _webs     : _empty;
export const agents   = USE_MOCK ? _agents   : _empty;
export const qa       = USE_MOCK ? _qa       : _empty;
