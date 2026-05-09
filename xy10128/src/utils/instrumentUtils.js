import * as THREE from 'three';

export const INSTRUMENT_TYPES = {
  SCALPEL: {
    type: 'scalpel',
    name: '手术刀',
    width: 0.1,
    height: 0.05,
    depth: 0.8,
    color: 0xe2e8f0,
    handleColor: 0x718096,
    minDistance: 0.1,
    sterile: true
  },
  FORCEPS: {
    type: 'forceps',
    name: '镊子',
    width: 0.15,
    height: 0.08,
    depth: 0.6,
    color: 0xcbd5e0,
    handleColor: 0x4a5568,
    minDistance: 0.15,
    sterile: true
  },
  SCISSORS: {
    type: 'scissors',
    name: '手术剪',
    width: 0.2,
    height: 0.06,
    depth: 0.5,
    color: 0xdee2e6,
    handleColor: 0x2d3748,
    minDistance: 0.12,
    sterile: true
  },
  RETRACTOR: {
    type: 'retractor',
    name: '拉钩',
    width: 0.18,
    height: 0.07,
    depth: 0.7,
    color: 0xe2e8f0,
    handleColor: 0x718096,
    minDistance: 0.15,
    sterile: true
  },
  NEEDLE_HOLDER: {
    type: 'needle_holder',
    name: '持针器',
    width: 0.12,
    height: 0.06,
    depth: 0.55,
    color: 0xe2e8f0,
    handleColor: 0x4a5568,
    minDistance: 0.12,
    sterile: true
  },
  CLAMP: {
    type: 'clamp',
    name: '止血钳',
    width: 0.16,
    height: 0.08,
    depth: 0.65,
    color: 0xcbd5e0,
    handleColor: 0x2d3748,
    minDistance: 0.15,
    sterile: true
  },
  GAUZE: {
    type: 'gauze',
    name: '纱布',
    width: 0.5,
    height: 0.02,
    depth: 0.5,
    color: 0xffffff,
    handleColor: null,
    minDistance: 0.1,
    sterile: true
  },
  SPONGE: {
    type: 'sponge',
    name: '海绵',
    width: 0.3,
    height: 0.1,
    depth: 0.3,
    color: 0xf0fff0,
    handleColor: null,
    minDistance: 0.1,
    sterile: true
  }
};

export function createInstrument(typeKey, id, position = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0 }) {
  const typeConfig = INSTRUMENT_TYPES[typeKey];
  if (!typeConfig) {
    console.error(`Unknown instrument type: ${typeKey}`);
    return null;
  }

  const group = new THREE.Group();
  group.userData = {
    id,
    type: typeConfig.type,
    name: typeConfig.name,
    typeKey,
    config: { ...typeConfig },
    sterile: typeConfig.sterile,
    isInstrument: true
  };

  if (typeConfig.type === 'gauze' || typeConfig.type === 'sponge') {
    const geometry = new THREE.BoxGeometry(
      typeConfig.width,
      typeConfig.height,
      typeConfig.depth
    );
    const material = new THREE.MeshStandardMaterial({
      color: typeConfig.color,
      metalness: 0.1,
      roughness: 0.9,
      transparent: true,
      opacity: 0.95
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = typeConfig.height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (typeConfig.type === 'gauze') {
      const lineGeometry = new THREE.BufferGeometry();
      const points = [];
      for (let i = 0; i <= 4; i++) {
        for (let j = 0; j <= 4; j++) {
          points.push(
            -typeConfig.width / 2 + (typeConfig.width / 4) * i,
            0.01,
            -typeConfig.depth / 2 + (typeConfig.depth / 4) * j
          );
        }
      }
      lineGeometry.setFromPoints(points);
      const lineMaterial = new THREE.PointsMaterial({
        color: 0xe0e0e0,
        size: 0.01
      });
      const texturePoints = new THREE.Points(lineGeometry, lineMaterial);
      texturePoints.position.y = typeConfig.height;
      group.add(texturePoints);
    }
  } else {
    const handleLength = typeConfig.depth * 0.6;
    const tipLength = typeConfig.depth * 0.4;

    const handleGeometry = new THREE.BoxGeometry(
      typeConfig.width * 1.2,
      typeConfig.height,
      handleLength
    );
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: typeConfig.handleColor,
      metalness: 0.3,
      roughness: 0.6
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, typeConfig.height / 2, -handleLength / 2);
    handle.castShadow = true;
    handle.receiveShadow = true;
    group.add(handle);

    const tipGeometry = new THREE.ConeGeometry(
      typeConfig.width * 0.6,
      tipLength,
      4
    );
    const tipMaterial = new THREE.MeshStandardMaterial({
      color: typeConfig.color,
      metalness: 0.8,
      roughness: 0.2
    });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.set(0, typeConfig.height / 2, handleLength / 2 + tipLength / 2);
    tip.rotation.x = Math.PI / 2;
    tip.castShadow = true;
    tip.receiveShadow = true;
    group.add(tip);

    if (typeConfig.type === 'forceps' || typeConfig.type === 'scissors') {
      const grooveGeometry = new THREE.BoxGeometry(
        typeConfig.width * 0.8,
        0.01,
        handleLength * 0.8
      );
      const grooveMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.9,
        roughness: 0.3
      });
      const groove = new THREE.Mesh(grooveGeometry, grooveMaterial);
      groove.position.set(0, typeConfig.height + 0.005, -handleLength / 2);
      groove.castShadow = true;
      group.add(groove);
    }
  }

  group.position.set(position.x, position.y + 0.91, position.z);
  group.rotation.set(rotation.x, rotation.y, rotation.z);

  return group;
}

export function createCollisionMarker(instrumentId, position) {
  const group = new THREE.Group();
  group.userData = { type: 'collision_marker', instrumentId };

  const markerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.8,
    emissive: 0xff0000,
    emissiveIntensity: 0.5
  });
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  marker.position.copy(position);
  marker.position.y += 0.3;
  group.add(marker);

  const ringGeometry = new THREE.TorusGeometry(0.1, 0.01, 8, 32);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.6
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.copy(position);
  ring.position.y += 0.3;
  ring.rotation.x = Math.PI / 2;
  ring.userData.ring = true;
  group.add(ring);

  return group;
}

export function updateCollisionMarkerAnimation(marker, time) {
  if (!marker || !marker.children) return;
  
  marker.children.forEach(child => {
    if (child.userData.ring) {
      child.scale.setScalar(1 + Math.sin(time * 3) * 0.2);
      child.material.opacity = 0.4 + Math.sin(time * 3) * 0.2;
    }
  });
}

export function getInstrumentBoundingBox(instrument) {
  const box = new THREE.Box3().setFromObject(instrument);
  return box;
}

export function getInstrumentCenter(instrument) {
  const box = getInstrumentBoundingBox(instrument);
  const center = new THREE.Vector3();
  box.getCenter(center);
  return center;
}

export function getDistanceBetweenInstruments(instrument1, instrument2) {
  const center1 = getInstrumentCenter(instrument1);
  const center2 = getInstrumentCenter(instrument2);
  return center1.distanceTo(center2);
}
