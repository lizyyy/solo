import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useScheduleStore } from '../../store/useScheduleStore';
import { Bus, ParkingSpot, StudentQueue } from '../../types';
import gsap from 'gsap';

export default function Scene3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const busMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const spotMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const studentMeshesRef = useRef<Map<string, THREE.InstancedMesh>>(new Map());
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const { buses, parkingSpots, queues, currentTime, cameraView, selectedBusId, selectBus, conflicts } = useScheduleStore();

  const createBus = useCallback((bus: Bus, spot: ParkingSpot | undefined): THREE.Group => {
    const busGroup = new THREE.Group();
    
    const bodyGeometry = new THREE.BoxGeometry(4, 2, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: bus.color,
      metalness: 0.3,
      roughness: 0.7,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.5;
    body.castShadow = true;
    busGroup.add(body);

    const windowGeometry = new THREE.BoxGeometry(3.9, 1, 0.1);
    const windowMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x87CEEB, 
      transparent: true, 
      opacity: 0.6 
    });
    
    for (let i = 0; i < 3; i++) {
      const windowLeft = new THREE.Mesh(windowGeometry, windowMaterial);
      windowLeft.position.set(-2, 1.8, -2.5 + i * 2.5);
      windowLeft.rotation.y = Math.PI / 2;
      busGroup.add(windowLeft);

      const windowRight = new THREE.Mesh(windowGeometry, windowMaterial);
      windowRight.position.set(2, 1.8, -2.5 + i * 2.5);
      windowRight.rotation.y = -Math.PI / 2;
      busGroup.add(windowRight);
    }

    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const wheelPositions = [
      [-1.8, 0.5, -2.5],
      [1.8, 0.5, -2.5],
      [-1.8, 0.5, 2.5],
      [1.8, 0.5, 2.5],
    ];
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.rotation.z = Math.PI / 2;
      busGroup.add(wheel);
    });

    if (spot) {
      busGroup.position.set(spot.position.x, 0, spot.position.z);
    }
    
    busGroup.rotation.y = Math.PI / 2;
    busGroup.userData = { busId: bus.id };

    return busGroup;
  }, []);

  const createParkingSpot = useCallback((spot: ParkingSpot, index: number): THREE.Mesh => {
    const geometry = new THREE.PlaneGeometry(spot.size.width, spot.size.length);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x2a2a2a,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(spot.position.x, 0.01, spot.position.z);
    mesh.receiveShadow = true;
    mesh.userData = { spotId: spot.id, index };
    return mesh;
  }, []);

  const createStudentQueue = useCallback((queue: StudentQueue): THREE.InstancedMesh => {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xFFE4B5 });
    const instancedMesh = new THREE.InstancedMesh(geometry, material, queue.totalStudents);
    
    const dummy = new THREE.Object3D();
    for (let i = 0; i < queue.totalStudents; i++) {
      dummy.position.set(
        queue.position.x + (Math.random() - 0.5) * 2,
        0.75,
        queue.position.z - i * 0.8
      );
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.userData = { queueId: queue.id };
    return instancedMesh;
  }, []);

  const updateBusPosition = useCallback((bus: Bus, spot: ParkingSpot | undefined) => {
    const busMesh = busMeshesRef.current.get(bus.id);
    if (!busMesh || !spot) return;

    const timeDiff = currentTime - bus.departureTime;

    if (bus.status === 'departed' || timeDiff >= 10) {
      gsap.to(busMesh.position, {
        x: spot.position.x + 30,
        z: spot.position.z,
        duration: 2,
        ease: 'power2.in',
      });
      gsap.to(busMesh.scale, {
        x: 0.5,
        y: 0.5,
        z: 0.5,
        duration: 2,
        ease: 'power2.in',
      });
    } else if (bus.status === 'departing' || (timeDiff >= 0 && timeDiff < 10)) {
      const progress = Math.min(timeDiff / 5, 1);
      busMesh.position.x = spot.position.x + progress * 15;
      busMesh.position.z = spot.position.z;
    } else {
      busMesh.position.set(spot.position.x, 0, spot.position.z);
      busMesh.scale.set(1, 1, 1);
    }
  }, [currentTime]);

  const updateStudentQueue = useCallback((queue: StudentQueue) => {
    const instancedMesh = studentMeshesRef.current.get(queue.id);
    if (!instancedMesh) return;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < queue.totalStudents; i++) {
      if (i < queue.currentIndex) {
        dummy.position.set(100, 100, 100);
      } else {
        dummy.position.set(
          queue.position.x + Math.sin(i * 0.5 + currentTime * 2) * 0.2,
          0.75,
          queue.position.z - (i - queue.currentIndex) * 0.8
        );
      }
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
  }, [currentTime]);

  const updateCameraView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const views: Record<string, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
      default: { pos: new THREE.Vector3(30, 30, 30), target: new THREE.Vector3(0, 0, 0) },
      top: { pos: new THREE.Vector3(0, 60, 0.1), target: new THREE.Vector3(0, 0, 0) },
      front: { pos: new THREE.Vector3(0, 15, 50), target: new THREE.Vector3(0, 0, 0) },
      side: { pos: new THREE.Vector3(50, 15, 0), target: new THREE.Vector3(0, 0, 0) },
    };

    const view = views[cameraView];
    if (view) {
      gsap.to(camera.position, {
        x: view.pos.x,
        y: view.pos.y,
        z: view.pos.z,
        duration: 1,
        ease: 'power2.out',
      });
      gsap.to(controls.target, {
        x: view.target.x,
        y: view.target.y,
        z: view.target.z,
        duration: 1,
        ease: 'power2.out',
      });
    }
  }, [cameraView]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 50, 150);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(30, 30, 30);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.1;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
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
    scene.add(directionalLight);

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x333333);
    scene.add(gridHelper);

    const exitLaneMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffaa00, 
      transparent: true, 
      opacity: 0.3 
    });
    for (let lane = -1; lane <= 1; lane += 2) {
      const exitLane = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 60),
        exitLaneMaterial
      );
      exitLane.rotation.x = -Math.PI / 2;
      exitLane.position.set(30 + lane * 4, 0.02, 0);
      scene.add(exitLane);
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const busGroups = Array.from(busMeshesRef.current.values());
      const allMeshes: THREE.Mesh[] = [];
      busGroups.forEach(group => {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            allMeshes.push(child);
          }
        });
      });

      const intersects = raycaster.intersectObjects(allMeshes);
      
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.userData.busId) {
          obj = obj.parent;
        }
        if (obj && obj.userData.busId) {
          selectBus(obj.userData.busId === selectedBusId ? null : obj.userData.busId);
        }
      } else {
        selectBus(null);
      }
    };

    renderer.domElement.addEventListener('click', onMouseClick);

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      controls.update();
      renderer.render(scene, camera);
    };
    animate(0);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', onMouseClick);
      cancelAnimationFrame(animationFrameRef.current);
      containerRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [selectBus, selectedBusId]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    busMeshesRef.current.forEach(mesh => scene.remove(mesh));
    busMeshesRef.current.clear();

    spotMeshesRef.current.forEach(mesh => scene.remove(mesh));
    spotMeshesRef.current.clear();

    studentMeshesRef.current.forEach(mesh => scene.remove(mesh));
    studentMeshesRef.current.clear();

    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x666666 });

    parkingSpots.forEach((spot, index) => {
      const spotMesh = createParkingSpot(spot, index);
      scene.add(spotMesh);
      spotMeshesRef.current.set(spot.id, spotMesh);

      const edges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(spot.size.width, spot.size.length));
      const line = new THREE.LineSegments(edges, edgesMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(spot.position.x, 0.02, spot.position.z);
      scene.add(line);
    });

    buses.forEach(bus => {
      const spot = parkingSpots.find(s => s.id === bus.parkingSpotId);
      const busMesh = createBus(bus, spot);
      scene.add(busMesh);
      busMeshesRef.current.set(bus.id, busMesh);
    });

    queues.forEach(queue => {
      const queueMesh = createStudentQueue(queue);
      scene.add(queueMesh);
      studentMeshesRef.current.set(queue.id, queueMesh);
    });
  }, [parkingSpots, buses, queues, createBus, createParkingSpot, createStudentQueue]);

  useEffect(() => {
    buses.forEach(bus => {
      const spot = parkingSpots.find(s => s.id === bus.parkingSpotId);
      updateBusPosition(bus, spot);
    });

    queues.forEach(queue => {
      updateStudentQueue(queue);
    });
  }, [buses, parkingSpots, queues, currentTime, updateBusPosition, updateStudentQueue]);

  useEffect(() => {
    busMeshesRef.current.forEach((mesh, busId) => {
      const isSelected = busId === selectedBusId;
      const hasConflict = conflicts.some(c => c.involvedBuses.includes(busId) && !c.resolved);
      
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          if (isSelected) {
            child.material.emissive = new THREE.Color(0x00ff00);
            child.material.emissiveIntensity = 0.3;
          } else if (hasConflict) {
            child.material.emissive = new THREE.Color(0xff0000);
            child.material.emissiveIntensity = 0.3;
          } else {
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
          }
        }
      });
    });
  }, [selectedBusId, conflicts, buses]);

  useEffect(() => {
    updateCameraView();
  }, [cameraView, updateCameraView]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full"
      style={{ touchAction: 'none' }}
    />
  );
}
