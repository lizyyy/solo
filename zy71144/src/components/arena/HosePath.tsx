import { useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { PathNode, Point3D } from '../../types';

interface HosePathProps {
  nodes: PathNode[];
  onNodeClick?: (nodeId: string) => void;
  onNodeDrag?: (nodeId: string, position: Point3D) => void;
  selectedNodeId?: string | null;
  playbackIndex?: number;
  isValid?: boolean;
}

export function HosePath({
  nodes,
  onNodeClick,
  onNodeDrag,
  selectedNodeId,
  playbackIndex = -1,
  isValid = true,
}: HosePathProps) {
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const { camera, size } = useThree();

  const visibleNodes =
    playbackIndex >= 0 ? nodes.slice(0, playbackIndex + 1) : nodes;

  const tubeGeometry = useMemo(() => {
    if (visibleNodes.length < 2) return null;

    const points = visibleNodes.map(
      (n) => new THREE.Vector3(n.position.x, n.position.y, n.position.z)
    );
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);

    return new THREE.TubeGeometry(curve, Math.max(64, points.length * 16), 0.08, 12, false);
  }, [visibleNodes]);

  const nodeColors = (type: PathNode['type'], isSelected: boolean) => {
    if (isSelected) return { color: '#fbbf24', emissive: '#f59e0b' };
    switch (type) {
      case 'start':
        return { color: '#10b981', emissive: '#059669' };
      case 'end':
        return { color: '#ef4444', emissive: '#dc2626' };
      case 'stairs':
        return { color: '#8b5cf6', emissive: '#7c3aed' };
      case 'corner':
      default:
        return { color: '#3b82f6', emissive: '#2563eb' };
    }
  };

  const handlePointerDown = (
    e: ThreeEvent<PointerEvent>,
    nodeId: string
  ) => {
    e.stopPropagation();
    setDraggingNode(nodeId);
    onNodeClick?.(nodeId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingNode) return;

    mouse.current.x = (e.clientX / size.width) * 2 - 1;
    mouse.current.y = -(e.clientY / size.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);

    const intersect = new THREE.Vector3();
    raycaster.current.ray.intersectPlane(dragPlane.current, intersect);

    if (intersect) {
      const node = nodes.find((n) => n.id === draggingNode);
      if (node) {
        intersect.y = node.position.y;
        onNodeDrag?.(draggingNode, {
          x: Math.round(intersect.x * 2) / 2,
          y: intersect.y,
          z: Math.round(intersect.z * 2) / 2,
        });
      }
    }
  };

  const handlePointerUp = () => {
    setDraggingNode(null);
  };

  return (
    <group
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {tubeGeometry && visibleNodes.length >= 2 && (
        <mesh geometry={tubeGeometry}>
          <meshStandardMaterial
            color={isValid ? '#ef4444' : '#dc2626'}
            emissive={isValid ? '#991b1b' : '#7f1d1d'}
            emissiveIntensity={0.3}
            metalness={0.2}
            roughness={0.6}
          />
        </mesh>
      )}

      {playbackIndex >= 0 && playbackIndex < nodes.length - 1 && (
        <mesh
          position={[
            visibleNodes[visibleNodes.length - 1].position.x,
            visibleNodes[visibleNodes.length - 1].position.y + 0.5,
            visibleNodes[visibleNodes.length - 1].position.z,
          ]}
        >
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
        </mesh>
      )}

      {visibleNodes.map((node, index) => {
        const colors = nodeColors(node.type, selectedNodeId === node.id);
        const scale = selectedNodeId === node.id ? 1.3 : 1;

        return (
          <group key={node.id} position={[node.position.x, node.position.y, node.position.z]}>
            <mesh
              scale={scale}
              onPointerDown={(e) => handlePointerDown(e, node.id)}
              castShadow
            >
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial
                color={colors.color}
                emissive={colors.emissive}
                emissiveIntensity={selectedNodeId === node.id ? 0.6 : 0.3}
                metalness={0.3}
                roughness={0.4}
              />
            </mesh>

            <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.25, 0.35, 32]} />
              <meshBasicMaterial
                color={colors.color}
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}

      {nodes.length > 0 && (
        <group position={[nodes[0].position.x, nodes[0].position.y, nodes[0].position.z]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
          <mesh position={[0, 2.3, 0]}>
            <coneGeometry args={[0.15, 0.3, 8]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
        </group>
      )}
    </group>
  );
}
