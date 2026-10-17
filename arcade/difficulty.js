export const DIFFICULTIES=Object.freeze({
 easy:Object.freeze({id:'easy',label:'Easy',landingSpeed:105,landingBrake:3.8,scoreMultiplier:1,shotSpeed:.8,fireInterval:1.4,damageProtection:3.6,launchProtection:3.8,description:'Gentler landings, stronger approach braking, and slower shots.'}),
 medium:Object.freeze({id:'medium',label:'Medium',landingSpeed:65,landingBrake:2.3,scoreMultiplier:1.5,shotSpeed:1,fireInterval:1,damageProtection:2.7,launchProtection:2.8,description:'The current balanced patrols.'}),
 hard:Object.freeze({id:'hard',label:'Hard',landingSpeed:65,landingBrake:2.3,scoreMultiplier:2.5,shotSpeed:1.2,fireInterval:.72,damageProtection:1.8,launchProtection:1.8,description:'Faster fire and shorter recovery windows.'})
});
export const getDifficulty=id=>Object.hasOwn(DIFFICULTIES,id)?DIFFICULTIES[id]:DIFFICULTIES.medium;
