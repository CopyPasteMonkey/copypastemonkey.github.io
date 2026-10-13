import {PDFDocument,PDFDict,PDFArray,PDFName,PDFStream} from 'pdf-lib';
export const maxResumeBytes=5_000_000;
export const isResumeUpload=path=>/^assets\/documents\/resume-[a-f0-9]{20}\.pdf$/.test(path);
export const isImageUpload=path=>/^assets\/images\/upload-[a-f0-9]{20}\.(webp|png)$/.test(path);
// Canvas falls back to PNG on browsers without a WebP encoder.
export const imageUploadType=path=>path.endsWith('.png')?'image/png':'image/webp';
export function matchesImageUpload(path,bytes,hash){
 const png=[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 return bytes.length<=2_000_000&&isImageUpload(path)&&path==='assets/images/upload-'+hash+(png?'.png':webp?'.webp':'');
}
export const assetPaths=data=>[...data.media.map(m=>m.src),data.site.resume];
export async function inspectPDF(bytes){
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>maxResumeBytes)throw Error('Choose a PDF smaller than 5 MB.');
 if(!/^%PDF-(1\.[0-7]|2\.0)/.test(new TextDecoder().decode(bytes.slice(0,8)))||!new TextDecoder().decode(bytes.slice(-1024)).trimEnd().endsWith('%%EOF'))throw Error('This file is not a complete PDF. Export it as PDF and try again.');
 let doc;try{doc=await PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true});}catch{throw Error('This PDF could not be read or is password-protected. Export an unprotected PDF and try again.');}
 const pages=doc.getPageCount();if(pages<1||pages>20)throw Error('Use a resume PDF with 1–20 pages.');
 const blocked=new Set(['JavaScript','JS','AA','Launch','EmbeddedFiles','EmbeddedFile','Filespec','RichMedia','XFA','AcroForm','SubmitForm','ImportData','GoToR','GoToE','Rendition','Movie','Sound']);
 const seen=new Set();let count=0;
 function inspect(value){
  if(!value||seen.has(value))return;seen.add(value);if(++count>100000)throw Error('This PDF is too complex. Export a simpler PDF.');
  if(value instanceof PDFName&&blocked.has(value.decodeText()))throw Error('Use a plain PDF without scripts, attachments, or interactive forms.');
  if(value instanceof PDFDict)for(const [key,item] of value.entries()){inspect(key);inspect(item);}
  else if(value instanceof PDFArray)for(const item of value.asArray())inspect(item);
  else if(value instanceof PDFStream)inspect(value.dict);
 }
 for(const [,value] of doc.context.enumerateIndirectObjects())inspect(value);
 for(const page of doc.getPages()){const {width,height}=page.getSize();if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>14400||height>14400)throw Error('This PDF has invalid page dimensions.');}
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);
 return {pages,src:'assets/documents/resume-'+hash+'.pdf'};
}
export async function prepareResume(file){
 if(typeof file.name!=='string'||file.name.length>128||!/^[A-Za-z0-9][A-Za-z0-9._ -]*\.pdf$/i.test(file.name))throw Error('Choose a .pdf filename with letters, numbers, spaces, dots, underscores or hyphens (up to 128 characters).');
 if(file.size>maxResumeBytes)throw Error('Choose a PDF smaller than 5 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),info=await inspectPDF(bytes);
 return {...info,filename:file.name.replace(/ /g,'-').replace(/\.pdf$/i,'.pdf'),blob:new Blob([bytes],{type:'application/pdf'})};
}
export async function verifyResume(path,blob){const info=await inspectPDF(new Uint8Array(await blob.arrayBuffer()));if(path!==info.src)throw Error('Resume bytes do not match their stable filename.');return info;}
