function location(state) {
 const {x,y,supportId}=state.player;
 return {time:state.time,x,y,supportId,phase:state.phase,checkpoint:state.checkpoint};
}

export class ExpandedEvidence {
 rooms=[];
 active=null;
 seenEvents=new Set();
 lastLanding=null;

 observe(state) {
  if(state.worldRevision!==2||state.mode==='menu')return;
  if(!this.active||this.active.id!==state.room){
   if(this.active){
    this.active.cleared=state.mechanisms.includes(this.active.id);
    this.active.exit=state.room;
   }
   this.active={id:state.room,floor:state.floor,sector:state.sector,entry:location(state),exit:null,
    cleared:false,jumps:0,shifts:0,rejectedShifts:0,deaths:0,landings:[],relay:null};
   this.rooms.push(this.active);
   this.lastLanding=null;
  }
  const room=this.active;
  for(const event of state.log){
   if(!['sound','shift','shift-rejected','death'].includes(event.type))continue;
   const key=JSON.stringify(event);
   if(this.seenEvents.has(key))continue;
   this.seenEvents.add(key);
   if(event.type==='sound'&&event.name==='jump')room.jumps++;
   if(event.type==='shift')room.shifts++;
   if(event.type==='shift-rejected')room.rejectedShifts++;
   if(event.type==='death')room.deaths++;
  }
  const support=state.player.grounded?state.player.supportId:null;
  if(support&&support!==this.lastLanding)room.landings.push(location(state));
  this.lastLanding=support;
  if(state.mode==='won'){
   room.cleared=state.mechanisms.includes(room.id);
   room.exit=`ending:${state.ending}`;
  }
 }

 recordRelay(relay) {
  if(this.active?.id!==relay.id)throw Error(`Unexpected relay report for ${relay.id}`);
  this.active.relay=relay;
 }

 verifyEnding(state,expectedEnding,expectedRooms,requireRelays) {
  if(state.ending!==expectedEnding)throw Error(`Expected ${expectedEnding} ending, reached ${state.ending}`);
  if(this.rooms.length!==expectedRooms.length)throw Error(`Observed ${this.rooms.length} of ${expectedRooms.length} sections`);
  for(const [index,expected] of expectedRooms.entries()){
   const room=this.rooms[index];
   if(room.id!==expected||!room.cleared||!room.exit)throw Error(`No mechanism and exit evidence for ${expected}`);
   if(requireRelays&&!room.relay)throw Error(`No live relay evidence for ${expected}`);
  }
 }
}
