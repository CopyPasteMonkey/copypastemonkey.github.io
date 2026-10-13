import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const portfolio = JSON.parse(fs.readFileSync('tests/fixtures/editor-content.json')).portfolio;
const authOrigin = 'https://portfolio-editor-auth.elidoggart.workers.dev';
const config = {enabled: true, repository: 'elidoggart/elidoggart.github.io', branch: 'main', repositoryId: 1412250381, allowedUserId: 183743177, editorOrigin: 'http://127.0.0.1:4175', authOrigin, requiredCheck: 'validate'};
const report = {from: '2026-09-14', to: '2026-10-13', days: 30, startedAt: '2026-10-13T17:00:00Z', updatedAt: '2026-10-13T18:00:00Z', rows: [
  {day: '2026-10-13', event: 'visit', source: 'linkedin', target: '', count: 12},
  {day: '2026-10-13', event: 'resume', source: 'linkedin', target: '', count: 3},
  {day: '2026-10-13', event: 'work', source: 'linkedin', target: portfolio.sections.find(s => s.id === 'work').entries[0].roles[0].id, count: 2}]};

async function mockLogin(context, {cancel = false} = {}) {
  await context.route('**/editor/publishing.json', route => route.fulfill({json: config}));
  await context.route(authOrigin + '/auth', route => route.fulfill({contentType: 'text/html', body: cancel ? '<p>Mock sign-in cancellation</p>' : `<script>const parent=window.opener;addEventListener('message',e=>{if(e.source===parent&&e.origin==='http://127.0.0.1:4175'&&e.data.type==='portfolio:ack'){parent.postMessage({type:'portfolio:authorized',provider:'github',token:'inert-github-token',statsToken:'inert-read-only-stats-token',expiresAt:Date.now()+3600000},e.origin);window.close();}});parent.postMessage({type:'portfolio:ready'},'http://127.0.0.1:4175');</script>`}));
  await context.route('https://api.github.com/**', route => {
    const request = route.request(), url = new URL(request.url()); expect(request.method()).toBe('GET');
    expect(request.headers().authorization).toBe('Bearer inert-github-token');
    let value;
    if (url.pathname === '/user') value = {id: config.allowedUserId};
    else if (url.pathname === '/repositories/' + config.repositoryId) value = {id: config.repositoryId, full_name: config.repository, private: false, permissions: {push: true}};
    else if (url.pathname.endsWith('/branches/main')) value = {commit: {sha: '1'.repeat(40)}};
    else if (url.pathname.endsWith('/pulls')) value = [];
    else if (url.pathname.endsWith('/contents/content/portfolio.json')) value = {encoding: 'base64', size: 100000, content: Buffer.from(JSON.stringify({portfolio})).toString('base64')};
    else throw Error('Unexpected request ' + url.pathname);
    return route.fulfill({json: value});
  });
}
async function statsRoute(context, respond) {
  await context.route(authOrigin + '/stats?*', route => {
    const headers = {'Access-Control-Allow-Origin': config.editorOrigin, 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Allow-Methods': 'GET'};
    if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers});
    expect(route.request().headers().authorization).toBe('Bearer inert-read-only-stats-token');
    return respond(route, headers);
  });
}
async function openSignedIn(page) {
  await page.getByRole('button', {name: 'Stats', exact: true}).click();
  await page.getByRole('button', {name: 'Sign in with GitHub to view stats', exact: true}).click();
}

test('Stats shares login, preserves unsaved edits, renders totals and clears on sign-out', async ({page, context}) => {
  await mockLogin(context); await statsRoute(context, (route, headers) => route.fulfill({json: report, headers}));
  await page.goto('/editor/');
  await page.getByRole('button', {name: 'Site & contact', exact: true}).click();
  await page.getByRole('textbox', {name: 'Name', exact: true}).fill('Unsaved stats test');
  await openSignedIn(page);
  const dialog = page.getByRole('dialog', {name: 'Website stats'});
  await expect(dialog.locator('.stats-card').first()).toHaveText('Visits12');
  await expect(dialog.getByRole('table', {name: 'Where visits come from'})).toContainText('LinkedIn1232');
  await expect(dialog.getByRole('table', {name: 'Work people open'})).toBeVisible();
  await dialog.screenshot({path: '.local/stats-desktop.png'});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', {name: 'Name', exact: true})).toHaveValue('Unsaved stats test');
  await expect(page.locator('#draft-state')).toHaveText('Unsaved changes');
  expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(v => v.includes('inert-read-only') || v.includes('inert-github')))).toBe(false);
  await page.getByRole('button', {name: 'Sign out', exact: true}).click();
  await page.getByRole('button', {name: 'Stats', exact: true}).click();
  await expect(dialog.locator('.stats-card')).toHaveCount(0);
  await expect(dialog.getByRole('button', {name: 'Sign in with GitHub to view stats'})).toBeVisible();
});

test('failed stats can retry, empty ranges are honest, mobile fits and expired login can recover', async ({page, context}) => {
  let status = 503, rows = report.rows; const queries = [];
  await mockLogin(context); await statsRoute(context, (route, headers) => {queries.push(new URL(route.request().url()).search); return route.fulfill({status, json: {...report, rows}, headers});});
  await page.setViewportSize({width: 390, height: 844}); await page.goto('/editor/'); await openSignedIn(page);
  const dialog = page.getByRole('dialog', {name: 'Website stats'});
  await expect(dialog).toContainText('Stats could not be loaded. Try Refresh');
  await expect(dialog.locator('.stats-card')).toHaveCount(0);
  status = 200; await page.getByRole('button', {name: 'Refresh stats'}).click();
  await expect(dialog.locator('.stats-card').first()).toHaveText('Visits12');
  await dialog.screenshot({path: '.local/stats-mobile.png'});
  rows = []; await page.getByLabel('Stats date range').selectOption('7');
  await expect(dialog).toContainText('No activity recorded in this period yet');
  expect(queries.at(-1)).toBe('?days=7');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  status = 401; await page.getByRole('button', {name: 'Refresh stats'}).click();
  await expect(dialog).toContainText('Your stats sign-in expired');
  await expect(dialog.locator('.stats-card')).toHaveCount(0);
  status = 200; await page.getByRole('button', {name: 'Sign in with GitHub to view stats'}).click();
  await expect(dialog).toContainText('No activity recorded in this period yet');
});

test('cancelled Stats sign-in keeps the editor and unsaved work usable', async ({page, context}) => {
  await mockLogin(context, {cancel: true}); await page.goto('/editor/');
  await page.getByRole('button', {name: 'Site & contact', exact: true}).click();
  await page.getByRole('textbox', {name: 'Name', exact: true}).fill('Keep this draft');
  await page.getByRole('button', {name: 'Stats', exact: true}).click();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', {name: 'Sign in with GitHub to view stats'}).click();
  const popup = await popupPromise; await expect(popup.getByText('Mock sign-in cancellation')).toBeVisible(); await popup.close();
  await expect(page.getByRole('dialog', {name: 'Website stats'})).toContainText('Sign-in was not completed. Try again when ready.');
  await page.getByRole('button', {name: 'Back to editor'}).click();
  await expect(page.getByRole('textbox', {name: 'Name', exact: true})).toHaveValue('Keep this draft');
});

test('public LinkedIn link counts without blocking downloads or keyboard interactions, and previews send nothing', async ({page, context}) => {
  const sent = [];
  await context.route(authOrigin + '/collect', route => {sent.push(route.request().postDataJSON()); return route.abort();});
  // Serve the actual built files on the production-shaped origin, intercepting every request.
  await context.route('https://www.elidoggart.com/**', route => {
    let pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    if (pathname === '/l') pathname = '/l/index.html';
    const root = path.resolve('.local/browser-dist'), file = path.resolve(root, '.' + pathname);
    expect(file.startsWith(root + path.sep)).toBe(true);
    const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf'};
    return route.fulfill({body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream'});
  });
  await page.goto('https://www.elidoggart.com/l'); await expect(page).toHaveURL(/utm_source=linkedin/);
  await expect.poll(() => sent.filter(e => e.event === 'visit').length).toBe(1);
  const work = page.locator('[data-view="work"] [data-expand]').first();
  await work.focus(); await page.keyboard.press('Enter'); await expect(work).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  const download = page.waitForEvent('download'); await page.locator('.resume-download').click(); await download;
  await expect.poll(() => sent.length).toBe(3);
  expect(sent.map(e => e.source)).toEqual(['linkedin', 'linkedin', 'linkedin']);
  expect(sent.map(e => e.event)).toEqual(['visit', 'work', 'resume']);
  await page.goto('https://www.elidoggart.com/?preview=1'); await page.locator('[data-view="work"] [data-expand]').first().click();
  await page.goto('/editor/'); await page.getByRole('button', {name: 'Preview website', exact: true}).click();
  await page.frameLocator('#preview').locator('[data-view="work"] [data-expand]').first().click();
  expect(sent.length).toBe(3);
});
