import {defineConfig} from '@playwright/test';
const browser=process.env.TEST_BROWSER||'chromium';
export default defineConfig({
 testDir:'tests/browser',outputDir:'test-results/'+browser,
 snapshotPathTemplate:'.local/visual-baselines/'+browser+'/{testFilePath}/{arg}{ext}',
 fullyParallel:false,workers:1,timeout:45000,
 use:{browserName:browser,baseURL:'http://127.0.0.1:4175',viewport:{width:1440,height:1000},screenshot:'only-on-failure'},
 // A dedicated fixture server keeps regression examples separate from real edits.
 webServer:{command:'node scripts/build.mjs --browser-test && node scripts/serve.mjs --browser-test',url:'http://127.0.0.1:4175/editor/',reuseExistingServer:false},
 reporter:'list'
});
