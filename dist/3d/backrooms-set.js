import * as THREE from 'three';
import { fitModel } from './map-dressing.js';
import { preloadAnnexDetail, preloadAnnexFit, preloadAnnexJunctions, preloadAnnexPitLining, preloadAnnexUtilities } from './architecture-kit.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { waitForRenderIdle } from './render-idle.js';

// The conversion from longitudinal distance to world Z is the same one used
// by the chase simulation. There is no floor mesh beneath pits or phase spans.
const asset = new URL('./assets/env/backrooms-annex.glb', import.meta.url);
let template;
export function preloadBackroomsSet() {
  if (!template)
    template = new GLTFLoader()
      .loadAsync(asset.href)
      .then((gltf) => gltf.scene)
      .catch((error) => {
        template = null;
        console.warn('Records annex scenery could not load.', error);
        return null;
      });
  return template;
}

function planSet(track) {
  const placements = [],
    lights = [],
    signs = [],
    contacts = [];
  const { centerX: cx, startZ, endZ, width } = track;
  const limit = width / 2;
  const roomAt = (distance) =>
    distance < track.length * 0.22
      ? 0
      : distance < track.length * 0.49
        ? 1
        : distance < track.length * 0.75
          ? 2
          : 3;
  function put(name, x, y, z, scale = [1, 1, 1], yaw = 0, phase = 'neutral', shade = 1) {
    const matrix = new THREE.Matrix4().makeRotationY(yaw);
    matrix.scale(new THREE.Vector3(...scale)).setPosition(x, y, z);
    placements.push({ name, matrix, phase, shade, z });
  }
  const unsupported=track.obstacles.filter(o=>o.kind==='gap'||o.kind==='bridge');
  function recessThreshold(x,z,yaw) {
    let start=startZ-z-2.4;
    const end=start+4.8;
    const at=(a,b)=>{
      if (b-a<=.19) return;
      put('recessbar',x,0,startZ-(a+b)/2,[1,1,(b-a-.08)/2.4],yaw);
    };
    for (const pit of unsupported) {
      const stop=pit.at+pit.length;
      if (stop<=start || pit.at>=end) continue;
      at(start,pit.at);
      start=Math.max(start,stop);
    }
    at(start,end);
  }
  function carpet(from, to, phase) {
    const seam=track.length*.22;
    if (!phase && from<seam && seam<to) {
      carpet(from,seam);
      carpet(seam,to);
      for (let lane=-1;lane<=1;lane++) put('floorbar',cx+lane*width/3,0,startZ-seam,[width/7.2,1,1]);
      return;
    }
    const count = Math.ceil((to - from) / (phase ? 1.2 : 2.4));
    if (count < 1) return;
    const step = (to - from) / count;
    for (let i = 0; i < count; i++) {
      const distance = from + (i + .5)*step;
      const z = startZ - distance;
      const covered = !phase && roomAt(distance)===0;
      if (covered) for (const side of [-1,1])
        // Sit room-side of the RC29 cove toe; stitches must not be buried.
        put('carpetbound',cx+side*(limit-.103),0,z,[1,1,step/2.4],side<0?Math.PI:0);
      for (let lane = -1; lane <= 1; lane++) {
        put(
          phase ? 'bridge' : covered ? 'carpet' : 'cementfloor',
          cx + (lane * width) / 3,
          0,
          z,
          [width / 7.2, 1, step / (phase ? 1.2 : 2.4)],
          0,
          phase || 'neutral',
          0.955 + 0.015 * ((i + lane + 4) % 4)
        );
      }
    }
  }
  let from = -13;
  for (const ob of track.obstacles) {
    const lengthX = ob.right - ob.left;
    const z = startZ - ob.at - ob.length / 2;
    if (ob.kind === 'gap' || ob.kind === 'bridge') {
      carpet(from, ob.at);
      if (ob.kind === 'bridge') {
        carpet(ob.at,ob.at+ob.length,ob.phase);
        for (const [sx,sz,yaw] of [[1,1,0],[1,-1,Math.PI/2],[-1,-1,Math.PI],[-1,1,-Math.PI/2]]) {
          put('bridgecorner',cx+sx*(limit-.047),0,z+sz*(ob.length/2-.049),[1,1,1],yaw,ob.phase);
        }
      }
      // The fixed nose assemblies grip the permanent ledges, never the
      // bridge. Slight setback keeps the rolled face within the shaft rim.
      for (let lane = -1; lane <= 1; lane++) {
        const x=cx+lane*width/3;
        put('dangerlip',x,0,startZ-ob.at+.027,[width/7.2,1,1]);
        put('dangerlip',x,0,startZ-ob.at-ob.length-.027,[width/7.2,1,1],Math.PI);
        put(
          'cementfloor',
          cx + (lane * width) / 3,
          -4.25,
          z,
          [width / 7.2, 1, ob.length / 2.4],
          0,
          'neutral',
          0.44
        );
      }
      for (const side of [-1, 1])
        put(
          'pitwall',
          cx + side * (limit + 0.06),
          -4.17,
          z,
          [ob.length / 4.8, 1.262, 1],
          (-side * Math.PI) / 2,
          'neutral',
          0.62
        );
      for (const edge of [-1, 1])
        put(
          'pitwall',
          cx,
          -4.2,
          z + (edge * ob.length) / 2,
          [width / 4.8, 1.272, 0.8],
          edge < 0 ? 0 : Math.PI,
          'neutral',
          0.62
        );
      from = ob.at + ob.length;
    } else if (ob.kind === 'hurdle') {
      for (let i = 0; i < 4; i++) {
        put('barrier', cx + ob.left + (lengthX * (i + 0.5)) / 4, 0, z, [
          lengthX / 4 / 1.91,
          ob.height / 0.64,
          ob.length / 0.62
        ]);
      }
      contacts.push([cx, z, lengthX, ob.length + 0.24]);
    } else if (ob.kind === 'rack') {
      for (let i = 0; i < 3; i++)
        for (const row of [-1, 1]) {
          put(
            'rack',
            cx + ob.left + (lengthX * (i + 0.5)) / 3,
            0,
            z + (row * ob.length) / 4,
            [lengthX / 3 / 1.52, ob.height / 1.97, ob.length / 2 / 0.57],
            row === 1 ? 0 : Math.PI
          );
        }
      contacts.push([cx + (ob.left + ob.right) / 2, z, lengthX + 0.16, ob.length + 0.32]);
    }
    if (ob.kind === 'rack' || ob.kind === 'bridge')
      signs.push({
        z: z + 6.8,
        label:
          ob.kind === 'rack'
            ? ob.left < -2
              ? 'RIGHT   >'
              : '<   LEFT'
            : ob.phase === 'night'
              ? '18:00  /  X'
              : '17:59  /  X',
        accent: ob.kind === 'bridge' ? '#d9d4a2' : '#bcd8b5'
      });
  }
  carpet(from, track.length + 3.0);
  const near = startZ + 13;
  const far = endZ - 3;
  const bays = Math.ceil((near - far) / 4.8);
  const roomWall = ['wall', 'tiledwall', 'concretewall', 'concretewall'];
  const roomHeight = [3.3, 4.15, 4.85, 3.6];
  const roomSigns = ['INTAKE  /  A', 'RETURN AIR  /  B', 'MICROFILM  /  C', 'FIRE STAIR  /  D'];
  let priorRoom = -1;
  for (let i = 0; i < bays; i++) {
    const z = near - (i + 0.5) * 4.8;
    const room = roomAt(startZ - z);
    const h = roomHeight[room];
    const wall = roomWall[room];
    const change = room !== priorRoom;
    const opening = i % 8 >= 2 && i % 8 <= 4;
    const gallery = room === 2 && !change && opening;
    const utility = room === 1 && !change && i % 4 === 2;
    if (change) {
      signs.push({
        z: z - 0.55,
        label: roomSigns[room],
        accent: room === 3 ? '#ffc791' : '#ece0ae',
        width: 2.25
      });
      if (priorRoom >= 0) {
        const lower = Math.min(h, roomHeight[priorRoom]);
        const upper = Math.max(h, roomHeight[priorRoom]);
        put('concretewall', cx, lower - 0.09, z + 2.4, [width / 4.8, (upper - lower + 0.13) / 3.3, 1.5]);
        put('transferbeam', cx, 2.82, z + 2.05, [1.01, 0.88, 1.4]);
        for (const side of [-1,1]) put('paneljoint',cx+side*(limit+.005),0,z+2.4,[1,lower,1],-side*Math.PI/2);
      }
    }
    priorRoom = room;
    for (const side of [-1, 1]) {
      const turn = (-side * Math.PI) / 2;
      const storage = room === 0 && (i + (side < 0 ? 4 : 0)) % 9 === 5;
      const recess = gallery ? 2.45 : utility ? 1.6 : storage ? 1.36 : 0;
      const wallX = cx + side * (limit + 0.07 + recess);
      put(wall, wallX, 0, z, [1, h / 3.3, 1], turn, 'neutral', 0.9 + 0.025 * ((i + side + 2) % 4));
      put('cove',wallX-side*.061,0,z,[1,1,1],turn);
      put('crown',wallX-side*.041,h-.016,z,[1,1,1],turn);
      if (recess) {
        recessThreshold(cx+side*(limit+.025),z,side<0?Math.PI:0);
        const x = cx + side * (limit + recess / 2);
        for (const end of [-1, 1]) {
          // Adjacent microfilm bays share one gallery instead of adding dead-end partitions.
          const openEnd = gallery && ((end === 1 && (i - 1) % 8 >= 2) || (end === -1 && i % 8 < 4));
          if (!openEnd) {
            const yaw=end === -1 ? 0 : Math.PI;
            put(wall,x,0,z+end*2.4,[recess/4.8,h/3.3,1],yaw);
            put('cove',x,0,z+end*2.339,[recess/4.8,1,1],yaw);
            put('crown',x,h-.016,z+end*2.359,[recess/4.8,1,1],yaw);
            put('paneljoint',wallX-side*.056,0,z+end*2.362,[.78,h,1],turn);
          }
          put('cementfloor', x, 0, z + end * 1.2, [recess / 2.4, 1, 1]);
          put('ceiling', x, h, z + end * 1.2, [recess / 2.4, 1, 1]);
        }
        put('pipes', cx + side * (limit + 0.085), 0.7, z, [2.07, 0.64, 0.68], turn);
        if (gallery) {
          put('rack', wallX - side * 0.36, 0, z, [2.1, 1.22, 1], turn);
          if (i % 2 === 0) put('cart', x, 0, z + 0.93, [1.1, 0.94, 1.1], turn + side * 0.37);
        } else if (utility) {
          put('ventilator', wallX - side * 0.11, 1.9, z, [1.06, 1.06, 1.06], turn);
          put('ventrotor', wallX - side * 0.11, 1.9, z, [1.06, 1.06, 1.06], turn);
          put('pipes', wallX - side * 0.17, 0.35, z, [1.82, 0.75, 1.3], turn);
          // Put the new assets behind the corridor boundary and off the existing pipe runs.
          const binSide=i%8===2 ? -1 : 1;
          if(side===binSide) put('recessbin',wallX-side*.752,0,z+1.47,[1,1,1],turn);
          put('recessextinguisher',wallX-side*.191,1.10,z-1.52,[1,1,1],turn);
          lights.push({ x: wallX - side * 0.36, z, y: 2.81, strength: 15 });
        } else {
          put('cart', x, 0, z + 0.8, [1, 1, 1], turn + 0.11);
          put('cabinet', cx + side * (limit + 0.94), 0, z - 0.86, [1, 1, 1], turn);
        }
        continue;
      }

      if (room === 0 && (i + (side + 1) * 2) % 7 === 3)
        put('door', cx + side * (limit + 0.039), 0.004, z, [1, 1, 0.33], turn);
      if ((room === 0 && (i + side + 4) % 5 === 0) || (room === 3 && i % 3 === 1))
        put('grille', cx + side * (limit + 0.024), 2.67, z + 0.56, [1, 1, 0.48], turn);
      if (room === 1) put('pipes', cx + side * (limit + 0.045), 2.5, z, [2.07, 1.14, 1.38], turn);
      if (room === 3 && (i + side) % 3 === 0) {
        const x = cx + side * (limit - 0.08);
        put('bulkheadlamp', x, 2.25, z, [1, 1, 1], turn);
        lights.push({ x: x - side * 0.18, z, y: 2.25, strength: 12, type: 'alarm' });
      }
    }
    for (let lane = -1; lane <= 1; lane++)
      for (const dz of [-1.2, 1.2])
        put(
          'ceiling',
          cx + (lane * width) / 3,
          h,
          z + dz,
          [width / 7.2, 1, 1],
          0,
          'neutral',
          0.9 + 0.024 * ((i + lane + 3) % 4)
        );
    if (room === 1 || (room === 2 && i % 2 === 1))
      put('transferbeam', cx, room === 1 ? 3.5 : 4.02, z - 2.27, [1.04, 1, 1], 0);
    if (i % 2 === 0 || (room === 3 && i % 3 === 0)) {
      const x = cx + Math.sin(i * 1.7) * (i % 3 === 0 ? 1.42 : 0.65);
      const y = [3.165, 3.37, 3.99, 3.32][room];
      put('troffer', x, y, z, [1.04, 1, 1], i % 8 === 0 ? 0 : Math.PI / 2);
      lights.push({ x, z, y: y - 0.07, strength: room === 2 ? 25 : i % 9 === 0 ? 13 : 18 });
    }
  }
  for (const [z, turn] of [
    [endZ - 1.4, 0],
    [startZ + 11.9, Math.PI]
  ]) {
    const wing = (width - 1.72) / 2,
      direction = turn === 0 ? 1 : -1;
    for (const side of [-1, 1])
      put('wall', cx + side * (0.86 + wing / 2), 0, z, [wing / 4.8, 1, 1], turn);
    put('wall', cx, 2.54, z, [1.72 / 4.8, 0.23, 1], turn);
    if (turn === 0) {
      put('doorframe', cx, 0.005, z + 0.11, [1.4, 1.14, 1], 0);
      put('doorleaf', cx, 0.005, z + 0.11, [1.4, 1.14, 1], 0);
      put('doorsill',cx,0,z+.221,[1.4,1,1],0);
      // The door swings away into a lit landing, with a floor and back wall.
      put('carpet', cx, 0, z - 1.77, [1.1, 1, 1.48]);
      put('ceiling', cx, 3.29, z - 1.77, [1.1, 1, 1.48]);
      put('wall', cx, 0, z - 3.48, [0.55, 1, 1]);
      for (const side of [-1, 1])
        put('wall', cx + side * 1.27, 0, z - 1.77, [0.74, 1, 1], (-side * Math.PI) / 2);
      lights.push({ x: cx, z: z - 1.65, y: 2.88, strength: 10 });
    } else put('door', cx, 0.005, z - 0.11, [1.4, 1.14, 1], turn);
    if (direction > 0) put('exit', cx, 2.78, z + 0.17, [1.25, 1.05, 1], turn);
    else signs.push({ z: z - 0.17, label: 'RECORDS LIFT', accent: '#e1c68b', facing: Math.PI });
  }
  return { placements, lights, signs, contacts };
}

const approx = {
  wall: [4.8, 3.3, 0.09, '#aca078'],
  carpet: [2.4, 0.074, 2.4, '#726957'],
  cementfloor: [2.4, 0.086, 2.4, '#73786c'],
  concretewall: [4.8, 3.3, 0.13, '#858579'],
  pitwall: [4.8, 3.3, 0.13, '#858579'],
  tiledwall: [4.8, 3.3, 0.13, '#708780'],
  transferbeam: [7.75, 0.53, 0.47, '#794e3d'],
  ceiling: [2.4, 0.05, 2.4, '#a49f8a'],
  troffer: [1.26, 0.085, 0.48, '#eee4ad'],
  barrier: [1.91, 0.64, 0.62, '#d4a557'],
  rack: [1.52, 1.97, 0.57, '#987952'],
  doorframe: [1.36, 2.29, 0.16, '#79684c'],
  doorleaf: [1.18, 2.18, 0.085, '#79684c'],
  bridge: [2.4, 0.114, 1.2, '#82959b'],
  door: [1.36, 2.29, 0.16, '#79684c'],
  exit: [1.16, 0.36, 0.19, '#a5c9ab']
};
function previewKits() {
  const byName = new Map();
  for (const [name, [w, h, d, color]] of Object.entries(approx)) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const floor = name === 'carpet' || name === 'bridge' || name === 'cementfloor';
    geometry.translate(0, floor ? -h / 2 : name === 'exit' ? 0 : h / 2, 0);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    byName.set(name, [{ geometry, material }]);
  }
  return byName;
}
function authoredKits(scene) {
  const byName = new Map();
  scene.updateMatrixWorld(true);
  for (const node of scene.children) {
    const list = [];
    node.traverse((part) => {
      if (part.isMesh) list.push({ geometry: part.geometry, material: part.material });
    });
    byName.set(node.name.replace(/^Annex_/, ''), list);
  }
  return byName;
}

function instanceSet(groups, placements, kits) {
  const entries = new Map();
  for (const entry of placements) {
    const key = entry.phase + '/' + entry.name;
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push(entry);
  }
  const buckets = [];
  for (const list of entries.values()) {
    const { name, phase } = list[0];
    for (const { geometry, material } of kits.get(name) ?? []) {
      const inst = new THREE.InstancedMesh(geometry, material, list.length);
      inst.name = 'Records ' + name + ' ' + phase;
      inst.castShadow = ![
        'carpet',
        'cementfloor',
        'ceiling',
        'wall',
        'tiledwall',
        'concretewall',
        'pitwall',
        'bridge',
        'dangerlip', 'cove', 'crown', 'doorsill', 'floorbar', 'paneljoint', 'bridgecorner', 'carpetbound', 'recessbar'
      ].includes(name);
      inst.receiveShadow = true;
      inst.frustumCulled = false;
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      groups[phase].add(inst);
      buckets.push({ inst, list });
    }
  }
  const color = new THREE.Color();
  const hinge = new THREE.Matrix4().makeTranslation(-0.593, 0, 0);
  const offset = new THREE.Matrix4().makeTranslation(0.593, 0, 0);
  const rotation = new THREE.Matrix4(),
    moving = new THREE.Matrix4();
  const spin = new THREE.Matrix4();
  let fanAngle = 0;
  let lastCell = null,
    lastDoor = -1;
  return {
    update(z, door = 0, dt = 0, night = false) {
      const cell = Math.floor(z / 6);
      const newCell = lastCell !== cell;
      if (!newCell && door === lastDoor && !dt) return;
      fanAngle += dt * (night ? 1.65 : 7.4);
      lastCell = cell;
      lastDoor = door;
      rotation.makeRotationY(1.49 * THREE.MathUtils.smoothstep(door, 0.06, 0.87));
      for (const { inst, list } of buckets) {
        const swinging = list[0].name === 'doorleaf';
        const rotor = list[0].name === 'ventrotor';
        if (!newCell && !swinging && !rotor) continue;
        let n = 0;
        for (const p of list) {
          if (Math.abs(p.z - cell * 6 - 3) > 66) continue;
          inst.setMatrixAt(
            n,
            swinging
              ? moving.copy(p.matrix).multiply(hinge).multiply(rotation).multiply(offset)
              : rotor
                ? moving.copy(p.matrix).multiply(spin.makeRotationZ(fanAngle + p.z * 0.7))
                : p.matrix
          );
          inst.setColorAt(n, color.setRGB(p.shade, p.shade, p.shade));
          n++;
        }
        inst.count = n;
        inst.visible = n > 0;
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      }
    },
    clear() {
      for (const { inst } of buckets) {
        inst.removeFromParent();
        inst.dispose();
      }
    }
  };
}

function wallSigns(visual, track, signs) {
  const geometry = new THREE.BoxGeometry(1, 0.32, 0.045);
  const materials = new Map();
  for (const sign of signs) {
    if (!materials.has(sign.label)) {
      const c = document.createElement('canvas');
      c.width = 384;
      c.height = 88;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#384a40';
      ctx.fillRect(0, 0, 384, 88);
      ctx.strokeStyle = '#8e987c';
      ctx.lineWidth = 4;
      ctx.strokeRect(5, 5, 374, 78);
      ctx.fillStyle = sign.accent || '#decda8';
      ctx.font = 'bold 39px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.label, 192, 45, 350);
      for (const x of [14, 370]) {
        ctx.fillStyle = '#b7b6a2';
        ctx.beginPath();
        ctx.arc(x, 44, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      const texture = new THREE.CanvasTexture(c);
      texture.colorSpace = THREE.SRGBColorSpace;
      visual.localTextures.push(texture);
      materials.set(
        sign.label,
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.48,
          metalness: 0.14,
          emissive: '#494638',
          emissiveMap: texture,
          emissiveIntensity: 0.36
        })
      );
    }
    // The next-turn sign hangs above the path; archive range plates sit on the wall.
    const m = new THREE.Mesh(geometry, materials.get(sign.label));
    const side = sign.side || 0;
    m.position.set(track.centerX + side * (track.width / 2 - 0.025), side ? 1.86 : 2.85, sign.z);
    m.rotation.y = sign.facing ?? (-side * Math.PI) / 2;
    m.scale.x = sign.width ?? (side ? 1.14 : 1.62);
    m.receiveShadow = true;
    visual.stage.add(m);
  }
}

function contactPatches(visual, contacts) {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(48, 48, 3, 48, 48, 48);
  g.addColorStop(0, 'rgba(28,20,13,.63)');
  g.addColorStop(0.65, 'rgba(30,21,15,.35)');
  g.addColorStop(1, 'rgba(32,23,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  visual.localTextures.push(map);
  const m = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
    contacts.length
  );
  const o = new THREE.Object3D();
  o.rotation.x = -Math.PI / 2;
  contacts.forEach(([x, z, w, d], i) => {
    o.position.set(x, 0.012, z);
    o.scale.set(w * 1.12, d * 1.4, 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  visual.stage.add(m);
}

function driftingFibres(visual, lights, track) {
  const count = 144;
  const coords = new Float32Array(count * 3),
    alpha = new Float32Array(count);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(coords, 3).setUsage(THREE.DynamicDrawUsage)
  );
  geometry.setAttribute('aGlow', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { tint: { value: new THREE.Color('#ffe3a6') } },
    vertexShader: `attribute float aGlow; varying float glow; void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(8./max(1.,-mv.z),1.,2.8);glow=aGlow;}`,
    fragmentShader: `uniform vec3 tint;varying float glow;void main(){float a=1.-smoothstep(.12,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(tint,glow*a);}`
  });
  const dust = new THREE.Points(geometry, material);
  dust.frustumCulled = false;
  visual.stage.add(dust);
  // Map half-metre slices to their actual fixture, including irregular bays.
  const minZ = Math.floor(track.endZ - 24);
  const nearest = Array.from({ length: Math.ceil((track.length + 60) * 2) }, (_, i) => {
    const z = minZ + i * 0.5;
    return lights.reduce((a, b) => (Math.abs(a.z - z) <= Math.abs(b.z - z) ? a : b));
  });
  const warm = new THREE.Color('#ffe3a6'),
    cold = new THREE.Color('#b9d9d8');
  return function update(state) {
    dust.visible = !(state.reduceMotion || state.reducedMotion || state.reducedEffects);
    if (!dust.visible) return;
    material.uniforms.tint.value.copy(state.night ? cold : warm);
    const t = state.time;
    const i0 = Math.floor(state.z / 12);
    for (let i = 0; i < count; i++) {
      const s = i + 1,
        band = i % 3,
        z = (i0 + band - 1) * 12 + ((s * 0.754877666) % 1) * 12;
      const x = track.centerX + (((s * 0.61803399) % 1) - 0.5) * 6.9 + Math.sin(t * 0.63 + s) * 0.12;
      const y = 0.2 + ((s * 0.37 + t * 0.026 + Math.sin(t * 0.72 + s) * 0.014) % 2.85);
      const fixture = nearest[Math.min(nearest.length - 1, Math.max(0, Math.round((z - minZ) * 2)))];
      const dx = x - fixture.x,
        dz = z - fixture.z;
      const light = Math.max(0, 1 - (dx * dx + dz * dz) / 27);
      coords[i * 3] = x;
      coords[i * 3 + 1] = y;
      coords[i * 3 + 2] = z;
      alpha[i] = 0.075 + 0.45 * light;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aGlow.needsUpdate = true;
  };
}

const importedKits = new Map();
function preloadImportedKit(file, name, fit) {
  if (!importedKits.has(file)) importedKits.set(file, new GLTFLoader().loadAsync(new URL('./assets/env/' + file + '.glb', import.meta.url).href).then(({ scene }) => {
    const kit = [];
    const transform = fitModel(scene,fit);
    scene.traverse(part => {
      if (!part.isMesh) return;
      // Envelopes match the original course. No phase or collision state changes.
      const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld).applyMatrix4(transform);
      geometry.name = name;
      kit.push({ geometry, material: part.material });
      part.geometry.dispose();
    });
    return kit;
  }).catch(error => { importedKits.delete(file); console.warn('Annex kit unavailable: ' + file,error); return null; }));
  return importedKits.get(file);
}

export function mountBackroomsSet(visual, track) {
  const plan = planSet(track),
    fallback = previewKits();
  const secondary = [
    ['recessbin','annex-recess-bin','Poly Haven rusted metal can',[.855,.906,.556]],
    ['recessextinguisher','annex-recess-extinguisher','Poly Haven wall fire extinguisher',[.280,.659,.367]]
  ];
  const secondaryKeys = new Set(secondary.map(([key]) => key));
  const corePlacements = plan.placements.filter(item => !secondaryKeys.has(item.name));
  const decor = [];
  let active = true;
  let meshes = instanceSet(visual.groups, plan.placements, fallback);
  meshes.update(track.startZ);
  for (const l of plan.lights)
    visual.lightSource(l.x, l.y, l.z, l.strength, l.type || 'general', l.type ? 0.6 : 0.42);
  wallSigns(visual, track, plan.signs);
  contactPatches(visual, plan.contacts);
  const animateDust = driftingFibres(visual, plan.lights, track);
  const removeFallback = () => {
    for (const list of fallback.values())
      for (const { geometry, material } of list) {
        geometry.dispose();
        material.dispose();
      }
    fallback.clear();
  };
  const coreReady = Promise.all([
    preloadBackroomsSet(),
    preloadImportedKit('annex-steel-rack','Poly Haven worn metal rack',[1.52,1.97,.57]),
    preloadImportedKit('annex-shipping-crate','Poly Haven wooden shipping crate',[1.91,.64,.62]),
    preloadAnnexPitLining(),
    preloadAnnexJunctions(),
    preloadAnnexUtilities(),
    preloadAnnexDetail(),
    preloadAnnexFit()
  ]).then(([scene, rack, crate, pit, junctions, utilities, detail, fit]) => {
    if (!scene || !active) return false;
    meshes.clear();
    removeFallback();
    const kits = authoredKits(scene);
    if (rack?.length) kits.set('rack', rack);
    if (crate?.length) kits.set('barrier',crate);
    kits.set('pitwall',pit.length ? pit : kits.get('concretewall'));
    for (const [name,kit] of [...junctions,...utilities,...detail,...fit]) kits.set(name,kit);
    meshes = instanceSet(visual.groups, corePlacements, kits);
    meshes.update(visual.camera.position.z);
    visual.renderer.shadowMap.needsUpdate = true;
    return true;
  });
  const ready = coreReady.then(async mounted => {
    if (!mounted) return false;
    // Finish the course before side-recess props can compete with its fetch,
    // upload or initial draw. Each decoration can succeed independently.
    for (const [key, file, preparation, size] of secondary) {
      await waitForRenderIdle();
      if (!active) return false;
      const kit = await preloadImportedKit(file, preparation, size);
      if (!active) return false;
      if (!kit?.length) continue;
      const instances = instanceSet(visual.groups, plan.placements.filter(item => item.name === key), new Map([[key, kit]]));
      instances.update(visual.camera.position.z);
      decor.push(instances);
      visual.renderer.shadowMap.needsUpdate = true;
    }
    return true;
  });
  return {
    ready,
    update(state, dt) {
      meshes.update(state.z, state.door, state.reduceMotion ? 0 : dt, state.night);
      for (const instances of decor) instances.update(state.z);
      animateDust(state);
    },
    dispose() {
      active = false;
      meshes.clear();
      for (const instances of decor) instances.clear();
      removeFallback();
    }
  };
}
