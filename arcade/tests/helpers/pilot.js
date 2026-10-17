// Test-only pilot; uses normal flight inputs, with no immunity or teleports.
import {angleDelta} from '../../physics.js';
export function pilot(){let dockTimer=0,lastDock='home',depart=null;return (m,fire=true)=>{
 const s=m.ship,target=s.cargo?m.home:m.planets.find(p=>p.id===m.planets.filter(p=>p.tech).map(p=>p.id).find(id=>m.planets.find(x=>x.id===id).flag!=='delivered'));
 if(!target)return {};
 if(s.docked){lastDock=s.docked;depart=null;dockTimer+=1/120;return {thrust:dockTimer>1.1};}
 if(dockTimer){depart=lastDock;dockTimer=0;}
 const p=m.planets.find(p=>p.id===depart);
 if(p&&Math.hypot(s.x-p.x,s.y-p.y)<p.r+135){const delta=angleDelta(Math.atan2(s.y-p.y,s.x-p.x),s.a);return {left:delta<-.04,right:delta>.04,thrust:Math.abs(delta)<.4,fire};}depart=null;
 let dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy),gap=d-target.r-s.r,desiredSpeed=Math.min(260,Math.sqrt(Math.max(0,gap)*100));
 if(gap<100)return {brake:true,fire};
 let vx=target.vx,vy=target.vy;
 const projection=-(s.x*dx+s.y*dy)/(d*d),closest=Math.hypot(s.x+dx*projection,s.y+dy*projection);
 if(projection>0&&projection<1&&closest<330&&gap>500){const r=Math.hypot(s.x,s.y),a=Math.atan2(s.y,s.x)+(Math.sign(s.x*target.y-s.y*target.x)||1)*.5,radius=Math.max(420,Math.min(r,target.orbit));dx=radius*Math.cos(a)-s.x;dy=radius*Math.sin(a)-s.y;d=Math.hypot(dx,dy);vx=0;vy=0;}
 const g=m.gravity(s),ax=(vx+dx/d*desiredSpeed-s.vx)*1.6-g.x,ay=(vy+dy/d*desiredSpeed-s.vy)*1.6-g.y,delta=angleDelta(Math.atan2(ay,ax),s.a);
 return {left:delta<-.03,right:delta>.03,thrust:Math.abs(delta)<.3&&Math.hypot(ax,ay)>12,brake:gap<180&&m.relativeSpeed(target)>100,fire};
};}
