import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useAppStore } from '@/store/useAppStore';
import { calculateTerrainData } from '@/utils/anomalyDetector';
import { getRiskColor, hexToRgb } from '@/utils/colors';
import type { TerrainDataPoint } from '@/types';

const INDUSTRY_COUNT = 12;
const MATURITY_COUNT = 8;
const CELL_SIZE = 0.8;
const GAP = 0.2;
const HEIGHT_SCALE = 0.00000008;

function TerrainBar({
  position,
  height,
  color,
  data,
  isHighlighted,
  hasAnomaly,
  onClick,
}: {
  position: [number, number, number];
  height: number;
  color: string;
  data: TerrainDataPoint;
  isHighlighted: boolean;
  hasAnomaly: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const targetHeight = useRef(0);
  const currentHeight = useRef(0);

  targetHeight.current = height;

  useFrame((_, delta) => {
    if (meshRef.current) {
      currentHeight.current += (targetHeight.current - currentHeight.current) * delta * 3;
      meshRef.current.scale.y = Math.max(0.01, currentHeight.current);
      meshRef.current.position.y = currentHeight.current / 2;

      if (hovered || isHighlighted) {
        meshRef.current.scale.x = 1.15;
        meshRef.current.scale.z = 1.15;
      } else {
        meshRef.current.scale.x += (1 - meshRef.current.scale.x) * delta * 5;
        meshRef.current.scale.z += (1 - meshRef.current.scale.z) * delta * 5;
      }
    }
  });

  const rgbColor = hexToRgb(color);
  const emissiveIntensity = hovered || isHighlighted ? 0.4 : 0.1;
  const pulseIntensity = isHighlighted ? 0.5 + Math.sin(Date.now() * 0.003) * 0.3 : 0;

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[CELL_SIZE, 1, CELL_SIZE]} />
        <meshStandardMaterial
          color={new THREE.Color(rgbColor.r, rgbColor.g, rgbColor.b)}
          emissive={new THREE.Color(rgbColor.r, rgbColor.g, rgbColor.b)}
          emissiveIntensity={emissiveIntensity + pulseIntensity}
          roughness={0.3}
          metalness={0.7}
          transparent
          opacity={0.95}
        />
      </mesh>

      {hasAnomaly && (
        <mesh position={[0, height + 0.3, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.9} />
        </mesh>
      )}

      {(hovered || isHighlighted) && (
        <Html position={[0, height + 0.8, 0]} center distanceFactor={10}>
          <div className="bg-slate-900/95 backdrop-blur-sm border border-cyan-500/50 rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap shadow-2xl">
            <div className="font-bold text-cyan-400 mb-1">
              敞口: {(data.totalPrincipal / 10000).toFixed(0)}万元
            </div>
            <div className="text-slate-300">笔数: {data.loanCount}笔</div>
            <div className="text-slate-300">平均风险: {data.avgRiskLevel.toFixed(1)}</div>
            {hasAnomaly && (
              <div className="text-amber-400 mt-1">异常: {data.anomalyCount}个</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function TerrainGrid({
  terrainData,
  maxPrincipal,
  riskLevelMap,
  selectedPoint,
  onPointClick,
  anomalyLoanIds,
}: {
  terrainData: TerrainDataPoint[];
  maxPrincipal: number;
  riskLevelMap: Map<string, number>;
  selectedPoint: TerrainDataPoint | null;
  onPointClick: (point: TerrainDataPoint) => void;
  anomalyLoanIds: Set<string>;
}) {
  const dataMap = useMemo(() => {
    const map = new Map<string, TerrainDataPoint>();
    terrainData.forEach((d) => {
      map.set(`${d.industryCode}-${d.maturityCode}-${d.riskRatingCode}`, d);
    });
    return map;
  }, [terrainData]);

  const industryOrder = useMemo(() => {
    const tags = useAppStore.getState().industryTags;
    return new Map(tags.map((t, i) => [t.code, i]));
  }, []);

  const maturityOrder = useMemo(() => {
    const buckets = useAppStore.getState().maturityBuckets;
    return new Map(buckets.map((b, i) => [b.code, i]));
  }, []);

  const bars = useMemo(() => {
    const result: {
      position: [number, number, number];
      height: number;
      color: string;
      data: TerrainDataPoint;
      isHighlighted: boolean;
      hasAnomaly: boolean;
    }[] = [];

    terrainData.forEach((data) => {
      const industryIdx = industryOrder.get(data.industryCode) ?? 0;
      const maturityIdx = maturityOrder.get(data.maturityCode) ?? 0;
      const riskLevel = riskLevelMap.get(data.riskRatingCode) ?? 5;

      const x = (industryIdx - INDUSTRY_COUNT / 2) * (CELL_SIZE + GAP);
      const z = (maturityIdx - MATURITY_COUNT / 2) * (CELL_SIZE + GAP);

      const height = Math.max(0.2, data.totalPrincipal * HEIGHT_SCALE);
      const color = getRiskColor(riskLevel);

      const hasAnomaly = data.loans.some((loanId) => anomalyLoanIds.has(loanId));
      const isHighlighted =
        selectedPoint?.industryCode === data.industryCode &&
        selectedPoint?.maturityCode === data.maturityCode &&
        selectedPoint?.riskRatingCode === data.riskRatingCode;

      if (hasAnomaly) {
        data.anomalyCount = data.loans.filter((loanId) => anomalyLoanIds.has(loanId)).length;
      }

      result.push({
        position: [x, 0, z],
        height,
        color,
        data,
        isHighlighted,
        hasAnomaly,
      });
    });

    return result;
  }, [terrainData, industryOrder, maturityOrder, riskLevelMap, selectedPoint, anomalyLoanIds]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[INDUSTRY_COUNT * (CELL_SIZE + GAP) + 2, MATURITY_COUNT * (CELL_SIZE + GAP) + 2]} />
        <meshStandardMaterial color="#1E293B" roughness={0.8} metalness={0.2} />
      </mesh>

      <gridHelper
        args={[
          INDUSTRY_COUNT * (CELL_SIZE + GAP) + 1,
          INDUSTRY_COUNT,
          '#334155',
          '#1E293B',
        ]}
        position={[0, 0.01, 0]}
      />

      {bars.map((bar, idx) => (
        <TerrainBar
          key={idx}
          position={bar.position}
          height={bar.height}
          color={bar.color}
          data={bar.data}
          isHighlighted={bar.isHighlighted}
          hasAnomaly={bar.hasAnomaly}
          onClick={() => onPointClick(bar.data)}
        />
      ))}
    </group>
  );
}

function AxisLabels() {
  const industryTags = useAppStore((state) => state.industryTags);
  const maturityBuckets = useAppStore((state) => state.maturityBuckets);

  return (
    <group>
      {industryTags.map((tag, idx) => {
        const x = (idx - INDUSTRY_COUNT / 2) * (CELL_SIZE + GAP);
        return (
          <Text
            key={tag.code}
            position={[x, 0, (MATURITY_COUNT / 2 + 1) * (CELL_SIZE + GAP)]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.25}
            color="#94A3B8"
            anchorX="center"
            anchorY="middle"
          >
            {tag.name}
          </Text>
        );
      })}

      {maturityBuckets.map((bucket, idx) => {
        const z = (idx - MATURITY_COUNT / 2) * (CELL_SIZE + GAP);
        return (
          <Text
            key={bucket.code}
            position={[-(INDUSTRY_COUNT / 2 + 1.5) * (CELL_SIZE + GAP), 0, z]}
            rotation={[-Math.PI / 2, 0, Math.PI / 4]}
            fontSize={0.2}
            color="#94A3B8"
            anchorX="center"
            anchorY="middle"
          >
            {bucket.name}
          </Text>
        );
      })}

      <Text
        position={[0, 0, (MATURITY_COUNT / 2 + 2.5) * (CELL_SIZE + GAP)]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.35}
        color="#06B6D4"
        anchorX="center"
        anchorY="middle"
      >
        行业维度
      </Text>

      <Text
        position={[-(INDUSTRY_COUNT / 2 + 2.5) * (CELL_SIZE + GAP), 0, 0]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={0.35}
        color="#06B6D4"
        anchorX="center"
        anchorY="middle"
      >
        期限维度
      </Text>
    </group>
  );
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#87CEEB', '#1E293B', 0.3]} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={[-8, 10, -8]} intensity={0.5} color="#475569" />
      <pointLight position={[0, 8, 0]} intensity={0.6} color="#06B6D4" distance={30} />
    </>
  );
}

export function RiskTerrainScene({
  onPointSelect,
}: {
  onPointSelect: (point: TerrainDataPoint | null) => void;
}) {
  const [selectedPoint, setSelectedPoint] = useState<TerrainDataPoint | null>(null);

  const loans = useAppStore((state) => state.loans);
  const filters = useAppStore((state) => state.filters);
  const getFilteredLoans = useAppStore((state) => state.getFilteredLoans);
  const riskRatings = useAppStore((state) => state.riskRatings);
  const anomalies = useAppStore((state) => state.anomalies);

  const filteredLoans = useMemo(() => {
    return getFilteredLoans();
  }, [loans, filters, getFilteredLoans]);

  const riskLevelMap = useMemo(() => {
    return new Map(riskRatings.map((r) => [r.code, r.riskLevel]));
  }, [riskRatings]);

  const terrainData = useMemo(() => {
    return calculateTerrainData(filteredLoans, riskLevelMap);
  }, [filteredLoans, riskLevelMap]);

  const maxPrincipal = useMemo(() => {
    return Math.max(...terrainData.map((d) => d.totalPrincipal), 1);
  }, [terrainData]);

  const anomalyLoanIds = useMemo(() => {
    return new Set(anomalies.filter((a) => !a.resolved).map((a) => a.loanId));
  }, [anomalies]);

  const handlePointClick = (point: TerrainDataPoint) => {
    const isSameAsSelected =
      selectedPoint?.industryCode === point.industryCode &&
      selectedPoint?.maturityCode === point.maturityCode &&
      selectedPoint?.riskRatingCode === point.riskRatingCode;

    const newSelected = isSameAsSelected ? null : point;
    setSelectedPoint(newSelected);
    onPointSelect(newSelected);
  };

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [12, 14, 12], fov: 45 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' }}
      >
        <SceneLighting />
        <TerrainGrid
          terrainData={terrainData}
          maxPrincipal={maxPrincipal}
          riskLevelMap={riskLevelMap}
          selectedPoint={selectedPoint}
          onPointClick={handlePointClick}
          anomalyLoanIds={anomalyLoanIds}
        />
        <AxisLabels />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={8}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 6}
          enableDamping
          dampingFactor={0.05}
        />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            height={300}
            intensity={1.5}
          />
          <Vignette offset={0.5} darkness={0.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
