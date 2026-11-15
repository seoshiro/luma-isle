// Loaded only by the DEV branch in IslandScene. Never part of a production build.
import type * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { GameState } from './game';

type Triple = [number, number, number];
type Pose = { id: string; label: string; position: Triple; target: Triple };
const poses: Pose[] = [
  { id: '01-mill-left-roots', label: '1 Mill left / roots', position: [-12,3.4,8], target: [-7.3,.3,2.7] },
  { id: '02-bench-tree', label: '2 Bench / tree', position: [8,2.7,10], target: [4.1,.5,4.6] },
  { id: '03-waterfall-cypress', label: '3 Waterfall cypress', position: [-9,2.5,9], target: [-5.4,.45,4.3] },
  { id: '04-front-path-lamps', label: '4 Front path lamps', position: [8,8,6], target: [1.4,.6,3.8] },
  { id: '05-observatory-bridge', label: '5 Bridge side / far joint', position: [7,5.2,1.5], target: [1.9,.8,-1.8] },
  { id: '06-quiet-garden', label: '6 Quiet garden', position: [19.6,2.6,4.2], target: [14.3,.7,-1.5] },
  { id: '07-close-grass', label: '7 Close grass', position: [8,1.25,6.1], target: [5.6,.2,4.1] },
  { id: '08-overview', label: '8 Overview', position: [17,15,31], target: [2.8,.5,0] },
  { id: '09-bridge-facing-observatory', label: '9 Bridge toward observatory', position: [2,3.5,7.5], target: [1.5,.8,-1.6] },
  { id: '10-bridge-upper', label: '10 Bridge upper', position: [5,9,3], target: [1.7,.6,-1.9] },
  { id: '11-bridge-from-observatory', label: '11 Bridge from observatory', position: [-.1,4.2,-1], target: [3.35,.6,-.3] },
  { id: '12-bridge-low-side', label: '12 Bridge low side', position: [5.6,1.35,-.1], target: [2.35,1.1,-1.45] },
];
export type SurfaceQaCommand = { type: 'pose'; index: number } | { type: 'orbit'; height: 'low'|'high' } | { type: 'stop'|'release'|'bridge'|'capture'|'benchmark'|'export' };
type Context = { state: GameState; zone: string|null; intro: boolean; photo: boolean; assetsReady: boolean; reducedMotion: boolean };
type Frame = { rafMs: number; renderCpuMs: number; calls: number; triangles: number; textures: number };
type Environment = ReturnType<ReturnType<typeof createSurfaceQa>['environment']>;
type Run = { phase: string; view: string; startedAt: string; startMs: number; measureMs: number; frames: Frame[]; interruptions: string[]; environment: Record<string,unknown>; hidden: boolean };
const stamp = () => new Date().toISOString().replace(/[:.]/g,'-');
const quantile = (values: number[], q: number) => values.length ? [...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*q)-1)] : null;
const summary = (values: number[]) => ({ median: quantile(values,.5), p95: quantile(values,.95), p99: quantile(values,.99), max: values.length ? Math.max(...values) : null });

export function createSurfaceQa(options: {
  renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; controls: OrbitControls;
  context: () => Context; cancelCameraMotion: () => void; replayBridge: () => void;
  invoke: (command: SurfaceQaCommand) => void;
}) {
  const { renderer, camera, controls } = options;
  const gl=renderer.getContext(), extension=gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName=String(gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  let phase='before', selected=7, locked=false, orbit: 'low'|'high'|null=null, orbitStart=0;
  let captureRequested=false, run: Run|null=null, lastStatus=0, autoReset=renderer.info.autoReset, renderStart=0;
  let fixedPosition: Triple=[...poses[selected].position], fixedTarget: Triple=[...poses[selected].target];
  const results: Record<string,unknown>[]=[], captures: Record<string,unknown>[]=[];
  const root=document.createElement('aside');root.id='surface-qa-panel';root.setAttribute('aria-label','Development surface QA');
  Object.assign(root.style,{position:'fixed',left:'12px',top:'76px',zIndex:'9999',width:'330px',maxHeight:'calc(100vh - 92px)',overflow:'auto',padding:'12px',background:'#102520f5',color:'#f2f7e9',border:'1px solid #9cb7a0',borderRadius:'10px',font:'12px/1.4 system-ui',boxShadow:'0 8px 28px #0005'});
  const header=document.createElement('strong');header.textContent='DEV · Surface QA';root.append(header);
  const body=document.createElement('div');root.append(body);
  const toggle=document.createElement('button');toggle.textContent='Hide panel';
  const buttonStyle={background:'#e9f0df',color:'#102520',border:'0',borderRadius:'5px',padding:'7px 8px',font:'12px system-ui',cursor:'pointer',minHeight:'30px'};
  Object.assign(toggle.style,buttonStyle,{marginLeft:'8px'});root.insertBefore(toggle,body);
  toggle.onclick=()=>{const hidden=body.style.display!=='none';body.style.display=hidden?'none':'block';toggle.textContent=hidden?'Show panel':'Hide panel';};
  const note=document.createElement('p');note.textContent='Same live scene. Import your 4/4 save normally. Close game panels; keep viewport, quality and lighting matched. No save changes.';body.append(note);
  const recordingNote=document.createElement('p');recordingNote.id='surface-qa-recording-shortcuts';recordingNote.textContent='Clean recording hides this entire panel. Alt+Shift+Q restores/toggles it. Alt+Shift+R: replay bridge; L: low orbit; H: high orbit; S: stop (all with Alt+Shift).';body.append(recordingNote);
  const cleanRecording=document.createElement('button');cleanRecording.textContent='Clean recording view';cleanRecording.setAttribute('aria-describedby',recordingNote.id);Object.assign(cleanRecording.style,buttonStyle,{display:'block',marginBottom:'10px'});cleanRecording.onclick=()=>{root.style.display='none'};body.append(cleanRecording);
  const phaseLabel=document.createElement('label');phaseLabel.textContent='Artifact phase: ';
  const phaseSelect=document.createElement('select');phaseSelect.setAttribute('aria-label','QA artifact phase');
  for(const value of ['before','after']){const option=document.createElement('option');option.value=value;option.textContent=value;phaseSelect.append(option)}
  Object.assign(phaseSelect.style,buttonStyle);phaseSelect.onchange=()=>{phase=phaseSelect.value;};phaseLabel.append(phaseSelect);body.append(phaseLabel);
  const grid=document.createElement('div');Object.assign(grid.style,{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px',margin:'10px 0'});body.append(grid);
  const button=(text:string,command:SurfaceQaCommand,parent:HTMLElement=grid)=>{const el=document.createElement('button');el.textContent=text;Object.assign(el.style,buttonStyle);el.onclick=()=>options.invoke(command);parent.append(el);return el;};
  poses.forEach((pose,index)=>button(pose.label,{type:'pose',index}));
  button('Low orbit · 30s / turn',{type:'orbit',height:'low'});button('High orbit · 30s / turn',{type:'orbit',height:'high'});
  button('Stop orbit / hold camera',{type:'stop'});button('Release camera',{type:'release'});
  button('Replay bridge in this pose',{type:'bridge'});button('Export current PNG',{type:'capture'});
  button('Measure 5s + 30s',{type:'benchmark'});button('Export QA JSON',{type:'export'});
  const status=document.createElement('pre');Object.assign(status.style,{whiteSpace:'pre-wrap',font:'11px/1.5 ui-monospace,monospace',margin:'8px 0 0',color:'#f2f7e9'});body.append(status);
  const stopMini=button('Stop',{type:'stop'},root);Object.assign(stopMini.style,{marginTop:'6px'});
  document.body.append(root);

  function environment() {
    const p=options.context(), box=renderer.domElement.getBoundingClientRect();
    return { renderer:rendererName, userAgent:navigator.userAgent, viewport:{width:box.width,height:box.height}, drawingBuffer:{width:renderer.domElement.width,height:renderer.domElement.height}, dpr:renderer.getPixelRatio(), deviceDpr:devicePixelRatio, quality:p.state.settings.quality, lighting:p.zone==='observatory'&&p.state.stage>=2?'night':p.state.settings.lighting, savedLighting:p.state.settings.lighting, stage:p.state.stage, zone:p.zone, photo:p.photo, intro:p.intro, assetsReady:p.assetsReady, reducedMotion:p.reducedMotion, camera:{position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,aspect:camera.aspect}, glass:document.querySelector('[data-glass-renderer]')?.getAttribute('data-glass-renderer')??document.documentElement.dataset.glassRenderer??'see runtime' };
  }
  function view(){return orbit?`${orbit}-orbit`:locked?poses[selected]?.id??'held-camera':'free-camera'}
  function download(data:string,name:string){const anchor=document.createElement('a');anchor.href=data;anchor.download=name;anchor.click();}
  function jsonDownload(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));download(url,name);setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function mark(reason:string){if(run&&!run.interruptions.includes(reason))run.interruptions.push(reason)}
  function ready(){const p=options.context();if(!p.assetsReady||!p.state.entered||p.intro){status.textContent='Wait for assets, enter the island, and finish the intro first.';return false}return true}
  function hold(){orbit=null;locked=true;fixedPosition=camera.position.toArray() as Triple;fixedTarget=controls.target.toArray() as Triple;}
  function command(value:SurfaceQaCommand){
    if(value.type==='export'){jsonDownload({schema:'luma-surface-qa-v1',exportedAt:new Date().toISOString(),phase,protocol:{warmupSeconds:5,sampleSeconds:30,orbitPeriodSeconds:30,frameTime:'Unclamped real RAF interval; not GPU time.',renderCounts:'All existing renderer passes, including optical pass and any fallback redraw.',poses},current:environment(),captures,runs:results,activeRun:run?{status:'unfinished',frameCount:run.frames.length,interruptions:run.interruptions}:null},`luma-surface-${phase}-metrics-${stamp()}.json`);return}
    if(!ready())return;
    if(value.type==='pose'){mark('Camera pose changed during run');selected=value.index;const pose=poses[selected];if(!pose)return;locked=true;orbit=null;fixedPosition=[...pose.position];fixedTarget=[...pose.target];options.cancelCameraMotion();status.textContent=`${phase} · ${pose.id}\nReady to export at current viewport.`;return}
    if(value.type==='orbit'){mark('Orbit changed during run');locked=true;orbit=value.height;orbitStart=performance.now();options.cancelCameraMotion();status.textContent=`${phase} · ${orbit} orbit running`;return}
    if(value.type==='stop'){mark('Stopped during run');hold();status.textContent='Camera held. Orbit stopped.';return}
    if(value.type==='release'){mark('Camera released during run');locked=false;orbit=null;status.textContent='Camera released to normal game controls.';return}
    if(value.type==='bridge'){mark('Bridge replay during run');options.replayBridge();status.textContent=`Bridge replay · camera unchanged (${view()})`;return}
    if(value.type==='capture'){if(run){status.textContent='Finish the benchmark before exporting PNGs.';return}captureRequested=true;return}
    if(value.type==='benchmark'){
      if(run){status.textContent='A benchmark is already running.';return}
      const startMs=performance.now();if(orbit)orbitStart=startMs;
      run={phase,view:view(),startedAt:new Date().toISOString(),startMs,measureMs:0,frames:[],interruptions:[],environment:environment(),hidden:document.hidden};
      phaseSelect.disabled=true;status.textContent='Warming up for 5 seconds…';
    }
  }
  function applyCamera(ms:number){
    if(!locked)return false;
    const p=options.context();if(!p.state.entered||p.intro)return false;
    options.cancelCameraMotion();controls.enabled=false;
    if(orbit){const a=.58+(ms-orbitStart)/30000*Math.PI*2;camera.position.set(2.8+Math.sin(a)*29,orbit==='low'?5.3:25,Math.cos(a)*29);controls.target.set(2.8,.5,0)}
    else {camera.position.fromArray(fixedPosition);controls.target.fromArray(fixedTarget)}
    camera.lookAt(controls.target);return true;
  }
  function beginRender(){autoReset=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();renderStart=performance.now()}
  function endRender(ms:number,rafMs:number){
    const renderCpuMs=performance.now()-renderStart;
    const counters={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures};
    renderer.info.autoReset=autoReset;
    if(captureRequested){captureRequested=false;try{const filename=`luma-surface-${phase}-${view()}-${stamp()}.png`;const data=renderer.domElement.toDataURL('image/png');download(data,filename);captures.push({filename,phase,view:view(),capturedAt:new Date().toISOString(),environment:environment(),...counters});status.textContent=`Downloaded ${filename}`;}catch(error){status.textContent=`PNG export failed: ${String(error)}`}}
    if(!run)return;
    if(document.hidden){run.hidden=true;mark('Document hidden')}
    const current=environment();for(const key of ['quality','lighting','stage','zone','photo','intro','assetsReady','reducedMotion','dpr','viewport','drawingBuffer'] as const){if(JSON.stringify(current[key])!==JSON.stringify(run.environment[key]))mark(`${key} changed during run`)}
    const elapsed=ms-run.startMs;
    if(elapsed>=5000){if(!run.measureMs)run.measureMs=ms;else run.frames.push({rafMs,renderCpuMs,...counters})}
    if(ms-lastStatus>500){lastStatus=ms;status.textContent=elapsed<5000?`Warmup: ${(elapsed/1000).toFixed(1)} / 5s`:`Sampling: ${((ms-run.measureMs)/1000).toFixed(1)} / 30s\n${run.frames.length} real frames · ${run.view}\n${run.interruptions.length?'INTERRUPTED: '+run.interruptions.join(', '):'Keep this tab visible.'}`}
    if(run.measureMs&&ms-run.measureMs>=30000){
      const times=run.frames.map(f=>f.rafMs),durationMs=ms-run.measureMs;
      const result={phase:run.phase,view:run.view,startedAt:run.startedAt,completedAt:new Date().toISOString(),warmupMs:run.measureMs-run.startMs,durationMs,frameCount:times.length,averageFps:times.length/(durationMs/1000),frameTimeMs:summary(times),over33ms:times.filter(v=>v>33).length,over50ms:times.filter(v=>v>50).length,renderCpuMs:summary(run.frames.map(f=>f.renderCpuMs)),drawCalls:summary(run.frames.map(f=>f.calls)),triangles:summary(run.frames.map(f=>f.triangles)),textures:summary(run.frames.map(f=>f.textures)),hiddenInterruption:run.hidden,interruptions:run.interruptions,valid:!run.hidden&&!run.interruptions.length,startEnvironment:run.environment,endEnvironment:current,rawFrames:run.frames};
      results.push(result);run=null;phaseSelect.disabled=false;
      status.textContent=`${result.valid?'COMPLETE':'INTERRUPTED / INVALID'} · ${result.phase} · ${result.view}\n${result.frameCount} frames / ${(durationMs/1000).toFixed(2)}s\nMedian / p95 / p99: ${[result.frameTimeMs.median,result.frameTimeMs.p95,result.frameTimeMs.p99].map(v=>v?.toFixed(2)).join(' / ')} ms\n>33ms: ${result.over33ms} · >50ms: ${result.over50ms}\nExport QA JSON to retain this measured run.`;
    }
  }
  function interrupt(reason:string){mark(reason);if(run&&document.hidden)run.hidden=true;}
  const onVisibility=()=>{if(document.hidden)interrupt('Document hidden')};document.addEventListener('visibilitychange',onVisibility);
  const shortcutCommands:Partial<Record<string,SurfaceQaCommand>>={KeyR:{type:'bridge'},KeyL:{type:'orbit',height:'low'},KeyH:{type:'orbit',height:'high'},KeyS:{type:'stop'}};
  const onKeyDown=(event:KeyboardEvent)=>{
    if(!event.altKey||!event.shiftKey||event.ctrlKey||event.metaKey||event.repeat||event.isComposing)return;
    if(event.code==='KeyQ'){event.preventDefault();event.stopPropagation();root.style.display=root.style.display==='none'?'':'none';return}
    const action=shortcutCommands[event.code];if(!action)return;
    event.preventDefault();event.stopPropagation();options.invoke(action);
  };
  document.addEventListener('keydown',onKeyDown);
  status.textContent='Select one of the eight matched views. PNGs keep the live viewport. Measures have not run yet.';
  return {command,applyCamera,beginRender,endRender,environment,interrupt,dispose(){interrupt('Scene disposed');document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('keydown',onKeyDown);renderer.info.autoReset=autoReset;root.remove();}};
}
