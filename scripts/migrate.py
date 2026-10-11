"""One-time, strict migration of the approved published fixture. Not a build dependency."""
from html.parser import HTMLParser
from pathlib import Path
import json

class Node:
    def __init__(self, tag='', attrs=()): self.tag, self.a, self.children = tag, dict(attrs), []
    def all(self, pred):
        return [n for c in self.children if isinstance(c, Node) for n in ([c] if pred(c) else []) + c.all(pred)]
    def first(self, pred): return next(iter(self.all(pred)), None)
    def text(self): return ''.join(c if isinstance(c,str) else c.text() for c in self.children)
    def cls(self,c): return c in self.a.get('class','').split()
class Parser(HTMLParser):
    def __init__(self): super().__init__(); self.root=Node();self.stack=[self.root]
    def handle_starttag(self,t,a):
        n=Node(t,a); self.stack[-1].children.append(n)
        if t not in ('meta','link','img','br','input','hr'): self.stack.append(n)
    def handle_startendtag(self,t,a): self.handle_starttag(t,a);self.handle_endtag(t)
    def handle_endtag(self,t):
        if self.stack[-1].tag==t:self.stack.pop()
        elif t not in ('meta','link','img','br','input','hr'):raise ValueError(t)
    def handle_data(self,d):self.stack[-1].children.append(d)
p=Parser();p.feed(Path('tests/fixtures/published.html').read_text());root=p.root
first=lambda c:root.first(lambda n:n.cls(c))
media={};resources={};counter=0

def figure(n):
    img=n.first(lambda x:x.tag=='img'); src=img.a['src']; mid=Path(src).stem
    media[mid]={'id':mid,'src':src,'width':int(img.a['width']),'height':int(img.a['height'])}
    cap=n.first(lambda x:x.tag=='figcaption');a=n.first(lambda x:x.tag=='a')
    return {'media':mid,'alt':img.a['alt'],'caption':cap.text() if cap else '', 'credit':'', 'linked':a is not None,'linkLabel':a.a.get('aria-label','') if a else '', 'lazy':img.a.get('loading')=='lazy'}

def resource(n):
    global counter
    a=n.first(lambda x:x.tag=='a'); note=n.first(lambda x:x.cls('resource-note'))
    counter+=1;rid='resource-'+str(counter)
    resources[rid]={'id':rid,'url':a.a['href'],'label':''.join(x for x in a.children if isinstance(x,str)),'note':note.text() if note else '', 'download':a.a.get('download',''), 'newTab':a.a.get('target')=='_blank'}
    return {'type':'resource','resource':rid}

def blocks(n):
    result=[]
    for c in n.children:
        if isinstance(c,str):
            if c.strip():raise ValueError('Unexpected text '+c)
            continue
        if c.tag=='button':continue
        if c.tag=='section':
            h=next(x for x in c.children if isinstance(x,Node) and x.tag in ('h4','h5','h6'))
            c.children.remove(h)
            result.append({'type':'section','title':h.text(),'level':int(h.tag[1]),'chapter':c.cls('chapter'),'blocks':blocks(c)})
        elif c.cls('resource-link'):result.append(resource(c))
        elif c.tag=='p':
            style={'empty-note':'note','source-note':'source','detail-context':'context'}.get(c.a.get('class'),'body')
            if c.first(lambda x:x.tag=='em'):
                em=c.first(lambda x:x.tag=='em'); result.append({'type':'citation','title':em.text(),'suffix':''.join(x for x in c.children if isinstance(x,str))})
            else:result.append({'type':'text','text':c.text(),'style':style})
        elif c.cls('section-images') or c.cls('photo-gallery'):
            result.append({'type':'gallery','layout':'photos' if c.cls('photo-gallery') else 'single' if c.cls('single-image') else 'grid','images':[figure(x) for x in c.children if isinstance(x,Node)]})
        elif c.tag=='figure':result.append({'type':'figure','layout':'chart' if c.cls('recovered-chart') else 'plain','image':figure(c)})
        elif c.cls('archive-code'):result.append({'type':'figure','layout':'code','image':figure(c)})
        elif c.cls('project-resources'):result.append({'type':'resources','blocks':blocks(c)})
        elif c.tag=='h5':result.append({'type':'heading','title':c.text(),'level':5})
        elif c.tag=='ul':result.append({'type':'list','items':[x.text() for x in c.children if isinstance(x,Node)]})
        else:raise ValueError(('Unknown block',c.tag,c.a))
    return result

def entry(n,work):
    eid=n.a['id'].removeprefix('entry-'); title=n.first(lambda x:x.tag=='h3').text(); intro=n.first(lambda x:x.cls('entry-intro')).text()
    photo=n.first(lambda x:x.cls('entry-photo')); summary=n.first(lambda x:x.cls('entry-summary'))
    e={'id':eid,'title':title,'intro':intro,'divider':'','role':'','date':'','image':[], 'placeholder':'','roles':[]}
    if photo:
        f=photo.first(lambda x:x.tag=='figure')
        if f:e['image']=[figure(f)]
        else:e['placeholder']='Hiking photograph'
    if not work:
        role=summary.first(lambda x:x.cls('role'));date=summary.first(lambda x:x.cls('date'))
        e['role']=role.text() if role else ''; e['date']=date.text() if date else ''
    for d in n.all(lambda x:x.cls('entry-details')):
        rid=d.a['id'].removeprefix('details-');button=n.first(lambda x:x.a.get('data-expand')==rid)
        control=n.first(lambda x:x.cls('work-role-control') and x.first(lambda y:y.a.get('data-expand')==rid))
        label='';role='';date=''
        if control:
            h=control.first(lambda x:x.tag=='h4'); r=control.first(lambda x:x.cls('role'));dt=control.first(lambda x:x.cls('date'))
            label=h.text() if h else '';role=r.text() if r else '';date=dt.text() if dt else ''
        e['roles'].append({'id':rid,'label':label,'role':role,'date':date,'blocks':blocks(d)})
    return e

site={'name':first('name').text(),'profession':first('profession').text(),'description':root.first(lambda n:n.a.get('name')=='description').a['content'],'introduction':first('introduction').text(),'resume':'assets/documents/Eli-Doggart-Resume.pdf','resumeFilename':'Eli-Doggart-Resume.pdf','resumeLabel':'Download resume, one-page PDF','email':first('contact-email').text(),'phone':first('contact-phone').text(),'phoneLink':first('contact-phone').a['href'],'footer':first('preview-note').text()}
sections=[]
for v in root.all(lambda n:n.cls('view')):
    sid=v.a['data-view']
    if sid=='contact':continue
    heading=v.first(lambda n:n.cls('section-heading'));sub=heading.first(lambda n:n.tag=='p')
    entries=[entry(n,sid=='work') for n in v.children if isinstance(n,Node) and n.tag=='article']
    for e in entries:
        if e['id']=='frc':e['divider']='Additional team experience'
    sections.append({'id':sid,'subtitle':sub.text() if sub else '', 'entries':entries})
ed=first('education')
content={'version':1,'site':site,'sections':sections,'education':{'heading':'Education','school':ed.first(lambda n:n.tag=='h4').text(),'date':ed.first(lambda n:n.cls('date')).text(),'degree':ed.first(lambda n:n.tag=='p').text()},'media':list(media.values()),'resources':list(resources.values())}
Path('content/portfolio.json').write_text(json.dumps({'portfolio':content},ensure_ascii=False,indent=2)+'\n')
print(f'Migrated {len(media)} distinct media, {len(resources)} resources, {sum(len(s["entries"]) for s in sections)} entries')
