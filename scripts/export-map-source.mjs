import { BACKROOMS_TRACK } from '../dist/3d/backrooms-track.js';
import { TILE, LEVELS, decodeLevel } from '../dist/3d/levels.js';

// Keep Blender's editable spatial reference derived from gameplay coordinates.
// The reference is intentionally not a new authority for collision or progress.
const levels = LEVELS.map(spec => {
  const map = decodeLevel(spec);
  return { id:spec.id, theme:spec.theme, name:spec.title, floor:map.floors, walls:map.walls,
    markers:[['Player start',map.spawn],['Exit',map.exit],['Auxiliary light',map.power],
      ...map.lamps.map((t,i)=>[`Checkpoint ${i+1}`,t]),
      ...map.stations.map(t=>[`Handover ${t.kind}`,t]),
      ...map.clues.map(t=>[`Evidence ${t.kind}`,t]),
      ...map.notes.map(t=>[`Recording ${t.kind}`,t]),
      ...map.ghosts.map(t=>[`Apparition ${t.id}`,t]),
      ...map.hazards.map(t=>[`Hazard ${t.id}`,t])].filter(([,t])=>t) };
});
console.log(JSON.stringify({ tile:TILE, levels, track:BACKROOMS_TRACK }));
