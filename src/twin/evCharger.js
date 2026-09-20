// UNITWIN GRID V2 — evCharger.js
import * as THREE from 'three';
import { scene, addAnimationCallback } from './scene.js';
import { MAT } from './materials.js';
import { subscribe } from '../core/state.js';
import { registerInteractiveObject } from './inspector.js';

let _status  = 'IDLE';
let _evPower = 0.0;
let _ledMesh    = null;
let _screenMesh = null;
let _t = 0;

function mk(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow    = cast;
  m.receiveShadow = true;
  return m;
}

export function buildEVCharger() {
  const group = new THREE.Group();
  group.name  = 'evCharger';
  group.position.set(9, 0, 2);

  // Cabinet body
  const body = mk(new THREE.BoxGeometry(1.5, 3.0, 0.8), MAT.evBody);
  body.position.y = 1.5;
  group.add(body);

  // Front recessed panel
  const panel = mk(new THREE.BoxGeometry(1.3, 2.7, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.3, roughness: 0.8 }));
  panel.position.set(0, 1.5, 0.43);
  group.add(panel);

  // Emissive screen
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x001a22, emissive: new THREE.Color(0x00ccff),
    emissiveIntensity: 0.0, metalness: 0.1, roughness: 0.6
  });
  _screenMesh = mk(new THREE.BoxGeometry(0.8, 0.5, 0.02), screenMat, false);
  _screenMesh.position.set(0, 2.2, 0.45);
  group.add(_screenMesh);

  // Charge port
  const portMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
  const port = mk(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16), portMat);
  port.rotation.x = Math.PI / 2;
  port.position.set(0, 1.2, 0.44);
  group.add(port);

  // Status LED
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x00ff44, emissive: new THREE.Color(0x00ff44),
    emissiveIntensity: 1.8, metalness: 0.0, roughness: 0.2
  });
  _ledMesh = mk(new THREE.SphereGeometry(0.05, 8, 8), ledMat, false);
  _ledMesh.position.set(0.5, 2.6, 0.45);
  group.add(_ledMesh);

  // Cable + plug
  const cable = mk(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), MAT.cable);
  cable.position.set(0, 0.65, 0.44);
  group.add(cable);
  const plug = mk(new THREE.BoxGeometry(0.15, 0.12, 0.1), MAT.sensorHousing);
  plug.position.set(0, 0.08, 0.44);
  group.add(plug);

  // Base
  const base = mk(new THREE.BoxGeometry(1.6, 0.08, 0.9), MAT.bushingMetal);
  base.position.y = 0.04;
  group.add(base);

  registerInteractiveObject(group, 'EV Load Emulator', () => ({
    'Status':   _status,
    'Power':    _evPower.toFixed(2) + ' W',
    'Mode':     'Emulator (12V Fan)',
    'Max':      '5.5 W',
    'Protocol': 'Simulated'
  }));

  scene.add(group);

  subscribe('ev', (state) => {
    _status  = state.ev.status;
    _evPower = state.ev.power;
  });

  addAnimationCallback((delta) => {
    _t += delta;
    const led = _ledMesh.material;
    if (_evPower > 0.1) {
      const pulse = 0.6 + 0.4 * Math.sin(_t * 3.0);
      led.color.set(0xff8800); led.emissive.set(0xff8800);
      led.emissiveIntensity = pulse * 2.0;
      _screenMesh.material.emissiveIntensity = 0.4 + 0.3 * Math.sin(_t * 2.2);
    } else {
      led.color.set(0x00ff44); led.emissive.set(0x00ff44);
      led.emissiveIntensity = 1.2;
      _screenMesh.material.emissiveIntensity = 0.12;
    }
  });

  return group;
}
