import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BimComponent, CollisionPoint, CameraView } from '../types';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface BimSceneViewerProps {
  components: BimComponent[];
  collisions?: CollisionPoint[];
  selectedCollisionId?: string | null;
  cameraView?: CameraView;
  onCameraChange?: (view: CameraView) => void;
  onSelectComponent?: (componentId: string) => void;
  height?: number;
  showGrid?: boolean;
}

export default function BimSceneViewer({
  components,
  collisions = [],
  selectedCollisionId,
  cameraView,
  onCameraChange,
  onSelectComponent,
  height = 400,
  showGrid = true,
}: BimSceneViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const componentMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const collisionMarkersRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const animationIdRef = useRef<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    sceneRef.current = scene;

    const { clientWidth, clientHeight } = containerRef.current;
    const camera = new THREE.PerspectiveCamera(50, clientWidth / clientHeight, 0.1, 1000);
    camera.position.set(100, -60, 50);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(clientWidth, clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    if (showGrid) {
      const gridHelper = new THREE.GridHelper(200, 50, 0x94a3b8, 0xe2e8f0);
      gridHelper.rotation.x = Math.PI / 2;
      gridHelper.position.y = 0;
      scene.add(gridHelper);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 100);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      const { clientWidth: w, clientHeight: h } = containerRef.current;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current || !camera) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(componentMeshesRef.current.values());
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const compId = mesh.userData.componentId;
        if (compId && onSelectComponent) {
          onSelectComponent(compId);
        }
      }
    };
    renderer.domElement.addEventListener('click', handleClick);

    const handleControlChange = () => {
      if (onCameraChange && camera) {
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ');
        onCameraChange({
          position: {
            x: parseFloat(camera.position.x.toFixed(2)),
            y: parseFloat(camera.position.y.toFixed(2)),
            z: parseFloat(camera.position.z.toFixed(2)),
          },
          rotation: {
            x: parseFloat((euler.x * 180 / Math.PI).toFixed(2)),
            y: parseFloat((euler.y * 180 / Math.PI).toFixed(2)),
            z: parseFloat((euler.z * 180 / Math.PI).toFixed(2)),
          },
          zoom: parseFloat((50 / camera.fov).toFixed(2)),
        });
      }
    };
    controls.addEventListener('change', handleControlChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.removeEventListener('change', handleControlChange);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [showGrid, onCameraChange, onSelectComponent]);

  useEffect(() => {
    if (!sceneRef.current) return;

    componentMeshesRef.current.forEach((mesh) => {
      sceneRef.current?.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    componentMeshesRef.current.clear();

    components.forEach((comp) => {
      const geometry = new THREE.BoxGeometry(comp.size.x, comp.size.z, comp.size.y);
      const material = new THREE.MeshStandardMaterial({
        color: comp.color,
        transparent: true,
        opacity: 0.85,
        roughness: 0.7,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(comp.position.x, comp.position.z, -comp.position.y);
      mesh.userData.componentId = comp.id;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      sceneRef.current?.add(mesh);
      componentMeshesRef.current.set(comp.id, mesh);
    });
  }, [components]);

  useEffect(() => {
    if (!sceneRef.current) return;

    collisionMarkersRef.current.forEach((mesh) => {
      sceneRef.current?.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    collisionMarkersRef.current.clear();

    collisions.forEach((col) => {
      const geometry = new THREE.SphereGeometry(1.5, 16, 16);
      const isSelected = selectedCollisionId === col.id;
      const isDuplicate = col.isDuplicate;
      const color = isSelected ? 0xff6b6b : isDuplicate ? 0xfbbf24 : 0xef4444;
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isSelected ? 1 : 0.8,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(col.position.x, col.position.z, -col.position.y);
      sphere.userData.collisionId = col.id;

      const ringGeometry = new THREE.RingGeometry(1.8, 2.2, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.set(col.position.x, col.position.z, -col.position.y);
      ring.lookAt(new THREE.Vector3(0, 50, 0));

      const group = new THREE.Group();
      group.add(sphere);
      group.add(ring);
      group.userData.collisionId = col.id;

      sceneRef.current?.add(group);
      collisionMarkersRef.current.set(col.id, sphere);
    });
  }, [collisions, selectedCollisionId]);

  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current || !cameraView) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    camera.position.set(
      cameraView.position.x,
      cameraView.position.z,
      -cameraView.position.y
    );

    const euler = new THREE.Euler(
      (cameraView.rotation.x * Math.PI) / 180,
      (cameraView.rotation.y * Math.PI) / 180,
      (cameraView.rotation.z * Math.PI) / 180,
      'XYZ'
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    camera.quaternion.copy(quaternion);

    camera.fov = 50 / cameraView.zoom;
    camera.updateProjectionMatrix();

    controls.target.set(
      cameraView.position.x,
      cameraView.position.z - 20,
      -cameraView.position.y
    );
    controls.update();
  }, [cameraView]);

  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current || !selectedCollisionId) return;

    const collision = collisions.find((c) => c.id === selectedCollisionId);
    if (!collision) return;

    const targetPos = new THREE.Vector3(
      collision.position.x,
      collision.position.z,
      -collision.position.y
    );

    controlsRef.current.target.copy(targetPos);
    controlsRef.current.update();
  }, [selectedCollisionId, collisions]);

  const resetView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(100, 50, 100);
    controlsRef.current.target.set(130, 30, -90);
    controlsRef.current.update();
  };

  const zoomIn = () => {
    if (!cameraRef.current) return;
    cameraRef.current.fov = Math.max(20, cameraRef.current.fov - 10);
    cameraRef.current.updateProjectionMatrix();
  };

  const zoomOut = () => {
    if (!cameraRef.current) return;
    cameraRef.current.fov = Math.min(100, cameraRef.current.fov + 10);
    cameraRef.current.updateProjectionMatrix();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200"
        style={{ height: isFullscreen ? '80vh' : height }}
      />
      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="w-8 h-8 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center text-slate-600 shadow-sm border border-slate-200 transition-colors"
          title="放大"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center text-slate-600 shadow-sm border border-slate-200 transition-colors"
          title="缩小"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center text-slate-600 shadow-sm border border-slate-200 transition-colors"
          title="重置视角"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={toggleFullscreen}
          className="w-8 h-8 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center text-slate-600 shadow-sm border border-slate-200 transition-colors"
          title="全屏"
        >
          <Maximize2 size={16} />
        </button>
      </div>
      {collisions.length > 0 && (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              碰撞点
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              重复/待确认
            </span>
            <span className="text-slate-400">共 {collisions.length} 处</span>
          </div>
        </div>
      )}
    </div>
  );
}
