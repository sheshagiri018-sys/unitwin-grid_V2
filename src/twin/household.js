// UNITWIN GRID V2 — household.js
import * as THREE from 'three';
import { scene, addAnimationCallback } from './scene.js';
import { MAT } from './materials.js';
import { subscribe } from '../core/state.js';
import { registerInteractiveObject } from './inspector.js';

let _status    = 'ON';
let _power     = 2.4;
let _windows   = [];
let _t         = 0;

function mk(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function buildHousehold() {
  const group = new THREE.Group();
  group.name  = 'household';
  group.position.set(-5, 0, -5);

  // Main body
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, metalness: 0.1, roughness: 0.85 });
  const body = mk(new THREE.BoxGeometry(3.0, 2.2, 2.4), bodyMat);
  body.position.y = 1.1;
  group.add(body);

  // Triangular roof via extrusion
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-1.6, 0); roofShape.lineTo(1.6, 0); roofShape.lineTo(0, 1.3); roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 2.5, bevelEnabled: false });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.2, roughness: 0.8 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.castShadow = roof.receiveShadow = true;
  roof.position.set(-1.25, 2.2, -1.25);
  roof.rotation.y = Math.PI / 2;
  group.add(roof);

  // Emissive windows
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xffeeaa, emissive: new THREE.Color(0xffcc44),
    emissiveIntensity: 0.0, transparent: true, opacity: 0.85
  });
  [[-0.9, 1.2, 1.21], [0.9, 1.2, 1.21], [0, 1.2, -1.21]].forEach(([x, y, z]) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.04), winMat.clone());
    w.position.set(x, y, z);
    group.add(w);
    _windows.push(w);
  });

  // Door
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a3010, metalness: 0.1, roughness: 0.9 });
  const door = mk(new THREE.BoxGeometry(0.55, 1.0, 0.04), doorMat);
  door.position.set(0, 0.5, 1.22);
  group.add(door);

  // Lamp post
  const postMat = new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.7, roughness: 0.3 });
  const post = mk(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), postMat);
  post.position.set(1.8, 0.4, 0);
  group.add(post);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffee88, emissive: new THREE.Color(0xffcc22), emissiveIntensity: 0.0
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lampMat);
  lamp.position.set(1.8, 0.85, 0);
  group.add(lamp);
  _windows.push(lamp);

  // Chimney
  const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x3a2820, roughness: 0.95 });
  const chimney = mk(new THREE.BoxGeometry(0.3, 0.8, 0.3), chimneyMat);
  chimney.position.set(-0.6, 3.65, 0);
  group.add(chimney);

  registerInteractiveObject(group, 'Household Base Load', () => ({
    'Status': _status, 'Power': _power.toFixed(2) + ' W',
    'Type': 'Residential', 'Supply': '12V DC bus', 'Load': 'Resistive (Lamp)'
  }));

  scene.add(group);

  subscribe('household', (state) => {
    _status = state.household.status;
    _power  = state.household.power;
  });

  addAnimationCallback((delta) => {
    _t += delta;
    const isOn = _status === 'ON';
    _windows.forEach((mesh, idx) => {
      mesh.material.emissiveIntensity = isOn
        ? Math.max(0, 1.0 + 0.1 * Math.sin(_t * 6 + idx))
        : 0;
    });
  });

  return group;
}
