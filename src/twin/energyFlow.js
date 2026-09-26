// ============================================================
// UNITWIN GRID V2 — 3D Energy Flow Particle System
// Velocity-mapped particles representing power through the grid
// ============================================================

import * as THREE from 'three';
import { scene, addAnimationCallback } from './scene.js';
import { subscribe, getState } from '../core/state.js';
import CONFIG from '../config/config.js';

let _particles = [];
let _paths = [];
let _guideLines = [];
let _enabled = true;

// Path definitions: from → to
const PATH_DEFS = [
  { id: 'solar_to_tx', from: [-10, 3, 5],   to: [0, 4.5, 0], color: 0xffdd00, stateKey: 'solar' },
  { id: 'tx_to_house', from: [0, 3.5, 0],   to: [-7, 2, -6], color: 0x44ff88, stateKey: 'household' },
  { id: 'tx_to_ev',    from: [0, 3.5, 0],   to: [10, 2, 3],  color: 0xaa44ff, stateKey: 'ev' },
  { id: 'grid_to_tx',  from: [0, 0.5, -12], to: [0, 2, 0],   color: 0x44aaff, stateKey: 'transformer' }
];

// ── Build energy flow system ───────────────────────────────────
export function buildEnergyFlow() {
  PATH_DEFS.forEach(def => {
    // Compute QuadraticBezierCurve3
    const pFrom = new THREE.Vector3(...def.from);
    const pTo = new THREE.Vector3(...def.to);
    const pMid = new THREE.Vector3().addVectors(pFrom, pTo).multiplyScalar(0.5);
    pMid.y += 4; // Midpoint curves upward
    
    const curve = new THREE.QuadraticBezierCurve3(pFrom, pMid, pTo);
    
    // Add thin tube guide line
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.03, 4, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.15 });
    const guideLine = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(guideLine);
    _guideLines.push(guideLine);

    const pathParticles = [];
    const particlesPerPath = 20;

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
      curve.getPoint(t, mesh.position);
      mesh.userData = { t, def };

      scene.add(mesh);
      pathParticles.push(mesh);
    }

    _paths.push({ def, particles: pathParticles, curve });
    _particles.push(...pathParticles);
  });

  addAnimationCallback(_animateParticles);
}

// ── Animate particles ──────────────────────────────────────────
function _animateParticles(dt) {
  const state = getState();
  const isCritical = (state.transformer && state.transformer.loading >= 90);

  _paths.forEach(path => {
    const { def, particles, curve } = path;
    const power  = _getPower(state, def.stateKey);
    const active = power > 0.05;
    
    let speed  = 0.005 + power * 0.0005; // Base speed based on power
    if (isCritical) speed *= 2;
    
    const activeColor = isCritical ? 0xff4400 : def.color;
    const alpha  = active ? Math.min(1.0, 0.2 + power * 0.06) : 0;

    particles.forEach(mesh => {
      if (!active) {
        mesh.material.opacity = 0;
        return;
      }
      mesh.userData.t += speed;
      if (mesh.userData.t > 1) mesh.userData.t -= 1;

      curve.getPoint(mesh.userData.t, mesh.position);

      mesh.material.color.setHex(activeColor);
      mesh.material.emissive.setHex(activeColor);
      mesh.material.opacity = alpha * (0.7 + 0.3 * Math.sin(mesh.userData.t * Math.PI * 4));
      mesh.material.emissiveIntensity = 0.8 + power * 0.3;
    });
  });
}

// ── Helpers ────────────────────────────────────────────────────

function _getPower(state, key) {
  if (!state[key]) return 0;
  switch (key) {
    case 'solar':       return state.solar.power / 1000;
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
  _guideLines.forEach(m => { m.visible = on; });
}

export function disposeEnergyFlow() {
  _particles.forEach(m => {
    m.geometry.dispose();
    m.material.dispose();
    scene.remove(m);
  });
  _guideLines.forEach(m => {
    m.geometry.dispose();
    m.material.dispose();
    scene.remove(m);
  });
  _particles = [];
  _paths = [];
  _guideLines = [];
}
