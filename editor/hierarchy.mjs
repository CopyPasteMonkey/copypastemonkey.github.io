// Read-only projection of the existing format. Legacy headings use levels in
// a flat list; section.blocks are explicit content. Do not rewrite either on load.
export const isHeading=block=>block?.type==='section'||block?.type==='heading';
export const levelName=level=>({4:'Main heading',5:'Subheading',6:'Nested subheading'}[level]);
export function outline(items){
 const roots=[],stack=[];
 for(const [index,block] of items.entries()){
  if(isHeading(block)){while(stack.length&&stack.at(-1).block.level>=block.level)stack.pop();}
  else if(stack.at(-1)?.block.type!=='heading')stack.length=0;
  const parent=stack.at(-1)||null,node={block,index,end:index,parent,children:[]};
  (parent?parent.children:roots).push(node);for(const ancestor of stack)ancestor.end=index;
  if(isHeading(block))stack.push(node);
 }
 return roots;
}
export function allNodes(nodes){return nodes.flatMap(node=>[node,...allNodes(node.children)]);}
export function headingSpan(items,node){return items.slice(node.index,node.end+1);}
function headings(blocks){return blocks.flatMap(b=>[...(isHeading(b)?[b]:[]),...(b.blocks?headings(b.blocks):[])]);}
export function canSetLevel(items,node,level){
 const delta=level-node.block.level;return Number.isInteger(level)&&level>=4&&level<=6&&headings(headingSpan(items,node)).every(b=>b.level+delta>=4&&b.level+delta<=6);
}
export function setLevel(items,node,level){
 if(!canSetLevel(items,node,level))throw Error('This heading has nested subheadings. Move those up a level first.');
 const delta=level-node.block.level;for(const block of headings(headingSpan(items,node)))block.level+=delta;
}
export function moveGroup(items,node,direction){
 const siblings=node.parent?node.parent.children:outline(items),index=siblings.findIndex(n=>n.block===node.block),next=siblings[index+direction];if(!next)return false;
 const count=node.end-node.index+1,to=direction<0?next.index:next.end+1-count;
 items.splice(to,0,...items.splice(node.index,count));return true;
}
export function removeGroup(items,node){return items.splice(node.index,node.end-node.index+1);}
export function setParent(items,node,parent,baseLevel=3){
 if(parent&&parent.index>=node.index&&parent.index<=node.end)throw Error('A heading cannot be moved inside itself.');
 const nextLevel=parent?parent.block.level+1:baseLevel+1;setLevel(items,node,nextLevel);
 let anchor=parent;if(!parent&&node.parent){anchor=node.parent;while(anchor.parent)anchor=anchor.parent;}
 const selected=removeGroup(items,node);
 const after=anchor?allNodes(outline(items)).find(n=>n.block===anchor.block)?.end+1:node.index;
 items.splice(after,0,...selected);
}
