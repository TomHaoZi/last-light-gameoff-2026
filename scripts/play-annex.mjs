// This controller holds the real movement key from the lamp to the exit.
// It observes positions; no player coordinates, save data or clocks are changed.
export async function playAnnex({snapshot,key,tap,stop,sleep}, {capture, failFirst=false}={}) {
  let state=await snapshot();
  if(!state.backrooms)throw Error('Expected a live Records Annex');
  await stop();
  if(failFirst){
    const initialDeaths=state.deaths;
    await key('ArrowRight',true);await sleep(170);await key('ArrowRight',false);
    let captured=false;
    const deadline=Date.now()+7000;
    while(Date.now()<deadline){
      state=await snapshot();
      if(state.death?.kind==='ghost')captured=true;
      if(capture)await capture(state);
      if(captured&&state.player.lifeState==='alive'&&!state.backrooms.active)break;
      await sleep(25);
    }
    if(!captured||state.deaths!==initialDeaths+1||state.player.hp!==3)throw Error('Chase capture/lamplight retry failed');
  }
  const atStart=await snapshot(), initialDeaths=atStart.deaths, start=atStart.player.x;
  let jumped=null, flipped=null, maxElapsed=0, firstTick=null, lastX=start;
  const jumps=[],switches=[];
  const wallStart=Date.now();
  await key('ArrowRight',true);
  try{
    while(Date.now()-wallStart<85000){
      state=await snapshot();
      if(!state.backrooms){
        if(!state.events.includes('backrooms-escaped'))throw Error('Left chase without reaching the door');
        if((state.time-firstTick)<39.9&&start<100)throw Error('Chase ended before forty seconds');
        return {start,finishX:lastX,seconds:state.time-firstTick,wallSeconds:(Date.now()-wallStart)/1000,
          lastChaseClock:maxElapsed,jumps,switches,heldForward:true,failedAndRetried:failFirst,checkpoint:state.events.includes('backrooms-relit')};
      }
      if(state.deaths!==initialDeaths||state.player.hp===0)throw Error('Chase failed at '+state.player.x+' ('+JSON.stringify(state.backrooms.nextObstacle)+')');
      if(firstTick===null&&state.backrooms.active)firstTick=state.time-state.backrooms.elapsed;
      maxElapsed=state.backrooms.elapsed;lastX=state.player.x;
      const o=state.backrooms.nextObstacle,p=state.player;
      // Release after the apex, so a landing immediately followed by another
      // launch still sends a distinct key edge through Chrome.
      if(!p.grounded&&p.vy>=0)await key('Space',false);
      if(o && o.id!==jumped && p.grounded && o.x-p.x<=o.launch && o.x-p.x>-3){
        await key('Space',true);jumped=o.id;jumps.push(o.id);
      }
      if(!p.grounded&&o?.phase&&jumped===o.id&&flipped!==o.id&&state.phase!==o.phase&&p.y+38<o.y){
        await tap('ShiftLeft');flipped=o.id;switches.push(o.id);
      }
      if(capture)await capture(state);
      await sleep(15);
    }
    throw Error('Allowed chase duration exceeded');
  } finally { await stop(); }
}
