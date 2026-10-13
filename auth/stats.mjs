// Aggregate counters only: no visitor IDs, IP addresses, user agents or browsing histories.
export const sources = ['linkedin', 'github', 'resume', 'email', 'application', 'google', 'bing', 'duckduckgo', 'other-website', 'other-campaign', 'direct'];
const day = time => new Date(time).toISOString().slice(0, 10);
const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin'};

async function smallJSON(request) {
  if (Number(request.headers.get('Content-Length')) > 512) throw Error('body');
  const reader = request.body?.getReader();
  if (!reader) throw Error('body');
  let size = 0, chunks = [];
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512) { await reader.cancel(); throw Error('body'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(await new Blob(chunks).text());
}

export async function handleStats(request, env, dependencies) {
  const {now = Date.now, verify} = dependencies || {};
  const url = new URL(request.url), origin = request.headers.get('Origin');
  const allowed = origin === env.EDITOR_ORIGIN;
  const responseHeaders = {...headers, ...(allowed ? {'Access-Control-Allow-Origin': origin} : {})};
  const reply = (value, status = 200) => Response.json(value, {status, headers: responseHeaders});
  if (url.origin !== env.AUTH_ORIGIN || !allowed) return reply({error: 'This request is not allowed.'}, 403);
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: {...responseHeaders,
    'Access-Control-Allow-Methods': url.pathname === '/collect' ? 'POST' : 'GET',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600'}});

  if (url.pathname === '/collect') {
    if (request.method !== 'POST') return reply({error: 'Use POST.'}, 405);
    if (url.search || !['text/plain', 'application/json'].includes((request.headers.get('Content-Type') || '').split(';')[0])) return reply({error: 'Invalid event.'}, 400);
    // Common previews and crawlers are excluded; this is not a claim of perfect bot detection.
    if (/bot|crawler|spider|headless|preview/i.test(request.headers.get('User-Agent') || '') || request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1') return new Response(null, {status: 204, headers: responseHeaders});
    let event;
    try {
      event = await smallJSON(request);
      if (!event || Array.isArray(event) || Object.keys(event).sort().join() !== 'event,source,target' ||
        !sources.includes(event.source) || !['visit', 'resume', 'work'].includes(event.event) ||
        typeof event.target !== 'string' || (event.event === 'work' ? !/^[a-z0-9][a-z0-9-]{0,79}$/.test(event.target) : event.target !== '')) throw Error('event');
    } catch { return reply({error: 'Invalid event.'}, 400); }
    try {
      await env.STATS_DB.prepare(`INSERT INTO daily_stats (day, event, source, target, count) VALUES (?1, ?2, ?3, ?4, 1)
        ON CONFLICT(day, event, source, target) DO UPDATE SET count = count + 1`)
        .bind(day(now()), event.event, event.source, event.target).run();
      return new Response(null, {status: 204, headers: responseHeaders});
    } catch { return reply({error: 'Counting is temporarily unavailable.'}, 503); }
  }

  if (url.pathname !== '/stats' || request.method !== 'GET') return reply({error: 'Not found.'}, 404);
  try {
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer [A-Za-z0-9_.-]{1,2048}$/.test(authorization)) throw Error('session');
    const session = await verify(authorization.slice(7));
    if (session.purpose !== 'portfolio-stats' || session.user !== env.ALLOWED_USER_ID ||
      !Number.isFinite(session.issued) || !Number.isFinite(session.expires) || session.issued > now() ||
      session.expires <= now() || session.expires - session.issued > 28800000) throw Error('session');
  } catch { return reply({error: 'Sign in with GitHub again to view your stats. Your draft is safe.'}, 401); }
  const days = Number(url.searchParams.get('days') || 30);
  if (![7, 30, 90].includes(days) || [...url.searchParams.keys()].some(key => key !== 'days') || url.searchParams.getAll('days').length > 1) return reply({error: 'Choose 7, 30 or 90 days.'}, 400);
  const to = day(now()), from = day(now() - (days - 1) * 86400000);
  try {
    const result = await env.STATS_DB.prepare('SELECT day, event, source, target, count FROM daily_stats WHERE day >= ?1 AND day <= ?2 ORDER BY day DESC').bind(from, to).all();
    const meta = await env.STATS_DB.prepare('SELECT started_at FROM stats_meta WHERE id = 1').first();
    return reply({from, to, days, startedAt: meta?.started_at || null, updatedAt: new Date(now()).toISOString(), rows: result.results});
  } catch { return reply({error: 'Stats could not be loaded. Try Refresh in a moment. Your website and editor still work.'}, 503); }
}
