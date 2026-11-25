// The menu launches the normal campaign. Mobile mode changes only its controls
// and presentation, so advancing and resuming use the edition's existing save.
const root = document.documentElement;
const coarse = matchMedia('(pointer: coarse)');
const start = document.getElementById('start');
const launcher = document.getElementById('play-mobile');
const stick = document.getElementById('mobile-stick');
const thumb = stick?.querySelector('.mobile-thumb');
let pointer = null;
let origin = null;
let direction = {x: 0, z: 0};

export const isMobilePlay = () => coarse.matches || root.dataset.mobilePlay === 'true';
export const mobileMotion = () => direction;

export function clearMobileMotion() {
  const held = pointer;
  pointer = origin = null;
  direction = {x:0, z:0};
  if (held !== null && stick?.hasPointerCapture(held)) stick.releasePointerCapture(held);
  if (thumb) thumb.style.transform = '';
  stick?.removeAttribute('data-held');
}

function activate() {
  if (root.dataset.mobilePlay === 'true') return;
  root.dataset.mobilePlay = 'true';
  window.dispatchEvent(new Event('lastlightmobileplay'));
}

function translate() {
  const zh = root.lang.startsWith('zh');
  if (launcher) launcher.textContent = zh ? '移动端游玩' : 'Play in Mobile';
  stick?.setAttribute('aria-label', zh ? '移动摇杆' : 'Movement joystick');
}

launcher?.addEventListener('click', () => {
  if (start?.hidden || start?.disabled) {
    const classic = document.getElementById('classic-link');
    if (classic) {
      const url = new URL(classic.href);
      url.searchParams.set('mobile', '1');
      location.assign(url);
    }
    return;
  }
  activate();
  start?.click();
});
start?.addEventListener('click', () => { if (isMobilePlay()) activate(); }, {capture: true});

if (new URLSearchParams(location.search).get('mobile') === '1') activate();
translate();
new MutationObserver(translate).observe(root, {attributes:true, attributeFilter:['lang']});

function move(event) {
  if (pointer !== event.pointerId || !origin) return;
  const dx = event.clientX - origin.x;
  const dy = event.clientY - origin.y;
  const distance = Math.hypot(dx, dy);
  const size = Math.min(1, distance / origin.radius);
  const strength = Math.max(0, (size - .15) / .85);
  const unitX = distance ? dx / distance : 0;
  const unitY = distance ? dy / distance : 0;
  direction = {x:unitX*strength, z:-unitY*strength};
  const travel = origin.radius * size;
  thumb.style.transform = `translate(${unitX*travel}px,${unitY*travel}px)`;
}

stick?.addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointer !== null || !isMobilePlay()) return;
  event.preventDefault();
  const rect = stick.getBoundingClientRect();
  pointer = event.pointerId;
  origin = {x:rect.left + rect.width / 2, y:rect.top + rect.height / 2, radius:rect.width * .35};
  stick.setPointerCapture(pointer);
  stick.dataset.held = '';
  move(event);
});
stick?.addEventListener('pointermove', move);
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stick?.addEventListener(type, event => {
    if (pointer === event.pointerId) clearMobileMotion();
  });
}
window.addEventListener('blur', clearMobileMotion);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearMobileMotion(); });
matchMedia('(orientation: landscape)').addEventListener('change', clearMobileMotion);
