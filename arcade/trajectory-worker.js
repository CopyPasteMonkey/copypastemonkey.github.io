import {predictTrajectory} from './physics.js';
self.onmessage=({data})=>{
 const result=predictTrajectory(data.snapshot);
 self.postMessage({id:data.id,revision:data.revision,result});
};
