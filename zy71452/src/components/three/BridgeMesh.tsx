import { useFrame } from '@react-three/fiber';
import { useBridgeStore } from '@/store/useBridgeStore';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export function BridgeMesh() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const deckRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const model = useBridgeStore(state => state.model);
  const currentMode = useBridgeStore(state => state.modeShape.currentOrder);
  const deformationScale = useBridgeStore(state => state.scene.deformationScale);
  const isPlaying = useBridgeStore(state => state.scene.isPlaying);
  const animationSpeed = useBridgeStore(state => state.scene.animationSpeed);
  const selectedElementId = useBridgeStore(state => state.scene.selectedElementId);
  const selectElement = useBridgeStore(state => state.selectElement);
  
  const modeShape = model?.modeShapes.find(m => m.order === currentMode);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (isPlaying) {
      timeRef.current += delta * animationSpeed;
    }
    
    if (!meshRef.current || !model || !modeShape) return;
    
    const deformation = Math.sin(timeRef.current * Math.PI) * deformationScale;
    
    model.elements.forEach((element, i) => {
      const startNode = model.nodes.find(n => n.id === element.nodeStartId);
      const endNode = model.nodes.find(n => n.id === element.nodeEndId);
      
      if (!startNode || !endNode) return;
      
      const startDisp = modeShape.displacements[startNode.id] || { x: 0, y: 0, z: 0 };
      const endDisp = modeShape.displacements[endNode.id] || { x: 0, y: 0, z: 0 };
      
      const sx = startNode.x + startDisp.x * deformation;
      const sy = startNode.y + startDisp.y * deformation;
      const sz = startNode.z + startDisp.z * deformation;
      
      const ex = endNode.x + endDisp.x * deformation;
      const ey = endNode.y + endDisp.y * deformation;
      const ez = endNode.z + endDisp.z * deformation;
      
      const midX = (sx + ex) / 2;
      const midY = (sy + ey) / 2;
      const midZ = (sz + ez) / 2;
      
      const dx = ex - sx;
      const dy = ey - sy;
      const dz = ez - sz;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      dummy.position.set(midX, midY, midZ);
      dummy.lookAt(ex, ey, ez);
      dummy.rotateX(Math.PI / 2);
      dummy.scale.set(1, length, 1);
      dummy.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      
      const color = element.id === selectedElementId 
        ? new THREE.Color(0xff6b35)
        : element.type === 'pier'
          ? new THREE.Color(0x64748b)
          : new THREE.Color(0x3b82f6);
      meshRef.current!.setColorAt(i, color);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (!model) return null;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, model.elements.length]}
        onClick={(e) => {
          e.stopPropagation();
          const element = model.elements[e.instanceId];
          if (element) selectElement(element.id);
        }}
      >
        <cylinderGeometry args={[0.2, 0.2, 1, 8]} />
        <meshStandardMaterial side={THREE.DoubleSide} />
      </instancedMesh>
      
      <mesh ref={deckRef} position={[0, 10, 0]}>
        <boxGeometry args={[model.length + 2, 0.5, 10]} />
        <meshStandardMaterial color="#475569" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
