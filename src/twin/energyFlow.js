// ============================================================
// UNITWIN GRID V2 — 3D Energy Flow Particle System
// Velocity-mapped particles representing power through the grid
// Solar → Grid → Transformer → Household / EV
// ============================================================

import * as THREE from 'three';
import { scene, addAnimationCallback } from './scene.js';
import { subscribe, getState } from '../core/state.js';
import CONFIG from '../config/config.js';

let _particles = [];
let _paths = [];
let _enabled = true;

// Path definitions: from → to
const PATH_DEFS = [
  { id: 'solar_grid',  from: [-9, 1, 0],   to: [0, 0.5, 0],   color: 0xffdd00, stateKey: 'solar' },
  { id: 'grid_tx',     from: [0, 0.5, 0],   to: [0, 1, 0],     color: 0x44aaff, stateKey: 'transformer' },
  { id: 'tx_house',    from: [0, 2, 0],     to: [-5, 1, -5],   color: 0x44ff88, stateKey: 'household' },
  { id: 'tx_ev',       from: [0, 2, 0],     to: [9, 1, 2],     color: 0xaa44ff, stateKey: 'ev' }
];

// ── Build energy flow system ───────────────────────────────────
export function buildEnergyFlow() {
  PATH_DEFS.forEach(def => {
    const pathParticles = [];
    const particlesPerPath = Math.floor(CONFIG.energyFlow.particleCount / 4);

    for (let i = 0; i < particlesPerPath; i++) {
      const geo  = new THREE.SphereGeometry(0.07, 5, 5);
      const mat  = new THREE.MeshStandardMaterial({
        color:            def.color,
        emissive:         def.color,
        emissiveIntensity: 1.2,
        transparent:      true,
        opacity:          0
      });
      const mesh = new THREE.Mesh(geo, mat);

      // Random starting progress along path
      const t = i / particlesPerPath;
      mesh.position.copy(_lerpPath(def.from, def.to, t));
      mesh.userData = { t, speed: CONFIG.energyFlow.baseSpeed, def };

      scene.add(mesh);
      pathParticles.push(mesh);
    }

    _paths.push({ def, particles: pathParticles });
    _particles.push(...pathParticles);
  });

  addAnimationCallback(_animateParticles);
}

// ── Animate particles ──────────────────────────────────────────
function _animateParticles(dt) {
  const state = getState();

  _paths.forEach(path => {
    const { def, particles } = path;
    const power  = _getPower(state, def.stateKey);
    const active = power > 0.05;
    const speed  = CONFIG.energyFlow.baseSpeed + power * CONFIG.energyFlow.speedScale;
    const alpha  = active ? Math.min(CONFIG.energyFlow.maxOpacity, CONFIG.energyFlow.minOpacity + power * 0.06) : 0;

    particles.forEach(mesh => {
      if (!active) {
        mesh.material.opacity = 0;
        return;
      }
      mesh.userData.t += speed;
      if (mesh.userData.t > 1) mesh.userData.t -= 1;

      const pos = _lerpPath(def.from, def.to, mesh.userData.t);
      // Add subtle perpendicular oscillation
      const perp = mesh.userData.t * Math.PI * 4;
      pos.y += Math.sin(perp + mesh.userData.t * 100) * 0.08;

      mesh.position.copy(pos);
      mesh.material.opacity = alpha * (0.7 + 0.3 * Math.sin(perp));
      mesh.material.emissiveIntensity = 0.8 + power * 0.3;
    });
  });
}

// ── Helpers ────────────────────────────────────────────────────
function _lerpPath(from, to, t) {
  return new THREE.Vector3(
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 0.8,
    from[2] + (to[2] - from[2]) * t
  );
}

function _getPower(state, key) {
  switch (key) {
    case 'solar':       return state.solar.power;
    case 'transformer': return state.transformer.power;
    case 'household':   return state.household.power;
    case 'ev':          return state.ev.power;
    default:            return 0;
  }
}

// ── Enable / disable ──────────────────────────────────────────
export function setEnergyFlowEnabled(on) {
  _enabled = on;
  _particles.forEach(m => { m.visible = on; });
}

export function disposeEnergyFlow() {
  _particles.forEach(m => {
    m.geometry.dispose();
    m.material.dispose();
    scene.remove(m);
  });
  _particles = [];
  _paths = [];
}
