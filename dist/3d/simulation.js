import { BACKROOMS_LEVEL, BACKROOMS_TRACK, advancePursuit, beginPursuit, chaseBlocked, chaseFloor, runDistance } from './backrooms-track.js';
import { LEVELS, TILE, decodeLevel } from './levels.js';

export const SAVE_KEY = 'last-light-3d-v1';
export const STEP = 1 / 120;
const PLAYER_RADIUS = 0.28;
const GHOST_RADIUS = 0.24;
const GRAVITY = 18;
const JUMP_SPEED = 5.7;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const cardinals = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function key(tile) {
  return tile.key ?? tile.kind;
}

export function floorActive(tile, night) {
  return Boolean(tile && !['#', ' '].includes(tile.kind) &&
    (tile.kind !== 'd' || !night) && (tile.kind !== 'n' || night));
}

export function defaultProgress() {
  return { chapter: 0, work: {}, evidence: [], checkpoint: null, powered: false, finished: false, deaths: 0 };
}

function readProgress(data, levels) {
  if (!data || data.schema !== 1) return defaultProgress();
  const safe = defaultProgress();
  safe.chapter = Number.isInteger(data.chapter) ? clamp(data.chapter, 0, levels.length - 1) : 0;
  for (const [i, level] of levels.entries()) {
    const { stations } = decodeLevel(level);
    safe.work[i] = stations.map(key).filter(id => Array.isArray(data.work?.[i]) && data.work[i].includes(id));
  }
  const knownEvidence = new Set(levels.flatMap((level, i) => decodeLevel(level).clues.map(t => i + '/' + key(t))));
  safe.evidence = [...new Set((Array.isArray(data.evidence) ? data.evidence : []).filter(id => knownEvidence.has(id)))];
  safe.backrooms = data.backrooms === true && levels[safe.chapter]?.id === 'office' &&
    safe.work[safe.chapter].length === decodeLevel(levels[safe.chapter]).stations.length;
  safe.powered = data.powered === true;
  safe.finished = data.finished === true && levels.every((level, i) => safe.work[i].length === decodeLevel(level).stations.length);
  safe.deaths = Number.isSafeInteger(data.deaths) ? clamp(data.deaths, 0, 999999) : 0;
  safe.checkpoint = typeof data.checkpoint === 'string' ? data.checkpoint : null;
  return safe;
}

export class Simulation3D {
  constructor({ levels = LEVELS, progress = null } = {}) {
    this.levels = levels;
    this.progress = readProgress(progress, levels);
    this.totalClues = levels.reduce((total, level) => total + decodeLevel(level).clues.length, 0);
    this.events = [];
    this.time = 0;
    this.mode = this.progress.finished ? 'won' : 'menu';
    this.quality = 'high';
    this.reduceMotion = false;
    this.load(this.progress.chapter, this.progress.backrooms);
  }

  emit(type, detail = {}) { this.events.push({ type, ...detail }); }

  drain() { return this.events.splice(0); }

  reset() {
    this.progress = defaultProgress();
    this.time = 0;
    this.load(0);
    this.mode = 'playing';
    this.emit('save');
  }

  load(index, backrooms = false) {
    this.levelIndex = index;
    this.progress.chapter = index;
    this.progress.backrooms = backrooms;
    this.chase = null;
    this.level = backrooms ? BACKROOMS_LEVEL : this.levels[index];
    this.map = decodeLevel(this.level);
    this.interactionTargets = [
      ...this.map.stations.map(tile => ({ type: 'station', tile })),
      ...this.map.clues.map(tile => ({ type: 'clue', tile })),
      ...this.map.lamps.map(tile => ({ type: 'lamp', tile })),
      ...(this.map.power ? [{ type: 'power', tile: this.map.power }] : []),
      { type: 'door', tile: this.map.exit }
    ];
    this.night = false;
    this.shiftFx = 0;
    this.shiftCooldown = 0;
    this.door = 0;
    this.departing = false;
    this.follow = null;
    this.completed = new Set(this.progress.work[index] ?? []);
    this.checkpoint = this.map.lamps.find(lamp => this.tileKey(lamp) === this.progress.checkpoint) ?? this.map.spawn;
    this.visited = new Set();
    this.spawnPlayer();
    this.emit(backrooms ? 'backrooms' : 'chapter', { index });
  }

  spawnPlayer() {
    Object.assign(this, {
      x: this.checkpoint.x, z: this.checkpoint.z, y: 0, vy: 0,
      yaw: this.checkpoint === this.map.spawn ? (this.checkpoint.yaw ?? this.level.spawnYaw ?? this.startYaw()) : 0,
      pitch: 0, life: 'alive', lifeTimer: 0, hp: 3, shield: 0, grounded: true, coyote: .1,
      jumpBuffer: 0, moving: false, sprint: false, quiet: false, stamina: 1,
      stepDistance: 0, hazardClock: 0, tension: 0, pursuer: null, atRisk: false
    });
    this.ghosts = this.map.ghosts.map((tile, i) => ({
      x: tile.x, z: tile.z, home: tile, key: this.tileKey(tile), index: i,
      phase: tile.phase ?? (tile.kind === 'G' ? 'day' : tile.kind === 'H' ? 'night' : null),
      alert: 0, active: false, target: null, refresh: 0, roam: i
    }));
    if (this.level === BACKROOMS_LEVEL) beginPursuit(this);
    this.syncGhosts();
  }

  startYaw() {
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      if (floorActive(this.map.get(this.map.spawn.col + dx, this.map.spawn.row + dz), false)) return Math.atan2(dx, -dz);
    }
    return 0;
  }

  tileKey(tile) { return tile.col + '/' + tile.row; }

  saveData() {
    return {
      schema: 1, ...this.progress, chapter: this.levelIndex,
      work: { ...this.progress.work, [this.levelIndex]: [...this.completed] },
      checkpoint: this.checkpoint === this.map.spawn ? null : this.tileKey(this.checkpoint)
    };
  }

  syncGhosts() {
    const phase = this.night ? 'night' : 'day';
    for (const g of this.ghosts) g.active = !g.phase || g.phase === phase || g.phase === 'both';
  }

  togglePhase() {
    if (this.shiftCooldown > 0 || this.departing) return false;
    this.night = !this.night;
    this.syncGhosts();
    this.shiftFx = 1;
    this.shiftCooldown = .21;
    this.emit('sound', { name: 'shift' });
    return true;
  }

  startDeath(kind, attacker = null) {
    if (this.life !== 'alive') return;
    this.life = 'dying';
    this.lifeTimer = 0;
    this.deathCause = kind;
    this.pursuer = attacker;
    this.hp = 0;
    this.moving = false;
    this.sprint = false;
    this.progress.deaths++;
    this.emit('sound', { name: 'death', position: attacker });
    this.emit('death', { kind });
    this.emit('save');
  }

  hurt() {
    if (this.life !== 'alive' || this.shield > 0) return;
    if (--this.hp <= 0) return this.startDeath('machinery');
    this.shield = 1;
    this.emit('sound', { name: 'hit' });
    this.emit('hurt');
  }

  lifeStep(dt) {
    this.lifeTimer += dt;
    if (this.life === 'dying' && this.lifeTimer >= 1.12) {
      this.night = false;
      this.spawnPlayer();
      this.life = 'respawning';
      this.lifeTimer = 0;
      this.emit('sound', { name: 'revive' });
      this.emit('revive');
    } else if (this.life === 'respawning' && this.lifeTimer >= .68) {
      this.life = 'alive';
      this.lifeTimer = 0;
      this.shield = .7;
    }
  }

  look(dx, dy) {
    if (this.mode !== 'playing' || this.departing || this.life !== 'alive') return;
    this.yaw = Math.atan2(Math.sin(this.yaw + dx), Math.cos(this.yaw + dx));
    this.pitch = clamp(this.pitch + dy, -1.23, 1.23);
  }

  blocks(x, z, radius = PLAYER_RADIUS) {
    if (this.chase) return chaseBlocked(x, z, this.y, radius);
    for (const [dx, dz] of [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
      if (this.map.at(x + dx, z + dz)?.kind === '#') return true;
    }
    return false;
  }

  canSee(a, b) {
    const n = Math.ceil(distance(a, b) / .35);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.map.at(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)?.kind === '#') return false;
    }
    return true;
  }

  getInteraction() {
    if (this.chase || this.life !== 'alive' || this.departing || this.y > .6) return null;
    let best = null;
    for (const target of this.interactionTargets) {
      const { tile } = target;
      const range = distance(this, tile);
      if (range > 1.68 || (best && range >= best.range) || !this.canSee(this, tile)) continue;
      best = { ...target, range, id: key(tile) };
    }
    return best;
  }

  get ending() {
    return this.progress.powered && this.progress.evidence.length >= this.totalClues ? 'complete' : 'normal';
  }

  requiredPhase(id) { return this.level.requiredPhase?.[id]; }

  hasRecord(id) { return this.progress.evidence.includes(this.levelIndex + '/' + id); }

  interact() {
    const target = this.getInteraction();
    if (!target) return;
    const { tile, id, type } = target;
    if (type === 'station') {
      if (this.completed.has(id)) return this.emit('notice', { id: 'workDone' });
      const phase = this.requiredPhase(id);
      if (phase && phase !== (this.night ? 'night' : 'day')) return this.emit('notice', { id: phase === 'night' ? 'needNight' : 'needDay' });
      this.completed.add(id);
      this.progress.work[this.levelIndex] = [...this.completed];
      this.emit('sound', { name: 'interact', position: tile });
      this.emit('story', { pair: tile.messages ?? this.level.messages?.[id], id: 'workDone', station: id });
    } else if (type === 'clue') {
      const evidence = this.levelIndex + '/' + id;
      if (!this.hasRecord(id)) {
        this.progress.evidence.push(evidence);
        this.emit('sound', { name: 'pickup', position: tile });
      }
      this.emit('story', { pair: tile.clue ?? this.level.clues?.[id], id: 'clueFound', clue: id });
    } else if (type === 'lamp') {
      this.checkpoint = tile;
      this.hp = 3;
      this.emit('notice', { id: 'lamp' });
      this.emit('sound', { name: 'pickup', position: tile });
    } else if (type === 'power') {
      this.progress.powered = true;
      this.emit('notice', { id: 'power' });
      this.emit('sound', { name: 'interact', position: tile });
    } else {
      if (this.completed.size < this.map.stations.length) return this.emit('notice', { id: 'locked' });
      this.departing = true;
      this.moving = false;
      this.sprint = false;
      this.emit('sound', { name: 'door', position: tile });
    }
    this.emit('save');
  }

  ghostRoute(from, to) {
    if (!from || !to || from === to) return to;
    const queue = [from], seen = new Map([[from, null]]);
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i];
      for (const [dx, dz] of cardinals) {
        const next = this.map.get(at.col + dx, at.row + dz);
        if (!floorActive(next, this.night) || seen.has(next)) continue;
        seen.set(next, at);
        if (next === to) {
          let step = next;
          while (seen.get(step) !== from) step = seen.get(step);
          return step;
        }
        queue.push(next);
      }
    }
    return null;
  }

  updateGhosts(dt) {
    this.tension = 0;
    const here = this.map.at(this.x, this.z);
    const sanctuary = this.map.lamps.some(tile => distance(tile, this) < 1.32) || distance(this.map.spawn, this) < 1.35;
    const difficulty = this.levelIndex;
    for (const ghost of this.ghosts) {
      if (!ghost.active) { ghost.alert = 0; ghost.target = null; continue; }
      const range = distance(ghost, this);
      const hear = this.sprint ? 9.6 : this.quiet ? 0 : this.moving ? 3.5 : 0;
      const confront = !sanctuary && range < (.65 + (this.quiet ? 4.55 : 6.3) + difficulty * .72) && this.canSee(ghost, this);
      const detects = !sanctuary && (confront || (range < hear && (range < 2.5 || this.canSee(ghost, this))));
      const alertBefore = ghost.alert;
      ghost.alert = clamp(ghost.alert + dt * (detects ? 2.25 : sanctuary ? -2.1 : -.45), 0, 1);
      if (alertBefore < .45 && ghost.alert >= .45 && range < 8 && ghost.refresh < .25) {
        this.emit('warning', { ghost });
      }
      this.tension = Math.max(this.tension, ghost.alert * clamp(1 - range / 20, 0, 1));
      ghost.refresh -= dt;
      const from = this.map.at(ghost.x, ghost.z);
      if (!floorActive(from, this.night)) {
        ghost.x = ghost.home.x;
        ghost.z = ghost.home.z;
        ghost.target = null;
      }
      if (ghost.alert >= .48 && ghost.refresh <= 0 && !sanctuary) {
        ghost.target = this.ghostRoute(from, here);
        ghost.refresh = .27;
      }
      if (ghost.alert < .48 && (!ghost.target || distance(ghost, ghost.target) < .16)) {
        const at = this.map.at(ghost.x, ghost.z) ?? ghost.home;
        const possible = cardinals.map(([dx,dz]) => this.map.get(at.col+dx,at.row+dz))
          .filter(tile => floorActive(tile, this.night) && !['S','L'].includes(tile.kind) && distance(tile, ghost.home) < 7);
        ghost.target = possible[(ghost.roam++ + ghost.index) % possible.length] ?? ghost.home;
      }
      if (ghost.target && floorActive(ghost.target, this.night)) {
        const dx = ghost.target.x - ghost.x;
        const dz = ghost.target.z - ghost.z;
        const len = Math.hypot(dx, dz);
        const speed = (ghost.alert > .64 ? 3.45 + difficulty * .32 : 1.08 + difficulty * .1);
        const move = Math.min(len, speed * dt);
        if (len > .002 && !this.blocks(ghost.x + dx / len * move, ghost.z + dz / len * move, GHOST_RADIUS)) {
          ghost.x += dx / len * move;
          ghost.z += dz / len * move;
        }
      }
      if (!sanctuary && this.y < .9 && distance(ghost, this) < .62) this.startDeath('ghost', ghost);
      if (this.life !== 'alive') break;
    }
  }

  movement(input, dt) {
    const forward = Number(input.forward ?? 0), side = Number(input.side ?? 0);
    const length = Math.hypot(forward, side);
    this.moving = length > .08;
    this.quiet = Boolean(input.quiet);
    this.sprint = this.chase ? this.moving && !this.quiet :
      !!input.sprint && this.moving && !this.quiet && this.stamina > .09;
    this.stamina = this.chase ? 1 : clamp(this.stamina + dt * (this.sprint ? -.24 : .32), 0, 1);
    if (this.moving) {
      const sprintSpeed = this.chase ? BACKROOMS_TRACK.speed : 6.1;
      const speed = this.quiet ? 1.75 : this.sprint ? sprintSpeed : 3.55;
      const amount = dt * speed / Math.max(1, length);
      const dx = (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) * amount;
      const dz = (-Math.cos(this.yaw) * forward + Math.sin(this.yaw) * side) * amount;
      if (!this.blocks(this.x + dx, this.z)) this.x += dx;
      if (!this.blocks(this.x, this.z + dz)) this.z += dz;
      this.stepDistance += Math.hypot(dx, dz);
      if (this.grounded && this.stepDistance >= (this.quiet ? 1.65 : this.sprint ? 1.12 : 1.48)) {
        this.stepDistance = 0;
        this.emit('sound', { name: 'step', position: { surface: ['concrete', 'carpet', 'grate'][this.levelIndex] ?? 'concrete' } });
      }
    } else {
      this.stepDistance = 0;
    }
    const tile = this.map.at(this.x, this.z);
    const supported = this.chase ? chaseFloor(runDistance(this.z),this.night) : floorActive(tile, this.night);
    if (tile && tile.kind !== '#') this.visited.add(this.tileKey(tile));
    if (this.grounded && supported) this.coyote = .098;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (input.jump) this.jumpBuffer = .12;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = JUMP_SPEED;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.emit('sound', { name: 'jump' });
    }
    if (input.release && this.vy > 2.3) this.vy = 2.3;
    const prevY = this.y;
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;
    this.grounded = supported && this.vy <= 0 && this.y <= 0 && prevY >= -.12;
    if (this.grounded) {
      if (this.vy < -4) this.emit('sound', { name: 'land' });
      this.y = 0;
      this.vy = 0;
    } else if (!this.chase && supported && this.y < 0 && this.y >= -.22 && !this.map.at(this.x, this.z)?.kind?.match(/^[dn]$/)) {
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
    }
    if (this.y < -2.55) this.startDeath('fall');
    this.atRisk = !supported && this.y < .46;
    const phase = this.night ? 'night' : 'day';
    const liveHazard = tile && (tile.kind === '~' ? phase === 'day' : tile.kind === '!' && phase === 'night');
    const beat = (this.time + (tile?.col ?? 0) * .27 + (tile?.row ?? 0) * .19) % 3;
    if (liveHazard && beat > 1.24 && beat < 2.53 && this.grounded) this.hurt();
  }

  step(input = {}, dt = STEP) {
    if (this.mode !== 'playing') return;
    this.time += dt;
    this.shiftFx = Math.max(0, this.shiftFx - dt / .18);
    this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
    this.shield = Math.max(0, this.shield - dt);
    if (this.life !== 'alive') { this.lifeStep(dt); return; }
    if (this.departing) {
      this.door = Math.min(1, this.door + dt / 1.27);
      if (this.door >= 1) {
        if (this.levelIndex === this.levels.length - 1) {
          this.mode = 'won';
          this.progress.finished = true;
          this.emit('sound', { name: 'ending' });
          this.emit('save');
        } else {
          this.progress.checkpoint = null;
          if (this.level.id === 'office' && this.levels[this.levelIndex+1].id === 'roof') this.load(this.levelIndex,true);
          else this.load(this.levelIndex + 1);
          this.emit('save');
        }
      }
      return;
    }
    if (input.shift) this.togglePhase();
    if (input.interact) this.interact();
    if (this.departing) return;
    this.movement(input, dt);
    if (this.life !== 'alive') return;
    if (this.chase) {
      advancePursuit(this,dt);
      if (this.life === 'alive' && this.chase.distance >= BACKROOMS_TRACK.length) {
        this.departing = true;
        this.moving = this.sprint = false;
        this.emit('sound', { name:'door', position:this.map.exit });
      }
    } else this.updateGhosts(dt);
  }
}
