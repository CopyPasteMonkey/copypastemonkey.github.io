import {element} from './form.mjs';

const labels = {linkedin: 'LinkedIn', github: 'GitHub', resume: 'Résumé link', email: 'Email link', application: 'Job application link', google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', 'other-website': 'Other websites', 'other-campaign': 'Other tagged links', direct: 'Direct / unknown'};
const number = value => value.toLocaleString();
const table = (caption, columns, rows) => element('div', {class: 'stats-table-scroll'},
  element('table', {}, element('caption', {text: caption}),
    element('thead', {}, element('tr', {}, ...columns.map(text => element('th', {scope: 'col', text})))),
    element('tbody', {}, ...rows.map(row => element('tr', {}, ...row.map((text, index) => element(index ? 'td' : 'th', index ? {text: String(text)} : {scope: 'row', text: String(text)})))))));

export function createStats({getConfig, getNames, onSignIn}) {
  const opener = document.querySelector('#open-stats');
  if (!opener) return {setSession() {}, clearSession() {}};
  let session, controller, generation = 0, expiry;
  const dialog = element('dialog', {id: 'stats-dialog', 'aria-labelledby': 'stats-title'});
  const message = element('p', {class: 'stats-message', role: 'status', 'aria-live': 'polite'});
  const content = element('div', {class: 'stats-content'});
  const signIn = element('button', {type: 'button', class: 'primary', text: 'Sign in with GitHub to view stats'});
  const range = element('select', {'aria-label': 'Stats date range'}, ...[7, 30, 90].map(days => element('option', {value: String(days), text: `Last ${days} days`})));
  range.value = '30';
  const refresh = element('button', {type: 'button', text: 'Refresh stats', onclick: () => load()});
  const close = element('button', {type: 'button', text: 'Back to editor', onclick: () => dialog.close()});
  dialog.append(element('div', {class: 'stats-heading'}, element('h2', {id: 'stats-title', text: 'Website stats'}), close),
    element('p', {text: 'Simple totals. No visitor profiles or analytics cookies.'}),
    element('div', {class: 'stats-actions'}, element('label', {}, 'Show ', range), refresh, signIn), message, content,
    element('details', {class: 'stats-explanation'}, element('summary', {text: 'What these numbers mean'}),
      element('p', {text: 'A visit is one loaded page, including reloads. Each résumé link and work dropdown is counted at most once per page load. These are visits and clicks, not unique people. A download click does not prove the PDF was saved.'}),
      element('p', {text: 'Editor previews are excluded. Privacy settings, blockers and undetected bots can affect totals. Direct / unknown includes apps that hide the referring website. Dates use UTC.'}),
      element('p', {text: 'Use this link on LinkedIn to label its visits reliably: '}),
      element('a', {href: 'https://www.elidoggart.com/l', target: '_blank', rel: 'noopener', text: 'elidoggart.com/l'})));
  document.body.append(dialog);

  function cancel() { generation++; controller?.abort(); controller = null; refresh.disabled = false; range.disabled = false; }
  function signedOut(text = 'Sign in with your existing GitHub login to view private stats. Your draft stays here.') {
    cancel(); session = null; clearTimeout(expiry); content.replaceChildren(); signIn.hidden = false; refresh.hidden = true; range.disabled = true; message.textContent = text;
  }
  function show(report) {
    const totals = {visit: 0, resume: 0, work: 0}, sources = new Map(), jobs = new Map(), days = new Map();
    for (const row of report.rows) {
      if (!(row.event in totals) || !Number.isSafeInteger(row.count) || row.count < 0) throw Error('Stats returned an unexpected response. Try Refresh in a moment.');
      totals[row.event] += row.count;
      if (!sources.has(row.source)) sources.set(row.source, {visit: 0, resume: 0, work: 0});
      sources.get(row.source)[row.event] += row.count;
      if (!days.has(row.day)) days.set(row.day, {visit: 0, resume: 0, work: 0});
      days.get(row.day)[row.event] += row.count;
      if (row.event === 'work') jobs.set(row.target, (jobs.get(row.target) || 0) + row.count);
    }
    const nodes = [element('p', {class: 'stats-period', text: `${report.from} to ${report.to} · UTC${report.startedAt ? ' · Collection began ' + report.startedAt.slice(0, 10) : ''}`}),
      element('div', {class: 'stats-cards'}, ...[['visit', 'Visits'], ['resume', 'Résumé download clicks'], ['work', 'Work dropdown opens']].map(([key, label]) => element('div', {class: 'stats-card'}, element('span', {text: label}), element('strong', {text: number(totals[key])}))))];
    if (!report.rows.length) nodes.push(element('p', {class: 'stats-empty', text: 'No activity recorded in this period yet. Counts start when tracking is activated; earlier visits are not available.'}));
    if (sources.size) nodes.push(table('Where visits come from', ['Source', 'Visits', 'Résumé clicks', 'Work opens'], [...sources].sort((a, b) => b[1].visit - a[1].visit).map(([key, count]) => [labels[key] || 'Other', ...['visit', 'resume', 'work'].map(event => number(count[event]))])));
    const names = getNames();
    if (jobs.size) nodes.push(table('Work people open', ['Work entry / dropdown', 'Opens'], [...jobs].sort((a, b) => b[1] - a[1]).map(([id, count]) => [names.get(id) || id + ' (older entry)', number(count)])));
    if (days.size) nodes.push(element('details', {class: 'stats-daily'}, element('summary', {text: 'Daily totals'}), table('Days with recorded activity (UTC)', ['Date', 'Visits', 'Résumé clicks', 'Work opens'], [...days].sort((a, b) => b[0].localeCompare(a[0])).map(([date, count]) => [date, ...['visit', 'resume', 'work'].map(event => number(count[event]))]))));
    content.replaceChildren(...nodes);
    message.textContent = 'Updated ' + new Date(report.updatedAt).toLocaleTimeString() + '. Refresh to check for new activity.';
  }
  async function load() {
    cancel();
    if (!session || session.expiresAt <= Date.now()) { signedOut(); return; }
    const id = generation, auth = session, config = getConfig();
    controller = new AbortController(); const requestController = controller, signal = controller.signal;
    const timeout = setTimeout(() => requestController.abort(), 10000);
    refresh.hidden = false; refresh.disabled = true; range.disabled = true; signIn.hidden = true;
    content.replaceChildren(); message.textContent = 'Loading stats…';
    try {
      const result = await fetch(config.authOrigin + '/stats?days=' + range.value, {headers: {Authorization: 'Bearer ' + auth.statsToken}, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal});
      if (id !== generation) return;
      if (result.status === 401) { signedOut('Your stats sign-in expired. Sign in again; your draft is safe.'); return; }
      if (!result.ok) throw Error('Stats could not be loaded. Try Refresh in a moment. Your website and draft are unaffected.');
      const report = await result.json();
      if (id !== generation) return;
      if (!Array.isArray(report.rows)) throw Error('Stats could not be read. Try Refresh in a moment.');
      show(report);
    } catch (error) {
      if (id === generation) message.textContent = signal.aborted ? 'Stats took too long to load. Try Refresh. Your draft is safe.' : error.message;
    } finally {
      clearTimeout(timeout);
      if (id === generation) { refresh.disabled = false; range.disabled = false; controller = null; }
    }
  }
  opener.onclick = () => { dialog.showModal(); load(); };
  range.onchange = load;
  dialog.addEventListener('close', cancel);
  signIn.onclick = async () => {
    signIn.disabled = true; message.textContent = 'Complete GitHub sign-in in the popup. Your draft stays here.';
    try {
      const success = await onSignIn();
      if (session) await load();
      else message.textContent = success ? 'Stats sign-in is not available yet. Try signing in again after the service update.' : 'Sign-in was not completed. Try again when ready. Your draft stays here.';
    } catch { message.textContent = 'Sign-in was not completed. Try again when ready. Your draft stays here.'; }
    finally { signIn.disabled = false; }
  };
  signedOut();
  return {
    setSession(credentials) {
      if (!credentials.statsToken) { signedOut(); return; }
      session = {statsToken: credentials.statsToken, expiresAt: credentials.expiresAt};
      clearTimeout(expiry); expiry = setTimeout(() => signedOut('Your stats sign-in expired. Sign in again; your draft is safe.'), Math.max(0, credentials.expiresAt - Date.now()));
    },
    clearSession: signedOut
  };
}
