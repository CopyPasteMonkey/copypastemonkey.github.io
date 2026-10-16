import {schema,blank} from '../lib/schema.mjs';
import {element,confirmRemoval} from './form.mjs';
import {outline,allNodes,isHeading,levelName,canSetLevel,setLevel,moveGroup,removeGroup,setParent} from './hierarchy.mjs';

const names={section:'Heading with content',heading:'Heading only',text:'Paragraph',gallery:'Photo gallery',figure:'Image',resources:'Links & downloads group',resource:'Link',citation:'Citation',list:'Bullet list'};
const textStyles={body:'Regular paragraph',note:'Note / coming soon',source:'Source / credit note',context:'Context line',italic:'Italic paragraph'};
const galleryLayouts={grid:'Side-by-side images',single:'Single wide image',photos:'Photography grid'};
const figureLayouts={plain:'Standard image',chart:'Wide chart',code:'Narrow image / code sample'};

export function createContentTree({getData,mount,imageEditor,photoList,prepareBlock,changed,settle,status,mediaURL}){
 const expanded=new WeakMap(),settingsExpanded=new WeakMap();
 const button=(text,onclick,extra={})=>{const icon=text==='Move up'?'↑':text==='Move down'?'↓':text.startsWith('Add ')?'+':'';return element('button',{type:'button',onclick,class:text.startsWith('Add ')?'content-add-button':text==='Remove'?'remove-button':'',...extra},icon?element('span',{class:'action-icon','aria-hidden':'true',text:icon}):null,element('span',{text}));};
 function choice(label,value,options,onChange,path){
  const select=element('select',{'aria-label':label,'data-path':path});
  for(const [v,text] of Object.entries(options))select.append(element('option',{value:v,text}));select.value=String(value);select.onchange=()=>onChange(select.value);
  return element('label',{class:'field'},element('span',{text:label}),select);
 }
 function list(host,items,path,{baseLevel=3,label='Content',notify=changed,allowHeadings=true}={}){
  host.classList.add('content-tree');host.dataset.path=path;
  function draw(focusBlock){
   host.replaceChildren();const roots=outline(items),nodes=allNodes(roots);
   const focus=block=>host.querySelectorAll('.content-node').forEach(el=>{if(el._block===block)el.querySelector('summary').focus();});
   const action=fn=>{try{settle();fn();notify();draw();}catch(e){status(e.message,true);}};
   async function add(type,{after=null,at,level=baseLevel+1}={}){
    if(items.length>=100)return;
    let value=blank(schema.$defs.block.oneOf.find(b=>b.properties.type.const===type));
    if(isHeading(value)){value.level=Math.min(6,level);if(value.type==='section')value.chapter=level===4;}
    value=await prepareBlock(value);if(!value)return;
    items.splice(at??(after?after.end+1:items.length),0,value);expanded.set(value,true);notify();draw(value);
   }
   const addRow=(target,{under=null,content=true}={})=>{
    const row=element('div',{class:'content-add-row'});
    if(under){if(under.block.level<6)row.append(button('Add subheading',()=>add('section',{after:under,level:under.block.level+1}),{disabled:items.length>=100}));}
    else{
     if(allowHeadings&&baseLevel<6)row.append(button('Add heading',()=>add('section'),{disabled:items.length>=100}));
     if(content){const select=element('select',{'aria-label':'Content type'});for(const type of ['text','gallery','figure','list','resource','resources','citation','heading','section']){
      if((baseLevel>=6||!allowHeadings)&&['section','heading'].includes(type))continue;select.append(element('option',{value:type,text:names[type]}));
     }row.append(select,button('Add content',()=>add(select.value),{disabled:items.length>=100}));}
    }
    target.append(row);
   };
   function renderNode(node,target){
    const b=node.block,p=path+'['+node.index+']',heading=isHeading(b),kind=heading?levelName(b.level):names[b.type];
    const details=element('details',{class:'content-node item '+(heading?'heading-node level-'+b.level:'body-node'), 'data-path':p,'data-kind':b.type,'data-level':heading?b.level:undefined});details._block=b;
    const summary=element('summary'),badge=element('span',{class:'content-kind',text:kind}),title=element('span',{class:'content-title'}),count=element('span',{class:'content-count'}),context=element('span',{class:'content-context'}),thumbs=element('span',{class:'content-thumbnails','aria-hidden':'true'}),caption=element('span',{class:'content-caption'},badge,title,context);summary.append(caption,thumbs,count);details.append(summary);let thumbnailKey;
    const updateSummary=()=>{badge.textContent=b.type==='text'?textStyles[b.style]:kind;title.textContent=heading?(b.title||'Untitled '+kind.toLowerCase()):b.type==='text'?(b.text.trim().slice(0,90)||'Empty paragraph'):b.type==='resource'?(getData().resources.find(r=>r.id===b.resource)?.label||'Choose a link'):b.type==='citation'?(b.title||'Untitled citation'):b.type==='gallery'?b.images.length+' '+(b.images.length===1?'image':'images'):b.type==='figure'?(b.image.alt||'Image description'):b.type==='list'?b.items.length+' bullet points':'Grouped links and headings';const headings=node.children.filter(n=>isHeading(n.block)).length;count.textContent=headings?headings+' '+(headings===1?'subheading':'subheadings'):node.children.length?node.children.length+' items':'';count.hidden=!count.textContent;context.textContent=heading&&node.parent?'Under '+(node.parent.block.title||'untitled heading'):'';context.hidden=!context.textContent;const images=b.type==='gallery'?b.images:b.type==='figure'?[b.image]:[];const key=images.slice(0,3).map(i=>i.media).join('|');if(key!==thumbnailKey){thumbnailKey=key;thumbs.replaceChildren(...images.slice(0,3).map(image=>{const media=getData().media.find(m=>m.id===image.media);return element('img',{src:media?mediaURL(media.src):'',alt:'',loading:'lazy'});}));}thumbs.hidden=!images.length;};details._refreshSummary=updateSummary;updateSummary();
    const ownChanged=()=>{for(const item of host.querySelectorAll('.content-node'))item._refreshSummary?.();notify();};let built=false;
    const fill=()=>{
     if(built)return;built=true;const body=element('div',{class:'content-body item-body'}),controls=element('div',{class:'item-actions'}),siblings=node.parent?node.parent.children:roots,position=siblings.indexOf(node);
     if(heading)controls.prepend(element('span',{class:'move-hint',text:'Move with its content'}));
     controls.append(button('Move up',()=>{action(()=>moveGroup(items,node,-1));focus(b);},{disabled:position===0,'aria-label':'Move '+(b.title||kind)+' up'}),button('Move down',()=>{action(()=>moveGroup(items,node,1));focus(b);},{disabled:position===siblings.length-1,'aria-label':'Move '+(b.title||kind)+' down'}),button('Remove',async()=>{if(!await confirmRemoval(b.title||kind,heading?'This removes the heading and all its text, images and subheadings. Undo can restore them.':undefined))return;action(()=>removeGroup(items,node));host.querySelector('summary,button')?.focus();},{'aria-label':'Remove '+(b.title||kind)}));body.append(controls);
     if(heading){
      const settings=element('details',{class:'heading-settings'},element('summary',{text:'Edit heading & placement'}));if(settingsExpanded.get(b)??!node.children.some(n=>isHeading(n.block)))settings.open=true;settings.addEventListener('toggle',()=>settingsExpanded.set(b,settings.open));body.append(settings);const fields=element('div');settings.append(fields);mount(fields,b,{type:'object',properties:{title:schema.$defs.block.oneOf.find(d=>d.properties.type.const===b.type).properties.title}},p,{labels:{title:'Heading text'},onChange:ownChanged});
      const levels={};for(let level=4;level<=6;level++)if(level>baseLevel&&canSetLevel(items,node,level))levels[level]=levelName(level);if(!levels[b.level])levels[b.level]=levelName(b.level);
      settings.append(choice('Heading level',b.level,levels,value=>{action(()=>setLevel(items,node,Number(value)));focus(b);},p+'.level'));
      const parents={'':'No parent heading in this section'};for(const candidate of nodes)if(isHeading(candidate.block)&&candidate.block.level<6&&(candidate.index<node.index||candidate.index>node.end)&&canSetLevel(items,node,candidate.block.level+1))parents[candidate.index]='Under '+(candidate.block.title||'Untitled heading');
      settings.append(choice('Parent heading',node.parent?.index??'',parents,value=>{action(()=>setParent(items,node,value===''?null:nodes.find(n=>n.index===Number(value)),baseLevel));focus(b);},p+'.parent'));
      settings.append(element('p',{class:'help',text:'Moving a heading also moves its paragraphs, images and lower headings. Subheadings appear indented below their parent.'}));
      if(b.type==='section'){
       settings.append(choice('Section format',String(b.chapter),{false:'Content section with a divider',true:'Group heading'},value=>{b.chapter=value==='true';ownChanged();},p+'.chapter'));
       settings.append(choice('Text and image layout',b.layout||'stacked',{stacked:'Stacked',split:'Text beside images'},value=>{b.layout=value;ownChanged();},p+'.layout'));
       const content=element('div',{class:'heading-content'});if(!b.blocks.length&&node.children.length){const intro=element('details',{class:'heading-intro'},element('summary',{text:'Add introductory text or images'}),content);body.append(intro);}else body.append(element('h4',{class:'content-owner',text:'Text & images'}),content);list(content,b.blocks,p+'.blocks',{baseLevel:b.level,label:b.title||'this heading',notify:ownChanged,allowHeadings:false});
      }else body.append(element('p',{class:'help',text:'A heading without a section wrapper. The items below belong to this heading until the next heading at this level.'}));
     }else if(b.type==='text'){
      mount(body.appendChild(element('div')),b,{type:'object',properties:{text:schema.$defs.block.oneOf.find(d=>d.properties.type.const==='text').properties.text}},p,{onChange:ownChanged});body.append(choice('Text format',b.style,textStyles,value=>{b.style=value;ownChanged();},p+'.style'));
     }else if(b.type==='gallery'){
      body.append(choice('Image arrangement',b.layout,galleryLayouts,value=>{b.layout=value;ownChanged();},p+'.layout'),photoList(b.images,p+'.images',ownChanged,{min:1,max:100}));
     }else if(b.type==='figure'){
      body.append(choice('Image format',b.layout,figureLayouts,value=>{b.layout=value;ownChanged();},p+'.layout'),imageEditor(b.image,p+'.image',ownChanged));
     }else if(b.type==='resources'){
      body.append(element('p',{class:'help',text:'A grouped area for report headings, citations and download links.'}));const content=element('div');body.append(content);list(content,b.blocks,p+'.blocks',{baseLevel,label:'Links & downloads',notify:ownChanged});
     }else{
      const def=schema.$defs.block.oneOf.find(d=>d.properties.type.const===b.type);mount(body.appendChild(element('div')),b,def,p,{onChange:ownChanged});
     }
     if(heading){
      const children=element('div',{class:'heading-children','aria-label':'Under '+(b.title||'untitled heading')});for(const child of node.children)renderNode(child,children);if(node.children.length)body.append(element('h4',{class:'content-owner subheading-label',text:node.children.some(n=>isHeading(n.block))?'Subheadings':'Content'}));body.append(children);addRow(body,{under:node});
      if(b.type==='heading'){
       const row=element('div',{class:'content-add-row'}),select=element('select',{'aria-label':'Content type'});for(const type of ['text','gallery','figure','list','resource','citation'])select.append(element('option',{value:type,text:names[type]}));row.append(select,button('Add content',()=>add(select.value,{at:node.children.find(n=>isHeading(n.block))?.index??node.end+1})));body.append(row);
      }
     }
     details.append(body);
    };
    details.addEventListener('toggle',()=>{expanded.set(b,details.open);if(details.open)fill();});target.append(details);
    if(expanded.get(b)??node.children.some(n=>isHeading(n.block))){details.open=true;fill();}
    if(focusBlock===b){details.open=true;fill();summary.focus();}
   }
   if(!items.length)host.append(element('p',{class:'help content-empty',text:'Add a paragraph, image or heading here.'}));
   for(const node of roots)renderNode(node,host);addRow(host);if(focusBlock)focus(focusBlock);
  }
  draw();return host;
 }
 return {list};
}
