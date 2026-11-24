import { CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

// The few marks are specific to the work that took place at each station.
function smear(ctx, x, y, width, height, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(width, height);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-.94, -.08);
  ctx.bezierCurveTo(-.69,-.71,-.11,-1.04,.12,-.87);
  ctx.bezierCurveTo(.29,-.65,.87,-.72,.96,-.29);
  ctx.bezierCurveTo(1.08,.02,.61,.14,.76,.37);
  ctx.bezierCurveTo(.62,.58,.3,.44,.06,.87);
  ctx.bezierCurveTo(-.20,.93,-.4,.52,-.57,.53);
  ctx.bezierCurveTo(-.88,.52,-.67,.17,-.94,-.08);
  ctx.fill();
  ctx.restore();
}

function dialLeak(ctx) {
  // Blood gathering beneath a dressing; the thinner edge dries brown first.
  for (const [x,y,w,h,a] of [[93,132,33,11,-.29],[121,125,20,7,-.24],[155,116,8,3,-.28],
    [172,111,3,2,0],[87,108,6,4,.2],[78,104,3,2,0]]) {
    smear(ctx,x,y,w,h,a,'rgba(88,51,37,.74)');
    smear(ctx,x-1,y,w*.72,h*.64,a,'rgba(65,29,26,.85)');
  }
}

function transferredSole(ctx) {
  // A partial transfer across the archive carpet. The toe wears away first.
  ctx.save();
  ctx.translate(118,114);
  ctx.rotate(-.36);
  smear(ctx,-4,35,17,7,.06,'rgba(79,42,31,.72)');
  for (let i=0;i<5;i++) {
    const y=14-i*8;
    smear(ctx,-9,y,10-i*.7,2.5,-.37,`rgba(80,36,32,${.64-i*.066})`);
    smear(ctx,9,y-2,8-i*.8,2.3,.32,`rgba(83,40,33,${.60-i*.069})`);
  }
  ctx.restore();
  smear(ctx,96,169,13,3,-.52,'rgba(70,34,31,.48)');
}

function drainedBed(ctx) {
  // Black leaf rot caught in a thin, oxidised run toward the roof drain.
  smear(ctx,128,115,65,5,-.27,'rgba(76,44,32,.54)');
  for (const [x,y,w,h,a] of [[93,123,17,6,-.27],[116,113,12,5,.38],[151,108,9,4,-.61]]) {
    smear(ctx,x,y,w,h,a,'rgba(61,49,31,.88)');
    ctx.strokeStyle='rgba(139,115,66,.8)';
    ctx.lineWidth=1.4;
    ctx.beginPath();ctx.moveTo(x-w*Math.cos(a),y-w*Math.sin(a));
    ctx.lineTo(x+w*Math.cos(a),y+w*Math.sin(a));ctx.stroke();
  }
}

export function mountStationTrace(visual) {
  const tile = visual.decoded.stations.find(t => t.key === ['A','B','C'][visual.theme]);
  if (!tile || tile.phase) return;
  const { x, z, dx, dz } = visual.edgeOffset(tile,.73);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  [dialLeak,transferredSole,drainedBed][visual.theme](canvas.getContext('2d'));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.min(4,visual.renderer.capabilities.getMaxAnisotropy());
  visual.localTextures.push(texture);
  const stain = new Mesh(new PlaneGeometry(.91,.91),new MeshStandardMaterial({
    map:texture, roughness:visual.theme===0 ? .72 : .94, transparent:true,
    depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1
  }));
  stain.name = ['Dried valve drips','Archive heel transfer','Leaves at the drain'][visual.theme];
  stain.receiveShadow = true;
  stain.position.set(x-dx*.56+dz*.19,.006,z-dz*.56-dx*.19);
  stain.rotation.set(-Math.PI/2,0,Math.atan2(dx,dz));
  visual.stage.add(stain);
}
