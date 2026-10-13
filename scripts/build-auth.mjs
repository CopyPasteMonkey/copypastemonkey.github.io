// One reproducible module for Cloudflare's dashboard upload; secrets stay in bindings.
import {build} from 'esbuild';
await build({entryPoints: ['auth/worker.mjs'], outfile: '.local/portfolio-editor-auth.mjs', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof'});
console.log('Built .local/portfolio-editor-auth.mjs. No deployment performed.');
