export const TILE = 2.4;

const DAY = "day";
const NIGHT = "night";
const floorKinds = new Set(".dnSELABC12GHJN~!P");

// Each shortcut crosses existing work areas. Coordinates name real pads; a
// single empty cell between them leaves a gap that a running jump can span.
const shortcuts = [
  {
    title: ["Return duct shortcut", "回流管道捷径"],
    pads: [[7, 16], [9, 16, NIGHT], [11, 16, DAY], [13, 16]],
  },
  {
    title: ["File wing shortcut", "档案侧翼捷径"],
    pads: [[12, 15], [14, 15, DAY], [16, 15, NIGHT], [18, 15]],
  },
  {
    title: ["Water tower transfer", "水塔检修捷径"],
    pads: [[15, 16], [17, 16, NIGHT], [17, 14, DAY], [19, 14, NIGHT], [19, 12]],
  },
];

/**
 * Authoring coordinates describe complete rooms and corridors, inclusive of
 * both endpoints. Indoor plans get an exterior wall course. The rooftop uses
 * open space around isolated slabs so a missing bridge opens into an abyss.
 */
function plan(width, depth, rooms, markers, { enclosed = true, shortcut } = {}) {
  const grid = Array.from({ length: depth }, () => Array(width).fill(" "));
  for (const [left, top, right, bottom, kind = "."] of rooms) {
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) grid[row][col] = kind;
    }
  }
  for (const [kind, col, row] of markers) {
    if (grid[row]?.[col] !== ".") {
      throw new Error(`Marker ${kind} requires neutral floor at ${col},${row}`);
    }
    grid[row][col] = kind;
  }
  const gaps = new Set();
  const pads = shortcut?.pads ?? [];
  for (const [index, [col, row, phase]] of pads.entries()) {
    if (index > 0) {
      const [fromCol, fromRow] = pads[index - 1];
      const distance = Math.abs(fromCol - col) + Math.abs(fromRow - row);
      const gapCol = (fromCol + col) / 2;
      const gapRow = (fromRow + row) / 2;
      if (distance !== 2 || grid[gapRow]?.[gapCol] !== " ") {
        throw new Error(`Shortcut leg needs one empty cell before ${col},${row}`);
      }
      gaps.add(gapCol + "/" + gapRow);
    }
    const expected = phase ? " " : ".";
    if (grid[row]?.[col] !== expected) {
      throw new Error(`Shortcut pad ${col},${row} needs ${phase ? "empty space" : "neutral floor"}`);
    }
    if (phase) grid[row][col] = phase === DAY ? "d" : "n";
  }
  if (enclosed) {
    const shell = grid.map(row => [...row]);
    for (let row = 0; row < depth; row++) {
      for (let col = 0; col < width; col++) {
        if (!floorKinds.has(grid[row][col])) continue;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = col + dx, z = row + dz;
            if (grid[z]?.[x] === " " && !gaps.has(x + "/" + z)) shell[z][x] = "#";
          }
        }
      }
    }
    return shell.map(row => row.join(""));
  }
  return grid.map(row => row.join(""));
}

const boiler = plan(26, 19, [
  [2, 14, 7, 17],     // Clock-in and first lamp
  [5, 11, 6, 13, "n"],// Collapsed grating
  [2, 6, 8, 10],      // Low-pressure hall
  [9, 7, 11, 8, "d"], // Main pressure gallery
  [9, 10, 11, 10, "d"],// Narrow service bypass
  [12, 6, 20, 11],    // Cooling chamber
  [13, 8, 14, 9, "#"],
  [17, 8, 18, 9, "#"],
  [15, 3, 16, 5, "n"],// Return duct landing
  [13, 1, 22, 2],     // Fire interlock and lift
  [21, 3, 22, 6, "n"],// Longer route around the pump
  [21, 7, 23, 9],
  [16, 12, 17, 13],
  [13, 14, 20, 16],   // Optional duty-board annex
  [2, 4, 4, 5],
], [
  ["S", 5, 16], ["L", 5, 15], ["L", 6, 9], ["L", 15, 10], ["L", 7, 15],
  ["A", 3, 8], ["1", 3, 4], ["B", 19, 10], ["2", 19, 15],
  ["C", 18, 1], ["E", 21, 1], ["G", 15, 7], ["H", 19, 6],
  ["~", 8, 7], ["~", 12, 8], ["!", 21, 8],
], { shortcut: shortcuts[0] });

const office = plan(25, 18, [
  [8, 13, 12, 16],    // Foyer
  [7, 6, 13, 12],     // File room hub
  [7, 1, 14, 3],      // Public records
  [10, 4, 11, 5, "d"],
  [16, 6, 22, 12],    // Gary's wing
  [18, 13, 18, 15],   // Return landing for the file wing shortcut
  [14, 8, 15, 9, "n"],
  [18, 8, 18, 10, "#"],
  [17, 1, 22, 3],     // Upper lift lobby
  [19, 4, 20, 5],
  [1, 5, 4, 14],      // Long lunchroom with opposite-phase entrances
  [5, 6, 6, 7, "n"],
  [5, 10, 6, 11, "d"],
  [2, 9, 3, 9, "#"],
  [1, 2, 3, 4],       // Dead-end oral-history alcove
], [
  ["S", 10, 15], ["L", 10, 13], ["L", 12, 10], ["L", 20, 6], ["L", 12, 14],
  ["N", 9, 14], ["A", 11, 2], ["1", 8, 2], ["B", 20, 8], ["2", 21, 7],
  ["C", 2, 7], ["E", 21, 2], ["G", 13, 2], ["H", 17, 10],
  ["J", 3, 12], ["!", 4, 6], ["~", 4, 10],
], { shortcut: shortcuts[1] });

const roof = plan(27, 19, [
  [8, 14, 15, 17],    // Lift landing
  [11, 11, 12, 13, "n"],
  [8, 6, 15, 10],     // Roof greenhouse
  [9, 6, 9, 7, "#"],
  [1, 5, 5, 11],      // West planting beds
  [6, 7, 7, 8, "d"],
  [2, 5, 2, 6, "#"],
  [19, 5, 24, 12],    // Water towers
  [16, 7, 18, 8, "n"],
  [16, 10, 18, 10, "d"],
  [21, 8, 22, 9, "#"],
  [8, 1, 17, 3],      // Independent power and final exit
  [11, 4, 12, 5, "n"],
  [23, 2, 24, 4, "n"],// Service route to lookout
  [21, 1, 25, 1],
  [21, 2, 22, 2],
], [
  ["S", 11, 16], ["L", 11, 15], ["L", 10, 10], ["L", 14, 3], ["L", 15, 15],
  ["A", 13, 8], ["1", 3, 10], ["B", 3, 7], ["2", 9, 2],
  ["C", 23, 7], ["P", 12, 2], ["E", 15, 2], ["G", 5, 5], ["H", 14, 6],
  ["J", 24, 11], ["!", 20, 7], ["~", 22, 6], ["!", 21, 1],
], { enclosed: false, shortcut: shortcuts[2] });

export const LEVELS = [
  {
    id: "boiler",
    title: "THE BOILER ROOM",
    zh: "锅炉房",
    subtitle: "01 / PRESSURE CONTROL · B2",
    subtitleZh: "01 / 压力控制 · 地下二层",
    objective: "Release pressure, open the cooling line, and inspect the fire interlock.",
    objectiveZh: "释放压力、打开冷却管线，检查消防联锁。",
    rows: boiler,
    shortcut: shortcuts[0],
    spawnYaw: 0,
    requiredPhase: { A: DAY },
    messages: {
      A: ["Pressure released. A service hatch stops shaking. Behind it, three measured knocks.", "压力释放，检修口停止震动。门后传来规律的三下敲击。"],
      B: ["The cooling line settles. A scratched instruction appears below the dial. Do not lock the door.", "冷却管线安静下来，表盘下露出一道刻字：别锁门。"],
      C: ["The interlock released at 18:00. Someone stayed behind to turn it by hand.", "消防联锁在 18:00 解除。有人留在里面，手动扳开了它。"],
    },
    clues: {
      1: ["FIRE CONTROL · Emergency closure enabled at 17:59. The override slot is on the inside.", "消防记录 · 17:59 紧急封闭启动。手动解除装置设在门内。"],
      2: ["DUTY BOARD · Gary’s lamp never switched to EVACUATED.", "值班牌 · Gary 的灯从未转到「已撤离」。"],
    },
  },
  {
    id: "office",
    title: "GARY’S OFFICE",
    zh: "Gary 的办公室",
    subtitle: "02 / PERSONNEL RECORDS · F4",
    subtitleZh: "02 / 人员档案 · 四楼",
    objective: "Recover the public register, correct Gary’s record, and leave his lunch.",
    objectiveZh: "取回公开名单、补正 Gary 的记录，把饭盒留给他。",
    rows: office,
    shortcut: shortcuts[1],
    spawnYaw: 0,
    mourning: true,
    guide: [
      "KEEP YOUR EYES LOW. Stare straight at the Mourning Clerk and she rushes you. Turn your head or look down to stop her. Listen for her crying and leave room as you pass.",
      "视线放低。直视默哀档案员时，她会朝你冲过来。转头或低头就能让她停下。听哭声辨位，绕行时留出一点距离。",
    ],
    requiredPhase: { B: NIGHT },
    messages: {
      A: ["The unsigned register says EVERYONE EVACUATED. The time beside Gary’s name has been erased.", "未签名的名单写着「全员撤离」。Gary 名字旁的时间被擦掉了。"],
      B: ["You correct the register. Gary was still on duty. He went back in to release the fire doors.", "你补正了名单：Gary 仍在岗。他返回火场，手动打开了消防门。"],
      C: ["You hold the lid shut and slide the lunchbox onto the shelf. Warm light comes on under the door.", "你按住盒盖，将饭盒推上置物架。门底下亮起一小块暖光。"],
    },
    clues: {
      1: ["PUBLIC REGISTER · GARY — EVACUATED. There is no signature.", "公开名单 · Gary——已撤离。这一栏没有签名。"],
      2: ["HANDOVER · Gary wrote that Eli should take the stairs. He would stay at the interlock until the others were out.", "交班簿 · Gary 让伊莱走楼梯。他会守在联锁旁，等其他人全部撤离。"],
    },
  },
  {
    id: "roof",
    title: "THE ROOFTOP",
    zh: "屋顶花园",
    subtitle: "03 / SERVICE ROOF · OUTSIDE",
    subtitleZh: "03 / 检修天台 · 室外",
    objective: "Water the rooftop beds and leave a light for the last person.",
    objectiveZh: "给屋顶的三处花床浇水，为最后一个人留灯。",
    rows: roof,
    shortcut: shortcuts[2],
    spawnYaw: 0,
    requiredPhase: { C: DAY },
    messages: {
      A: ["Water reaches the first dry pot. The evacuation arrow turns toward the open sky.", "水流进第一个干涸的花盆。疏散箭头转向露天通道。"],
      B: ["A leaf bends in the wind. You promised Gary you’d take the next shift. The promise is still yours to keep.", "叶片在风中摇晃。你答应 Gary 接下一班。这个承诺仍由你完成。"],
      C: ["The tanks recover pressure and the final bed drinks. Only the exit light is left.", "水箱恢复压力，最后一处花床浇好了。只剩出口那盏灯。"],
    },
    clues: {
      1: ["EVACUATION PLAN · The roof route stays open only while its independent light has power.", "屋顶疏散图 · 只有独立应急灯得到供电，出口线路才保持开放。"],
      2: ["GARY’S NOTE · Keep the exit lamp on its own circuit. Leave a door for the last person.", "Gary 的维修便条 · 出口那盏接独立电源。给最后一个人留门。"],
    },
  },
];

export function decodeLevel(spec) {
  const depth = spec.rows.length;
  const width = spec.rows[0].length;
  const cells = Array.from({ length: depth }, () => Array(width).fill(null));
  const tiles = [];
  const walls = [];
  const floors = [];
  const lamps = [];
  const stations = [];
  const clues = [];
  const notes = [];
  const ghosts = [];
  const hazards = [];
  let spawn = null;
  let exit = null;
  let power = null;

  for (const [row, line] of spec.rows.entries()) {
    if (line.length !== width) throw new Error(`Unequal row widths in level ${spec.id}`);
    for (const [col, kind] of [...line].entries()) {
      if (kind === " ") continue;
      if (kind !== "#" && !floorKinds.has(kind)) {
        throw new Error(`Unknown tile ${kind} in level ${spec.id}`);
      }
      const tile = { kind, col, row, x: (col + .5) * TILE, z: (row + .5) * TILE };
      cells[row][col] = tile;
      tiles.push(tile);
      if (kind === "#") {
        walls.push(tile);
        continue;
      }
      floors.push(tile);
      if (kind === "d" || kind === "n") tile.phase = kind === "d" ? DAY : NIGHT;
      if (kind === "S") {
        spawn = tile;
        spawn.yaw = spec.spawnYaw ?? 0;
      }
      if (kind === "E") exit = tile;
      if (kind === "L") lamps.push(tile);
      if (kind === "P") power = tile;
      if ("ABC".includes(kind)) {
        Object.assign(tile, { key: kind, id: kind, messages: spec.messages?.[kind], requiredPhase: spec.requiredPhase?.[kind] });
        stations.push(tile);
      }
      if ("12".includes(kind)) {
        Object.assign(tile, { key: kind, id: kind, clue: spec.clues?.[kind] });
        clues.push(tile);
      }
      if (kind === "N") {
        Object.assign(tile, { key: kind, id: kind, messages: spec.guide });
        notes.push(tile);
      }
      if ("GHJ".includes(kind)) {
        Object.assign(tile, { id: `${kind}${col}-${row}`, phase: kind === "G" ? DAY : kind === "H" ? NIGHT : null,
          ...(spec.mourning ? { creature: "mourning" } : {}) });
        ghosts.push(tile);
      }
      if ("~!".includes(kind)) {
        Object.assign(tile, { id: `hazard${col}-${row}`, phase: kind === "~" ? DAY : NIGHT });
        hazards.push(tile);
      }
    }
  }
  if (!spawn || !exit) throw new Error(`Level ${spec.id} requires a spawn and an exit`);
  const get = (col, row) => cells[row]?.[col] ?? null;
  const shortcut = spec.shortcut && {
    title: spec.shortcut.title,
    pads: spec.shortcut.pads.map(([col, row]) => get(col, row)),
  };
  return {
    width, depth, worldWidth: width * TILE, worldDepth: depth * TILE, tiles, walls, floors,
    spawn, exit, power, lamps, stations, clues, notes, ghosts, hazards, shortcut, get,
    at: (x, z) => get(Math.floor(x / TILE), Math.floor(z / TILE)),
  };
}
