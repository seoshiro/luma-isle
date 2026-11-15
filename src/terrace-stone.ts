import * as THREE from 'three';
import {createTerraceLayer} from './world-geometry';
import {TERRACE,terraceProfile,type Point2} from './world-layout';

// Surface-only treatment: the dock plane and all existing terrace vertices stay exact.
const TAU=Math.PI*2;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(a:number,b:number,n:number)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t)};
const hash=(i:number)=>{let n=Math.imul(i^0x45d9f3b,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const wrap=(n:number,size:number)=>n>size/2?n-size:n<-size/2?n+size:n;
type SurfaceSample={color:readonly number[];height:number;roughness:number};
type Maps={map:THREE.DataTexture;relief:THREE.DataTexture};

function makeMaps(name:string,width:number,height:number,sample:(u:number,v:number)=>SurfaceSample,repeat=false):Maps {
  const color=new Uint8Array(width*height*4),relief=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const s=sample((x+.5)/width,(y+.5)/height),i=(y*width+x)*4;
    for(let c=0;c<3;c++)color[i+c]=Math.round(Math.max(0,Math.min(255,s.color[c])));
    color[i+3]=255;relief[i]=Math.round(clamp(s.height)*255);relief[i+1]=Math.round(clamp(s.roughness)*255);relief[i+2]=0;relief[i+3]=255;
  }
  const texture=(data:Uint8Array,suffix:string,srgb=false)=>{
    const t=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);t.name=`Terrace ${name} ${suffix}`;
    t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
    t.wrapT=THREE.ClampToEdgeWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
  };
  return {map:texture(color,'color',true),relief:texture(relief,'height / roughness')};
}
function stoneMaterial(name:string,maps:Maps,bumpScale:number):THREE.MeshStandardMaterial {
  const material=new THREE.MeshStandardMaterial({map:maps.map,bumpMap:maps.relief,roughnessMap:maps.relief,bumpScale,roughness:1,metalness:0});
  material.name=`Terrace ${name}`;return material;
}
function perimeter(profile:readonly Point2[]) {
  const lengths=profile.map((p,i)=>Math.hypot(p[0]-profile[(i+1)%profile.length][0],p[1]-profile[(i+1)%profile.length][1]));
  const total=lengths.reduce((s,n)=>s+n,0),u=[0];for(const length of lengths)u.push(u.at(-1)!+length/total);return {lengths,total,u};
}
/** Periodic, smooth mineral patches. No per-pixel white noise or repeating tile. */
function mineralField(columns:number,rows:number,seed:number) {
  const stride=columns+1,grid=new Float32Array(stride*(rows+1));
  for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++)grid[y*stride+x]=hash((x%columns)+y*971+seed);
  return (u:number,v:number)=>{
    const x=u*columns,y=clamp(v)*rows,ix=Math.min(columns-1,Math.floor(x)),iy=Math.min(rows-1,Math.floor(y));
    const tx=smooth(0,1,x-ix),ty=smooth(0,1,y-iy),i=iy*stride+ix;
    return mix(mix(grid[i],grid[i+1],tx),mix(grid[i+stride],grid[i+stride+1],tx),ty)*2-1;
  };
}
function rockSampler(length:number,height:number) {
  const mineral=mineralField(30,7,601),weather=mineralField(83,19,907),pitting=mineralField(167,39,1301);
  // Unequal, offset strata form broad irregular rocks, not a repeating brick grid.
  const sites:{x:number;y:number;shade:number;warmth:number;roughness:number}[]=[];
  for(let row=0;row<3;row++){
    const count=[16,18,15][row];
    for(let i=0;i<count;i++){const id=row*57+i+11;sites.push({x:(i+(row%2)*.53+(hash(id)-.5)*.52)*length/count,y:[.12,.62,1.17][row]+(hash(id+233)-.5)*.23,shade:.9+hash(id+79)*.2,warmth:(hash(id+751)-.5)*9,roughness:.88+hash(id+613)*.08});}
  }
  const buckets=Array.from({length:32},(_,i)=>sites.filter(site=>Math.abs(wrap((i+.5)*length/32-site.x,length))<2.1));
  return (u:number,v:number):SurfaceSample=>{
    const angle=u*TAU,x=u*length+.063*Math.sin(angle*8+v*19)+.026*Math.sin(angle*31-v*13),y=v*height+.042*Math.sin(angle*9)+.022*Math.sin(angle*23+v*7);
    let first=Infinity,second=Infinity,chosen=sites[0],ax=0,ay=0,bx=0,by=0;
    for(const site of buckets[Math.min(31,Math.floor(u*32))]){const dx=wrap(x-site.x,length),dy=(y-site.y)*1.7,d=dx*dx+dy*dy;
      if(d<first){second=first;bx=ax;by=ay;first=d;ax=dx;ay=dy;chosen=site}else if(d<second){second=d;bx=dx;by=dy}
    }
    const distance=(second-first)/(2*Math.max(.001,Math.hypot(bx-ax,by-ay)))/1.2;
    const patches=mineral(u,v),erosion=weather(u,v),pores=pitting(u,v);
    const chips=.009*(erosion*.5+.5)+.004*Math.sin(angle*47+v*27),worn=distance-chips,face=smooth(.002,.025,worn);
    const grain=Math.sin(angle*27+v*17)*Math.sin(angle*13-v*31),broad=Math.sin(ax*4.3+chosen.warmth)*Math.sin(ay*3.5+1.7);
    const facet=Math.abs(ax*.8+ay*.45)-Math.abs(ax*.35-ay*.85),dome=Math.exp(-first*2.4);
    const shade=chosen.shade*(.97+.03*v)+broad*.075+facet*.08-ay*.045+patches*.10+erosion*.055+pores*.013;
    const ochre=smooth(-.1,.7,patches)*smooth(-.5,.6,erosion);
    const base=[185*shade+chosen.warmth+ochre*7,176*shade+chosen.warmth*.35+ochre*2,151*shade-ochre*5];
    const crevice=[143,138,119],contact=.16+.18*(Math.sin(angle*19+v*11)*.5+.5);
    // Thin, softly worn fissures, with broad relief across the whole rock face.
    return {color:base.map((c,i)=>mix(mix(crevice[i],c,contact),c,face)),height:.15+face*(.32+dome*.23+broad*.07+facet*.07+patches*.095+erosion*.13+pores*.025)+grain*.004*face,roughness:mix(.98,Math.max(.8,Math.min(.99,chosen.roughness+erosion*.06)),face)};
  };
}
function copingSampler(length:number) {
  const mineral=mineralField(47,9,1703),weathering=mineralField(111,23,2203);
  const widths=Array.from({length:22},(_,i)=>.8+hash(i+503)*.4),total=widths.reduce((s,n)=>s+n,0),bounds=[0];
  for(const width of widths)bounds.push(bounds.at(-1)!+width/total);
  return (u:number,v:number,top=false):SurfaceSample=>{
    u=((u%1)+1)%1;let cell=0;while(cell<widths.length-1&&u>bounds[cell+1])cell++;
    const a=bounds[cell],b=bounds[cell+1],local=(u-a)/(b-a),distance=Math.min(u-a,b-u)*length;
    const joint=smooth(.003,top?.018:.024,distance),edge=top?1:smooth(0,.12,Math.min(v,1-v));
    const patches=mineral(u,clamp(v)),weather=weathering(u,clamp(v)),shade=.96+hash(cell+911)*.075+patches*.055+weather*.025;
    const base=(top?[216,207,183]:[202,193,169]).map(c=>c*shade),relief=joint*(.67+.09*patches+.07*weather)*(.92+.08*edge);
    return {color:base.map((c,i)=>mix((top?[181,172,149]:[166,158,135])[i],c,joint)*(.97+.03*edge)),height:.2+relief*.7,roughness:.9+hash(cell+433)*.065};
  };
}
/** Add UVs/material ranges only. No resampling, displacement, overlap, or new triangles. */
function surfaceUVs(geometry:THREE.BufferGeometry,profile:readonly Point2[],capTop=false) {
  const {u}=perimeter(profile),uv:number[]=[],n=profile.length;
  for(let i=0;i<n;i++)uv.push(u[i],0,u[i+1],0,u[i],1,u[i+1],0,u[i+1],1,u[i],1);
  if(capTop){const p=geometry.getAttribute('position');for(let i=n*6;i<p.count;i++)uv.push(.5+p.getX(i)/(TERRACE.topRadius*2),.5+p.getZ(i)/(TERRACE.topRadius*2));geometry.addGroup(0,n*6,0);geometry.addGroup(n*6,n*3,1)}
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
}
export function createTerraceStonework():THREE.Group {
  const group=new THREE.Group();group.name='Aligned terrace and bridge landing';group.userData.dynamic=true;
  const topProfile=terraceProfile(TERRACE.topRadius),wallProfile=terraceProfile(TERRACE.seamRadius),topPerimeter=perimeter(topProfile);
  const wallMaps=makeMaps('irregular limestone',1024,256,rockSampler(perimeter(wallProfile).total,TERRACE.seamY-TERRACE.bottomY),true);
  const coping=copingSampler(topPerimeter.total),rimMaps=makeMaps('weathered coping',1024,64,(u,v)=>coping(u,v),true);
  const topMaps=makeMaps('paving',256,256,(u,v)=>{
    const x=(u-.5)*TERRACE.topRadius*2,z=(v-.5)*TERRACE.topRadius*2;let nearest=Infinity,along=0;
    for(let i=0;i<topProfile.length;i++){
      const a=topProfile[i],b=topProfile[(i+1)%topProfile.length],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)),distance=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
      if(distance<nearest){nearest=distance;along=topPerimeter.u[i]+t*(topPerimeter.u[i+1]-topPerimeter.u[i]);}
    }
    return coping(along,nearest,true);
  });
  const base=createTerraceLayer(TERRACE.baseRadius,TERRACE.seamRadius,TERRACE.bottomY,TERRACE.seamY),rim=createTerraceLayer(TERRACE.seamRadius,TERRACE.topRadius,TERRACE.seamY,TERRACE.topY,true);
  surfaceUVs(base,wallProfile);surfaceUVs(rim,topProfile,true);
  const body=new THREE.Mesh(base,stoneMaterial('irregular limestone',wallMaps,.19));body.name='Observatory rock pedestal';
  const copingMesh=new THREE.Mesh(rim,[stoneMaterial('weathered coping',rimMaps,.035),stoneMaterial('paving',topMaps,.025)]);copingMesh.name='Observatory coping and terrace';
  for(const mesh of [body,copingMesh]){
    // Existing static batching strips UVs; retain these two independently owned meshes.
    mesh.userData.dynamic=true;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
