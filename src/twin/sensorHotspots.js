// UNITWIN GRID V2 — sensorHotspots.js
import * as THREE from 'three';
import { scene, camera, renderer, addAnimationCallback } from './scene.js';
import { subscribe } from '../core/state.js';

const HOTSPOT_DEFS = [
  { id: 'ds18b20', pos: [0.8,  3.5, 1.2], label: 'DS18B20', unit: '°C', getValue: s => s.transformer?.temperature ?? 32.4, warn: 45, crit: 70 },
  { id: 'mpu6500', pos: [-0.8, 3.0, 1.2], label: 'MPU6500', unit: 'g',  getValue: s => s.transformer?.vibration ?? 0.120,   warn: 0.5, crit: 1.0 },
  { id: 'ina219',  pos: [-9.0, 2.5, 0.5], label: 'INA219',  unit: 'W',  getValue: s => s.solar?.power ?? 1.04,             warn: 4.5, crit: 5.5 },
  { id: 'dht22',   pos: [0.0,  1.2,-1.5], label: 'DHT22',   unit: '°C', getValue: s => s.ambient?.temperature ?? 28.5,     warn: 38,  crit: 50  }
];

let _hotspots = [];
let _visible = false;
let _overlayLayer = null;

export function buildSensorHotspots() {
  const container = document.getElementById('threeContainer');
  if (container) {
    _overlayLayer = document.getElementById('hotspotsOverlay');
    if (!_overlayLayer) {
      _overlayLayer = document.createElement('div');
      _overlayLayer.id = 'hotspotsOverlay';
      _overlayLayer.style.position = 'absolute';
      _overlayLayer.style.inset = '0';
      _overlayLayer.style.pointerEvents = 'none';
      _overlayLayer.style.zIndex = '15';
      _overlayLayer.style.display = 'none';
      container.appendChild(_overlayLayer);
    }
  }

  HOTSPOT_DEFS.forEach(def => {
    // 3D pulsing sphere indicator
    const geo = new THREE.SphereGeometry(0.14, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00d8f0,
      emissive: new THREE.Color(0x00d8f0),
      emissiveIntensity: 1.5,
      metalness: 0.2,
      roughness: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...def.pos);
    mesh.visible = false;
    scene.add(mesh);

    // DOM tag label element
    let labelEl = null;
    if (_overlayLayer) {
      labelEl = document.createElement('div');
      labelEl.className = 'twin-badge';
      labelEl.style.position = 'absolute';
      labelEl.style.transform = 'translate(-50%, -120%)';
      labelEl.style.pointerEvents = 'none';
      labelEl.style.transition = 'opacity 0.2s';
      labelEl.innerHTML = `<div class="twin-badge-title">${def.label}</div><div class="twin-badge-value" style="font-size:0.75rem;">—</div>`;
      _overlayLayer.appendChild(labelEl);
    }

    _hotspots.push({ def, mesh, mat, labelEl, t: Math.random() * Math.PI * 2 });
  });

  subscribe('*', (state) => {
    _hotspots.forEach(hs => {
      const val = hs.def.getValue(state);
      const isNum = typeof val === 'number' && !isNaN(val);
      const text = isNum ? `${val.toFixed(hs.def.unit === 'g' ? 3 : 1)} ${hs.def.unit}` : '—';

      if (hs.labelEl) {
        const valDiv = hs.labelEl.querySelector('.twin-badge-value');
        if (valDiv) valDiv.textContent = text;
      }

      if (val >= hs.def.crit) {
        hs.mat.emissive.setHex(0xff2200);
      } else if (val >= hs.def.warn) {
        hs.mat.emissive.setHex(0xff8800);
      } else {
        hs.mat.emissive.setHex(0x00d8f0);
      }
    });
  });

  addAnimationCallback((delta) => {
    if (!_visible) return;

    const container = document.getElementById('threeContainer');
    const rect = container ? container.getBoundingClientRect() : null;

    _hotspots.forEach(hs => {
      hs.t += delta;
      const s = 1.0 + 0.25 * Math.sin(hs.t * 3.5);
      hs.mesh.scale.setScalar(s);

      // Project 3D position to 2D screen overlay
      if (hs.labelEl && rect && camera) {
        const wp = hs.mesh.position.clone();
        wp.project(camera);

        if (wp.z < 1) {
          const x = (wp.x * 0.5 + 0.5) * rect.width;
          const y = (-(wp.y * 0.5) + 0.5) * rect.height;
          hs.labelEl.style.left = `${x}px`;
          hs.labelEl.style.top  = `${y}px`;
          hs.labelEl.style.display = 'block';
        } else {
          hs.labelEl.style.display = 'none';
        }
      }
    });
  });
}

export function setSensorHotspotsVisible(on) {
  _visible = on;
  _hotspots.forEach(hs => {
    hs.mesh.visible = on;
    if (hs.labelEl) hs.labelEl.style.display = on ? 'block' : 'none';
  });
  if (_overlayLayer) {
    _overlayLayer.style.display = on ? 'block' : 'none';
  }
}
