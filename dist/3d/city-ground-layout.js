// Render-only city below the roof. Coordinates never enter a gameplay map.
export const CITY_GRADE = -21.94;
const STEP=12, ROAD=3.64, LOT=STEP-ROAD;
export const BOULEVARD_RADIUS=44.75;
const BOULEVARD_INNER=BOULEVARD_RADIUS-2.05;

/** Local module axes: X across the road, Z along it; origin at sidewalk grade. */
export function planCityGround(cx,cz,towers) {
  const groups=new Map();
  const put=(name,x,z,yaw=0,sx=1,sy=1,sz=1,y=CITY_GRADE)=>{
    if(!groups.has(name))groups.set(name,[]);
    groups.get(name).push([cx+x,y,cz+z,yaw,sx,sy,sz]);
  };
  put('CitySubgrade',0,0);
  put('CityBoulevard',0,0);
  const grid=new Set(), segments=new Set(), junctions=new Map();
  for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++) {
    const x=i*STEP,z=j*STEP;
    if(Math.hypot(Math.abs(x)+LOT/2,Math.abs(z)+LOT/2)>41.2) continue;
    grid.add(`${i}/${j}`);
    put('CityPavedBlock',x,z);
    const tag=((i*37+j*63+109)%9+9)%9;
    const turn=(tag%4)*Math.PI/2;
    if(Math.hypot(x,z)<5||tag===0||tag===5) put('CityPublicSquare',x,z,turn);
    else if(tag===1||tag===4||tag===7) put('CityServiceYard',x,z,turn);
    else put('CityLowRise',x,z,turn,1,.73+(tag%3)*.17,1);
    // A road on each block edge, deduplicated between adjacent blocks.
    for(const side of [-1,1]) for(const axis of [0,1]) {
      const u=axis?i*2:i*2+side,v=axis?j*2+side:j*2;
      const key=`${u}/${v}/${axis}`;
      if(segments.has(key))continue;
      segments.add(key);
      put('CityRoad',u*STEP/2,v*STEP/2,axis?Math.PI/2:0);
      for(const end of [-1,1]) {
        const a=u+(axis?end:0),b=v+(axis?0:end),k=`${a}/${b}`;
        if(!junctions.has(k))junctions.set(k,{a,b,legs:new Set()});
        junctions.get(k).legs.add(axis?(end<0?'e':'w'):(end<0?'s':'n'));
      }
    }
  }
  for(const {a,b,legs} of junctions.values()) {
    const x=a*STEP/2,z=b*STEP/2;
    put('CityCrossing',x,z);
    const orient={n:Math.PI,s:0,e:Math.PI/2,w:-Math.PI/2};
    for(const leg of legs) put('CityStopBars',x,z,orient[leg]);
    for(const [dx,dz] of [[-1,1],[1,-1]]) {
      // Lamps belong to existing sidewalk corners, not rounding into the carriageway.
      if(grid.has(`${(a+dx)/2}/${(b+dz)/2}`))
        put('CityStreetLight',x+dx*2.13,z+dz*2.13,Math.atan2(-dx,-dz));
    }
  }
  // Axial streets join the ring at eight gateways—do not extend the
  // striped grid through the ring's curb or across a tower footprint.
  for(const sign of [-1,1]) for(const offset of [-6,6]) {
    const edge=sign*42.4;
    const end=sign*Math.sqrt((BOULEVARD_RADIUS+.58)**2-offset**2);
    const mid=(edge+end)/2, length=Math.abs(edge-end);
    put('CityAccessLane',offset,mid,0,1.46,1,length);
    put('CityAccessLane',mid,offset,Math.PI/2,1.46,1,length);
  }
  for(const {x,z,width,depth,turn=0,far=false} of towers) {
    const rim=far?.46:.64;
    put('CityTowerFoot',x-cx,z-cz,turn,width+rim,far?.68:1,depth+rim,-22.02);
    if(far)continue;
    const dx=x-cx,dz=z-cz,r=Math.hypot(dx,dz),nx=dx/r,nz=dz/r;
    const rayReach=Math.min((width+rim)/2/Math.max(1e-6,Math.abs(nx)),(depth+rim)/2/Math.max(1e-6,Math.abs(nz)));
    const to=r-rayReach+.16,from=BOULEVARD_RADIUS+1.25;
    if(to-from<.86)continue;
    // A neighboring tower may be further inward along this compass bearing.
    // Skip questionable drives rather than stamping a road under that building.
    const overlaps=towers.some(t=>{
      if(t.far||t.x===x&&t.z===z)return false;
      const u=t.x-cx,v=t.z-cz;
      const projection=Math.max(from,Math.min(to,u*nx+v*nz));
      return Math.abs(u-projection*nx)<t.width/2+1.48&&Math.abs(v-projection*nz)<t.depth/2+1.48;
    });
    if(!overlaps) put('CityAccessLane',nx*(from+to)/2,nz*(from+to)/2,Math.atan2(nx,nz),1,1,to-from);
  }
  return groups;
}
