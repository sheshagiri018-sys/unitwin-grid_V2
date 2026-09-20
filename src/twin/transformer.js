// ============================================================
// UNITWIN GRID V2 — transformer.js
// Procedural power transformer digital twin.
// Full geometry: core, coils, tank, bushings, radiators,
// cables, mounting base, indicators, thermal overlay.
// ============================================================

import * as THREE from 'three';
import { scene, addAnimationCallback, thermalLight } from './scene.js';
import { MAT, setThermalIntensity }                  from './materials.js';
import { subscribe }                                  from '../core/state.js';
import { registerExplodedPart }                       from './explodedView.js';
import { registerInteractiveObject }                  from './inspector.js';

// ── Constants ────────────────────────────────────────────────
const NORMAL_TEMP   = 20;   // °C baseline for ratio calculation
const CRITICAL_TEMP = 70;   // °C upper bound

// ── Module-level state ────────────────────────────────────────
let _group              = null;
let _vibration          = 0.0;
let _temperature        = 32.4;
let _thermalMode        = false;
let _thermalOverlayMesh = null;
let _t                  = 0;

// ─────────────────────────────────────────────────────────────
// Utility: shadow-ready mesh
// ─────────────────────────────────────────────────────────────
function _mesh(geo, mat, cast = true, recv = true) {
  const m        = new THREE.Mesh(geo, mat);
  m.castShadow    = cast;
  m.receiveShadow = recv;
  return m;
}

// ─────────────────────────────────────────────────────────────
// Sub-builder: laminated iron core + copper coils
// ─────────────────────────────────────────────────────────────
function _buildInternalCore(parent) {
  const coreGroup = new THREE.Group();
  coreGroup.name  = 'core';

  const limbX = [-0.9, 0, 0.9];

  limbX.forEach((xPos, idx) => {
    // Vertical core limb
    const limbGeo = new THREE.BoxGeometry(0.7, 2.8, 0.7);
    const limb    = _mesh(limbGeo, MAT.core);
    limb.position.set(xPos, 2.0, 0);
    limb.name = `core_limb_${idx}`;
    coreGroup.add(limb);
    registerExplodedPart(limb, new THREE.Vector3(xPos * 0.8, -0.5, 0));

    // Copper coil winding
    const coilGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
    const coil    = _mesh(coilGeo, MAT.coil);
    coil.position.set(xPos, 2.0, 0);
    coil.name = `coil_${idx}`;
    coreGroup.add(coil);
    registerExplodedPart(coil, new THREE.Vector3(xPos * 0.8, -0.3, 0.45));

    // Insulation tape — two torus rings per coil
    [-0.5, 0.5].forEach((yOff) => {
      const torusGeo = new THREE.TorusGeometry(0.52, 0.04, 8, 24);
      const tape     = _mesh(torusGeo, MAT.sensorHousing);
      tape.position.set(xPos, 2.0 + yOff, 0);
      tape.rotation.x = Math.PI / 2;
      coreGroup.add(tape);
    });
  });

  // Top yoke — horizontal connecting bar
  const topYokeGeo = new THREE.BoxGeometry(2.6, 0.6, 0.72);
  const topYoke    = _mesh(topYokeGeo, MAT.core);
  topYoke.position.set(0, 3.5, 0);
  topYoke.name = 'core_top_yoke';
  coreGroup.add(topYoke);
  registerExplodedPart(topYoke, new THREE.Vector3(0, 0.65, 0));

  // Bottom yoke
  const botYokeGeo = new THREE.BoxGeometry(2.6, 0.6, 0.72);
  const botYoke    = _mesh(botYokeGeo, MAT.core);
  botYoke.position.set(0, 0.5, 0);
  botYoke.name = 'core_bot_yoke';
  coreGroup.add(botYoke);
  registerExplodedPart(botYoke, new THREE.Vector3(0, -0.65, 0));

  parent.add(coreGroup);
}

// ─────────────────────────────────────────────────────────────
// Sub-builder: steel oil tank body
// ─────────────────────────────────────────────────────────────
function _buildTank(parent) {
  const tankGroup = new THREE.Group();
  tankGroup.name  = 'tank';

  // Main tank body
  const bodyGeo = new THREE.BoxGeometry(3.2, 4.2, 2.2);
  const body    = _mesh(bodyGeo, MAT.tankBody);
  body.position.set(0, 2.1, 0);
  body.name = 'tank_body';
  tankGroup.add(body);

  registerInteractiveObject(body, 'Transformer Tank', () => ({
    'Type':        'Distribution Transformer',
    'Rating':      '11 kV / 433 V',
    'Capacity':    '100 kVA',
    'Oil Type':    'Mineral',
    'Cooling':     'ONAN',
    'Temperature': `${_temperature.toFixed(1)} °C`
  }));

  // Top plate
  const topGeo   = new THREE.BoxGeometry(3.2, 0.12, 2.2);
  const topPlate = _mesh(topGeo, MAT.tankTop);
  topPlate.position.set(0, 4.32, 0);
  tankGroup.add(topPlate);

  // Left and right side flanges
  [-1.65, 1.65].forEach((x) => {
    const flangeGeo = new THREE.BoxGeometry(0.08, 4.0, 2.0);
    const flange    = _mesh(flangeGeo, MAT.tankTop);
    flange.position.set(x, 2.15, 0);
    tankGroup.add(flange);
  });

  // Oil drain valve — small horizontal cylinder on side
  const valveGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8);
  const valve    = _mesh(valveGeo, MAT.bushingMetal);
  valve.rotation.z = Math.PI / 2;
  valve.position.set(1.73, 0.35, 0);
  tankGroup.add(valve);

  // Nameplate — embossed aluminium panel on front face
  const nameMat   = new THREE.MeshStandardMaterial({ color: 0xc0c8d0, metalness: 0.5, roughness: 0.4 });
  const nameGeo   = new THREE.BoxGeometry(1.0, 0.5, 0.03);
  const nameplate = _mesh(nameGeo, nameMat);
  nameplate.position.set(0, 1.6, 1.12);
  tankGroup.add(nameplate);

  // Thermal overlay mesh — same footprint as body, toggled in thermal mode
  const overlayGeo   = new THREE.BoxGeometry(3.22, 4.22, 2.22);
  _thermalOverlayMesh = _mesh(overlayGeo, MAT.thermalOverlay, false, false);
  _thermalOverlayMesh.position.set(0, 2.1, 0);
  _thermalOverlayMesh.renderOrder = 1;
  _thermalOverlayMesh.visible     = false;
  tankGroup.add(_thermalOverlayMesh);

  parent.add(tankGroup);
}

// ─────────────────────────────────────────────────────────────
// Sub-builder: HV and LV porcelain bushings
// ─────────────────────────────────────────────────────────────
function _buildBushings(parent) {
  const bushGroup = new THREE.Group();
  bushGroup.name  = 'bushings';

  const hvX = [-0.9, 0, 0.9];

  hvX.forEach((x, i) => {
    const single = new THREE.Group();
    single.name  = `hv_bushing_${i}`;

    // Three stacked ceramic segments — each slightly tapered
    const segDefs = [
      { h: 0.60, rBot: 0.120, rTop: 0.096 },
      { h: 0.50, rBot: 0.096, rTop: 0.080 },
      { h: 0.40, rBot: 0.080, rTop: 0.065 }
    ];
    let yOff = 0;
    segDefs.forEach((sd) => {
      const segGeo = new THREE.CylinderGeometry(sd.rTop, sd.rBot, sd.h, 12);
      const seg    = _mesh(segGeo, MAT.bushing);
      seg.position.set(0, yOff + sd.h / 2, 0);
      single.add(seg);
      yOff += sd.h;
    });

    // Metal collar at base
    const collarGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.10, 12);
    const collar    = _mesh(collarGeo, MAT.bushingMetal);
    collar.position.set(0, -0.05, 0);
    single.add(collar);

    // Brass terminal cap at top
    const capGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8);
    const cap    = _mesh(capGeo, MAT.terminal);
    cap.position.set(0, yOff + 0.06, 0);
    single.add(cap);

    single.position.set(x, 4.44, 0);
    bushGroup.add(single);

    registerInteractiveObject(single, `HV Bushing ${i + 1} (Phase ${['A','B','C'][i]})`, () => ({
      'Phase':    ['A', 'B', 'C'][i],
      'Voltage':  '11 kV',
      'Material': 'Porcelain',
      'BIL':      '75 kV',
      'Creepage': '250 mm'
    }));
  });

  // LV bushing — horizontal on left side
  const lvGroup   = new THREE.Group();
  lvGroup.name    = 'lv_bushing';
  const lvSegGeo  = new THREE.CylinderGeometry(0.10, 0.12, 0.90, 10);
  const lvSeg     = _mesh(lvSegGeo, MAT.bushing);
  lvGroup.add(lvSeg);
  const lvCollarGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 10);
  const lvCollar    = _mesh(lvCollarGeo, MAT.bushingMetal);
  lvCollar.position.y = -0.42;
  lvGroup.add(lvCollar);
  lvGroup.rotation.z = Math.PI / 2;
  lvGroup.position.set(-1.75, 3.5, 0);
  bushGroup.add(lvGroup);

  registerInteractiveObject(lvGroup, 'LV Bushing', () => ({
    'Phase':    'LV Output',
    'Voltage':  '433 V',
    'Material': 'Porcelain',
    'BIL':      '20 kV'
  }));

  parent.add(bushGroup);
}

// ─────────────────────────────────────────────────────────────
// Sub-builder: ONAN radiator banks
// ─────────────────────────────────────────────────────────────
function _buildRadiators(parent) {
  const radGroup = new THREE.Group();
  radGroup.name  = 'radiators';

  // Two banks: one on each side
  [-2.2, 2.2].forEach((xSide, bankIdx) => {
    const bankGroup = new THREE.Group();
    bankGroup.name  = `rad_bank_${bankIdx}`;

    // 6 flat fins spaced 0.22 m apart in Z
    for (let i = 0; i < 6; i++) {
      const finGeo = new THREE.BoxGeometry(0.08, 2.8, 0.8);
      const fin    = _mesh(finGeo, MAT.radiator);
      fin.position.set(0, 0, (i - 2.5) * 0.22);
      bankGroup.add(fin);
    }

    // Top header pipe
    const topHdrGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8);
    const topHdr    = _mesh(topHdrGeo, MAT.bushingMetal);
    topHdr.rotation.z = Math.PI / 2;
    topHdr.position.set(0, 1.42, 0);
    bankGroup.add(topHdr);

    // Bottom header pipe
    const botHdrGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8);
    const botHdr    = _mesh(botHdrGeo, MAT.bushingMetal);
    botHdr.rotation.z = Math.PI / 2;
    botHdr.position.set(0, -1.42, 0);
    bankGroup.add(botHdr);

    bankGroup.position.set(xSide, 2.1, 0);
    radGroup.add(bankGroup);

    registerInteractiveObject(bankGroup, `Radiator Bank ${bankIdx + 1}`, () => ({
      'Fins':        '6',
      'Fin Width':   '0.8 m',
      'Cooling':     'ONAN',
      'Fluid':       'Mineral Oil',
      'Max ΔT':      '45 °C'
    }));
  });

  parent.add(radGroup);
}

// ─────────────────────────────────────────────────────────────
// Sub-builder: HV / LV cables
// ─────────────────────────────────────────────────────────────
function _buildCables(parent) {
  const cableGroup = new THREE.Group();
  cableGroup.name  = 'cables';

  const hvX = [-0.9, 0, 0.9];

  // HV red cables rising from bushings then curving outward
  hvX.forEach((x) => {
    const riserGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6);
    const riser    = _mesh(riserGeo, MAT.cableRed);
    riser.position.set(x, 6.4, 0);
    cableGroup.add(riser);

    const bendGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
    const bend    = _mesh(bendGeo, MAT.cableRed);
    bend.rotation.z = Math.PI / 4;
    bend.position.set(x + 0.25, 7.3, 0);
    cableGroup.add(bend);
  });

  // LV output — 3 black cables horizontal from LV bushing
  for (let i = 0; i < 3; i++) {
    const lvCabGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6);
    const lvCab    = _mesh(lvCabGeo, MAT.cable);
    lvCab.rotation.z = Math.PI / 2;
    lvCab.position.set(-2.55, 3.30 + i * 0.15, 0);
    cableGroup.add(lvCab);
  }

  // Terminal block at cable end
  const tbGeo = new THREE.BoxGeometry(0.4, 0.3, 0.65);
  const tb    = _mesh(tbGeo, MAT.sensorHousing);
  tb.position.set(-3.35, 3.4, 0);
  cableGroup.add(tb);

  parent.add(cableGroup);
}

// ─────────────────────────────────────────────────────────────
// Sub-builder: base frame mounting
// ─────────────────────────────────────────────────────────────
function _buildMounting(parent) {
  const mountGroup = new THREE.Group();
  mountGroup.name  = 'mounting';

  // Four angle-iron corner legs
  [[-1.4, 0.9], [-1.4, -0.9], [1.4, 0.9], [1.4, -0.9]].forEach(([x, z]) => {
    const legGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12);
    const leg    = _mesh(legGeo, MAT.bushingMetal);
    leg.position.set(x, 0.175, z);
    leg.receiveShadow = true;
    mountGroup.add(leg);
  });

  // Two longitudinal base rails
  [-0.9, 0.9].forEach((z) => {
    const railGeo = new THREE.BoxGeometry(3.0, 0.08, 0.12);
    const rail    = _mesh(railGeo, MAT.bushingMetal);
    rail.position.set(0, 0.04, z);
    mountGroup.add(rail);
  });

  // Ground bonding lug
  const lugGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.28, 6);
  const lug    = _mesh(lugGeo, MAT.terminal);
  lug.rotation.z = Math.PI / 2;
  lug.position.set(1.72, 0.30, 0.9);
  mountGroup.add(lug);

  parent.add(mountGroup);
}

// ─────────────────────────────────────────────────────────────
// Sub-builder: status indicators
// ─────────────────────────────────────────────────────────────
function _buildIndicators(parent) {
  const indGroup = new THREE.Group();
  indGroup.name  = 'indicators';

  // Green status LED dome on front top
  const ledGeo = new THREE.SphereGeometry(0.07, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const ledMat = new THREE.MeshStandardMaterial({
    color:             0x00ff44,
    emissive:          new THREE.Color(0x00ff44),
    emissiveIntensity: 1.5,
    metalness:         0.1,
    roughness:         0.1
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 4.4, 1.13);
  led.name = 'status_led';
  indGroup.add(led);

  // Oil level sight glass — translucent amber window
  const glassMat = new THREE.MeshPhysicalMaterial({
    color:        0xffcc88,
    transmission: 0.78,
    roughness:    0.05,
    metalness:    0.0,
    transparent:  true,
    opacity:      0.6
  });
  const glassGeo = new THREE.BoxGeometry(0.08, 0.42, 0.02);
  const glass    = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(1.63, 1.8, 0.4);
  indGroup.add(glass);

  // Glass frame
  const gFrameGeo = new THREE.BoxGeometry(0.12, 0.46, 0.03);
  const gFrameMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.8, roughness: 0.3 });
  const gFrame    = new THREE.Mesh(gFrameGeo, gFrameMat);
  gFrame.position.set(1.63, 1.8, 0.39);
  indGroup.add(gFrame);

  parent.add(indGroup);
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────

/**
 * Build the full transformer digital twin and add it to the scene.
 * @returns {THREE.Group}
 */
export function buildTransformer() {
  _group      = new THREE.Group();
  _group.name = 'transformer';

  _buildInternalCore(_group);
  _buildTank(_group);
  _buildBushings(_group);
  _buildRadiators(_group);
  _buildCables(_group);
  _buildMounting(_group);
  _buildIndicators(_group);

  scene.add(_group);

  // ── State subscriptions ────────────────────────────────────
  subscribe('transformer', (state) => {
    _vibration   = state.transformer.vibration;
    _temperature = state.transformer.temperature;
  });

  subscribe('twin', (state) => {
    _thermalMode = state.twin.viewMode === 'THERMAL';
  });

  // ── Per-frame animation ────────────────────────────────────
  addAnimationCallback((delta) => {
    _t += delta;

    // Micro vibration shake proportional to vibration reading
    const vib = _vibration * 0.002;
    _group.position.x = Math.sin(_t * 60.0) * vib;
    _group.position.z = Math.cos(_t * 47.0) * vib;

    if (_thermalMode) {
      const ratio = Math.max(0, (_temperature - NORMAL_TEMP) / (CRITICAL_TEMP - NORMAL_TEMP));
      setThermalIntensity(ratio);
      if (thermalLight) thermalLight.intensity = ratio * 3.5;
      if (_thermalOverlayMesh) _thermalOverlayMesh.visible = true;
    } else {
      setThermalIntensity(0);
      if (thermalLight) thermalLight.intensity = 0;
      if (_thermalOverlayMesh) _thermalOverlayMesh.visible = false;
    }
  });

  return _group;
}
