const endpoint = 'https://portfolio-editor-auth.elidoggart.workers.dev/collect';
const siteOrigin = 'https://www.elidoggart.com';
const campaignSources = new Set(['linkedin', 'github', 'resume', 'email', 'application', 'google', 'bing', 'duckduckgo']);
export function visitSource(href, referrer) {
  const url = new URL(href);
  const tag = (url.searchParams.get('utm_source') || url.searchParams.get('source') || '').toLowerCase();
  if (tag) return campaignSources.has(tag) ? tag : 'other-campaign';
  let host;
  try { host = new URL(referrer).hostname; } catch { return 'direct'; }
  if (['www.elidoggart.com', 'elidoggart.com'].includes(host)) return 'direct';
  for (const [domain, source] of [['linkedin.com', 'linkedin'], ['lnkd.in', 'linkedin'], ['github.com', 'github'], ['google.com', 'google'], ['bing.com', 'bing'], ['duckduckgo.com', 'duckduckgo']]) {
    if (host === domain || host.endsWith('.' + domain)) return source;
  }
  return 'other-website';
}

export function startStats(host = window) {
  const {document, location, navigator} = host;
  // No counters in the editor, guide, iframe previews, local builds or explicit test links.
  if (location.origin !== siteOrigin || !['/', '/index.html'].includes(location.pathname) ||
    host.top !== host || new URL(location.href).searchParams.has('preview') ||
    navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  const source = visitSource(location.href, document.referrer), counted = new Set();
  function count(event, target = '') {
    const key = event + ':' + target;
    if (counted.has(key)) return;
    counted.add(key);
    // No retries: ambiguous delivery must not turn one click into several counts.
    // Never delay or cancel navigation/downloads, even if the collector is unavailable.
    try { host.fetch(endpoint, {method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
      keepalive: true, headers: {'Content-Type': 'text/plain'}, body: JSON.stringify({event, source, target})}).catch(() => {}); } catch {}
  }
  const loaded = () => { if (document.visibilityState === 'visible' && !document.prerendering) count('visit'); };
  document.addEventListener('visibilitychange', loaded);
  document.addEventListener('prerenderingchange', loaded);
  document.addEventListener('click', event => {
    const target = event.target?.closest?.('a.resume-download, [data-view="work"] [data-expand]');
    if (!target) return;
    if (target.matches('a.resume-download')) count('resume');
    else if (target.getAttribute('aria-expanded') === 'false') count('work', target.dataset.expand);
  }, true);
  loaded();
}
if (typeof window !== 'undefined') startStats();
