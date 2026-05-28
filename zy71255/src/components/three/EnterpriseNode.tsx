import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Enterprise, Gap, Issue } from '../../types';

const COLORS = {
  normal: '#00FF9D',
  warning: '#FF8A00',
  danger: '#FF3B3B',
  selected: '#00D4FF'
};

interface EnterpriseNodeProps {
  enterprise: Enterprise;
  isSelected: boolean;
  isHighlighted: boolean;
  hasIssue: boolean;
  hasGap: boolean;
  gapSize?: number;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}

export const EnterpriseNode = ({
  enterprise,
  isSelected,
  isHighlighted,
  hasIssue,
  hasGap,
  gapSize = 0,
  onSelect,
  onFocus
}: EnterpriseNodeProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const warningRingRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const { baseColor, baseScale } = useMemo(() => {
    let color = COLORS.normal;
    let scale = 1;

    if (isSelected) {
      color = COLORS.selected;
      scale = 1.3;
    } else if (hasGap && gapSize > 0.5) {
      color = COLORS.danger;
      scale = 1 + gapSize * 0.3;
    } else if (hasGap) {
      color = COLORS.warning;
      scale = 1 + gapSize * 0.2;
    } else if (hasIssue) {
      color = COLORS.warning;
      scale = 1.1;
    }

    if (isHighlighted && !isSelected) {
      scale *= 1.15;
    }

    return { baseColor: color, baseScale: scale };
  }, [isSelected, isHighlighted, hasIssue, hasGap, gapSize]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (meshRef.current) {
      if (hasGap && !isSelected) {
        const pulseScale = baseScale + Math.sin(time * 3) * 0.1 * (1 + gapSize);
        meshRef.current.scale.setScalar(pulseScale);
      } else if (!isSelected) {
        const breatheScale = baseScale + Math.sin(time * 2) * 0.03;
        meshRef.current.scale.setScalar(breatheScale);
      }
    }

    if (warningRingRef.current && hasIssue) {
      warningRingRef.current.rotation.y = time * 0.5;
      warningRingRef.current.rotation.z = time * 0.3;
      const ringScale = 1.5 + Math.sin(time * 4) * 0.2;
      warningRingRef.current.scale.setScalar(ringScale);
    }

    if (groupRef.current && hovered) {
      groupRef.current.rotation.y += 0.01;
    }
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect(enterprise.id);
  };

  const handleDoubleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onFocus(enterprise.id);
  };

  const handlePointerOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const gapPercentage = gapSize > 0 ? Math.round(gapSize * 100) : 0;

  return (
    <group ref={groupRef} position={enterprise.position}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={isSelected ? 0.6 : isHighlighted ? 0.4 : 0.2}
          transparent
          opacity={0.9}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>

      {isSelected && (
        <mesh>
          <sphereGeometry args={[1.4, 32, 32]} />
          <meshBasicMaterial
            color={COLORS.selected}
            transparent
            opacity={0.15}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {hasIssue && (
        <mesh ref={warningRingRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.3, 0.05, 16, 100]} />
          <meshBasicMaterial
            color={COLORS.warning}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {hovered && (
        <Html
          center
          distanceFactor={10}
          zIndexRange={[100, 0]}
          position={[0, 2, 0]}
        >
          <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 min-w-[180px] shadow-xl">
            <div className="text-white font-semibold text-sm mb-1">{enterprise.name}</div>
            <div className="text-slate-400 text-xs mb-2">{enterprise.industry}</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">总配额:</span>
                <span className="text-slate-300">{enterprise.totalQuota.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">已使用:</span>
                <span className="text-slate-300">{enterprise.usedQuota.toLocaleString()}</span>
              </div>
              {hasGap && (
                <div className="flex justify-between text-xs pt-1 border-t border-slate-700">
                  <span className="text-orange-400">缺口:</span>
                  <span className="text-orange-400">{gapPercentage}%</span>
                </div>
              )}
              {hasIssue && (
                <div className="text-xs text-red-400 pt-1 border-t border-slate-700">
                  ⚠ 存在数据问题
                </div>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

interface InstancedEnterpriseNodesProps {
  enterprises: Enterprise[];
  gaps: Gap[];
  issues: Issue[];
  selectedEnterpriseId: string | null;
  highlightedEnterpriseIds: string[];
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}

export const InstancedEnterpriseNodes = ({
  enterprises,
  gaps,
  issues,
  selectedEnterpriseId,
  highlightedEnterpriseIds,
  onSelect,
  onFocus
}: InstancedEnterpriseNodesProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const enterpriseInfo = useMemo(() => {
    const gapMap = new Map(gaps.map(g => [g.enterpriseId, g]));
    const issueMap = new Map(issues.map(i => [i.enterpriseId, i]));

    return enterprises.map((enterprise, index) => {
      const gap = gapMap.get(enterprise.id);
      const issue = issueMap.get(enterprise.id);
      const hasGap = !!gap && gap.gap > 0;
      const gapSize = gap ? Math.min(gap.gap / Math.max(gap.required, 1), 1) : 0;
      const hasIssue = !!issue;
      const isSelected = enterprise.id === selectedEnterpriseId;
      const isHighlighted = highlightedEnterpriseIds.includes(enterprise.id);

      let color = COLORS.normal;
      let scale = 1;
      let emissiveIntensity = 0.2;

      if (isSelected) {
        color = COLORS.selected;
        scale = 1.3;
        emissiveIntensity = 0.6;
      } else if (hasGap && gapSize > 0.5) {
        color = COLORS.danger;
        scale = 1 + gapSize * 0.3;
        emissiveIntensity = 0.3;
      } else if (hasGap) {
        color = COLORS.warning;
        scale = 1 + gapSize * 0.2;
        emissiveIntensity = 0.3;
      } else if (hasIssue) {
        color = COLORS.warning;
        scale = 1.1;
        emissiveIntensity = 0.3;
      }

      if (isHighlighted && !isSelected) {
        scale *= 1.15;
        emissiveIntensity = 0.4;
      }

      if (enterprise.id === hoveredId) {
        scale *= 1.1;
      }

      return {
        enterprise,
        index,
        color,
        scale,
        emissiveIntensity,
        hasGap,
        gapSize,
        hasIssue,
        isSelected,
        isHighlighted
      };
    });
  }, [enterprises, gaps, issues, selectedEnterpriseId, highlightedEnterpriseIds, hoveredId]);

  useEffect(() => {
    if (!meshRef.current) return;

    const color = new THREE.Color();

    enterpriseInfo.forEach((info) => {
      dummy.position.set(...info.enterprise.position);
      dummy.scale.setScalar(info.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(info.index, dummy.matrix);
      meshRef.current!.setColorAt(info.index, color.set(info.color));
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [enterpriseInfo, dummy]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime;

    enterpriseInfo.forEach((info) => {
      if (info.hasGap && !info.isSelected) {
        const pulseScale = info.scale + Math.sin(time * 3 + info.index) * 0.1 * (1 + info.gapSize);
        dummy.position.set(...info.enterprise.position);
        dummy.scale.setScalar(pulseScale);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(info.index, dummy.matrix);
      } else if (!info.isSelected) {
        const breatheScale = info.scale + Math.sin(time * 2 + info.index * 0.5) * 0.03;
        dummy.position.set(...info.enterprise.position);
        dummy.scale.setScalar(breatheScale);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(info.index, dummy.matrix);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const handlePointerMove = (e: { instanceId?: number | null; stopPropagation: () => void }) => {
    if (e.instanceId !== undefined && e.instanceId !== null) {
      const enterprise = enterprises[e.instanceId];
      if (enterprise && hoveredId !== enterprise.id) {
        setHoveredId(enterprise.id);
        document.body.style.cursor = 'pointer';
      }
    }
  };

  const handlePointerOut = () => {
    setHoveredId(null);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (e: { instanceId?: number | null; stopPropagation: () => void }) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && e.instanceId !== null) {
      const enterprise = enterprises[e.instanceId];
      if (enterprise) {
        onSelect(enterprise.id);
      }
    }
  };

  const handleDoubleClick = (e: { instanceId?: number | null; stopPropagation: () => void }) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && e.instanceId !== null) {
      const enterprise = enterprises[e.instanceId];
      if (enterprise) {
        onFocus(enterprise.id);
      }
    }
  };

  const hoveredEnterprise = hoveredId ? enterprises.find(e => e.id === hoveredId) : null;
  const hoveredInfo = hoveredId ? enterpriseInfo.find(info => info.enterprise.id === hoveredId) : null;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, enterprises.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.9}
          metalness={0.3}
          roughness={0.2}
        />
      </instancedMesh>

      {enterpriseInfo.filter(info => info.isSelected).map((info) => (
        <mesh key={`selected-${info.enterprise.id}`} position={info.enterprise.position}>
          <sphereGeometry args={[1.4, 32, 32]} />
          <meshBasicMaterial
            color={COLORS.selected}
            transparent
            opacity={0.15}
            side={THREE.BackSide}
          />
        </mesh>
      ))}

      {enterpriseInfo.filter(info => info.hasIssue).map((info) => (
        <IssueRing key={`ring-${info.enterprise.id}`} position={info.enterprise.position} />
      ))}

      {hoveredEnterprise && hoveredInfo && (
        <Html
          center
          distanceFactor={10}
          zIndexRange={[100, 0]}
          position={[hoveredEnterprise.position[0], hoveredEnterprise.position[1] + 2, hoveredEnterprise.position[2]]}
        >
          <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 min-w-[180px] shadow-xl">
            <div className="text-white font-semibold text-sm mb-1">{hoveredEnterprise.name}</div>
            <div className="text-slate-400 text-xs mb-2">{hoveredEnterprise.industry}</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">总配额:</span>
                <span className="text-slate-300">{hoveredEnterprise.totalQuota.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">已使用:</span>
                <span className="text-slate-300">{hoveredEnterprise.usedQuota.toLocaleString()}</span>
              </div>
              {hoveredInfo.hasGap && (
                <div className="flex justify-between text-xs pt-1 border-t border-slate-700">
                  <span className="text-orange-400">缺口:</span>
                  <span className="text-orange-400">{Math.round(hoveredInfo.gapSize * 100)}%</span>
                </div>
              )}
              {hoveredInfo.hasIssue && (
                <div className="text-xs text-red-400 pt-1 border-t border-slate-700">
                  ⚠ 存在数据问题
                </div>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

const IssueRing = ({ position }: { position: [number, number, number] }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      const time = state.clock.elapsedTime;
      ringRef.current.rotation.y = time * 0.5;
      ringRef.current.rotation.z = time * 0.3;
      const ringScale = 1.5 + Math.sin(time * 4) * 0.2;
      ringRef.current.scale.setScalar(ringScale);
    }
  });

  return (
    <mesh ref={ringRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.3, 0.05, 16, 100]} />
      <meshBasicMaterial
        color={COLORS.warning}
        transparent
        opacity={0.8}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default EnterpriseNode;
