import * as THREE from 'three';

export class MallBuilder {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.floorHeight = 0.3;
  }

  buildFloor(floorData) {
    const group = new THREE.Group();
    group.name = `floor-${floorData.id}`;
    group.userData = { type: 'floor', ...floorData };

    const floorGeometry = new THREE.BoxGeometry(80, this.floorHeight, 60);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: floorData.color,
      roughness: 0.8,
      metalness: 0.1
    });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.position.y = floorData.y;
    floorMesh.receiveShadow = true;
    floorMesh.userData = { type: 'floor', ...floorData };
    group.add(floorMesh);

    const edgeGeometry = new THREE.EdgesGeometry(floorGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.5 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.y = floorData.y;
    group.add(edges);

    this.addFloorLabel(group, floorData);

    this.scene.add(group);
    this.sceneManager.objects.push(group);

    return group;
  }

  addFloorLabel(group, floorData) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(floorData.name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, floorData.y + 3, 25);
    sprite.scale.set(10, 2.5, 1);
    group.add(sprite);
  }

  buildEscalator(escalatorData, floorY) {
    const group = new THREE.Group();
    group.name = `escalator-${escalatorData.id}`;
    group.userData = { type: 'escalator', ...escalatorData };

    const baseColor = escalatorData.status === 'maintenance' ? 0xff8800 : 0x888888;
    const handrailColor = escalatorData.status === 'maintenance' ? 0xff6600 : 0x4488ff;

    const baseGeometry = new THREE.BoxGeometry(escalatorData.width, 0.3, escalatorData.length);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.6,
      metalness: 0.4
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(escalatorData.x, floorY + 0.15, escalatorData.z);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const handrailGeometry = new THREE.BoxGeometry(0.1, 1, escalatorData.length);
    const handrailMaterial = new THREE.MeshStandardMaterial({
      color: handrailColor,
      roughness: 0.3,
      metalness: 0.8,
      emissive: handrailColor,
      emissiveIntensity: 0.2
    });

    const leftHandrail = new THREE.Mesh(handrailGeometry, handrailMaterial);
    leftHandrail.position.set(escalatorData.x - escalatorData.width / 2, floorY + 0.8, escalatorData.z);
    group.add(leftHandrail);

    const rightHandrail = new THREE.Mesh(handrailGeometry, handrailMaterial);
    rightHandrail.position.set(escalatorData.x + escalatorData.width / 2, floorY + 0.8, escalatorData.z);
    group.add(rightHandrail);

    this.addDirectionArrow(group, escalatorData, floorY);

    if (escalatorData.status === 'maintenance') {
      this.addMaintenanceMarker(group, escalatorData, floorY);
    }

    this.scene.add(group);
    this.sceneManager.escalators.push({ data: escalatorData, mesh: group });
    this.sceneManager.objects.push(group);

    return group;
  }

  addDirectionArrow(group, escalatorData, floorY) {
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 1);
    arrowShape.lineTo(-0.5, -0.5);
    arrowShape.lineTo(0, 0);
    arrowShape.lineTo(0.5, -0.5);
    arrowShape.lineTo(0, 1);

    const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });

    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(escalatorData.x, floorY + 1.5, escalatorData.z + (escalatorData.direction === 'up' ? -4 : 4));
    arrow.rotation.x = Math.PI / 2;
    arrow.rotation.z = escalatorData.direction === 'up' ? 0 : Math.PI;
    arrow.scale.set(1.5, 1.5, 1.5);
    group.add(arrow);
  }

  addMaintenanceMarker(group, escalatorData, floorY) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 136, 0, 0.9)';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(escalatorData.x, floorY + 5, escalatorData.z);
    sprite.scale.set(3, 3, 1);
    group.add(sprite);
  }

  buildFireDoor(fireDoorData, floorY) {
    const group = new THREE.Group();
    group.name = `fire-door-${fireDoorData.id}`;
    group.userData = { type: 'fireDoor', ...fireDoorData };

    const doorGeometry = new THREE.BoxGeometry(fireDoorData.width, 3, fireDoorData.depth);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0xff4444,
      emissiveIntensity: 0.1
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(fireDoorData.x, floorY + 1.5, fireDoorData.z);
    
    if (fireDoorData.direction === 'north' || fireDoorData.direction === 'south') {
      door.rotation.y = Math.PI / 2;
    }
    
    door.castShadow = true;
    group.add(door);

    const markerGeometry = new THREE.ConeGeometry(0.5, 1, 4);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(fireDoorData.x, floorY + 4, fireDoorData.z);
    marker.rotation.x = Math.PI;
    group.add(marker);

    this.addDoorLabel(group, fireDoorData, floorY);

    this.scene.add(group);
    this.sceneManager.fireDoors.push({ data: fireDoorData, mesh: group });
    this.sceneManager.objects.push(group);

    return group;
  }

  addDoorLabel(group, fireDoorData, floorY) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fireDoorData.name, 64, 16);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(fireDoorData.x, floorY + 2.5, fireDoorData.z);
    sprite.scale.set(4, 1, 1);
    group.add(sprite);
  }

  buildBarrier(barrierData, floorY) {
    const group = new THREE.Group();
    group.name = `barrier-${barrierData.id}`;
    group.userData = { type: 'barrier', ...barrierData, isDraggable: true, floorY: floorY };

    const barrierGeometry = new THREE.BoxGeometry(barrierData.width, 2, barrierData.depth);
    const barrierMaterial = new THREE.MeshStandardMaterial({
      color: barrierData.color || 0xff6b6b,
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9
    });
    const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    barrier.position.set(0, 1, 0);
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    group.add(barrier);

    const edgeGeometry = new THREE.EdgesGeometry(barrierGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.set(0, 1, 0);
    group.add(edges);

    this.addWarningStripes(group, barrierData);

    group.position.set(barrierData.x, floorY, barrierData.z);
    group.rotation.y = barrierData.rotation || 0;

    this.scene.add(group);
    
    const barrierObj = { data: { ...barrierData }, mesh: group };
    this.sceneManager.barriers.push(barrierObj);
    this.sceneManager.objects.push(group);

    return barrierObj;
  }

  addWarningStripes(group, barrierData) {
    const stripeHeight = 0.1;
    const stripeCount = 8;
    
    for (let i = 0; i < stripeCount; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      
      for (let j = 0; j < 8; j++) {
        ctx.fillStyle = j % 2 === 0 ? '#ffff00' : '#000000';
        ctx.fillRect(j * 32, 0, 32, 32);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.8 });
      
      const stripeGeometry = new THREE.PlaneGeometry(barrierData.width, stripeHeight);
      const stripe = new THREE.Mesh(stripeGeometry, material);
      stripe.position.set(0, 0.3 + i * 0.25, (barrierData.depth / 2) + 0.01);
      group.add(stripe);
    }
  }

  buildHeatmap(flowPathData, floorY) {
    const group = new THREE.Group();
    group.name = `heatmap-${flowPathData.id}`;

    const intensity = flowPathData.intensity || 0.5;
    
    for (let i = 0; i < flowPathData.points.length - 1; i++) {
      const start = flowPathData.points[i];
      const end = flowPathData.points[i + 1];
      
      const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2));
      const angle = Math.atan2(end.x - start.x, end.z - start.z);
      
      const color = this.getHeatColor(intensity);
      
      const heatGeometry = new THREE.PlaneGeometry(3, distance);
      const heatMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.4 * intensity,
        side: THREE.DoubleSide
      });
      
      const heatPlane = new THREE.Mesh(heatGeometry, heatMaterial);
      heatPlane.position.set((start.x + end.x) / 2, floorY + 0.05, (start.z + end.z) / 2);
      heatPlane.rotation.x = -Math.PI / 2;
      heatPlane.rotation.z = -angle;
      group.add(heatPlane);
    }

    this.scene.add(group);
    this.sceneManager.heatmapObjects.push(group);

    return group;
  }

  getHeatColor(intensity) {
    if (intensity > 0.7) return 0xff4444;
    if (intensity > 0.5) return 0xff8800;
    if (intensity > 0.3) return 0xffff00;
    return 0x00ff00;
  }

  buildDirectionArrow(point, nextPoint, floorY, index) {
    const group = new THREE.Group();
    
    const dx = nextPoint.x - point.x;
    const dz = nextPoint.z - point.z;
    const angle = Math.atan2(dx, dz);
    
    const arrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(dx, 0, dz).normalize(),
      new THREE.Vector3(point.x, floorY + 0.5, point.z),
      2,
      0x00ffff,
      0.8,
      0.5
    );
    group.add(arrowHelper);

    this.scene.add(group);
    this.sceneManager.directionArrows.push(group);

    return group;
  }

  buildStore(storeData, floorY) {
    const group = new THREE.Group();
    group.name = `store-${storeData.id}`;

    const storeGeometry = new THREE.BoxGeometry(storeData.width, 0.1, storeData.depth);
    const storeMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a6fa5,
      roughness: 0.9,
      transparent: true,
      opacity: 0.5
    });
    const store = new THREE.Mesh(storeGeometry, storeMaterial);
    store.position.set(storeData.x, floorY + 0.05, storeData.z);
    store.receiveShadow = true;
    group.add(store);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(storeData.name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(storeData.x, floorY + 1, storeData.z);
    sprite.scale.set(storeData.width * 0.8, storeData.depth * 0.4, 1);
    group.add(sprite);

    this.scene.add(group);
    this.sceneManager.objects.push(group);

    return group;
  }
}
