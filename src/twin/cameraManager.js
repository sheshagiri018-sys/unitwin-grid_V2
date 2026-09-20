// UNITWIN GRID V2 — cameraManager.js
import * as THREE from 'three';
import { camera, controls } from './scene.js';

const PRESETS = {
  overview:    { pos: [20, 14, 24], target: [0, 2, 0]   },
  transformer: { pos: [6,  7,  8],  target: [0, 3, 0]   },
  solar:       { pos: [-9, 6,  8],  target: [-9, 1, 0]  },
  ev:          { pos: [9,  6,  8],  target: [9,  1, 0]  },
  energyFlow:  { pos: [2,  16, 20], target: [0,  2, 0]  },
  household:   { pos: [-4, 5,  4],  target: [-5, 1, -5] },
  core:        { pos: [3,  5,  4],  target: [0,  3, 0]  }
};

function ease(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

export function getCameraPreset(name) { return PRESETS[name] || null; }

export function setCameraLabel(text) {
  const el = document.getElementById('cameraLabel');
  if (el) el.textContent = text.toUpperCase() + ' · 3D DIGITAL TWIN';
}

export function moveTo(presetName, durationSec = 1.2) {
  const preset = PRESETS[presetName];
  if (!preset || !camera || !controls) return;
  const startPos    = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos      = new THREE.Vector3(...preset.pos);
  const endTarget   = new THREE.Vector3(...preset.target);
  const startTime   = performance.now();
  const durationMs  = durationSec * 1000;

  function frame(now) {
    const rawT = Math.min((now - startTime) / durationMs, 1.0);
    const t    = ease(rawT);
    camera.position.lerpVectors(startPos, endPos, t);
    controls.target.lerpVectors(startTarget, endTarget, t);
    controls.update();
    if (rawT < 1.0) {
      requestAnimationFrame(frame);
    } else {
      camera.position.copy(endPos);
      controls.target.copy(endTarget);
      controls.update();
      setCameraLabel(presetName);
    }
  }
  requestAnimationFrame(frame);
}
