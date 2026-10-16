// vCard 3.0 keeps the photo embedded so it travels with the saved contact.
const escapeText=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line){
 const lines=[];let current='',bytes=0;
 for(const char of line){const size=Buffer.byteLength(char,'utf8');if(bytes+size>75){lines.push(current);current=' ';bytes=1;}current+=char;bytes+=size;}
 lines.push(current);return lines.join('\r\n');
}
export function createContact({firstName,lastName,email,phone,website,photo}){
 if(!photo?.length)throw Error('A contact portrait is required.');
 const lines=['BEGIN:VCARD','VERSION:3.0',`N:${escapeText(lastName)};${escapeText(firstName)};;;`,`FN:${escapeText(firstName+' '+lastName)}`,`EMAIL;TYPE=INTERNET:${escapeText(email)}`,`TEL;TYPE=CELL:${escapeText(phone)}`,`URL:${escapeText(website)}`,`PHOTO;ENCODING=b;TYPE=JPEG:${Buffer.from(photo).toString('base64')}`,'END:VCARD'];
 return lines.map(fold).join('\r\n')+'\r\n';
}
