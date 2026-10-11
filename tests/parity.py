from html.parser import HTMLParser
from pathlib import Path
import sys
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.nodes=[]
 def handle_starttag(self,t,a):self.nodes.append(('open',t,sorted(a)))
 def handle_endtag(self,t):self.nodes.append(('end',t))
 def handle_startendtag(self,t,a):self.handle_starttag(t,a);self.handle_endtag(t)
 def handle_data(self,d):self.nodes.append(('text',d))
a,b=Parser(),Parser();a.feed(Path(sys.argv[1]).read_text());b.feed(Path(sys.argv[2]).read_text())
assert a.nodes==b.nodes,'Parsed HTML changed: text, structure, attributes, assets or IDs differ.'
print(f'Exact parity: {len(a.nodes)} parsed nodes')
