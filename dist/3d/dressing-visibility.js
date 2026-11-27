import { TILE } from './levels.js';
const boilerWallTop = 3.28;
const rooms = new WeakMap();

export function dressingBounds(points, [width, height, depth]) {
  let minX = Infinity, minZ = Infinity, minY = Infinity;
  let maxX = -Infinity, maxZ = -Infinity, maxY = -Infinity;
  for (const {x, y, z, yaw} of points) {
    const cos = Math.abs(Math.cos(yaw)), sin = Math.abs(Math.sin(yaw));
    const dx = (width * cos + depth * sin) / 2 + .018;
    const dz = (width * sin + depth * cos) / 2 + .018;
    minX = Math.min(minX, x - dx);
    maxX = Math.max(maxX, x + dx);
    minZ = Math.min(minZ, z - dz);
    maxZ = Math.max(maxZ, z + dz);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + height);
  }
  return boundsOf(minX, minY, minZ, maxX, maxY, maxZ);
}

function boundsOf(minX, minY, minZ, maxX, maxY, maxZ) {
  return {minX,minY,minZ,maxX,maxY,maxZ, corners: [[minX,minZ],[minX,maxZ],[maxX,minZ],[maxX,maxZ]]};
}

export function opaqueWallSpans(map) {
  const spans = new Map();
  const add = (col, row, endCol, endRow) => {
    const key = [col,row,endCol,endRow].join('/');
    spans.set(key, [col*TILE+.015, row*TILE+.015, (endCol+1)*TILE-.015, (endRow+1)*TILE-.015]);
  };
  for (const {col,row} of map.walls) {
    if (map.get(col-1,row)?.kind !== '#') {
      let end = col;
      while (map.get(end+1,row)?.kind === '#') end++;
      add(col,row,end,row);
    }
    if (map.get(col,row-1)?.kind !== '#') {
      let end = row;
      while (map.get(col,end+1)?.kind === '#') end++;
      add(col,row,col,end);
    }
  }
  return [...spans.values()];
}

function between(source, bounds, [x0,z0,x1,z1]) {
  return source.x < x0 && bounds.minX > x1 || source.x > x1 && bounds.maxX < x0 ||
    source.z < z0 && bounds.minZ > z1 || source.z > z1 && bounds.maxZ < z0;
}

function crosses(source, x, z, [x0,z0,x1,z1]) {
  const dx = x - source.x, dz = z - source.z;
  if (!dx && (source.x <= x0 || source.x >= x1)) return false;
  if (!dz && (source.z <= z0 || source.z >= z1)) return false;
  const ax = dx ? (x0 - source.x) / dx : -Infinity;
  const bx = dx ? (x1 - source.x) / dx : Infinity;
  const az = dz ? (z0 - source.z) / dz : -Infinity;
  const bz = dz ? (z1 - source.z) / dz : Infinity;
  const enter = Math.max(0, Math.min(ax,bx), Math.min(az,bz));
  const leave = Math.min(1, Math.max(ax,bx), Math.max(az,bz));
  return leave - enter > 1e-5;
}

export function dressingOccluded(spans, bounds, eye, light, wallTop = boilerWallTop) {
  if (bounds.minY < -.24 || bounds.maxY >= wallTop - .02) return false;
  if (Math.max(eye.y, light.y) >= wallTop - .02 || Math.min(eye.y, light.y) < -.24) return false;
  // The wall must be in front of the whole bound. Its projected silhouette
  // is convex, so the four corner rays cover the intervening faces.
  const hidden = source => spans.some(span => between(source, bounds, span) &&
    bounds.corners.every(([x,z]) => crosses(source, x, z, span)));
  return hidden(eye) && hidden(light);
}

export function trackBoilerBatch(visual, instances, bounds = null) {
  if (visual.theme !== 0 || !instances.length || visual.decoded.level?.id === 'backrooms') return;
  const stage = visual.stage;
  if (!rooms.has(stage)) rooms.set(stage, {spans: opaqueWallSpans(visual.decoded), batches: []});
  if (!bounds) {
    instances[0].computeBoundingBox();
    const {min, max} = instances[0].boundingBox;
    bounds = boundsOf(min.x,min.y,min.z,max.x,max.y,max.z);
  }
  rooms.get(stage).batches.push({bounds, instances});
}

export function updateBoilerBatches(visual) {
  const room = rooms.get(visual.stage);
  if (!room) return;
  const {spans, batches} = room;
  const eye = visual.camera.position, light = visual.lamp.position;
  const last = room.last;
  if (last && eye.equals(last.eye) && light.equals(last.light) && last.count === batches.length) return;
  room.last = {eye: eye.clone(), light: light.clone(), count: batches.length};
  for (const {bounds, instances} of batches) {
    const visible = !dressingOccluded(spans, bounds, eye, light);
    for (const batch of instances) batch.visible = visible;
  }
}
