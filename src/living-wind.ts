export interface IslandWind {strength:number;direction:number;lean:number}
/** One deterministic slow gust envelope shared by the meadow and hanging objects. */
export function islandWind(time:number,reduced=false):IslandWind {
 if(reduced)return{strength:0,direction:.32,lean:0};
 const slow=(Math.sin(time*.17-.7)+1)*.5,gust=slow*slow*(3-2*slow);
 const strength=.42+.5*gust;
 return{strength,direction:.32+Math.sin(time*.09)*.18,lean:(Math.sin(time*1.35)*.72+Math.sin(time*2.1)*.2)*strength};
}
