// Read-only preview server. No filesystem or Git write endpoints.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=await fs.realpath('dist');const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.pdf':'application/pdf','.csv':'text/csv'};
http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`){res.writeHead(403);return res.end();}
  let pathname=decodeURIComponent(new URL(req.url,`http://127.0.0.1:${port}`).pathname);if(pathname.endsWith('/'))pathname+='index.html';
  const file=await fs.realpath(path.join(root,pathname));if(!file.startsWith(root+path.sep))throw Error();
  const body=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Read-only preview: http://127.0.0.1:${port}/editor/`));
