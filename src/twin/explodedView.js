// UNITWIN GRID V2 — explodedView.js
import { addAnimationCallback, removeAnimationCallback } from './scene.js';

const _parts = [];
let _isExploded = false;

export function registerExplodedPart(mesh, explodedOffset) {
  _parts.push({
    mesh,
    originalPos:    mesh.position.clone(),
    explodedOffset: explodedOffset.clone()
  });
}

export function clearExplodedParts() { _parts.length = 0; _isExploded = false; }
export function isExploded() { return _isExploded; }

function easeInOutCubic(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
}

export function toggleExplodedView() {
  const targetExploded = !_isExploded;
  _isExploded = targetExploded;
  const durationMs     = 1200;
  const startTime      = performance.now();
  const startPositions = _parts.map(p => p.mesh.position.clone());

  let _cb = null;
  _cb = () => {
    const rawT = Math.min((performance.now() - startTime) / durationMs, 1.0);
    const t    = easeInOutCubic(rawT);
    _parts.forEach((part, i) => {
      const start = startPositions[i];
      const end   = targetExploded
        ? part.originalPos.clone().add(part.explodedOffset)
        : part.originalPos.clone();
      part.mesh.position.lerpVectors(start, end, t);
    });
    if (rawT >= 1.0) removeAnimationCallback(_cb);
  };
  addAnimationCallback(_cb);
  return targetExploded;
}
