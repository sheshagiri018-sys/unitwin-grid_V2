// ============================================================
// UNITWIN GRID V2 — scene.js
// Three.js scene bootstrap: renderer, camera, lights, ground,
// animation loop, resize handling.
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Exported singletons ────────────────────────────────────────
export let renderer     = null;
export let scene        = null;
export let camera       = null;
export let controls     = null;
export let clock        = null;

/**
 * PointLight used as a thermal accent.
 * Intensity is driven externally by thermal mode logic in transformer.js.
 */
export let thermalLight = null;

// ── Internal animation callback registry ──────────────────────
const _animationCallbacks = new Set();

// ── Resize handler reference (kept for removal on dispose) ────
let _resizeHandler = null;

// ── Animation loop state ──────────────────────────────────────
let _animating = false;

// ─────────────────────────────────────────────────────────────
// Private: core render loop
// ─────────────────────────────────────────────────────────────
function _animate() {
  if (!_animating) return;
  requestAnimationFrame(_animate);

  const delta = clock.getDelta();

  for (const cb of _animationCallbacks) {
    try {
      cb(delta);
    } catch (e) {
      console.error('[scene] animation callback error:', e);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Initialise the entire Three.js scene and mount it into container.
 * @param {HTMLElement} container
 */
export function initScene(container) {
  // ── Renderer ──────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled       = true;
  renderer.shadowMap.type          = THREE.PCFSoftShadowMap;
  renderer.toneMapping             = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure     = 1.25;
  renderer.outputColorSpace        = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // ── Scene ─────────────────────────────────────────────────
  scene            = new THREE.Scene();
  scene.background = new THREE.Color(0x060c18);
  scene.fog        = new THREE.Fog(0x080e1e, 40, 130);

  // ── Camera ────────────────────────────────────────────────
  camera = new THREE.PerspectiveCamera(
    52,
    container.clientWidth / container.clientHeight,
    0.1,
    300
  );
  camera.position.set(20, 16, 26);
  camera.lookAt(0, 2, 0);

  // ── OrbitControls ─────────────────────────────────────────
  controls                = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.05;
  controls.minDistance    = 4;
  controls.maxDistance    = 90;
  controls.target.set(0, 2, 0);
  controls.update();

  // ── Clock ─────────────────────────────────────────────────
  clock = new THREE.Clock();

  // ── Lighting ──────────────────────────────────────────────

  // Ambient — cool deep blue fill
  const ambientLight = new THREE.AmbientLight(0x1a2a4a, 0.9);
  scene.add(ambientLight);

  // Key light — warm directional with shadow
  const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.2);
  keyLight.position.set(18, 32, 18);
  keyLight.castShadow              = true;
  keyLight.shadow.mapSize.width    = 2048;
  keyLight.shadow.mapSize.height   = 2048;
  keyLight.shadow.camera.near      = 1;
  keyLight.shadow.camera.far       = 120;
  keyLight.shadow.camera.left      = -30;
  keyLight.shadow.camera.right     = 30;
  keyLight.shadow.camera.top       = 30;
  keyLight.shadow.camera.bottom    = -30;
  keyLight.shadow.bias             = -0.0005;
  scene.add(keyLight);

  // Fill light — cool blue opposite side
  const fillLight = new THREE.DirectionalLight(0x3a4a6a, 0.6);
  fillLight.position.set(-15, 10, -10);
  scene.add(fillLight);

  // Rim light — teal back edge separation
  const rimLight = new THREE.DirectionalLight(0x006888, 0.8);
  rimLight.position.set(0, 5, -20);
  scene.add(rimLight);

  // Thermal accent point light — starts at intensity 0
  thermalLight = new THREE.PointLight(0xff4400, 0, 14, 2);
  thermalLight.position.set(0, 6, 0);
  scene.add(thermalLight);

  // ── Ground plane ──────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(80, 80);
  const groundMat = new THREE.MeshStandardMaterial({
    color:     0x0a1020,
    metalness: 0.2,
    roughness: 0.9
  });
  const ground        = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x   = -Math.PI / 2;
  ground.position.y   = 0;
  ground.receiveShadow = true;
  ground.name         = 'ground';
  scene.add(ground);

  // ── Grid helper ───────────────────────────────────────────
  const grid       = new THREE.GridHelper(80, 40, 0x0d2040, 0x0a1830);
  grid.position.y  = 0.01;
  scene.add(grid);

  // ── Window resize handler ─────────────────────────────────
  _resizeHandler = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', _resizeHandler);

  // ── Start render loop ─────────────────────────────────────
  _animating = true;
  _animate();
}

/**
 * Register a per-frame animation callback.
 * @param {function(delta: number): void} cb
 */
export function addAnimationCallback(cb) {
  _animationCallbacks.add(cb);
}

/**
 * Unregister a previously registered animation callback.
 * @param {function} cb
 */
export function removeAnimationCallback(cb) {
  _animationCallbacks.delete(cb);
}

/**
 * Fully dispose the renderer, scene, controls, and event listeners.
 */
export function disposeScene() {
  _animating = false;

  if (_resizeHandler) {
    window.removeEventListener('resize', _resizeHandler);
    _resizeHandler = null;
  }

  _animationCallbacks.clear();

  if (controls) {
    controls.dispose();
    controls = null;
  }

  if (renderer) {
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer = null;
  }

  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    scene = null;
  }

  camera      = null;
  clock       = null;
  thermalLight = null;
}
