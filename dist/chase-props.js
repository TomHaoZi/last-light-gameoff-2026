// Orthographic Cycles portraits of the same editable models used in the 3D route.
// Each model is framed in its own 192 × 128 cell of the transparent atlas.
const frames = [
  'troffer',
  'cart',
  'barrier',
  'cabinet',
  'door',
  'grille',
  'wall',
  'carpet',
  'pipes',
  'exit',
  'rack',
  'bridge',
  'steamtrap',
  'ticketcase',
  'rainhead'
];
let atlas, nightAtlas;
export function drawChaseProp(context, name, x, bottomY, width, height, night = false) {
  const index = frames.indexOf(name);
  if (index < 0 || typeof Image === 'undefined') return false;
  if (!atlas) {
    atlas = new Image();
    atlas.src = new URL('./backrooms-props.png', import.meta.url).href;
  }
  if (!atlas.complete || !atlas.naturalWidth) return false;
  if (night && !nightAtlas && typeof document !== 'undefined') {
    nightAtlas = document.createElement('canvas');
    nightAtlas.width = atlas.naturalWidth;
    nightAtlas.height = atlas.naturalHeight;
    const brush = nightAtlas.getContext('2d');
    brush.drawImage(atlas, 0, 0);
    brush.globalCompositeOperation = 'source-atop';
    brush.fillStyle = 'rgba(20, 48, 62, 0.42)';
    brush.fillRect(0, 0, nightAtlas.width, nightAtlas.height);
  }
  context.drawImage(
    night && nightAtlas ? nightAtlas : atlas,
    (index % 4) * 192,
    Math.floor(index / 4) * 128,
    192,
    128,
    Math.round(x),
    Math.round(bottomY - height),
    Math.round(width),
    Math.round(height)
  );
  return true;
}
