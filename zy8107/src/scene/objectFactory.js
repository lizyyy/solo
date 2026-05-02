import * as THREE from 'three';

export class ObjectFactory {
  static createCrane(craneSpec, position = { x: 0, y: 0, z: 0 }) {
    const craneGroup = new THREE.Group();
    craneGroup.position.set(position.x, position.y, position.z);
    
    const color = craneSpec.visualization?.color || '#e94560';
    
    if (craneSpec.type === 'crawler') {
      ObjectFactory.createCrawlerChassis(craneGroup, craneSpec, color);
    } else {
      ObjectFactory.createTruckChassis(craneGroup, craneSpec, color);
    }
    
    ObjectFactory.createRotatingPlatform(craneGroup, color);
    const boomData = ObjectFactory.createBoom(craneGroup, craneSpec);
    
    ObjectFactory.createHookAndCable(craneGroup, boomData);
    
    craneGroup.userData = {
      type: 'crane',
      crane_id: craneSpec.crane_id,
      spec: craneSpec,
      boom_angle: 70,
      boom_length: craneSpec.boom?.min_length || 30,
      swing_angle: 0,
      hook_height: 10,
      hook_radius: 15
    };
    
    return craneGroup;
  }

  static createCrawlerChassis(group, craneSpec, color) {
    const chassisGroup = new THREE.Group();
    
    const chassisGeom = new THREE.BoxGeometry(8, 2, 5);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: parseInt(color.replace('#', ''), 16),
      roughness: 0.7,
      metalness: 0.3
    });
    const chassis = new THREE.Mesh(chassisGeom, chassisMat);
    chassis.position.y = 1;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    chassisGroup.add(chassis);
    
    const trackWidth = craneSpec.dimensions?.track_width || 10.5;
    const trackLength = craneSpec.dimensions?.track_length || 14.5;
    
    const trackGeom = new THREE.BoxGeometry(trackLength * 0.6, 1.5, 1.2);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });
    
    const leftTrack = new THREE.Mesh(trackGeom, trackMat);
    leftTrack.position.set(0, 0.75, trackWidth / 2 - 0.6);
    leftTrack.castShadow = true;
    leftTrack.receiveShadow = true;
    chassisGroup.add(leftTrack);
    
    const rightTrack = new THREE.Mesh(trackGeom, trackMat);
    rightTrack.position.set(0, 0.75, -trackWidth / 2 + 0.6);
    rightTrack.castShadow = true;
    rightTrack.receiveShadow = true;
    chassisGroup.add(rightTrack);
    
    const rollerGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16);
    const rollerMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.5,
      metalness: 0.5
    });
    
    for (let i = 0; i < 6; i++) {
      const rollerL = new THREE.Mesh(rollerGeom, rollerMat);
      rollerL.rotation.x = Math.PI / 2;
      rollerL.position.set(-trackLength * 0.25 + i * (trackLength * 0.1), 0.4, trackWidth / 2 - 0.6);
      rollerL.castShadow = true;
      chassisGroup.add(rollerL);
      
      const rollerR = new THREE.Mesh(rollerGeom, rollerMat);
      rollerR.rotation.x = Math.PI / 2;
      rollerR.position.set(-trackLength * 0.25 + i * (trackLength * 0.1), 0.4, -trackWidth / 2 + 0.6);
      rollerR.castShadow = true;
      chassisGroup.add(rollerR);
    }
    
    group.add(chassisGroup);
  }

  static createTruckChassis(group, craneSpec, color) {
    const chassisGroup = new THREE.Group();
    
    const cabGeom = new THREE.BoxGeometry(3, 3, 2.5);
    const cabMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.4
    });
    const cab = new THREE.Mesh(cabGeom, cabMat);
    cab.position.set(5, 1.5, 0);
    cab.castShadow = true;
    cab.receiveShadow = true;
    chassisGroup.add(cab);
    
    const bodyGeom = new THREE.BoxGeometry(10, 2.5, 3);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: parseInt(color.replace('#', ''), 16),
      roughness: 0.7,
      metalness: 0.3
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.set(-1.5, 1.25, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    chassisGroup.add(body);
    
    group.add(chassisGroup);
  }

  static createRotatingPlatform(group, color) {
    const platformGroup = new THREE.Group();
    platformGroup.position.y = 2;
    platformGroup.name = 'rotatingPlatform';
    
    const platformGeom = new THREE.CylinderGeometry(4, 4.5, 0.8, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: parseInt(color.replace('#', ''), 16),
      roughness: 0.5,
      metalness: 0.5
    });
    const platform = new THREE.Mesh(platformGeom, platformMat);
    platform.castShadow = true;
    platform.receiveShadow = true;
    platformGroup.add(platform);
    
    const cabinGeom = new THREE.BoxGeometry(2, 2, 2);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x87CEEB,
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.7
    });
    const cabin = new THREE.Mesh(cabinGeom, cabinMat);
    cabin.position.set(0, 1.5, 3);
    cabin.castShadow = true;
    platformGroup.add(cabin);
    
    group.add(platformGroup);
  }

  static createBoom(group, craneSpec) {
    const boomGroup = new THREE.Group();
    boomGroup.name = 'boom';
    boomGroup.position.y = 2.4;
    
    const boomLength = craneSpec.boom?.min_length || 30;
    const boomColor = craneSpec.visualization?.boom_color || '#555555';
    
    const boomGeom = new THREE.BoxGeometry(boomLength, 0.8, 0.8);
    const boomMat = new THREE.MeshStandardMaterial({
      color: parseInt(boomColor.replace('#', ''), 16),
      roughness: 0.6,
      metalness: 0.4
    });
    const boom = new THREE.Mesh(boomGeom, boomMat);
    boom.position.x = boomLength / 2;
    boom.castShadow = true;
    boom.receiveShadow = true;
    boomGroup.add(boom);
    
    const latticeGeom = new THREE.BoxGeometry(boomLength - 2, 0.6, 0.6);
    const latticeMat = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.5,
      metalness: 0.5,
      wireframe: true
    });
    const lattice = new THREE.Mesh(latticeGeom, latticeMat);
    lattice.position.x = boomLength / 2;
    boomGroup.add(lattice);
    
    for (let i = 0; i < boomLength / 5; i++) {
      const strutGeom = new THREE.BoxGeometry(0.1, 0.3, 0.1);
      const strutMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.4,
        metalness: 0.6
      });
      
      const strut1 = new THREE.Mesh(strutGeom, strutMat);
      strut1.position.set(1 + i * 5, 0.3, 0.2);
      boomGroup.add(strut1);
      
      const strut2 = new THREE.Mesh(strutGeom, strutMat);
      strut2.position.set(1 + i * 5, -0.3, -0.2);
      boomGroup.add(strut2);
    }
    
    const pivotGeom = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 16);
    const pivotMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.4,
      metalness: 0.6
    });
    const pivot = new THREE.Mesh(pivotGeom, pivotMat);
    pivot.rotation.z = Math.PI / 2;
    pivot.castShadow = true;
    boomGroup.add(pivot);
    
    boomGroup.rotation.z = Math.PI * 0.35;
    
    const rotatingPlatform = group.getObjectByName('rotatingPlatform');
    if (rotatingPlatform) {
      rotatingPlatform.add(boomGroup);
    }
    
    return {
      group: boomGroup,
      length: boomLength,
      angle: Math.PI * 0.35
    };
  }

  static createHookAndCable(group, boomData) {
    const hookGroup = new THREE.Group();
    hookGroup.name = 'hookSystem';
    
    const hookColor = 0xffc107;
    
    const hookGeom = new THREE.CylinderGeometry(0.15, 0.15, 2, 16);
    const hookMat = new THREE.MeshStandardMaterial({
      color: hookColor,
      roughness: 0.3,
      metalness: 0.8
    });
    const hook = new THREE.Mesh(hookGeom, hookMat);
    hook.position.y = 0;
    hook.castShadow = true;
    hookGroup.add(hook);
    
    const spreaderGeom = new THREE.BoxGeometry(3, 0.2, 0.5);
    const spreaderMat = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.5,
      metalness: 0.5
    });
    const spreader = new THREE.Mesh(spreaderGeom, spreaderMat);
    spreader.position.y = -1.5;
    spreader.castShadow = true;
    hookGroup.add(spreader);
    
    const slingGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8);
    const slingMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
      metalness: 0.1
    });
    
    for (let i = 0; i < 4; i++) {
      const sling = new THREE.Mesh(slingGeom, slingMat);
      const xOffset = (i % 2 === 0 ? -1 : 1) * 1.3;
      const zOffset = (i < 2 ? 0.15 : -0.15);
      sling.position.set(xOffset, -2.25, zOffset);
      sling.rotation.x = Math.PI * 0.1;
      hookGroup.add(sling);
    }
    
    const cableGroup = new THREE.Group();
    cableGroup.name = 'cables';
    
    const cableGeom = new THREE.CylinderGeometry(0.05, 0.05, 20, 8);
    const cableMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });
    
    const mainCable = new THREE.Mesh(cableGeom, cableMat);
    mainCable.position.y = 10;
    cableGroup.add(mainCable);
    
    hookGroup.add(cableGroup);
    
    hookGroup.position.set(
      Math.cos(boomData.angle) * boomData.length * 0.7,
      Math.sin(boomData.angle) * boomData.length * 0.7,
      0
    );
    
    const rotatingPlatform = group.getObjectByName('rotatingPlatform');
    if (rotatingPlatform) {
      rotatingPlatform.add(hookGroup);
    }
    
    return hookGroup;
  }

  static createObstacle(obstacleData) {
    const obstacleGroup = new THREE.Group();
    obstacleGroup.position.set(
      obstacleData.position.x,
      obstacleData.position.y,
      obstacleData.position.z
    );
    
    let mesh;
    const material = new THREE.MeshStandardMaterial({
      color: obstacleData.critical ? 0xff6b6b : 0x74b9ff,
      roughness: 0.6,
      metalness: 0.3,
      transparent: true,
      opacity: 0.9
    });
    
    if (obstacleData.type === 'cylinder') {
      const geom = new THREE.CylinderGeometry(
        obstacleData.dimensions.radius,
        obstacleData.dimensions.radius,
        obstacleData.dimensions.height,
        32
      );
      mesh = new THREE.Mesh(geom, material);
      mesh.position.y = obstacleData.dimensions.height / 2;
    } else {
      const geom = new THREE.BoxGeometry(
        obstacleData.dimensions.width,
        obstacleData.dimensions.height,
        obstacleData.dimensions.depth
      );
      mesh = new THREE.Mesh(geom, material);
      mesh.position.y = obstacleData.dimensions.height / 2;
    }
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    obstacleGroup.add(mesh);
    
    if (obstacleData.no_go_zone) {
      const indicatorGeom = new THREE.CylinderGeometry(
        obstacleData.dimensions.width / 2 + 2,
        obstacleData.dimensions.width / 2 + 2,
        0.2,
        32
      );
      const indicatorMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.3
      });
      const indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
      indicator.position.y = 0.1;
      obstacleGroup.add(indicator);
    }
    
    obstacleGroup.userData = {
      type: 'obstacle',
      obstacle_id: obstacleData.id,
      name: obstacleData.name,
      critical: obstacleData.critical,
      data: obstacleData
    };
    
    return obstacleGroup;
  }

  static createOutriggerZone(outriggerData) {
    const zoneGroup = new THREE.Group();
    zoneGroup.position.set(
      outriggerData.position.x,
      outriggerData.position.y,
      outriggerData.position.z
    );
    
    const width = outriggerData.size.left + outriggerData.size.right;
    const depth = outriggerData.size.front + outriggerData.size.back;
    
    const zoneGeom = new THREE.BoxGeometry(width, 0.1, depth);
    const zoneMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3
    });
    const zone = new THREE.Mesh(zoneGeom, zoneMat);
    zone.position.y = 0.05;
    zone.receiveShadow = true;
    zoneGroup.add(zone);
    
    const edgeGeom = new THREE.BoxGeometry(width + 0.5, 0.2, depth + 0.5);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.position.y = 0.1;
    zoneGroup.add(edge);
    
    const corners = [
      { x: -outriggerData.size.left, z: outriggerData.size.front },
      { x: outriggerData.size.right, z: outriggerData.size.front },
      { x: -outriggerData.size.left, z: -outriggerData.size.back },
      { x: outriggerData.size.right, z: -outriggerData.size.back }
    ];
    
    corners.forEach((corner, index) => {
      const padGeom = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16);
      const padMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 0.7
      });
      const pad = new THREE.Mesh(padGeom, padMat);
      pad.position.set(corner.x, 0.1, corner.z);
      zoneGroup.add(pad);
    });
    
    zoneGroup.userData = {
      type: 'outrigger_zone',
      zone_id: outriggerData.id,
      name: outriggerData.name,
      data: outriggerData
    };
    
    return zoneGroup;
  }

  static createLiftPath(waypoints, color = 0x00ffff) {
    const pathGroup = new THREE.Group();
    
    if (!waypoints || waypoints.length < 2) {
      return pathGroup;
    }
    
    const points = waypoints.map(wp => 
      new THREE.Vector3(wp.x, wp.y, wp.z)
    );
    
    const curve = new THREE.CatmullRomCurve3(points);
    const curvePoints = curve.getPoints(100);
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    });
    
    const line = new THREE.Line(geometry, material);
    pathGroup.add(line);
    
    waypoints.forEach((wp, index) => {
      const markerGeom = new THREE.SphereGeometry(0.8, 16, 16);
      const markerMat = new THREE.MeshStandardMaterial({
        color: index === 0 ? 0x00ff00 : 
               index === waypoints.length - 1 ? 0xff0000 : 0x00ffff,
        emissive: index === 0 ? 0x00ff00 : 
                 index === waypoints.length - 1 ? 0xff0000 : 0x00ffff,
        emissiveIntensity: 0.5
      });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.set(wp.x, wp.y, wp.z);
      pathGroup.add(marker);
    });
    
    pathGroup.userData = {
      type: 'lift_path',
      waypoints: waypoints
    };
    
    return pathGroup;
  }

  static createLoadComponent(loadData, position = { x: 0, y: 0, z: 0 }) {
    const loadGroup = new THREE.Group();
    loadGroup.position.set(position.x, position.y, position.z);
    
    const size = Math.max(2, Math.min(8, loadData.weight / 10 + 2));
    
    const loadGeom = new THREE.BoxGeometry(size, size * 0.8, size * 0.6);
    const loadMat = new THREE.MeshStandardMaterial({
      color: 0x9b59b6,
      roughness: 0.7,
      metalness: 0.2
    });
    const load = new THREE.Mesh(loadGeom, loadMat);
    load.position.y = size * 0.4;
    load.castShadow = true;
    load.receiveShadow = true;
    loadGroup.add(load);
    
    const outlineGeom = new THREE.BoxGeometry(size + 0.1, size * 0.8 + 0.1, size * 0.6 + 0.1);
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    const outline = new THREE.Mesh(outlineGeom, outlineMat);
    outline.position.y = size * 0.4;
    loadGroup.add(outline);
    
    loadGroup.userData = {
      type: 'load',
      component_name: loadData.component_name,
      component_id: loadData.component_id,
      weight: loadData.weight,
      size: size
    };
    
    return loadGroup;
  }

  static createNoFlyZone(zoneData) {
    const zoneGroup = new THREE.Group();
    
    const width = zoneData.bounds.x_max - zoneData.bounds.x_min;
    const depth = zoneData.bounds.z_max - zoneData.bounds.z_min;
    const height = zoneData.max_height - zoneData.min_height;
    
    const centerX = (zoneData.bounds.x_max + zoneData.bounds.x_min) / 2;
    const centerZ = (zoneData.bounds.z_max + zoneData.bounds.z_min) / 2;
    const centerY = (zoneData.max_height + zoneData.min_height) / 2;
    
    zoneGroup.position.set(centerX, centerY, centerZ);
    
    const zoneGeom = new THREE.BoxGeometry(width, height, depth);
    const zoneMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    const zone = new THREE.Mesh(zoneGeom, zoneMat);
    zoneGroup.add(zone);
    
    const floorGeom = new THREE.BoxGeometry(width, 0.1, depth);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.2
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.y = -height / 2;
    zoneGroup.add(floor);
    
    zoneGroup.userData = {
      type: 'no_fly_zone',
      zone_id: zoneData.id,
      name: zoneData.name,
      data: zoneData
    };
    
    return zoneGroup;
  }
}
