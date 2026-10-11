import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validate,assertValid,safeURL} from '../lib/schema.mjs';
import {render} from '../lib/render.mjs';
import {validateAssets} from '../scripts/assets.mjs';
const current=JSON.parse(fs.readFileSync('content/portfolio.json')).portfolio;
const data=JSON.parse(fs.readFileSync('tests/fixtures/published-content.json')).portfolio;
const changed=fn=>{const d=structuredClone(data);fn(d);return d;};
test('the complete migrated content and every asset validate',async()=>{assert.deepEqual(validate(current),[]);await validateAssets(current,process.cwd());});
test('render is deterministic and retains exact published DOM',()=>{
 assert.equal(render(current),render(structuredClone(current)));const a=render(data);fs.mkdirSync('.local',{recursive:true});fs.writeFileSync('.local/generated.html',a);
 execFileSync('python3',['tests/parity.py','tests/fixtures/published.html','.local/generated.html']);
});
test('IDs and explicit media refs survive renaming and reordering',()=>{
 const d=changed(d=>{const work=d.sections[0];work.entries.reverse();work.entries.find(e=>e.id==='nimbus').title='Renamed employer';const roles=work.entries.find(e=>e.id==='nimbus').roles;roles.reverse();roles[1].blocks[1].title='Renamed section';});
 assertValid(d);const html=render(d);assert.match(html,/details-nimbus-internship/);assert.equal((html.match(/assets\/images\/nimbus-00.webp/g)||[]).length,2);
});
test('add/remove employers and role blocks through the controlled schema',()=>{const d=changed(d=>{const e=structuredClone(d.sections[0].entries[1]);e.id='new-employer';e.roles[0].id='new-employer';d.sections[0].entries.push(e);d.sections[0].entries.splice(3,1);});assertValid(d);assert.match(render(d),/entry-new-employer/);});
test('reject code fields, duplicate IDs, unknown refs, unsafe URLs and filenames',()=>{
 const cases=[d=>d.site.html='<script>',d=>d.sections[0].entries[1].id='nimbus',d=>d.sections[0].entries[1].roles[0].id='nimbus-current',d=>d.sections[0].entries[0].image[0].media='missing',d=>d.resources[0].url='javascript:alert(1)',d=>d.resources[0].url='//evil.test',d=>d.resources[0].url='https://trusted.test@evil.test',d=>d.media[0].src='assets/images/../../evil.webp',d=>d.media[0].width='900',d=>d.site.resume='https://evil.test/resume.pdf',d=>d.sections.push(d.sections[0]),d=>d.sections[0].entries[0].roles[0].blocks[0].type='html'];
 for(const mutate of cases)assert.ok(validate(changed(mutate)).length);
});
test('escape all authored text without interpreting markup',()=>{const html=render(changed(d=>d.site.name='<img src=x onerror=alert(1)>'));assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<img src=x/);});
test('reject excessive content and nesting',()=>{assert.ok(validate(changed(d=>d.site.name='x'.repeat(101))).length);const d=changed(d=>{let b=d.sections[0].entries[0].roles[0].blocks[0];for(let i=0;i<20;i++){b.blocks=[{type:'section',title:'Nested',level:4,chapter:false,blocks:[]}];b=b.blocks[0];}});assert.ok(validate(d).length);});
test('HTTPS links allow approved existing query strings and reject controls',()=>{assert.ok(safeURL(data.resources[1].url));for(const u of ['data:text/html,hi','http://example.com','https://x.test/\n','https:\\evil.test'])assert.equal(safeURL(u),false);});
