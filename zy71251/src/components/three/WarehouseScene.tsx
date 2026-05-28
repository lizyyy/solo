import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Line, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import useStore from '../../store/useStore';
import type { Location } from '../../types';

const getTemperatureColor = (temp: number): string => {
  if (temp < 18) return '#3B82F6';
  if (temp < 22) return '#10B981';
  if (temp < 25) return '#F59E0B';
  return '#EF4444';
};

const getHumidityColor = (humidity: number): string => {
  if (humidity < 40) return '#3B82F6';
  if (humidity < 55) return '#10B981';
  if (humidity < 65) return '#F59E0B';
  return '#EF4444';
};

const getStatusColor = (status: Location['status']): string => {
  switch (status) {
    case 'occupied': return '#10B981';
    case 'empty': return '#6B7280';
    case 'reserved': return '#3B82F6';
    case 'maintenance': return '#F59E0B';
    default: return '#6B7280';
  }
};

const getZoneColor = (zone: Location['zone']): string => {
  switch (zone) {
    case 'valuables': return '#F59E0B';
    case 'constant_temp': return '#8B5CF6';
    default: return '#374151';
  }
};

interface ShelfMeshProps {
  shelf: {
    id: string;
    code: string;
    position: { x: number; z: number };
    levels: number;
    positionsPerLevel: number;
  };
  locations: Location[];
  selectedLocation: Location | null;
  onLocationClick: (location: Location) => void;
  showHeatmap: boolean;
  filteredLocationIds: Set<string>;
}

function ShelfMesh({ shelf, locations, selectedLocation, onLocationClick, showHeatmap, filteredLocationIds }: ShelfMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shelfLocations = locations.filter(loc => loc.shelfId === shelf.id);
  
  const shelfWidth = shelf.positionsPerLevel * 1.2 + 0.4;
  const shelfHeight = shelf.levels * 1.8;
  const shelfDepth = 1;

  return (
    <group ref={groupRef} position={[shelf.position.x, 0, shelf.position.z]}>
      <mesh position={[0, shelfHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.1, shelfHeight, shelfDepth]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[shelfWidth / 2 - 0.05, shelfHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.1, shelfHeight, shelfDepth]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
      </mesh>
      
      {Array.from({ length: shelf.levels + 1 }).map((_, i) => (
        <mesh key={i} position={[(shelfWidth - 0.1) / 2, i * 1.8, 0]} castShadow receiveShadow>
          <boxGeometry args={[shelfWidth, 0.08, shelfDepth]} />
          <meshStandardMaterial 
            color={i === 0 ? '#4B5563' : '#374151'} 
            metalness={0.5} 
            roughness={0.5} 
          />
        </mesh>
      ))}

      {shelfLocations.map((loc) => {
        const isSelected = selectedLocation?.id === loc.id;
        const isFiltered = filteredLocationIds.size > 0 && filteredLocationIds.has(loc.id);
        const posX = (loc.position - 1) * 1.2 + 0.2;
        const posY = loc.level * 1.8 - 0.45;
        
        let displayColor = getStatusColor(loc.status);
        if (showHeatmap && loc.sensor) {
          displayColor = getTemperatureColor(loc.sensor.temperature);
        }
        if (isFiltered) {
          displayColor = '#FBBF24';
        }

        return (
          <group key={loc.id} position={[posX, posY, 0]}>
            <mesh
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onLocationClick(loc);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default';
              }}
              castShadow
            >
              <boxGeometry args={[1, 1.5, 0.8]} />
              <meshStandardMaterial
                color={loc.box ? displayColor : '#1F2937'}
                transparent
                opacity={loc.box ? 0.85 : 0.3}
                emissive={isSelected ? displayColor : '#000000'}
                emissiveIntensity={isSelected ? 0.4 : 0}
              />
            </mesh>
            
            {loc.box && (
              <mesh position={[0, 0, 0.05]} castShadow>
                <boxGeometry args={[0.85, 1.2, 0.65]} />
                <meshPhysicalMaterial
                  color="#F5F5DC"
                  transparent
                  opacity={0.6}
                  roughness={0.3}
                  clearcoat={0.3}
                />
              </mesh>
            )}

            {loc.sensor?.alerts && loc.sensor.alerts.length > 0 && (
              <mesh position={[0.4, 0.6, 0.4]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshBasicMaterial color="#EF4444" transparent opacity={0.9} />
              </mesh>
            )}

            {isSelected && (
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1.1, 1.6, 0.9]} />
                <meshBasicMaterial color="#3B82F6" transparent opacity={0.2} />
              </mesh>
            )}

            <Text
              position={[0.5, -0.85, 0.5]}
              fontSize={0.12}
              color="#9CA3AF"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {loc.code.split('-').slice(1).join('-')}
            </Text>
          </group>
        );
      })}

      <Text
        position={[shelfWidth / 2, shelfHeight + 0.3, 0]}
        fontSize={0.3}
        color="#E5E7EB"
        anchorX="center"
        anchorY="middle"
      >
        {shelf.code}
      </Text>
    </group>
  );
}

interface ForbiddenZoneMeshProps {
  zone: {
    id: string;
    name: string;
    points: { x: number; z: number }[];
    reason: string;
    color: string;
  };
}

function ForbiddenZoneMesh({ zone }: ForbiddenZoneMeshProps) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(zone.points[0].x, zone.points[0].z);
    for (let i = 1; i < zone.points.length; i++) {
      s.lineTo(zone.points[i].x, zone.points[i].z);
    }
    s.closePath();
    return s;
  }, [zone]);

  const linePoints = useMemo(() => {
    return zone.points.map(p => new THREE.Vector3(p.x, 0.02, p.z));
  }, [zone]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={zone.color} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      <Line
        points={linePoints}
        color={zone.color}
        lineWidth={2}
        dashed={false}
      />
      <Text
        position={[
          (zone.points[0].x + zone.points[2].x) / 2,
          0.05,
          (zone.points[0].z + zone.points[2].z) / 2
        ]}
        fontSize={0.25}
        color={zone.color}
        anchorX="center"
        anchorY="middle"
      >
        {zone.name}
      </Text>
    </group>
  );
}

interface RouteVisualizationProps {
  route: { x: number; y: number; z: number }[];
  color: string;
  hasWarning?: boolean;
}

function RouteVisualization({ route, color, hasWarning }: RouteVisualizationProps) {
  const linePoints = useMemo(() => {
    return route.map(p => new THREE.Vector3(p.x, p.y + 0.1, p.z));
  }, [route]);

  const animRef = useRef(0);
  
  useFrame((_, delta) => {
    animRef.current += delta * 2;
  });

  return (
    <group>
      <Line
        points={linePoints}
        color={hasWarning ? '#EF4444' : color}
        lineWidth={3}
      />
      {route.map((point, i) => (
        <mesh key={i} position={[point.x, point.y + 0.1, point.z]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial 
            color={hasWarning ? '#EF4444' : color} 
            transparent 
            opacity={0.6 + Math.sin(animRef.current + i) * 0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

interface HeatmapFloorProps {
  locations: Location[];
}

function HeatmapFloor({ locations }: HeatmapFloorProps) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 256, 256);
    
    locations.forEach(loc => {
      if (!loc.sensor) return;
      const x = ((loc.worldPosition.x + 20) / 40) * 256;
      const y = ((loc.worldPosition.z + 15) / 30) * 256;
      const temp = loc.sensor.temperature;
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 30);
      gradient.addColorStop(0, getTemperatureColor(temp));
      gradient.addColorStop(1, 'transparent');
      
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
    });
    
    ctx.globalAlpha = 1;
    return c;
  }, [locations]);

  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [canvas]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <planeGeometry args={[40, 30]} />
      <meshBasicMaterial map={texture} transparent opacity={0.4} />
    </mesh>
  );
}

interface SceneContentProps {
  onLocationClick: (location: Location) => void;
}

function SceneContent({ onLocationClick }: SceneContentProps) {
  const { 
    shelves, 
    locations, 
    forbiddenZones, 
    selectedLocation, 
    showHeatmap, 
    showRoutes, 
    tasks,
    getFilteredLocations,
    checkForbiddenCrossing
  } = useStore();
  
  const filteredLocations = getFilteredLocations();
  const filteredLocationIds = new Set(filteredLocations.map(l => l.id));

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={0.8} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#FEF3C7" />
      
      <Grid
        args={[50, 40]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#374151"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#4B5563"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 40]} />
        <meshStandardMaterial color="#111827" roughness={0.8} />
      </mesh>

      {forbiddenZones.map(zone => (
        <ForbiddenZoneMesh key={zone.id} zone={zone} />
      ))}

      {showHeatmap && <HeatmapFloor locations={locations} />}

      {shelves.map(shelf => (
        <ShelfMesh
          key={shelf.id}
          shelf={shelf}
          locations={locations}
          selectedLocation={selectedLocation}
          onLocationClick={onLocationClick}
          showHeatmap={showHeatmap}
          filteredLocationIds={filteredLocationIds}
        />
      ))}

      {showRoutes && tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').map(task => (
        <RouteVisualization
          key={task.id}
          route={task.route}
          color={task.priority === 'urgent' ? '#EF4444' : '#3B82F6'}
          hasWarning={checkForbiddenCrossing(task.route)}
        />
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 3, 0]}
      />

      <EffectComposer>
        <Bloom 
          intensity={0.5} 
          luminanceThreshold={0.8} 
          luminanceSmoothing={0.9} 
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export default function WarehouseScene() {
  const { setSelectedLocation, selectedLocation } = useStore();

  return (
    <Canvas
      shadows
      camera={{ position: [25, 20, 25], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'linear-gradient(to bottom, #0F172A, #1E293B)' }}
      onClick={() => {
        if (selectedLocation) {
          setSelectedLocation(null);
        }
      }}
    >
      <SceneContent onLocationClick={setSelectedLocation} />
    </Canvas>
  );
}
