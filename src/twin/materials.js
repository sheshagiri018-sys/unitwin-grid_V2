// ============================================================
// UNITWIN GRID V2 — materials.js
// Centralised Three.js PBR material definitions for the entire
// digital twin scene. All geometry modules import from here for
// consistent looks and easy global tweaking.
// ============================================================

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Create a MeshStandardMaterial from a plain config object. */
function std(cfg) {
  const mat = new THREE.MeshStandardMaterial();
  if (cfg.color             !== undefined) mat.color.setHex(cfg.color);
  if (cfg.metalness         !== undefined) mat.metalness         = cfg.metalness;
  if (cfg.roughness         !== undefined) mat.roughness         = cfg.roughness;
  if (cfg.emissive          !== undefined) mat.emissive.setHex(cfg.emissive);
  if (cfg.emissiveIntensity !== undefined) mat.emissiveIntensity = cfg.emissiveIntensity;
  if (cfg.transparent       !== undefined) mat.transparent       = cfg.transparent;
  if (cfg.opacity           !== undefined) mat.opacity           = cfg.opacity;
  if (cfg.side              !== undefined) mat.side              = cfg.side;
  mat.needsUpdate = true;
  return mat;
}

/** Create a MeshPhysicalMaterial from a plain config object. */
function phys(cfg) {
  const mat = new THREE.MeshPhysicalMaterial();
  if (cfg.color              !== undefined) mat.color.setHex(cfg.color);
  if (cfg.metalness          !== undefined) mat.metalness          = cfg.metalness;
  if (cfg.roughness          !== undefined) mat.roughness          = cfg.roughness;
  if (cfg.emissive           !== undefined) mat.emissive.setHex(cfg.emissive);
  if (cfg.emissiveIntensity  !== undefined) mat.emissiveIntensity  = cfg.emissiveIntensity;
  if (cfg.transparent        !== undefined) mat.transparent        = cfg.transparent;
  if (cfg.opacity            !== undefined) mat.opacity            = cfg.opacity;
  if (cfg.transmission       !== undefined) mat.transmission       = cfg.transmission;
  if (cfg.clearcoat          !== undefined) mat.clearcoat          = cfg.clearcoat;
  if (cfg.clearcoatRoughness !== undefined) mat.clearcoatRoughness = cfg.clearcoatRoughness;
  if (cfg.ior                !== undefined) mat.ior                = cfg.ior;
  if (cfg.reflectivity       !== undefined) mat.reflectivity       = cfg.reflectivity;
  mat.needsUpdate = true;
  return mat;
}

// ─────────────────────────────────────────────────────────────
// Material Library
// ─────────────────────────────────────────────────────────────

export const MAT = {

  // ── Transformer tank ──────────────────────────────────────
  /** Dark gunmetal blue — painted steel tank body */
  tankBody: std({
    color:     0x2a3a4a,
    metalness: 0.72,
    roughness: 0.42
  }),

  /** Darker high-gloss top plate */
  tankTop: std({
    color:     0x1a2535,
    metalness: 0.85,
    roughness: 0.28
  }),

  // ── Bushings ──────────────────────────────────────────────
  /** Porcelain ceramic glazed bushing — off-white */
  bushing: std({
    color:     0xd0dce8,
    metalness: 0.02,
    roughness: 0.55
  }),

  /** Bushing metal collar hardware */
  bushingMetal: std({
    color:     0x8899aa,
    metalness: 0.92,
    roughness: 0.18
  }),

  // ── Radiator ──────────────────────────────────────────────
  /** Dark cooling blue-grey radiator fins */
  radiator: std({
    color:     0x1a2a3a,
    metalness: 0.65,
    roughness: 0.55
  }),

  // ── Cables ────────────────────────────────────────────────
  /** Black PVC HV cable sheathing */
  cable: std({
    color:     0x111111,
    metalness: 0.0,
    roughness: 0.90
  }),

  /** Red HV cable sheathing */
  cableRed: std({
    color:     0x7a0000,
    metalness: 0.0,
    roughness: 0.88
  }),

  // ── Terminals ─────────────────────────────────────────────
  /** Brass terminal lug — warm gold with slight emissive glow */
  terminal: std({
    color:             0xb08020,
    metalness:         0.92,
    roughness:         0.18,
    emissive:          0x2a1500,
    emissiveIntensity: 0.25
  }),

  // ── Core & Coils ──────────────────────────────────────────
  /** Laminated silicon-steel transformer core */
  core: std({
    color:     0x334455,
    metalness: 0.88,
    roughness: 0.28
  }),

  /** Copper winding coils */
  coil: std({
    color:     0xb87333,
    metalness: 0.78,
    roughness: 0.22
  }),

  // ── Ground / floor ────────────────────────────────────────
  /** Near-matte dark industrial floor */
  ground: std({
    color:     0x0a1020,
    metalness: 0.15,
    roughness: 0.92
  }),

  // ── Sensors ───────────────────────────────────────────────
  /** Dark charcoal plastic sensor enclosure */
  sensorHousing: std({
    color:     0x2a2a2a,
    metalness: 0.3,
    roughness: 0.7
  }),

  // ── Solar array ───────────────────────────────────────────
  /** Anodised aluminium solar panel frame */
  solarPanel: std({
    color:     0x1a2a4a,
    metalness: 0.4,
    roughness: 0.3
  }),

  /** Deep blue photovoltaic cell surface with clearcoat */
  solarCell: phys({
    color:             0x0a1535,
    metalness:         0.5,
    roughness:         0.15,
    clearcoat:         0.8,
    clearcoatRoughness: 0.1
  }),

  // ── EV Charger ────────────────────────────────────────────
  /** Dark navy painted steel cabinet */
  evBody: std({
    color:     0x1a2535,
    metalness: 0.7,
    roughness: 0.35
  }),

  // ── Thermal overlay ───────────────────────────────────────
  /**
   * Semi-transparent additive heat overlay for thermal mode.
   * Driven by setThermalIntensity().
   */
  thermalOverlay: std({
    color:       0xff4400,
    transparent: true,
    opacity:     0.0,
    side:        THREE.FrontSide
  })
};

// ─────────────────────────────────────────────────────────────
// Thermal colour ramp utility
// ─────────────────────────────────────────────────────────────

const _coolColor = new THREE.Color(0x0044ff);  // cool blue
const _midColor  = new THREE.Color(0xffaa00);  // warm amber
const _hotColor  = new THREE.Color(0xff2200);  // hot red

/**
 * Drive the thermalOverlay material based on a normalised heat ratio.
 *
 * @param {number} ratio  0 = coolest, 1 = hottest
 */
export function setThermalIntensity(ratio) {
  const r       = Math.max(0, Math.min(1, ratio));
  const blended = new THREE.Color();

  if (r < 0.5) {
    blended.lerpColors(_coolColor, _midColor, r * 2);
  } else {
    blended.lerpColors(_midColor, _hotColor, (r - 0.5) * 2);
  }

  MAT.thermalOverlay.color.copy(blended);
  // Opacity ramps from 0 (cool) to 0.35 (hot)
  MAT.thermalOverlay.opacity    = r * 0.35;
  MAT.thermalOverlay.needsUpdate = true;
}
