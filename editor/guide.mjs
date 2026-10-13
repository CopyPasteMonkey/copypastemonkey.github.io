import {render} from '../lib/render.mjs';
const topics=[
 ['structure','Entries & dropdowns','Use an interest or job for the main card. Add details sections (or roles in Work) for separate dropdowns. Summary, dates and main image stay visible.'],
 ['headings','Headings','Add heading creates a heading with content. Use Main heading, Subheading and Nested subheading to show the hierarchy. Section format controls the divider.'],
 ['text','Paragraphs','Add content → Paragraph, then choose Text format. Compare all five treatments below.'],
 ['images','Images','Add content → Image, then choose Image format. Captions and credits are visible; alt text is for accessibility.'],
 ['galleries','Photo galleries','Add content → Photo gallery, then choose Image arrangement. These examples reuse the same photos so you can compare layouts.'],
 ['extras','Lists, links & citations','Choose these from Content type → Add content. Manage reusable link destinations in Links & downloads.']
];
const text=(value,style='body')=>({type:'text',text:value,style});
const heading=(title,level=4,chapter=true,blocks=[text('Content belonging to this heading appears here.')])=>({type:'section',title,level,chapter,blocks});
export function examples(source,topic){
 const data=structuredClone(source);data.sections.forEach(s=>s.entries=[]);data.sections.find(s=>s.id==='passions').subtitle='Labelled examples · '+topics.find(t=>t[0]===topic)[1];
 const media=data.media.filter(m=>m.id.startsWith('photo-'));if(!media.length)throw Error('No example photographs are available.');
 const photo=(n=0,extra={})=>({media:media[n%media.length].id,alt:'Example photograph from the portfolio library',caption:'Caption — visible below the photograph',credit:'Credit / attribution',linked:false,linkLabel:'',lazy:false,...extra});
 let count=0;const entry=(title,intro,blocks=[],extra={})=>{const id='guide-example-'+(++count);return {id,title,intro,divider:'',role:'',date:'',image:[],placeholder:'',roles:[{id,label:'',role:'',date:'',blocks}],...extra};};
 let entries=[];
 if(topic==='structure')entries=[entry('Entry title / interest name','Summary — a short introduction that stays visible before a dropdown is opened.',[],{role:'Collection or activity',date:'Dates',image:[photo()],roles:[{id:'guide-film',label:'Film Photography',role:'',date:'',blocks:[text('Details section 1 — this dropdown has its own text and photos.')]},{id:'guide-digital',label:'Digital Photography',role:'',date:'',blocks:[text('Details section 2 — open either or both, just like the Nimbus roles.')]}]}),entry('Coming-soon image label','Use Other text options → Coming-soon image label when you do not have a main image.',[],{placeholder:'Example photograph'}),entry('Heading above this item','Other text options → Heading above this item adds a separator before the whole entry.',[],{divider:'Heading above this item'})];
 if(topic==='headings')entries=[entry('Heading levels','Use Add heading, then Add subheading. Parent heading controls which heading contains a subheading.',[heading('Main heading',4),heading('Subheading',5),heading('Nested subheading',6)]),entry('Group heading','Section format → Group heading groups its text and lower headings without an extra divider.',[heading('Group heading',4,true)]),entry('Content section with a divider','Section format → Content section with a divider adds a rule before the heading.',[heading('Content section with a divider',4,false)]),entry('Heading only','Content type → Heading only creates a title without its own section wrapper. Following content belongs to it until the next heading at the same level.',[{type:'heading',title:'Heading only',level:4},text('A paragraph following a heading-only block.')])];
 if(topic==='text')entries=[['body','Regular paragraph','Use for your main explanations, stories and descriptions.'],['note','Note / coming soon','Use for a quieter note or content you plan to add later.'],['source','Source / credit note','Use for supporting source information or attribution.'],['context','Context line','Use for a short line of background information.'],['italic','Italic paragraph','Use when the whole paragraph should be italic.']].map(([style,label,help])=>entry(label,'Text format → '+label+'. '+help,[text('A short description of the photograph, the work behind it, or what you learned along the way.',style)]));
 if(topic==='images')entries=[...['plain','chart','code'].map((layout,i)=>entry(['Standard image','Wide chart','Narrow image / code sample'][i],'Image format → '+['Standard image','Wide chart','Narrow image / code sample'][i]+'. The same image is shown at the width this format allows.',[{type:'figure',layout,image:photo()}])),entry('Full-size image link','Image link options → Open full-size image when clicked. Click this example to open the original in a new tab. The link description tells screen-reader users what opens.',[{type:'figure',layout:'plain',image:photo(0,{linked:true,linkLabel:'Open the example photograph at full size'})}])];
 if(topic==='galleries')entries=[['grid','Side-by-side images',2],['single','Single wide image',1],['photos','Photography grid',3]].map(([layout,label,n])=>entry(label,'Image arrangement → '+label+'. Switch Preview width to see the phone layout.',[{type:'gallery',layout,images:Array.from({length:n},(_,i)=>photo(i,{caption:'Photograph '+(i+1)+' · caption',credit:''}))}]));
 if(topic==='extras'){
 data.resources.push({id:'guide-link',url:'https://www.elidoggart.com/',label:'Website link label',note:'Short note — shown with the link',download:'',newTab:true},{id:'guide-download',url:data.site.resume,label:'Download link label',note:'Example using the published résumé PDF',download:data.site.resumeFilename,newTab:false});
 entries=[entry('Bullet list','Content type → Bullet list. The website currently renders this as a clean list without bullet dots.',[{type:'list',items:['First list item','Second list item','Third list item']}]),entry('Link','Content type → Link. Choose a saved link from Links & downloads.',[{type:'resource',resource:'guide-link'}]),entry('Links & downloads group','Group related headings, citations and file links together.',[{type:'resources',blocks:[{type:'heading',title:'Report heading',level:4},{type:'citation',title:'Citation title',suffix:' — additional citation text.'},{type:'resource',resource:'guide-download'}]}]),entry('Citation','Content type → Citation. The title is italic, followed by normal additional citation text.',[{type:'citation',title:'Title of the source',suffix:' — author, date, or other details.'}])];
 }
 data.sections.find(s=>s.id==='passions').entries=entries;return data;
}
async function start(){
 const status=document.querySelector('#status');try{
 const response=await fetch('../content/portfolio.json');if(!response.ok)throw Error('Could not load example photographs.');const {portfolio}=await response.json();const frame=document.querySelector('#examples');
 function show(topic){
 const item=topics.find(t=>t[0]===topic)||topics[0];document.querySelector('#topic-title').textContent=item[1];document.querySelector('#topic-help').textContent=item[2];for(const b of document.querySelectorAll('#topics button'))b.setAttribute('aria-pressed',String(b.dataset.topic===item[0]));
 const doc=new DOMParser().parseFromString(render(examples(portfolio,item[0]),{base:new URL('../',location.href).href}),'text/html');
 doc.querySelectorAll('.site-header,.site-toolbar,footer,.skip,noscript,#view-contact').forEach(el=>el.remove());doc.querySelectorAll('.view').forEach(el=>{if(el.id==='view-passions')el.hidden=false;else el.remove();});
 if(item[0]!=='structure'){doc.querySelectorAll('.entry-details').forEach(el=>el.hidden=false);doc.querySelectorAll('.expand-button,.collapse-button').forEach(el=>el.remove());}
 const style=doc.createElement('style');style.textContent='.wrap{width:calc(100% - 48px)}.view-heading{margin-top:24px}.portfolio-entry{padding-block:26px}.entry-intro{color:#555}';doc.head.append(style);
 // There is no top-level site navigation in the samples; keep the real disclosure behavior.
 doc.querySelector('script').remove();const script=doc.createElement('script');script.src=new URL('guide-preview.mjs',location.href).href;script.type='module';doc.body.append(script);
 frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;history.replaceState(null,'','#'+item[0]);status.textContent='';
 }
 for(const [id,label] of topics){const b=document.createElement('button');b.textContent=label;b.dataset.topic=id;b.onclick=()=>show(id);document.querySelector('#topics').append(b);}
 document.querySelector('#width').onchange=e=>frame.classList.toggle('phone',e.target.value==='phone');show(location.hash.slice(1));
 }catch(error){status.textContent=error.message+' Reload this page to try again.';}}
if(typeof document!=='undefined')start();
