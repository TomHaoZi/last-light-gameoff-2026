import { Vector3 } from 'three';

export function fingerJoints(joints, side) {
  const point = label => joints.get(label + '.' + side).getWorldPosition(new Vector3());
  const middle = point('finger3-1').sub(point('wrist'));
  const breadth = point('finger5-1').sub(point('finger2-1'));
  const palm = middle.cross(breadth).normalize().multiplyScalar(side === 'R' ? 1 : -1);
  const curl = [];
  for (const finger of [2, 3, 4, 5]) {
    for (let link = 1; link <= 3; link++) {
      const label = 'finger' + finger + '-' + link;
      const direction = link === 3 ? point(label).sub(point('finger' + finger + '-2')) :
        point('finger' + finger + '-' + (link + 1)).sub(point(label));
      curl.push({
        bone: joints.get(label + '.' + side),
        axis: direction.cross(palm).normalize(),
        depth: [.41, .68, .47][link - 1] * (1 - (finger - 2) * .06)
      });
    }
  }
  return curl;
}
