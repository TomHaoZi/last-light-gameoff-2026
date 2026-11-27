// Read-only choreography shared by the worker rigs and their spatial audio.
// It does not change awareness, damage, collision or the phase of an actor.
const sat=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
function smooth(value,lo,hi) { const p=sat((value-lo)/(hi-lo)); return p*p*(3-2*p); }
export function creaturePressure({threat=0,distance=10,attack=0,stagger=0}={}) {
  threat=sat(threat); attack=sat(attack);
  const recoil=smooth(stagger,0,.42)*(1-attack);
  const closing=smooth(threat,.54,.91)*(1-attack)*(1-recoil);
  const settle=(1-smooth(threat,.05,.38))*(1-recoil);
  const listen=smooth(threat,.09,.47)*(1-smooth(threat,.61,.86))*(1-attack)*(1-recoil);
  const brace=closing*(1-smooth(distance,1.14,3.32));
  const breathHold=listen*.78+brace*.15;
  return {settle,listen,closing,brace,recoil,attack,breathHold};
}
