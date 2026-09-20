// ============================================================
// UNITWIN GRID V2 — solarArray.js
// Procedural solar panel array digital twin.
// 2x3 grid of PV panels on a tilted aluminium frame.
// INA219 sensor integration via state subscription.
// ============================================================

import * as THREE from 'three';
import { scene, addAnimationCallback } from './scene.js';
import { MAT }                          from './materials.js';
import { subscribe }                    from '../core/state.js';
import { registerInteractiveObject }    from './inspector.js';

// ── Module-level state ────────────────────────────────────────
let _solarPower    = 1.04;
let _solarStatus   = 'ACTIVE';
let _shimmerMeshes = [];
let _t             = 0;

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────
function _mesh(geo, mat, cast = true, recv = true) {
  const m        = new THREE.Mesh(geo, mat);
  m.castShadow    = cast;
  m.receiveShadow = recv;
  return m;
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────

/**
 * Build the solar panel array twin and add it to the scene.
 * Positioned at x=-9, z=0, y=0.
 * @returns {THREE.Group}
 */
export function buildSolarArray() {
  const group = new THREE.Group();
  group.name  = 'solarArray';
  group.position.set(-9, 0, 0);

  // ── Rear support legs — 4 vertical posts ──────────────────
  [[-1.8, 0.8], [-1.8, -0.8], [1.8, 0.8], [1.8, -0.8]].forEach(([x, z]) => {
    const postGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.8, 6);
    const post    = _mesh(postGeo, MAT.solarPanel);
    post.position.set(x, 0.9, z);
    group.add(post);
  });

  // Horizontal cross-braces at mid height
  [{ z: -0.7 }, { z: 0.7 }].forEach(({ z }) => {
    const braceGeo = new THREE.BoxGeometry(3.8, 0.05, 0.05);
    const brace    = _mesh(braceGeo, MAT.solarPanel);
    brace.position.set(0, 0.5, z);
    group.add(brace);
  });

  // Diagonal rear stabiliser
  const diagGeo = new THREE.BoxGeometry(0.05, 0.05, 2.2);
  const diag    = _mesh(diagGeo, MAT.solarPanel);
  diag.position.set(0, 0.6, 0);
  group.add(diag);

  // ── Main tilted frame ─────────────────────────────────────
  const TILT = -0.44;   // ~25° tilt toward equator

  const frameGeo = new THREE.BoxGeometry(4.1, 0.08, 2.65);
  const frame    = _mesh(frameGeo, MAT.solarPanel);
  frame.position.set(0, 1.82, 0);
  frame.rotation.x = TILT;
  group.add(frame);

  // Frame border rails
  const frameBorderMat = MAT.solarPanel.clone();
  [
    { w: 4.1,  h: 0.06, d: 0.06, px: 0,     py: 1.82, pz:  1.3, rx: TILT },
    { w: 4.1,  h: 0.06, d: 0.06, px: 0,     py: 1.82, pz: -1.3, rx: TILT },
    { w: 0.06, h: 0.06, d: 2.6,  px:  2.05, py: 1.82, pz:  0,   rx: TILT },
    { w: 0.06, h: 0.06, d: 2.6,  px: -2.05, py: 1.82, pz:  0,   rx: TILT }
  ].forEach((r) => {
    const bGeo = new THREE.BoxGeometry(r.w, r.h, r.d);
    const bM   = _mesh(bGeo, frameBorderMat);
    bM.position.set(r.px, r.py, r.pz);
    bM.rotation.x = r.rx;
    group.add(bM);
  });

  // ── 2×3 panel grid (6 panels total) ─────────────────────
  _shimmerMeshes = [];
  const cellMat  = MAT.solarCell.clone();

  const glassMat = new THREE.MeshPhysicalMaterial({
    color:        0xaaccff,
    roughness:    0.04,
    metalness:    0.0,
    transparent:  true,
    opacity:      0.18,
    clearcoat:    1.0,
    clearcoatRoughness: 0.05,
    transmission: 0.12
  });

  const COLS = 3, ROWS = 2;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const panelGroup = new THREE.Group();

      // Aluminium panel backing
      const backGeo  = new THREE.BoxGeometry(1.28, 0.04, 1.18);
      const panelBack = _mesh(backGeo, MAT.solarPanel);
      panelGroup.add(panelBack);

      // PV cell surface
      const cellGeo  = new THREE.BoxGeometry(1.18, 0.025, 1.08);
      const cellMesh = new THREE.Mesh(cellGeo, cellMat.clone());
      cellMesh.position.y = 0.032;
      panelGroup.add(cellMesh);
      _shimmerMeshes.push(cellMesh);

      // Cell grid lines (fine mesh detail)
      const gridMat = new THREE.MeshBasicMaterial({ color: 0x1a2a4a });
      for (let gi = 0; gi < 4; gi++) {
        const gGeo = new THREE.BoxGeometry(0.008, 0.035, 1.08);
        const gLine = new THREE.Mesh(gGeo, gridMat);
        gLine.position.set(-0.45 + gi * 0.3, 0.045, 0);
        panelGroup.add(gLine);
      }

      // Glass cover layer
      const glassGeo  = new THREE.BoxGeometry(1.18, 0.012, 1.08);
      const glassMesh = new THREE.Mesh(glassGeo, glassMat.clone());
      glassMesh.position.y = 0.055;
      panelGroup.add(glassMesh);

      // Position panel in tilt space
      panelGroup.position.set(
        (c - 1) * 1.34,
        1.85,
        (r - 0.5) * 1.22
      );
      panelGroup.rotation.x = TILT;

      group.add(panelGroup);
    }
  }

  // ── Junction box on back ──────────────────────────────────
  const jbGeo = new THREE.BoxGeometry(0.30, 0.13, 0.22);
  const jb    = _mesh(jbGeo, MAT.sensorHousing);
  jb.position.set(0, 1.52, 0.18);
  group.add(jb);

  // Junction box conduit
  const conduitGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6);
  const conduit    = _mesh(conduitGeo, MAT.cable);
  conduit.position.set(0, 1.25, 0.18);
  group.add(conduit);

  // ── DC cable run to transformer area ─────────────────────
  // Horizontal run eastward
  const cableHGeo = new THREE.CylinderGeometry(0.028, 0.028, 9.2, 6);
  const cableH    = _mesh(cableHGeo, MAT.cable);
  cableH.rotation.z = Math.PI / 2;
  cableH.position.set(4.6, 0.35, 0);
  group.add(cableH);

  // Second cable (negative)
  const cableHGeo2 = new THREE.CylinderGeometry(0.028, 0.028, 9.2, 6);
  const cableH2    = _mesh(cableHGeo2, MAT.cable);
  cableH2.rotation.z = Math.PI / 2;
  cableH2.position.set(4.6, 0.42, 0.06);
  group.add(cableH2);

  // ── Register interactive ──────────────────────────────────
  registerInteractiveObject(group, 'Solar Panel Array (INA219)', () => ({
    'Sensor':      'INA219',
    'Panels':      '6',
    'Config':      '2 × 3',
    'Peak Power':  '120 W',
    'Voltage':     `${(5.8).toFixed(2)} V`,
    'Power':       `${_solarPower.toFixed(2)} W`,
    'Status':      _solarStatus
  }));

  scene.add(group);

  // ── State subscription ────────────────────────────────────
  subscribe('solar', (state) => {
    _solarPower  = state.solar.power;
    _solarStatus = state.solar.status;
  });

  // ── Animation: shimmer based on solar power ────────────────
  addAnimationCallback((delta) => {
    _t += delta;
    if (_solarStatus !== 'ACTIVE') {
      _shimmerMeshes.forEach((m) => { m.material.emissiveIntensity = 0; });
      return;
    }
    const normalised = Math.max(0, Math.min(1, _solarPower / 5.0));
    _shimmerMeshes.forEach((m, idx) => {
      const phase     = _t * 1.6 + idx * 0.35;
      const shimmer   = normalised * (0.04 + 0.06 * Math.abs(Math.sin(phase)));
      m.material.emissive          = m.material.emissive || new THREE.Color();
      m.material.emissive.setRGB(shimmer * 0.08, shimmer * 0.22, shimmer * 0.85);
      m.material.emissiveIntensity = shimmer * 1.8;
    });
  });

  return group;
}
