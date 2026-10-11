import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {blankEntry,editorData,validateDraft,unfinishedEntries,templateMetadata,readTemplateIDs} from '../editor/templates.mjs';
import {validate} from '../lib/schema.mjs';
import {render} from '../lib/render.mjs';
const baseline=JSON.parse(fs.readFileSync('content/portfolio.json')).portfolio;
function draft(){const data=structuredClone(baseline),entry=blankEntry(data);data.sections[0].entries.push(entry);return {data,entry,ids:new Set([entry.id])};}
test('blank templates contain no sample text and remain invalid for public rendering until completed',()=>{
 const {data,entry,ids}=draft();assert.equal(entry.title,'');assert.equal(entry.intro,'');assert.deepEqual(entry.image,[]);assert.deepEqual(entry.roles[0].blocks,[]);assert.ok(validate(data).length);assert.throws(()=>render(data));assert.deepEqual(validateDraft(data,ids),[]);assert.equal(unfinishedEntries(data,ids).length,1);assert.equal(editorData(data,ids,{visitor:true}).sections[0].entries.length,baseline.sections[0].entries.length);assert.equal(data.sections[0].entries.at(-1).title,'');
 entry.title='A company';entry.intro='Actual authored summary';assert.deepEqual(validate(data),[]);assert.deepEqual(editorData(data,ids),data);assert.equal(unfinishedEntries(data,ids).length,0);
});
test('incomplete draft allowance never bypasses reference, URL, ID, media, or existing-content validation',()=>{
 for(const mutate of [d=>d.sections[0].entries.at(-1).image.push({media:'missing',alt:'Image',caption:'',credit:'',linked:false,linkLabel:'',lazy:true}),d=>d.resources[0].url='javascript:alert(1)',d=>d.sections[0].entries[1].id='nimbus',d=>d.media[0].width='10',d=>d.sections[0].entries[0].title='',d=>d.site.html='<script>']){const {data,ids}=draft();mutate(data);assert.ok(validateDraft(data,ids).length);}
});
test('template markers round-trip separately from portfolio data; existing IDs stay unchanged',()=>{
 const {data,entry,ids}=draft(),metadata=templateMetadata(data,ids);assert.deepEqual(readTemplateIDs(metadata),ids);data.sections[0].entries.reverse();assert.equal(data.sections[0].entries[0].id,entry.id);assert.deepEqual(validateDraft(data,readTemplateIDs(metadata)),[]);assert.throws(()=>readTemplateIDs({version:1,templates:['nimbus']}));assert.deepEqual(readTemplateIDs(),new Set());assert.deepEqual(validateDraft(baseline,new Set()),[]);
});
