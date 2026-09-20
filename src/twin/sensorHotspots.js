// UNITWIN GRID V2 — sensorHotspots.js
import * as THREE from 'three';
import { scene, addAnimationCallback } from './scene.js';
import { subscribe } from '../core/state.js';

const HOTSPOT_DEFS = [
  { id: 'ds18b20', pos: [0.8,  3.5, 1.2], label: 'DS18B20', unit: '°C', getValue: s => s.transformer.temperature, warn: 45, crit: 70 },
  { id: 'mpu6500', pos: [-0.8, 3.0, 1.2], label: 'MPU6500', unit: 'g',  getValue: s => s.transformer.vibration,   warn: 0.5, crit: 1.0 },
  { id: 'ina219',  pos: [-9.0, 2.5, 0.5], label: 'INA219',  unit: 'W',  getValue: s => s.solar.power,             warn: 4.5, crit: 5.5 },
  { id: 'dht22',   pos: [0.0,  1.2,-1.5], label: 'DHT22',   unit: '°C', getValue: s => s.ambient.temperature,     warn: 38,  crit: 50  }
];

let _hotspots = [];
let _container = null;

export function buildSensorHotspots() {
  _container = document.getElementById('threeContainer');

  HOTSPOT_DEFS.forEach(def => {
    // 3D sphere indicator
    const geo  = new THREE.SphereGeometry(0.12, 8, 8);
    const mat  = new THREE.MeshStandardMaterial({
      color: 0x00ccff,
      emissive: new THREE.Color(0x00aaff),
      emissiveIntensity: 1.2,
      metalness: 0.1, roughness: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...def.pos);
    scene.add(mesh);

    _hotspots.push({ def, mesh, mat, t: Math.random() * Math.PI * 2 });
  });

  subscribe('*', (state) => {
    _hotspots.forEach(hs => {
      const val = hs.def.getValue(state);
      if (val >= hs.def.crit)      hs.mat.emissive.setHex(0xff2200);
      else if (val >= hs.def.warn) hs.mat.emissive.setHex(0xff8800);
      else                         hs.mat.emissive.setHex(0x00aaff);
    });
  });

  addAnimationCallback((delta) => {
    _hotspots.forEach(hs => {
      hs.t += delta;
      const s = 1.0 + 0.3 * Math.sin(hs.t * 3.0);
      hs.mesh.scale.setScalar(s);
    });
  });
}

export function setSensorHotspotsVisible(on) {
  _hotspots.forEach(hs => { hs.mesh.visible = on; });
}
