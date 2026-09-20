// UNITWIN GRID V2 — inspector.js
import * as THREE from 'three';
import { camera, renderer } from './scene.js';

const _objects   = new Map();
const _raycaster = new THREE.Raycaster();
const _mouse     = new THREE.Vector2();
let   _hudEl     = null;

export function registerInteractiveObject(mesh, label, getDataFn = () => ({})) {
  _objects.set(mesh, { label, getData: getDataFn });
}

export function clearInteractiveObjects() { _objects.clear(); }

function _getHUD() {
  if (!_hudEl) {
    _hudEl = document.getElementById('inspectorHUD');
    if (!_hudEl) {
      _hudEl = document.createElement('div');
      _hudEl.id = 'inspectorHUD';
      document.body.appendChild(_hudEl);
    }
  }
  return _hudEl;
}

export function showInspectorHUD(label, data) {
  const hud = _getHUD();
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <span class="inspector-title">${label}</span>
    <button id="inspectorClose" style="background:none;border:1px solid rgba(100,150,200,0.4);color:#6a9abf;cursor:pointer;border-radius:3px;padding:0 6px;font-size:11px;">✕</button>
  </div>`;
  for (const [k, v] of Object.entries(data)) {
    html += `<div class="inspector-row"><span class="inspector-label">${k}</span><span class="inspector-value">${v}</span></div>`;
  }
  hud.innerHTML = html;
  hud.style.display = 'block';
  hud.style.opacity = '0';
  hud.style.transition = 'opacity 0.25s ease';
  requestAnimationFrame(() => { hud.style.opacity = '1'; });
  hud.querySelector('#inspectorClose').onclick = hideInspectorHUD;
}

export function hideInspectorHUD() {
  if (_hudEl) { _hudEl.style.display = 'none'; }
}

export function initInspector() {
  if (!renderer) return;
  renderer.domElement.addEventListener('click', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    _mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    _mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_mouse, camera);
    const hits = _raycaster.intersectObjects([..._objects.keys()], true);
    if (!hits.length) { hideInspectorHUD(); return; }
    for (const hit of hits) {
      let obj = hit.object;
      while (obj) {
        if (_objects.has(obj)) {
          const { label, getData } = _objects.get(obj);
          showInspectorHUD(label, getData());
          return;
        }
        obj = obj.parent;
      }
    }
  });
}
