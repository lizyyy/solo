import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { DrainPoint } from "shared/types";
import { cn } from "@/lib/utils";

export type ViewAngle = "top" | "isometric" | "closeup";

export const VIEW_LABELS: Record<ViewAngle, string> = {
  top: "俯视图",
  isometric: "轴测图",
  closeup: "局部排水口",
};

interface RoofThreeSceneProps {
  drainPoints: DrainPoint[];
  selectedPointId?: string;
  onPointSelect?: (pointId: string) => void;
  viewAngle?: ViewAngle;
  className?: string;
}

const ROOF_WIDTH = 20;
const ROOF_DEPTH = 15;
const ROOF_HEIGHT = 0.3;
const PARAPET_HEIGHT = 0.8;
const GUTTER_WIDTH = 0.6;
const GUTTER_DEPTH = 0.3;
const DOWNSPOUT_RADIUS = 0.2;

function createLabelSprite(text: string, isActive: boolean): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 256;
  canvas.height = 256;

  const bgColor = isActive ? "#1e3a8a" : "#2563eb";
  const ringColor = isActive ? "#fbbf24" : "#ffffff";

  ctx.clearRect(0, 0, 256, 256);

  ctx.beginPath();
  ctx.arc(128, 128, 90, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = ringColor;
  ctx.stroke();

  ctx.font = "bold 90px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 132);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 1.5, 1);
  sprite.renderOrder = 100;
  return sprite;
}

export default function RoofThreeScene({
  drainPoints,
  selectedPointId,
  onPointSelect,
  viewAngle = "isometric",
  className,
}: RoofThreeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const markGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const animationIdRef = useRef<number>(0);

  const pointPositions = useMemo(() => {
    return drainPoints.map((p) => ({
      id: p.id,
      label: p.label,
      x: ((p.x / 100) - 0.5) * ROOF_WIDTH,
      z: ((p.y / 100) - 0.5) * ROOF_DEPTH,
    }));
  }, [drainPoints]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f5f9");
    scene.fog = new THREE.Fog("#f1f5f9", 25, 60);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      100
    );
    camera.position.set(18, 20, 22);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 8;
    controls.maxDistance = 50;
    controls.target.set(0, 0.5, 0);
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x8eb4ff, 0.4);
    fillLight.position.set(-8, 10, -10);
    scene.add(fillLight);

    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: "#e2e8f0",
      roughness: 1,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    const buildingGroup = new THREE.Group();

    const wallMat = new THREE.MeshStandardMaterial({
      color: "#94a3b8",
      roughness: 0.9,
      metalness: 0.1,
    });
    const wallHeight = 6;
    const wallGeo = new THREE.BoxGeometry(ROOF_WIDTH + 0.5, wallHeight, ROOF_DEPTH + 0.5);
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.y = wallHeight / 2 - 0.5;
    walls.receiveShadow = true;
    buildingGroup.add(walls);

    const roofMat = new THREE.MeshStandardMaterial({
      color: "#475569",
      roughness: 0.8,
      metalness: 0.2,
    });
    const roofGeo = new THREE.BoxGeometry(ROOF_WIDTH, ROOF_HEIGHT, ROOF_DEPTH);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = wallHeight - 0.5 + ROOF_HEIGHT / 2;
    roof.receiveShadow = true;
    roof.castShadow = true;
    buildingGroup.add(roof);

    const parapetMat = new THREE.MeshStandardMaterial({
      color: "#64748b",
      roughness: 0.7,
      metalness: 0.1,
    });

    const parapetN = new THREE.Mesh(
      new THREE.BoxGeometry(ROOF_WIDTH, PARAPET_HEIGHT, 0.2),
      parapetMat
    );
    parapetN.position.set(0, wallHeight - 0.5 + ROOF_HEIGHT + PARAPET_HEIGHT / 2, -ROOF_DEPTH / 2 + 0.1);
    parapetN.castShadow = true;
    buildingGroup.add(parapetN);

    const parapetS = new THREE.Mesh(
      new THREE.BoxGeometry(ROOF_WIDTH, PARAPET_HEIGHT, 0.2),
      parapetMat
    );
    parapetS.position.set(0, wallHeight - 0.5 + ROOF_HEIGHT + PARAPET_HEIGHT / 2, ROOF_DEPTH / 2 - 0.1);
    parapetS.castShadow = true;
    buildingGroup.add(parapetS);

    const parapetE = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, PARAPET_HEIGHT, ROOF_DEPTH),
      parapetMat
    );
    parapetE.position.set(ROOF_WIDTH / 2 - 0.1, wallHeight - 0.5 + ROOF_HEIGHT + PARAPET_HEIGHT / 2, 0);
    parapetE.castShadow = true;
    buildingGroup.add(parapetE);

    const parapetW = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, PARAPET_HEIGHT, ROOF_DEPTH),
      parapetMat
    );
    parapetW.position.set(-ROOF_WIDTH / 2 + 0.1, wallHeight - 0.5 + ROOF_HEIGHT + PARAPET_HEIGHT / 2, 0);
    parapetW.castShadow = true;
    buildingGroup.add(parapetW);

    const gutterMat = new THREE.MeshStandardMaterial({
      color: "#334155",
      roughness: 0.6,
      metalness: 0.4,
    });

    const gutterN = new THREE.Mesh(
      new THREE.BoxGeometry(ROOF_WIDTH - 1, GUTTER_DEPTH, GUTTER_WIDTH),
      gutterMat
    );
    gutterN.position.set(0, wallHeight - 0.5 + ROOF_HEIGHT - GUTTER_DEPTH / 2, -ROOF_DEPTH / 2 + GUTTER_WIDTH / 2 + 0.3);
    buildingGroup.add(gutterN);

    const gutterS = new THREE.Mesh(
      new THREE.BoxGeometry(ROOF_WIDTH - 1, GUTTER_DEPTH, GUTTER_WIDTH),
      gutterMat
    );
    gutterS.position.set(0, wallHeight - 0.5 + ROOF_HEIGHT - GUTTER_DEPTH / 2, ROOF_DEPTH / 2 - GUTTER_WIDTH / 2 - 0.3);
    buildingGroup.add(gutterS);

    const downspoutMat = new THREE.MeshStandardMaterial({
      color: "#1e293b",
      roughness: 0.5,
      metalness: 0.6,
    });

    const downspoutPositions = [
      { x: -ROOF_WIDTH / 2 + 1.5, z: -ROOF_DEPTH / 2 + 0.3 },
      { x: ROOF_WIDTH / 2 - 1.5, z: -ROOF_DEPTH / 2 + 0.3 },
      { x: -ROOF_WIDTH / 2 + 1.5, z: ROOF_DEPTH / 2 - 0.3 },
      { x: ROOF_WIDTH / 2 - 1.5, z: ROOF_DEPTH / 2 - 0.3 },
    ];

    downspoutPositions.forEach((pos) => {
      const ds = new THREE.Mesh(
        new THREE.CylinderGeometry(DOWNSPOUT_RADIUS, DOWNSPOUT_RADIUS, wallHeight + 1, 12),
        downspoutMat
      );
      ds.position.set(pos.x, (wallHeight - 0.5) / 2, pos.z);
      ds.castShadow = true;
      buildingGroup.add(ds);

      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(DOWNSPOUT_RADIUS * 1.6, DOWNSPOUT_RADIUS * 1.2, 0.3, 12),
        downspoutMat
      );
      head.position.set(pos.x, wallHeight - 0.5 + ROOF_HEIGHT - GUTTER_DEPTH / 2, pos.z);
      head.castShadow = true;
      buildingGroup.add(head);
    });

    const slopeArrowMat = new THREE.MeshStandardMaterial({
      color: "#f59e0b",
      emissive: "#f59e0b",
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.8,
    });

    for (let i = 0; i < 3; i++) {
      const arrowShape = new THREE.Shape();
      arrowShape.moveTo(0, 0.15);
      arrowShape.lineTo(-0.12, -0.1);
      arrowShape.lineTo(-0.05, -0.1);
      arrowShape.lineTo(-0.05, -0.3);
      arrowShape.lineTo(0.05, -0.3);
      arrowShape.lineTo(0.05, -0.1);
      arrowShape.lineTo(0.12, -0.1);
      arrowShape.lineTo(0, 0.15);

      const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, {
        depth: 0.05,
        bevelEnabled: false,
      });

      const arrow = new THREE.Mesh(arrowGeo, slopeArrowMat);
      arrow.rotation.x = -Math.PI / 2;
      arrow.rotation.z = Math.PI;
      arrow.position.set(
        -ROOF_WIDTH / 3 + i * (ROOF_WIDTH / 3),
        wallHeight - 0.5 + ROOF_HEIGHT + 0.02,
        0
      );
      arrow.scale.set(2.5, 2.5, 1);
      buildingGroup.add(arrow);
    }

    const gridHelper = new THREE.GridHelper(ROOF_WIDTH, 10, "#94a3b8", "#cbd5e1");
    gridHelper.position.y = wallHeight - 0.5 + ROOF_HEIGHT + 0.01;
    buildingGroup.add(gridHelper);

    scene.add(buildingGroup);

    const markGroup = new THREE.Group();
    scene.add(markGroup);
    markGroupRef.current = markGroup;

    const baseY = wallHeight - 0.5 + ROOF_HEIGHT + 0.02;

    pointPositions.forEach((p, idx) => {
      const marker = new THREE.Group();
      marker.userData.pointId = p.id;
      marker.userData.isMarker = true;

      const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.7, 32),
        new THREE.MeshBasicMaterial({
          color: "#ffffff",
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
        })
      );
      baseRing.rotation.x = -Math.PI / 2;
      baseRing.position.y = 0.01;
      marker.add(baseRing);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: "#2563eb" })
      );
      pole.position.y = 0.6;
      marker.add(pole);

      const sprite = createLabelSprite(String(idx + 1), false);
      sprite.position.y = 1.3;
      sprite.userData.isLabel = true;
      marker.add(sprite);

      marker.position.set(p.x, baseY, p.z);
      markGroup.add(marker);
    });

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationIdRef.current);
      controls.dispose();
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!markGroupRef.current || !sceneRef.current) return;

    const markGroup = markGroupRef.current;
    while (markGroup.children.length > 0) {
      const child = markGroup.children[0];
      markGroup.remove(child);
    }

    const cameraY = sceneRef.current.position.y;
    const baseY = 5.5;

    pointPositions.forEach((p, idx) => {
      const marker = new THREE.Group();
      marker.userData.pointId = p.id;
      marker.userData.isMarker = true;

      const isSelected = selectedPointId === p.id;

      const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(isSelected ? 0.5 : 0.4, isSelected ? 0.85 : 0.7, 32),
        new THREE.MeshBasicMaterial({
          color: isSelected ? "#fbbf24" : "#ffffff",
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isSelected ? 0.9 : 0.6,
        })
      );
      baseRing.rotation.x = -Math.PI / 2;
      baseRing.position.y = 0.01;
      marker.add(baseRing);

      const poleColor = isSelected ? "#f59e0b" : "#2563eb";
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: poleColor, emissive: poleColor, emissiveIntensity: isSelected ? 0.3 : 0 })
      );
      pole.position.y = 0.6;
      marker.add(pole);

      const sprite = createLabelSprite(String(idx + 1), isSelected);
      sprite.position.y = 1.3;
      sprite.userData.isLabel = true;
      marker.add(sprite);

      marker.position.set(p.x, baseY, p.z);
      markGroup.add(marker);
    });
  }, [pointPositions, selectedPointId]);

  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const targets: Record<ViewAngle, { pos: [number, number, number]; target: [number, number, number] }> = {
      top: {
        pos: [0, 30, 0.01],
        target: [0, 0, 0],
      },
      isometric: {
        pos: [18, 20, 22],
        target: [0, 0.5, 0],
      },
      closeup: {
        pos: [8, 8, 10],
        target: [-6, 2, -5],
      },
    };

    const t = targets[viewAngle];
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = new THREE.Vector3(...t.pos);
    const endTarget = new THREE.Vector3(...t.target);

    const duration = 600;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      camera.position.lerpVectors(startPos, endPos, ease);
      controls.target.lerpVectors(startTarget, endTarget, ease);
      controls.update();

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [viewAngle]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current || !markGroupRef.current || !onPointSelect) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(markGroupRef.current.children, true);

    if (intersects.length > 0) {
      let obj: THREE.Object3D | null = intersects[0].object;
      while (obj && !obj.userData.isMarker) {
        obj = obj.parent;
      }
      if (obj && obj.userData.pointId) {
        onPointSelect(obj.userData.pointId);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={cn("w-full h-full cursor-crosshair", className)}
    />
  );
}
