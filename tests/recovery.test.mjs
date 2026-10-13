import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {validate,validateLocalDraft} from '../lib/schema.mjs';
import {render} from '../lib/render.mjs';
import {createRecovery,readableDraft} from '../editor/recovery.mjs';
import {loadLocalDraft} from '../editor/storage.mjs';
import {draftKey} from '../editor/drafts.mjs';
const original=JSON.parse(await fs.readFile('content/portfolio.json')).portfolio;
const memory=()=>{const values=new Map();return {get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('unfinished text and links survive local saving while public rendering stays strict',()=>{
 const portfolio=structuredClone(original);portfolio.site.name='';portfolio.site.email='unfinished@';portfolio.resources[0].url='javascript:alert(1)';portfolio.sections[0].entries[0].roles[0].blocks.push({type:'text',text:'',style:'body'},{type:'resource',resource:''});
 assert.deepEqual(validateLocalDraft(portfolio),[]);assert.ok(validate(portfolio).length);assert.throws(()=>render(portfolio));
 const storage=memory();storage.setItem(draftKey,JSON.stringify({portfolio}));assert.deepEqual(loadLocalDraft(storage,readableDraft).stored.portfolio,portfolio);
});
test('local draft tolerance does not admit broken structures, code fields, unsafe assets or IDs',()=>{
 for(const change of [p=>p.sections.pop(),p=>p.site=null,p=>p.sections[0].entries[0].roles=null,p=>p.media[0].src='../escape.png',p=>p.sections[0].entries[0].id='unsafe id',p=>p.site.html='<script>',p=>p.site.name='x'.repeat(101)]){
  const p=structuredClone(original);change(p);assert.equal(readableDraft({portfolio:p}),false);
 }
});
test('per-tab recovery preserves both interrupted drafts and never changes the saved draft',()=>{
 const storage=memory(),a=createRecovery(storage),b=createRecovery(storage),saved=JSON.stringify({portfolio:original});storage.setItem(draftKey,saved);
 const first={portfolio:structuredClone(original),savedAt:'2026-10-13T10:00:00Z'},second=structuredClone(first);first.portfolio.site.name='First tab';second.portfolio.site.name='Second tab';second.savedAt='2026-10-13T11:00:00Z';
 a.write(first);b.write(second);assert.equal(a.list().length,2);assert.equal(a.list()[0].value.portfolio.site.name,'Second tab');assert.equal(storage.getItem(draftKey),saved);
 const old=a.list()[1];first.portfolio.site.name='Newer first-tab edit';a.write(first);b.discard(old);assert.equal(b.list().length,2);b.clear();assert.equal(a.list().length,1);
});
test('full storage leaves the previous recovery copy intact',()=>{
 const storage=memory(),recovery=createRecovery(storage);recovery.write({portfolio:original});const before=recovery.list()[0].raw;
 storage.setItem=()=>{throw new DOMException('quota','QuotaExceededError');};assert.throws(()=>recovery.write({portfolio:original,savedAt:'later'}));assert.equal(recovery.list()[0].raw,before);
});
test('displaced GitHub and other-tab versions are available through the recovery list',()=>{
 const storage=memory(),recovery=createRecovery(storage);for(const key of ['portfolio-before-github-load','portfolio-before-local-overwrite'])storage.setItem(key,JSON.stringify({portfolio:original,savedAt:'2026-10-13T10:00:00Z'}));assert.equal(recovery.list().length,2);
});
