import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.objects = new Map();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.roadNetwork = null;
    this.routeLine = null;
    this.routePoints = [];
    this.vehicle = null;
    this.animationId = null;
    this.onObjectClick = null;
    this.onGroundClick = null;
    this.onObjectDrag = null;
    this.draggingObject = null;
    this.dragOffset = { x: 0, z: 0 };
    this.isDragging = false;
    this.visibleTypes = new Set(['truck', 'speedZone', 'noStopZone', 'washPoint']);
    
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f0f1a);
    this.scene.fog = new THREE.Fog(0x0f0f1a, 50, 150);

    const { width, height } = this.canvas.getBoundingClientRect();
    
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(30, 40, 30);

    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas, 
      antialias: true,
      alpha: true 
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 80;

    this.setupLights();
    this.createGround();
    this.setupEventListeners();
    this.animate();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x1a1a2e, 0.3);
    this.scene.add(hemisphereLight);
  }

  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a2a3a,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);
    this.objects.set('ground', ground);

    const gridHelper = new THREE.GridHelper(100, 50, 0x2a3a4a, 0x1a2a3a);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
  }

  createRoadNetwork(roads) {
    if (this.roadNetwork) {
      this.scene.remove(this.roadNetwork);
    }
    
    this.roadNetwork = new THREE.Group();
    this.roadNetwork.name = 'roadNetwork';

    roads.forEach(road => {
      const points = road.points.map(p => new THREE.Vector3(p.x, 0.02, p.z));
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeometry = new THREE.TubeGeometry(curve, 100, road.width / 2, 8, false);
      const roadMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2a2a3a,
        roughness: 0.8,
        metalness: 0.2
      });
      const roadMesh = new THREE.Mesh(tubeGeometry, roadMaterial);
      roadMesh.receiveShadow = true;
      this.roadNetwork.add(roadMesh);

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(100));
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
      const centerLine = new THREE.Line(lineGeometry, lineMaterial);
      centerLine.position.y = 0.03;
      this.roadNetwork.add(centerLine);
    });

    this.scene.add(this.roadNetwork);
  }

  createZone(type, position, size, id) {
    const colors = {
      speedZone: { main: 0xf59e0b, opacity: 0.3 },
      noStopZone: { main: 0xef4444, opacity: 0.3 },
      washPoint: { main: 0x22c55e, opacity: 0.5 }
    };

    const colorConfig = colors[type] || colors.speedZone;
    const group = new THREE.Group();
    group.name = id;
    group.userData = { type, id, position: { ...position }, size: { ...size } };
    group.position.set(position.x, 0, position.z);

    const geometry = type === 'washPoint' 
      ? new THREE.CylinderGeometry(size.radius, size.radius, 0.1, 32)
      : new THREE.BoxGeometry(size.width, 0.1, size.height);
    
    const material = new THREE.MeshStandardMaterial({
      color: colorConfig.main,
      transparent: true,
      opacity: colorConfig.opacity,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0.05, 0);
    mesh.receiveShadow = true;
    group.add(mesh);

    const edgeGeometry = type === 'washPoint'
      ? new THREE.RingGeometry(size.radius - 0.1, size.radius, 32)
      : new THREE.EdgesGeometry(geometry);
    
    const edgeMaterial = new THREE.LineBasicMaterial({ color: colorConfig.main, linewidth: 2 });
    
    if (type === 'washPoint') {
      const ring = new THREE.Mesh(edgeGeometry, new THREE.MeshBasicMaterial({ 
        color: colorConfig.main, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.11, 0);
      group.add(ring);
    } else {
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edges.position.copy(mesh.position);
      group.add(edges);
    }

    const marker = this.createMarker(type, { x: 0, z: 0 });
    if (marker) {
      marker.position.set(0, 3, 0);
      group.add(marker);
    }

    this.scene.add(group);
    this.objects.set(id, group);
    return group;
  }

  createMarker(type, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const icons = {
      speedZone: '⏱',
      noStopZone: '🚫',
      washPoint: '🚿'
    };
    
    ctx.fillText(icons[type] || '📍', 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(position.x, 3, position.z);
    sprite.scale.set(4, 4, 1);
    
    return sprite;
  }

  createVehicle(position) {
    if (this.vehicle) {
      this.scene.remove(this.vehicle);
    }

    const truckGroup = new THREE.Group();
    truckGroup.name = 'vehicle';
    truckGroup.userData = { type: 'truck' };

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.5, roughness: 0.5 });
    const cabMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.3, roughness: 0.7 });

    const tankGeometry = new THREE.CylinderGeometry(1.2, 1.2, 6, 16);
    const tank = new THREE.Mesh(tankGeometry, bodyMaterial);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(0, 1.5, 0);
    tank.castShadow = true;
    truckGroup.add(tank);

    const hazardGeometry = new THREE.TorusGeometry(1.25, 0.1, 8, 16);
    const hazardMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, metalness: 0.3, roughness: 0.5 });
    const hazard = new THREE.Mesh(hazardGeometry, hazardMaterial);
    hazard.rotation.z = Math.PI / 2;
    hazard.position.set(0, 1.5, 0);
    truckGroup.add(hazard);

    const cabGeometry = new THREE.BoxGeometry(2, 2, 2.5);
    const cab = new THREE.Mesh(cabGeometry, cabMaterial);
    cab.position.set(0, 1.2, -4);
    cab.castShadow = true;
    truckGroup.add(cab);

    const wheelPositions = [
      [-1.2, 0.5, -2.5], [1.2, 0.5, -2.5],
      [-1.2, 0.5, 2], [1.2, 0.5, 2],
      [-1.2, 0.5, 3.5], [1.2, 0.5, 3.5]
    ];

    wheelPositions.forEach(pos => {
      const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(...pos);
      wheel.castShadow = true;
      truckGroup.add(wheel);
    });

    const warningLightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const warningLightMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const warningLight = new THREE.Mesh(warningLightGeometry, warningLightMaterial);
    warningLight.position.set(0, 2.5, -4);
    truckGroup.add(warningLight);

    truckGroup.position.set(position.x, 0, position.z);
    this.scene.add(truckGroup);
    this.vehicle = truckGroup;
    this.objects.set('vehicle', truckGroup);
    
    return truckGroup;
  }

  createRouteLine(points) {
    if (this.routeLine) {
      this.scene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      this.routeLine.material.dispose();
    }

    this.routePoints = points;

    if (points.length < 2) return;

    const pathPoints = points.map(p => new THREE.Vector3(p.x, 0.15, p.z));
    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(200));
    const material = new THREE.LineDashedMaterial({
      color: 0x00d4ff,
      linewidth: 2,
      dashSize: 0.5,
      gapSize: 0.3
    });

    this.routeLine = new THREE.Line(geometry, material);
    this.routeLine.computeLineDistances();
    this.scene.add(this.routeLine);

    points.forEach((p, index) => {
      const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: index === 0 ? 0x22c55e : (index === points.length - 1 ? 0xef4444 : 0x00d4ff)
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(p.x, 0.3, p.z);
      marker.name = `routePoint_${index}`;
      this.routeLine.add(marker);
    });
  }

  updateVehiclePosition(position, rotation = 0) {
    if (this.vehicle) {
      this.vehicle.position.set(position.x, 0, position.z);
      this.vehicle.rotation.y = rotation;
    }
  }

  setView(viewType) {
    const positions = {
      top: { x: 0, y: 60, z: 0.01 },
      perspective: { x: 30, y: 40, z: 30 },
      front: { x: 0, y: 20, z: 50 }
    };

    const pos = positions[viewType] || positions.perspective;
    
    const startPos = this.camera.position.clone();
    const endPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const duration = 500;
    const startTime = Date.now();

    const animateCamera = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      this.camera.position.lerpVectors(startPos, endPos, eased);
      this.controls.target.set(0, 0, 0);
      this.controls.update();

      if (t < 1) {
        requestAnimationFrame(animateCamera);
      }
    };

    animateCamera();
  }

  setupEventListeners() {
    let clickStartTime = 0;
    let clickStartPos = { x: 0, y: 0 };

    this.canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      
      clickStartTime = Date.now();
      clickStartPos = { x: event.clientX, y: event.clientY };
      
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      const allObjects = [];
      this.objects.forEach(obj => {
        if (obj.userData.type && obj.userData.type !== 'ground' && obj.visible) {
          allObjects.push(obj);
        }
      });
      
      const intersects = this.raycaster.intersectObjects(allObjects, true);

      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        let targetObject = clickedObject;
        
        while (targetObject.parent && !targetObject.userData.type) {
          targetObject = targetObject.parent;
        }

        if (targetObject.userData.type && targetObject.userData.type !== 'truck') {
          this.draggingObject = targetObject;
          this.isDragging = false;
          this.controls.enabled = false;
          
          const groundIntersect = this.raycaster.intersectObject(this.objects.get('ground'));
          if (groundIntersect.length > 0) {
            this.dragOffset = {
              x: targetObject.position.x - groundIntersect[0].point.x,
              z: targetObject.position.z - groundIntersect[0].point.z
            };
          }
        }
      }
    });

    this.canvas.addEventListener('mousemove', (event) => {
      if (!this.draggingObject) return;
      
      const moveDistance = Math.sqrt(
        Math.pow(event.clientX - clickStartPos.x, 2) + 
        Math.pow(event.clientY - clickStartPos.y, 2)
      );
      
      if (moveDistance > 5) {
        this.isDragging = true;
      }
      
      if (this.isDragging) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const groundIntersect = this.raycaster.intersectObject(this.objects.get('ground'));
        
        if (groundIntersect.length > 0 && this.draggingObject) {
          const newX = groundIntersect[0].point.x + this.dragOffset.x;
          const newZ = groundIntersect[0].point.z + this.dragOffset.z;
          
          this.draggingObject.position.x = newX;
          this.draggingObject.position.z = newZ;
          
          if (this.draggingObject.userData.position) {
            this.draggingObject.userData.position.x = newX;
            this.draggingObject.userData.position.z = newZ;
          }
          
          if (this.onObjectDrag) {
            this.onObjectDrag(this.draggingObject.userData, { x: newX, z: newZ });
          }
        }
      }
    });

    this.canvas.addEventListener('mouseup', (event) => {
      if (this.draggingObject) {
        if (!this.isDragging && Date.now() - clickStartTime < 300) {
          if (this.onObjectClick) {
            this.onObjectClick(this.draggingObject.userData, this.draggingObject.position);
          }
        }
        
        this.draggingObject = null;
        this.isDragging = false;
        this.controls.enabled = true;
      } else {
        const moveDistance = Math.sqrt(
          Math.pow(event.clientX - clickStartPos.x, 2) + 
          Math.pow(event.clientY - clickStartPos.y, 2)
        );
        
        if (moveDistance < 5 && Date.now() - clickStartTime < 300) {
          const rect = this.canvas.getBoundingClientRect();
          this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          this.raycaster.setFromCamera(this.mouse, this.camera);
          
          const allObjects = [];
          this.objects.forEach(obj => allObjects.push(obj));
          
          const intersects = this.raycaster.intersectObjects(allObjects, true);

          if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            let targetObject = clickedObject;
            
            while (targetObject.parent && !targetObject.userData.type) {
              targetObject = targetObject.parent;
            }

            if (targetObject.userData.type && targetObject.userData.type !== 'ground' && this.onObjectClick) {
              this.onObjectClick(targetObject.userData, intersects[0].point);
            } else if ((clickedObject.name === 'ground' || clickedObject.parent?.name === 'ground') && this.onGroundClick) {
              this.onGroundClick(intersects[0].point);
            }
          } else {
            const groundIntersect = this.raycaster.intersectObject(this.objects.get('ground'));
            if (groundIntersect.length > 0 && this.onGroundClick) {
              this.onGroundClick(groundIntersect[0].point);
            }
          }
        }
      }
    });

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  toggleTypeVisibility(type) {
    if (this.visibleTypes.has(type)) {
      this.visibleTypes.delete(type);
    } else {
      this.visibleTypes.add(type);
    }
    
    this.objects.forEach((obj, id) => {
      if (obj.userData.type === type) {
        obj.visible = this.visibleTypes.has(type);
        obj.traverse(child => {
          if (child.isMesh || child.isSprite) {
            child.visible = this.visibleTypes.has(type);
          }
        });
      }
    });
    
    return this.visibleTypes.has(type);
  }

  isTypeVisible(type) {
    return this.visibleTypes.has(type);
  }

  updateZonePosition(id, position) {
    const zone = this.objects.get(id);
    if (zone) {
      zone.position.x = position.x;
      zone.position.z = position.z;
      zone.userData.position = { ...position };
    }
  }

  removeAllZones() {
    const zonesToRemove = [];
    this.objects.forEach((obj, id) => {
      if (obj.userData.type && obj.userData.type !== 'truck' && obj.userData.type !== 'ground') {
        zonesToRemove.push(id);
      }
    });
    
    zonesToRemove.forEach(id => {
      const obj = this.objects.get(id);
      if (obj) {
        this.scene.remove(obj);
        obj.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        this.objects.delete(id);
      }
    });
  }

  removeZone(id) {
    const obj = this.objects.get(id);
    if (obj) {
      this.scene.remove(obj);
      obj.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.objects.delete(id);
    }
  }

  dispose() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update();

    if (this.vehicle) {
      const warningLight = this.vehicle.children.find(c => c.geometry?.type === 'SphereGeometry' && c.position.y > 2);
      if (warningLight) {
        warningLight.material.opacity = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
        warningLight.material.transparent = true;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.objects.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.renderer.dispose();
  }
}
