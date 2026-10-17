import {DIFFICULTIES} from './difficulty.js';
const KEY='space-flight-highscores-v2';
export function validScores(value){
 if(!Array.isArray(value))return [];
 return value.filter(s=>s&&/^[A-Z]{3}$/.test(s.initials)&&Number.isSafeInteger(s.score)&&s.score>=0&&s.score<1e9&&Number.isFinite(s.time)&&s.time>0&&typeof s.pacifist==='boolean'&&(s.difficulty===undefined||s.difficulty==='classic'||Object.hasOwn(DIFFICULTIES,s.difficulty))).map(({initials,score,time,pacifist,difficulty='classic'})=>({initials,score,time,pacifist,difficulty})).sort((a,b)=>b.score-a.score||a.time-b.time).slice(0,10);
}
export function readScores(storage){try{return validScores(JSON.parse(storage.getItem(KEY)||'[]'));}catch{return [];}}
export function saveScore(storage,entry){
 if(validScores([entry]).length!==1)return {ok:false,scores:readScores(storage)};
 const scores=validScores([...readScores(storage),entry]);
 try{storage.setItem(KEY,JSON.stringify(scores));return {ok:true,scores};}catch{return {ok:false,scores};}
}
