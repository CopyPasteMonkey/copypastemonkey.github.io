import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {outline,allNodes,moveGroup,removeGroup,setLevel,setParent,canSetLevel} from '../editor/hierarchy.mjs';
import {render} from '../lib/render.mjs';
import {validate} from '../lib/schema.mjs';
const original=JSON.parse(fs.readFileSync('tests/fixtures/editor-content.json')).portfolio;
const section=(title,level,blocks=[])=>({type:'section',title,level,chapter:level===4,blocks});
const paragraph=text=>({type:'text',style:'body',text});

test('legacy Nimbus levels project real ownership without rewriting a single stored value',()=>{
 const data=structuredClone(original),before=render(data),items=data.sections[0].entries[0].roles[1].blocks,nodes=outline(items);
 const skills=nodes.find(n=>n.block.title==='Skills Developed');assert.deepEqual(skills.children.map(n=>n.block.title),['LabView','Wiring and Plumbing','Documentation']);
 const projects=nodes.find(n=>n.block.title==='Projects'),cart=projects.children.find(n=>n.block.title==='New 20 Cell Cart');assert.deepEqual(cart.children.map(n=>n.block.title),['Power Distribution Unit','8020 Frame']);
 assert.equal(nodes.at(-1).block.style,'source');assert.equal(nodes[0].block.style,'context');assert.deepEqual(data,original);assert.equal(render(data),before);
});
test('heading reordering moves the complete span and associated text and images',()=>{
 const data=structuredClone(original),items=data.sections[0].entries[0].roles[1].blocks,skills=outline(items).find(n=>n.block.title==='Skills Developed'),expected=items.slice(skills.index,skills.end+1);
 assert.equal(moveGroup(items,skills,1),true);assert.deepEqual(items.slice(-expected.length-1,-1),expected);assert.equal(items.at(-1).style,'source');assert.deepEqual(validate(data),[]);
});
test('removing a heading removes exactly its descendants and explicit content',()=>{
 const data=structuredClone(original),items=data.sections[0].entries[0].roles[1].blocks,skills=outline(items).find(n=>n.block.title==='Skills Developed');const removed=removeGroup(items,skills);assert.equal(removed.length,4);assert.equal(removed[1].blocks[1].type,'gallery');assert.equal(items[1].title,'Projects');assert.equal(items.at(-1).style,'source');assert.deepEqual(validate(data),[]);
});
test('parent changes retain content and update complete descendant heading levels within bounds',()=>{
 const items=[section('A',4),section('B',5,[paragraph('B text')]),section('C',6,[paragraph('C text')]),section('D',4)],nodes=allNodes(outline(items));
 assert.equal(canSetLevel(items,nodes[0],5),false);assert.throws(()=>setLevel(items,nodes[0],5));
 setParent(items,nodes[1],null);assert.deepEqual(items.map(b=>[b.title,b.level]),[['A',4],['B',4],['C',5],['D',4]]);
 const updated=allNodes(outline(items));setParent(items,updated.find(n=>n.block.title==='B'),updated.find(n=>n.block.title==='D'));assert.deepEqual(items.map(b=>[b.title,b.level]),[['A',4],['D',4],['B',5],['C',6]]);assert.equal(items[2].blocks[0].text,'B text');assert.equal(items[3].blocks[0].text,'C text');
});
test('standalone report headings own following citations and links; section bodies stay explicit',()=>{
 const items=[{type:'heading',title:'Report',level:5},{type:'citation',title:'A report',suffix:' by Eli'},{type:'resource',resource:'resource-7'},{type:'heading',title:'Next report',level:5},paragraph('Second report')];const nodes=outline(items);assert.equal(nodes.length,2);assert.deepEqual(nodes[0].children.map(n=>n.block.type),['citation','resource']);moveGroup(items,nodes[0],1);assert.equal(items[0].title,'Next report');assert.equal(items[2].title,'Report');
 const nested=[section('Outer',4,[section('Inner',5,[paragraph('Content')])])];assert.equal(outline(nested)[0].children.length,0);setLevel(nested,outline(nested)[0],5);assert.equal(nested[0].blocks[0].level,6);
});
