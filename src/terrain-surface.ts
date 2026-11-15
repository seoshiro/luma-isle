import * as THREE from 'three';

export type SurfacePoint2 = readonly [x: number, z: number];
export type SurfacePoint3 = readonly [x: number, y: number, z: number];

/** Explicitly supplied island meshes only. Never pass a scene-wide mesh list. */
export interface TerrainSource {
  mesh: THREE.Mesh;
  role: 'island-body' | 'ground-top';
}

export interface TerrainOptions {
  /** Coordinates, bounds and samples are relative to this frame, or world space. */
  frame?: THREE.Object3D;
  minY: number;
  maxY: number;
  minNormalY?: number;
  /** UV seams duplicate vertices; weld positions for connectivity, not rendering. */
  weldTolerance?: number;
  componentPolicy?: 'largest' | 'all';
  minComponentArea?: number;
  cellSize?: number;
}

export interface TerrainFace {
  source: THREE.Mesh;
  sourceTriangle: number;
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  normal: THREE.Vector3;
  area: number;
  projectedArea: number;
}

export interface SurfaceHit {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  face: TerrainFace;
  barycentric: readonly [number, number, number];
}

export interface TerrainDiagnostics {
  sourceTriangles: number;
  candidateTriangles: number;
  rejectedDegenerate: number;
  rejectedHeight: number;
  rejectedSlope: number;
  components: number;
  keptTriangles: number;
  area: number;
  projectedArea: number;
}

function finitePositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive and finite`);
  return value;
}

function barycentricXZ(face: TerrainFace, x: number, z: number): [number, number, number] | null {
  const {a, b, c} = face;
  const denominator = (b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
  if (Math.abs(denominator) < 1e-12) return null;
  const u = ((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/denominator;
  const v = ((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/denominator;
  const w = 1-u-v;
  return u >= -1e-7 && v >= -1e-7 && w >= -1e-7 ? [u,v,w] : null;
}

/** Immutable surface snapshot. Construction is the only topology/indexing work. */
export class TerrainSurface {
  readonly bounds = new THREE.Box3();
  readonly cumulativeAreas: Float64Array;
  private readonly cells = new Map<string, number[]>();

  constructor(
    readonly faces: readonly TerrainFace[],
    readonly diagnostics: TerrainDiagnostics,
    readonly cellSize = .5,
  ) {
    finitePositive(cellSize, 'cellSize');
    this.cumulativeAreas = new Float64Array(faces.length);
    let area = 0;
    faces.forEach((face, index) => {
      const {a,b,c} = face;
      this.bounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);
      this.cumulativeAreas[index] = area += face.area;
      const minX = Math.floor(Math.min(a.x,b.x,c.x)/cellSize);
      const maxX = Math.floor(Math.max(a.x,b.x,c.x)/cellSize);
      const minZ = Math.floor(Math.min(a.z,b.z,c.z)/cellSize);
      const maxZ = Math.floor(Math.max(a.z,b.z,c.z)/cellSize);
      for (let x=minX; x<=maxX; x++) for (let z=minZ; z<=maxZ; z++) {
        const key = `${x},${z}`;
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(index); else this.cells.set(key,[index]);
      }
    });
  }

  /** Downward intersection with the selected ground, never roofs/cliff shelves. */
  sample(x: number, z: number): SurfaceHit | null {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const bucket = this.cells.get(`${Math.floor(x/this.cellSize)},${Math.floor(z/this.cellSize)}`);
    let hit: SurfaceHit | null = null;
    for (const index of bucket ?? []) {
      const face = this.faces[index];
      const weights = barycentricXZ(face,x,z);
      if (!weights) continue;
      const y = weights[0]*face.a.y+weights[1]*face.b.y+weights[2]*face.c.y;
      if (!hit || y>hit.position.y) hit = {
        position: new THREE.Vector3(x,y,z), normal: face.normal.clone(), face, barycentric: weights,
      };
    }
    return hit;
  }

  /** Equivalent area-weighted triangle sampling; caller owns the seeded RNG. */
  sampleArea(random: () => number): SurfaceHit | null {
    if (!this.faces.length) return null;
    const values = [random(),random(),random()];
    if (values.some(n => !Number.isFinite(n) || n<0 || n>=1)) throw new Error('Random samples must be in [0, 1)');
    const target = values[0]*this.cumulativeAreas[this.cumulativeAreas.length-1];
    let low=0, high=this.faces.length-1;
    while (low<high) { const mid=(low+high)>>>1; if (this.cumulativeAreas[mid]<=target) low=mid+1; else high=mid; }
    const face = this.faces[low];
    const root = Math.sqrt(values[1]);
    const weights: [number,number,number] = [1-root,root*(1-values[2]),root*values[2]];
    const position = new THREE.Vector3().addScaledVector(face.a,weights[0]).addScaledVector(face.b,weights[1]).addScaledVector(face.c,weights[2]);
    return {position,normal:face.normal.clone(),face,barycentric:weights};
  }

  /** A dedicated mesh for inspection or MeshSurfaceSampler, never an overlay. */
  createGeometry() {
    const positions: number[] = [], normals: number[] = [];
    for (const face of this.faces) for (const point of [face.a,face.b,face.c]) {
      positions.push(point.x,point.y,point.z);
      normals.push(face.normal.x,face.normal.y,face.normal.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  }
}

/** Pure extraction: source transforms/materials/geometries are never changed. */
export function createTerrainSurface(sources: readonly TerrainSource[], options: TerrainOptions) {
  if (!Number.isFinite(options.minY) || !Number.isFinite(options.maxY) || options.minY>=options.maxY) throw new Error('A finite ordered ground-height band is required');
  const minNormalY = options.minNormalY ?? .72;
  if (!(minNormalY>0 && minNormalY<=1)) throw new Error('minNormalY must be in (0, 1]');
  const weld = finitePositive(options.weldTolerance ?? .0001,'weldTolerance');
  const minimumArea = options.minComponentArea ?? .01;
  if (!Number.isFinite(minimumArea) || minimumArea<0) throw new Error('minComponentArea must not be negative');
  options.frame?.updateWorldMatrix(true,false);
  const inverseFrame = options.frame ? options.frame.matrixWorld.clone().invert() : new THREE.Matrix4();
  const candidates: TerrainFace[] = [];
  const diagnostics: TerrainDiagnostics = {sourceTriangles:0,candidateTriangles:0,rejectedDegenerate:0,rejectedHeight:0,rejectedSlope:0,components:0,keptTriangles:0,area:0,projectedArea:0};
  const edges = new Map<string,number>(), parents: number[] = [];
  const find = (index: number): number => {
    while (parents[index]!==index) {parents[index]=parents[parents[index]];index=parents[index];}
    return index;
  };
  const pointKey = (p: THREE.Vector3) => `${Math.round(p.x/weld)},${Math.round(p.y/weld)},${Math.round(p.z/weld)}`;
  for (const {mesh,role} of sources) {
    if (role!=='island-body' && role!=='ground-top') throw new Error('Only explicit island terrain sources are supported');
    mesh.updateWorldMatrix(true,false);
    const transform = inverseFrame.clone().multiply(mesh.matrixWorld);
    const determinant = transform.determinant();
    if (!Number.isFinite(determinant) || Math.abs(determinant)<1e-12) throw new Error('Terrain source transform is singular');
    const geometry=mesh.geometry, position=geometry.getAttribute('position'), index=geometry.getIndex();
    if (!position || position.itemSize<3) continue;
    const total=index?.count ?? position.count;
    const start=Math.max(0,Math.ceil(geometry.drawRange.start/3)*3);
    const end=Math.min(total,Number.isFinite(geometry.drawRange.count)?geometry.drawRange.start+geometry.drawRange.count:total);
    for (let i=start; i+2<end; i+=3) {
      diagnostics.sourceTriangles++;
      const points = [0,1,2].map(offset => new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i+offset):i+offset).applyMatrix4(transform));
      // A mirrored source reverses winding; match the renderer's corrected front face.
      if(determinant<0)[points[1],points[2]]=[points[2],points[1]];
      const [a,b,c]=points;
      const cross=b.clone().sub(a).cross(c.clone().sub(a));
      const area=cross.length()*.5;
      if (!Number.isFinite(area) || area<1e-10 || points.some(p=>![p.x,p.y,p.z].every(Number.isFinite))) {diagnostics.rejectedDegenerate++;continue;}
      const normal=cross.normalize();
      if (Math.min(a.y,b.y,c.y)<options.minY || Math.max(a.y,b.y,c.y)>options.maxY) {diagnostics.rejectedHeight++;continue;}
      if (normal.y<minNormalY) {diagnostics.rejectedSlope++;continue;}
      const faceIndex=candidates.length;
      candidates.push({source:mesh,sourceTriangle:i/3,a,b,c,normal,area,projectedArea:area*normal.y});
      parents.push(faceIndex);
      const keys=points.map(pointKey);
      for (let j=0;j<3;j++) {
        const edge=[keys[j],keys[(j+1)%3]].sort().join('|');
        const prior=edges.get(edge);
        if (prior===undefined) edges.set(edge,faceIndex); else parents[find(faceIndex)]=find(prior);
      }
    }
  }
  diagnostics.candidateTriangles=candidates.length;
  const componentArea = new Map<number,number>();
  candidates.forEach((face,i)=>{const key=find(i);componentArea.set(key,(componentArea.get(key)??0)+face.projectedArea);});
  diagnostics.components=componentArea.size;
  let largest=-1, largestArea=-1;
  for (const [component,area] of componentArea) if (area>largestArea) {largest=component;largestArea=area;}
  const faces=candidates.filter((_,i)=>{
    const component=find(i);
    return (componentArea.get(component)??0)>=minimumArea && (options.componentPolicy==='all' || component===largest);
  });
  diagnostics.keptTriangles=faces.length;
  diagnostics.area=faces.reduce((sum,face)=>sum+face.area,0);
  diagnostics.projectedArea=faces.reduce((sum,face)=>sum+face.projectedArea,0);
  return new TerrainSurface(faces,diagnostics,options.cellSize);
}

/** Independent random streams keep terrain work from changing puzzles/cloud layout. */
export function surfaceRandom(seed: number | string) {
  let state=2166136261;
  for (const char of String(seed)) state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
  return () => {state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
