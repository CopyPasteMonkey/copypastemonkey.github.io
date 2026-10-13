import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

function digest(directory){
 const hash=createHash('sha256');
 function visit(folder){for(const name of fs.readdirSync(folder).sort()){const file=path.join(folder,name);if(fs.statSync(file).isDirectory())visit(file);else hash.update(path.relative(directory,file)).update(fs.readFileSync(file));}}
 visit(directory);return hash.digest('hex');
}

test('UI fixture builds cannot replace a separately edited deployment artifact',()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/editor-content.json'));
 const edited=structuredClone(fixture);edited.portfolio.site.name='Build isolation review';edited.portfolio.sections[0].entries.shift();
 fs.mkdirSync('.local',{recursive:true});const input='.local/build-isolation-content.json';fs.writeFileSync(input,JSON.stringify(edited));
 const env={...process.env,PORTFOLIO_CONTENT:path.resolve(input)};
 const build=(args=[],environment=env)=>execFileSync(process.execPath,['scripts/build.mjs',...args],{env:environment,stdio:'pipe'});
 try{
  build();const before=digest('dist');
  assert.equal(JSON.parse(fs.readFileSync('dist/content/portfolio.json')).portfolio.site.name,'Build isolation review');
  assert.doesNotMatch(fs.readFileSync('dist/index.html','utf8'),/id="entry-nimbus"/);
  build(['--browser-test']);
  assert.equal(digest('dist'),before,'UI tests must never overwrite the deployable website');
  assert.deepEqual(JSON.parse(fs.readFileSync('.local/browser-dist/content/portfolio.json')),fixture);
 }finally{
  const normal={...process.env};delete normal.PORTFOLIO_CONTENT;build([],normal);fs.unlinkSync(input);
 }
});
