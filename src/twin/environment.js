import * as THREE from 'three';
import { scene } from './scene.js';
import { subscribe } from '../core/state.js';
import { registerInteractiveObject } from './inspector.js';

export function buildEnvironment() {
  const envGroup = new THREE.Group();
  envGroup.name = 'environment';

  // 1. Road strip
  const roadGeo = new THREE.PlaneGeometry(60, 8);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.1, roughness: 0.95 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, -8);
  road.receiveShadow = true;
  envGroup.add(road);

  const markGeo = new THREE.BoxGeometry(0.2, 0.01, 2.5);
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffee00 });
  [-8, 0, 8].forEach(x => {
    const mark = new THREE.Mesh(markGeo, markMat);
    mark.position.set(x, 0.02, -8);
    envGroup.add(mark);
  });

  // 2. Utility poles
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 9, 7);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5d4e37 });
  const armGeo = new THREE.BoxGeometry(5, 0.15, 0.15);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x4a3c28 });
  const insulGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6);
  const insulMat = new THREE.MeshStandardMaterial({ color: 0xcc9944 });

  [[-14, -8], [14, -8]].forEach(([x, z]) => {
    const poleGrp = new THREE.Group();
    
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 4.5, 0);
    pole.castShadow = true;
    poleGrp.add(pole);
    
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0, 8.5, 0);
    poleGrp.add(arm);

    [-1.8, 0, 1.8].forEach(ix => {
      const insul = new THREE.Mesh(insulGeo, insulMat);
      insul.position.set(ix, 8.65, 0);
      poleGrp.add(insul);
    });
    
    poleGrp.position.set(x, 0, z);
    envGroup.add(poleGrp);

    // Connect pole to transformer (0, 4.5, 0)
    const pts = [new THREE.Vector3(x, 8.65, z), new THREE.Vector3(0, 4.5, 0)];
    const lineGeo = new THREE.TubeGeometry(new THREE.LineCurve3(pts[0], pts[1]), 2, 0.01, 4, false);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const line = new THREE.Mesh(lineGeo, lineMat);
    envGroup.add(line);
  });

  // 3. EV vehicle
  const evGroup = new THREE.Group();
  
  const bodyGeo = new THREE.BoxGeometry(3.5, 1.0, 1.8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, metalness: 0.6, roughness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.5, 0);
  body.castShadow = true;
  evGroup.add(body);
  
  const cabinGeo = new THREE.BoxGeometry(2.0, 0.7, 1.7);
  const cabinMat = new THREE.MeshPhysicalMaterial({ color: 0x333333, transmission: 0.5, transparent: true, opacity: 0.8 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.35, 0);
  evGroup.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const wellGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.2, 16);
  
  [[-1.1, 0.9], [1.1, 0.9], [-1.1, -0.9], [1.1, -0.9]].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.35, wz);
    evGroup.add(wheel);
    
    const well = new THREE.Mesh(wellGeo, bodyMat);
    well.rotation.x = Math.PI / 2;
    well.position.set(wx, 0.35, wz > 0 ? wz - 0.05 : wz + 0.05);
    evGroup.add(well);
  });

  const frontLightGeo = new THREE.BoxGeometry(0.1, 0.2, 0.4);
  const frontLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 });
  const frontLight1 = new THREE.Mesh(frontLightGeo, frontLightMat);
  frontLight1.position.set(1.7, 0.6, 0.7);
  const frontLight2 = new THREE.Mesh(frontLightGeo, frontLightMat);
  frontLight2.position.set(1.7, 0.6, -0.7);
  evGroup.add(frontLight1, frontLight2);

  const rearLightGeo = new THREE.BoxGeometry(0.1, 0.2, 0.4);
  const rearLightMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 1.0 });
  const rearLight1 = new THREE.Mesh(rearLightGeo, rearLightMat);
  rearLight1.position.set(-1.7, 0.6, 0.7);
  const rearLight2 = new THREE.Mesh(rearLightGeo, rearLightMat);
  rearLight2.position.set(-1.7, 0.6, -0.7);
  evGroup.add(rearLight1, rearLight2);

  evGroup.position.set(11.5, 0.35, 2);
  envGroup.add(evGroup);

  let evState = { status: 'UNKNOWN', power: 0, battery: 0 };
  registerInteractiveObject(body, 'EV Vehicle', () => {
    return {
      'Status': evState.status,
      'Charging Power': (evState.power || 0).toFixed(2) + ' kW',
      'Battery Level': (evState.battery || 0) + '%'
    };
  });

  subscribe('ev', (state) => {
    if (state.ev) {
      evState = { ...state.ev, battery: state.ev.level || 0 };
      if (state.ev.status === 'CHARGING') {
        rearLightMat.color.setHex(0xffaa00);
        rearLightMat.emissive.setHex(0xffaa00);
        rearLightMat.emissiveIntensity = 2.0;
      } else {
        rearLightMat.color.setHex(0xff2200);
        rearLightMat.emissive.setHex(0xff2200);
        rearLightMat.emissiveIntensity = 1.0;
      }
    }
  });

  // 4. Ground patches
  const padMat = new THREE.MeshStandardMaterial({ color: 0x1a2028 });
  const txPadGeo = new THREE.BoxGeometry(6, 0.08, 4);
  const txPad = new THREE.Mesh(txPadGeo, padMat);
  txPad.position.set(0, 0.04, 0);
  txPad.receiveShadow = true;
  envGroup.add(txPad);

  const evPadGeo = new THREE.BoxGeometry(3, 0.08, 3);
  const evPad = new THREE.Mesh(evPadGeo, padMat);
  evPad.position.set(10, 0.04, 3);
  evPad.receiveShadow = true;
  envGroup.add(evPad);

  // 5. Street lamp posts
  const lampPoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 5, 6);
  const lampArmGeo = new THREE.BoxGeometry(0.9, 0.05, 0.05);
  const lampHeadGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xfff5e0, emissive: 0xfff5e0, emissiveIntensity: 1.5 });

  [[-6, -8], [6, -8]].forEach(([x, z]) => {
    const lampGrp = new THREE.Group();
    const pole = new THREE.Mesh(lampPoleGeo, padMat);
    pole.position.set(0, 2.5, 0);
    lampGrp.add(pole);
    
    const arm = new THREE.Mesh(lampArmGeo, padMat);
    arm.position.set(0.45, 5, 0);
    lampGrp.add(arm);

    const head = new THREE.Mesh(lampHeadGeo, lampHeadMat);
    head.position.set(0.9, 5, 0);
    lampGrp.add(head);

    const light = new THREE.PointLight(0xfff8e8, 0.8, 12, 2);
    light.position.set(0.9, 4.8, 0);
    lampGrp.add(light);

    lampGrp.position.set(x, 0, z);
    lampGrp.rotation.y = Math.PI / 2; // Point towards road
    envGroup.add(lampGrp);
  });

  // 6. Background building silhouettes
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x0d1520 });
  
  [[-20, 15, -55], [0, 25, -60], [25, 10, -50]].forEach(([x, h, z]) => {
    const bGeo = new THREE.BoxGeometry(15, h, 15);
    const b = new THREE.Mesh(bGeo, bgMat);
    b.position.set(x, h/2, z);
    envGroup.add(b);
  });

  scene.add(envGroup);
  return envGroup;
}
