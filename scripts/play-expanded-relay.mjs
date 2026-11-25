// The browser remains authoritative. Read the game's diagnostic snapshot and
// steer with the same trusted keyboard input used for the rest of the route.
export async function playExpandedRelay(data,{snapshot,key,tap,stop,sleep,readSave},checkRecovery=false){
 const {steps,checkpoint}=data.relay;
 const entryStart=performance.now();
 const move=async direction=>{
  await key('ArrowLeft',direction<0);
  await key('ArrowRight',direction>0);
 };
 async function until(check,label,timeout=2400){
  const deadline=performance.now()+timeout;
  let state;
  while(performance.now()<deadline){
   state=await snapshot();
   if(state.room!==data.id||state.player.lifeState!=='alive')throw Error(`${data.id}: left live relay at ${label}`);
   if(await check(state))return state;
   await sleep(11);
  }
  const player=state?.player;
  throw Error(`${data.id}: ${label} timed out at ${player?.supportId||'air'} (${player?.x.toFixed(1)}, ${player?.y.toFixed(1)})`);
 }
 const aim=(target,from)=>{
  const center=target.x+target.w/2;
  const preferred=Math.abs(center-from)<=76?center:from+Math.sign(center-from)*77;
  return Math.max(target.x+13,Math.min(target.x+target.w-13,preferred));
 };
 async function approach(x,support){
  return until(async ({player:p})=>{
   if(!p.grounded||p.supportId!==support)throw Error(`${data.id}: left ${support} while lining up at ${x}`);
   const remaining=x-p.x;
   if(Math.abs(remaining)<3&&Math.abs(p.vx)<14){await move(0);return true;}
   const projected=remaining-p.vx*.046;
   await move(Math.abs(projected)<1.5?0:Math.sign(projected));
   return false;
  },`line up at x=${x}`);
 }
 async function jumpTo(target,allowMissingPhase=false){
  const launch=await snapshot();
  if(!launch.player.grounded)throw Error(`${data.id}: jumped without a stable takeoff`);
  const firstShifts=launch.shifts;
  const needsShift=target.phase&&target.phase!==launch.phase;
  let shiftedInAir=false,wasAirborne=false;
  let shiftAttemptAt=-Infinity;
  const desired=aim(target,launch.player.x+7);
  const airDirection=p=>{
   const projected=p.x+7+p.vx*.078;
   return Math.abs(desired-projected)<4?0:Math.sign(desired-projected);
  };
  await move(airDirection(launch.player));
  await key('Space',true);
  try{
   const landed=await until(async state=>{
    const p=state.player;
    if(!p.grounded){
     wasAirborne=true;
     if(state.shifts>firstShifts&&state.phase===target.phase)shiftedInAir=true;
     if(needsShift&&!allowMissingPhase&&state.phase!==target.phase&&p.vy<0&&state.time-shiftAttemptAt>=.12){
      shiftAttemptAt=state.time;
      await tap('ShiftLeft');
     }
     await move(airDirection(p));
    }
    return wasAirborne&&p.grounded;
   },`jump to ${target.id}`,1600);
   const jump=landed.log.find(event=>event.type==='sound'&&event.name==='jump'&&event.tick>=Math.floor(launch.time*120));
   if(!jump)throw Error(`${data.id}: no in-game jump event for ${target.id}`);
   if(!allowMissingPhase&&landed.player.supportId!==target.id){
    throw Error(`${data.id}: expected ${target.id}, landed on ${landed.player.supportId} at (${landed.player.x.toFixed(1)}, ${landed.player.y.toFixed(1)}), ${launch.phase}→${landed.phase}`);
   }
   if(needsShift&&!allowMissingPhase&&(!shiftedInAir||landed.phase!==target.phase))throw Error(`${data.id}: ${target.id} did not record an accepted airborne shift`);
   return {from:launch.player.supportId,to:landed.player.supportId,expected:target.id,tick:jump.tick,phase:landed.phase,
    time:landed.time,x:landed.player.x,y:landed.player.y,shiftedInAir,checkpoint:landed.checkpoint};
  }finally{
   await stop();
   // Let the real game consume Space's release edge before the next jump edge.
   // If both arrive in the same simulation tick, the next launch is cut short.
   await sleep(34);
  }
 }

 const initial=await until(state=>state.player.grounded&&state.player.supportId,'arrival floor');
 if(initial.player.x>90)throw Error(`${data.id}: expected fresh arrival for relay`);
 await approach(55,initial.player.supportId);
 const jumps=[await jumpTo(steps[0])];
 let recovery=null;
 if(checkRecovery){
  const first=steps[1];
  if((await snapshot()).phase===first.phase){
   await tap('ShiftLeft');
   await until(state=>state.phase!==first.phase,'wrong-phase control');
  }
  const dropped=await jumpTo(first,true);
  if(dropped.to===first.id||dropped.to?.includes('/relay-')||dropped.y<124){
   throw Error(`${data.id}: missed first catch did not drop to the normal route`);
  }
  await move(-1);
  try{await until(state=>state.player.x<=55,'return to the departure mark');}
  finally{await stop();}
  const back=await until(state=>state.player.grounded,'settle after the missed catch');
  await approach(55,back.player.supportId);
  const restart=back.player.supportId===steps[0].id?{to:steps[0].id,phase:back.phase}:await jumpTo(steps[0]);
  recovery={missedCatch:dropped,restart};
 }
 for(const [index,target] of steps.entries()){
  if(index===0)continue;
  if(index===steps.length-1)await approach(425,steps[index-1].id);
  else if(index<steps.length-2){
   const previous=steps[index-1];
   await approach(previous.x+previous.w/2-7,previous.id);
  }
  jumps.push(await jumpTo(target));
 }
 await approach(checkpoint.x,steps.at(-1).id);
 await until(state=>state.checkpoint===checkpoint.id,'relay lamp activation');
 const save=await readSave();
 if(save?.checkpointId!==checkpoint.id)throw Error(`${data.id}: relay lamp did not save`);
 return {id:data.id,jumps,recovery,savedCheckpoint:save.checkpointId,elapsedMs:Math.round(performance.now()-entryStart)};
}
