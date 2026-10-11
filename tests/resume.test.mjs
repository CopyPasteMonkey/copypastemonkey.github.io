import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PDFDocument,PDFName} from 'pdf-lib';
import {prepareResume,inspectPDF,verifyResume,isResumeUpload} from '../lib/pdf.mjs';
import {makeZip,readZip} from '../editor/drafts.mjs';
const original=new Uint8Array(await fs.readFile('assets/documents/Eli-Doggart-Resume.pdf'));
test('resume uploads preserve bytes and use a deterministic safe path',async()=>{
 const value=await prepareResume(new File([original],'Eli Resume.PDF',{type:'application/pdf'}));
 assert.equal(value.filename,'Eli-Resume.pdf');assert.equal(value.pages,1);assert.ok(isResumeUpload(value.src));assert.deepEqual(new Uint8Array(await value.blob.arrayBuffer()),original);assert.deepEqual(await verifyResume(value.src,value.blob),await inspectPDF(original));
 await assert.rejects(verifyResume('assets/documents/resume-'+ '0'.repeat(20)+'.pdf',value.blob),/stable filename/);
});
test('reject invalid, truncated, oversized and unsafe-name resume files',async()=>{
 for(const name of ['../resume.pdf','resume.html','<resume>.pdf','a'.repeat(129)+'.pdf'])await assert.rejects(prepareResume(new File([original],name)),/filename/);
 await assert.rejects(prepareResume(new File([new Uint8Array(5_000_001)],'large.pdf')),/5 MB/);
 for(const bytes of [new Uint8Array(),new TextEncoder().encode('<html>not PDF</html>'),original.slice(0,-40),new TextEncoder().encode('%PDF-1.7\nnot a document\n%%EOF')])await assert.rejects(inspectPDF(bytes));
});
test('reject active content and too many pages after parsing object streams',async()=>{
 const active=await PDFDocument.load(original);active.addJavaScript('bad','app.alert("no");');await assert.rejects(inspectPDF(await active.save()),/plain PDF/);
 const attached=await PDFDocument.load(original);await attached.attach(new Uint8Array([1,2,3]),'note.txt');await assert.rejects(inspectPDF(await attached.save()),/plain PDF/);
 const encrypted=await PDFDocument.load(original);encrypted.context.trailerInfo.Encrypt=encrypted.context.register(encrypted.context.obj({Filter:PDFName.of('Standard')}));await assert.rejects(inspectPDF(await encrypted.save()),/password-protected/);
 const many=await PDFDocument.load(original);for(let n=0;n<20;n++)many.addPage();await assert.rejects(inspectPDF(await many.save()),/1–20/);
});
test('portable draft packages retain the selected resume PDF exactly',async()=>{
 const info=await inspectPDF(original);const zip=await makeZip(new Map([['content/portfolio.json',new Blob(['{}'])],[info.src,new Blob([original])]]));const files=await readZip(zip);assert.equal(files.get(info.src).type,'application/pdf');assert.deepEqual(new Uint8Array(await files.get(info.src).arrayBuffer()),original);await verifyResume(info.src,files.get(info.src));
});
