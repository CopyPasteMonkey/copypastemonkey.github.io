import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handle} from '../auth/worker.mjs';
import {handleStats} from '../auth/stats.mjs';
import {visitSource, startStats} from '../stats-client.mjs';

const now = () => Date.parse('2026-10-13T18:00:00Z');
const base = {AUTH_ORIGIN: 'https://auth.example.test', EDITOR_ORIGIN: 'https://www.elidoggart.com', CLIENT_ID: 'test', CLIENT_SECRET: 'inert-test-secret', COOKIE_KEY: 'inert-test-cookie-secret-at-least-32-characters', REPOSITORY_ID: '123', ALLOWED_USER_ID: '456'};
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync('auth/stats-schema.sql', 'utf8'));
  const STATS_DB = {prepare(sql) {
    const statement = db.prepare(sql);
    // D1 positional binding maps directly onto SQLite's numbered placeholders.
    let parameters = {};
    const query = {bind(...values) { parameters = Object.fromEntries(values.map((value, index) => [String(index + 1), value])); return query; },
      async run() { return statement.run(parameters); }, async all() { return {results: statement.all(parameters)}; }, async first() { return statement.get(parameters); }};
    return query;
  }};
  return {db, env: {...base, STATS_DB}};
}
const collect = (body = {event: 'visit', source: 'linkedin', target: ''}, headers = {}) => new Request(base.AUTH_ORIGIN + '/collect', {method: 'POST', headers: {Origin: base.EDITOR_ORIGIN, 'Content-Type': 'text/plain', ...headers}, body: typeof body === 'string' ? body : JSON.stringify(body)});
const read = (extra = '', token = 'read-only-test') => new Request(base.AUTH_ORIGIN + '/stats' + extra, {headers: {Origin: base.EDITOR_ORIGIN, Authorization: 'Bearer ' + token}});
const verify = async () => ({purpose: 'portfolio-stats', user: base.ALLOWED_USER_ID, issued: now() - 1000, expires: now() + 1000});

test('real SQLite increments atomic daily totals, separates source/action and filters UTC ranges', async () => {
  const {env, db} = database();
  for (let i = 0; i < 3; i++) assert.equal((await handle(collect(), env, {now})).status, 204);
  await handle(collect({event: 'resume', source: 'linkedin', target: ''}), env, {now});
  await handle(collect({event: 'work', source: 'github', target: 'nimbus'}), env, {now});
  await handle(collect(), env, {now: () => now() - 8 * 86400000});
  const res = await handleStats(read('?days=7'), env, {now, verify}), report = await res.json();
  assert.equal(res.headers.get('Cache-Control'), 'no-store'); assert.equal(res.headers.get('Set-Cookie'), null);
  assert.equal(report.from, '2026-10-07'); assert.equal(report.to, '2026-10-13'); assert.equal(report.rows.length, 3);
  assert.equal(report.rows.find(r => r.event === 'visit').count, 3);
  assert.equal((await (await handleStats(read('?days=30'), env, {now, verify})).json()).rows.length, 4);
  assert.deepEqual(db.prepare('PRAGMA table_info(daily_stats)').all().map(r => r.name), ['day', 'event', 'source', 'target', 'count']);
  db.close();
});

test('invalid origins, events, extra personal data and oversized bodies never write', async () => {
  const {env, db} = database();
  for (const request of [collect(undefined, {Origin: 'https://evil.test'}), collect({...{event: 'visit', source: 'linkedin', target: ''}, email: 'never-store@example.test'}), collect({event: 'other', source: 'linkedin', target: ''}), collect({event: 'visit', source: 'unknown', target: ''}), collect({event: 'work', source: 'direct', target: '<script>'}), collect('x'.repeat(513)), collect(undefined, {'Content-Type': 'image/png'})]) {
    assert.ok((await handle(request, env, {now})).status >= 400);
  }
  assert.equal(db.prepare('SELECT count(*) AS count FROM daily_stats').get().count, 0); db.close();
});

test('known bots and privacy opt-outs do not count; database failures are recoverable and expose no details', async () => {
  const {env, db} = database();
  for (const headers of [{'User-Agent': 'LinkedInBot'}, {DNT: '1'}, {'Sec-GPC': '1'}]) assert.equal((await handle(collect(undefined, headers), env, {now})).status, 204);
  assert.equal(db.prepare('SELECT count(*) AS count FROM daily_stats').get().count, 0); db.close();
  const unavailable = {...base, STATS_DB: {prepare() { throw Error('secret database internals'); }}};
  for (const request of [collect(), read()]) {
    const result = await handleStats(request, unavailable, {now, verify}); assert.equal(result.status, 503); assert.doesNotMatch(await result.text(), /secret|internals/);
  }
});

test('private stats reject unauthenticated, expired, wrong-purpose and wrong-user sessions', async () => {
  const {env, db} = database();
  assert.equal((await handle(read(), env, {now})).status, 401);
  for (const changes of [{purpose: 'oauth'}, {user: '999'}, {expires: now()}, {issued: now() + 1}, {expires: now() + 28800001}]) {
    assert.equal((await handleStats(read(), env, {now, verify: async () => ({...await verify(), ...changes})})).status, 401);
  }
  for (const query of ['?days=999', '?days=7&days=30', '?token=secret']) assert.equal((await handleStats(read(query), env, {now, verify})).status, 400);
  db.close();
});

test('OAuth produces a separate read-only stats capability; GitHub token and OAuth cookie cannot read stats', async () => {
  const {env, db} = database();
  const start = await handle(new Request(base.AUTH_ORIGIN + '/auth'), env, {now});
  const cookie = start.headers.get('Set-Cookie').split(';')[0];
  const state = new URL(start.headers.get('Location')).searchParams.get('state');
  const fetcher = async url => Response.json(url.includes('access_token') ? {access_token: 'inert-github-token', expires_in: 3600} : url.endsWith('/user') ? {id: 456} : {id: 123, permissions: {push: true}});
  const callback = await handle(new Request(base.AUTH_ORIGIN + '/callback?code=inert&state=' + state, {headers: {Cookie: cookie}}), env, {now, fetcher});
  assert.equal(callback.status, 200);
  const token = JSON.parse((await callback.text()).match(/target\.postMessage\((\{"type":"portfolio:authorized".*?\}),origin\)/)[1]).statsToken;
  assert.notEqual(token, 'inert-github-token');
  assert.equal((await handle(read('', token), env, {now})).status, 200);
  for (const invalid of ['inert-github-token', cookie.split('=')[1], token + 'x']) assert.equal((await handle(read('', invalid), env, {now})).status, 401);
  assert.equal((await handle(read('', token), env, {now: () => now() + 3600000})).status, 401);
  db.close();
});

test('source labels discard raw URLs and query strings and explicit tags survive missing referrers', () => {
  assert.equal(visitSource(base.EDITOR_ORIGIN + '/?utm_source=linkedin', ''), 'linkedin');
  assert.equal(visitSource(base.EDITOR_ORIGIN, 'https://www.linkedin.com/in/private-path?token=secret'), 'linkedin');
  assert.equal(visitSource(base.EDITOR_ORIGIN, 'https://linkedin.com.evil.test/'), 'other-website');
  assert.equal(visitSource(base.EDITOR_ORIGIN + '/?utm_source=someone@example.test', ''), 'other-campaign');
  assert.equal(visitSource(base.EDITOR_ORIGIN, ''), 'direct');
});

test('public counter is cookie-free, deduplicates within a load, excludes previews and swallows delivery failures', async () => {
  const events = {}, sent = [], document = {referrer: '', visibilityState: 'visible', addEventListener: (name, callback) => events[name] = callback};
  const host = {document, location: new URL(base.EDITOR_ORIGIN + '/?utm_source=linkedin'), navigator: {}, fetch(url, options) {sent.push([url, options]); return Promise.reject(Error('offline'));}};
  host.top = host; startStats(host); events.visibilitychange();
  const target = {matches: () => true}; events.click({target: {closest: () => target}}); events.click({target: {closest: () => target}});
  await Promise.resolve();
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map(([, options]) => JSON.parse(options.body).event), ['visit', 'resume']);
  assert.ok(sent.every(([, options]) => options.credentials === 'omit' && options.referrerPolicy === 'no-referrer'));
  for (const url of ['http://127.0.0.1:4175/', base.EDITOR_ORIGIN + '/editor/', base.EDITOR_ORIGIN + '/?preview=1']) startStats({...host, location: new URL(url)});
  startStats({...host, top: {}}); assert.equal(sent.length, 2);
});
