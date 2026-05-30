import { useFrame } from '@react-three/fiber';
import { useBridgeStore } from '@/store/useBridgeStore';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export function Nodes() {
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const model = useBridgeStore(state => state.model);
  const currentMode = useBridgeStore(state => state.modeShape.currentOrder);
  const deformationScale = useBridgeStore(state => state.scene.deformationScale);
  const isPlaying = useBridgeStore(state => state.scene.isPlaying);
  const animationSpeed = useBridgeStore(state => state.scene.animationSpeed);
  const selectedNodeId = useBridgeStore(state => state.scene.selectedNodeId);
  const selectNode = useBridgeStore(state => state.selectNode);
  
  const modeShape = model?.modeShapes.find(m => m.order === currentMode);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (isPlaying) {
      timeRef.current += delta * animationSpeed;
    }
    
    if (!instancedRef.current || !model || !modeShape) return;
    
    const deformation = Math.sin(timeRef.current * Math.PI) * deformationScale;
    
    model.nodes.forEach((node, i) => {
      const disp = modeShape.displacements[node.id] || { x: 0, y: 0, z: 0 };
      
      const x = node.x + disp.x * deformation;
      const y = node.y + disp.y * deformation;
      const z = node.z + disp.z * deformation;
      
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(node.id === selectedNodeId ? 0.8 : 0.4);
      dummy.updateMatrix();
      
      instancedRef.current!.setMatrixAt(i, dummy.matrix);
      
      const dispMag = Math.sqrt(disp.x ** 2 + disp.y ** 2 + disp.z ** 2);
      const color = node.id === selectedNodeId
        ? new THREE.Color(0xff6b35)
        : new THREE.Color().setHSL(0.6 - dispMag * 0.5, 0.8, 0.5);
      instancedRef.current!.setColorAt(i, color);
    });
    
    instancedRef.current.instanceMatrix.needsUpdate = true;
    if (instancedRef.current.instanceColor) {
      instancedRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (!model) return null;

  return (
    <instancedMesh
      ref={instancedRef}
      args={[undefined, undefined, model.nodes.length]}
      onClick={(e) => {
        e.stopPropagation();
        const node = model.nodes[e.instanceId];
        if (node) selectNode(node.id);
      }}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial emissive="#1e40af" emissiveIntensity={0.3} />
    </instancedMesh>
  );
}
