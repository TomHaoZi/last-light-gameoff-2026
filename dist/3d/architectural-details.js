import { BoxGeometry, Vector3 } from 'three';

// A shared chamfered form with a flat center on every face. The shoulder
// normals keep highlights on the bevel instead of smoothing the whole box.
export function makeChamferedBox() {
  const geometry = new BoxGeometry(1, 1, 1, 3, 3, 3);
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  const face = new Vector3();
  const vertex = new Vector3();
  const normal = new Vector3();
  const corner = v => Math.sign(v) * (Math.abs(v) > .4 ? .5 : .42);
  for (let i = 0; i < p.count; i++) {
    face.fromBufferAttribute(n, i);
    vertex.set(corner(p.getX(i)), corner(p.getY(i)), corner(p.getZ(i)));
    normal.copy(vertex).clampScalar(-.42, .42);
    normal.subVectors(vertex, normal).normalize();
    vertex.clampScalar(-.42, .42).addScaledVector(normal, .08);
    face.lerp(normal, .72).normalize();
    p.setXYZ(i, vertex.x, vertex.y, vertex.z);
    n.setXYZ(i, face.x, face.y, face.z);
  }
  return geometry;
}

// Work on the solid wall face only. Nothing here extends a walking surface,
// lights up an absent platform, or changes the map's collision envelope.
export function dressArchitecture(theme, pattern, panel, materials, plate=panel) {
  const { edgeMetal, plasterEdge, lacquer, dark, steel, brass } = materials;
  if (theme === 0) {
    const u = pattern < 9 ? -.74 : .74;
    panel(edgeMetal, .100, 2.40, .15, .19, .17, u);
    panel(dark, .113, 2.40, .025, .176, .178, u - .061);
    panel(steel, .126, 2.40, .021, .157, .15, u + .060);
    if (pattern % 5 === 0) {
      plate(lacquer, .048, 1.52, .35, .16, .052, -.65);
      plate(brass, .079, 1.52, .25, .077, .013, -.65);
      plate(dark, .086, 1.527, .16, .014, .011, -.65);
      plate(dark, .086, 1.506, .10, .010, .011, -.65);
    }
  } else if (theme === 1) {
    // Lacquered picture rail and recessed inset frames catch oblique light.
    panel(plasterEdge, .050, 2.888, 2.39, .032, .050);
    panel(lacquer, .054, .928, 2.39, .038, .061);
    for (const bay of [-.60, .60]) {
      panel(lacquer, .035, .533, .98, .57, .039, bay);
      panel(dark, .056, .536, .909, .495, .018, bay);
      panel(lacquer, .066, .741, .86, .020, .017, bay);
    }
    if (pattern % 5 === 0) {
      plate(lacquer, .044, 1.58, .38, .23, .068, .91);
      plate(plasterEdge, .083, 1.58, .324, .176, .016, .91);
      plate(dark, .096, 1.61, .23, .014, .010, .91);
      plate(dark, .096, 1.566, .15, .012, .010, .91);
    }
  } else {
    panel(plasterEdge, .019, 1.347, 2.39, .038, .078);
    if (pattern % 3 === 0) {
      panel(edgeMetal, .052, .70, .136, 1.13, .091, -.92);
      for (const y of [.25, 1.16]) panel(steel, .110, y, .04, .044, .032, -.92);
    }
    if (pattern % 7 === 0) {
      plate(edgeMetal, .038, .40, .73, .30, .089, .48);
      plate(dark, .090, .40, .64, .232, .032, .48);
      for (let i = 0; i < 4; i++) plate(steel, .115, .327 + i * .049, .61, .021, .052, .48);
    }
  }
}
