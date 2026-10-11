import fs from 'node:fs/promises';import {schema} from '../lib/schema.mjs';
await fs.writeFile('content/schema.json',JSON.stringify(schema,null,2)+'\n');
