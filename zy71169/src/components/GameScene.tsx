import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { GRADE_COLORS, GRADE_NAMES } from '../game/levels';
import { getAllergenLabel } from '../game/meals';
import type { Order, PrepStation, PickupWindow } from '../game/types';

function PrepStation3D({ station, isHighlighted, onDropZoneReady }: {
  station: PrepStation;
  isHighlighted: boolean;
  onDropZoneReady?: (stationId: string, element: HTMLElement) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = GRADE_COLORS[station.grade];
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useFrame((state) => {
    if (meshRef.current && isHighlighted) {
      meshRef.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
    }
  });

  useEffect(() => {
    if (dropZoneRef.current && onDropZoneReady) {
      onDropZoneReady(station.id, dropZoneRef.current);
    }
  }, [station.id, onDropZoneReady]);

  const stationX = station.grade === 1 ? -3 : station.grade === 2 ? 0 : 3;

  return (
    <group position={[stationX, 0, 0]}>
      <RoundedBox
        ref={meshRef}
        args={[2.5, 0.3, 1.5]}
        radius={0.1}
        position={[0, 0.5, 0]}
      >
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isHighlighted ? 0.95 : 0.7}
          emissive={color}
          emissiveIntensity={isHighlighted ? 0.4 : 0.1}
        />
      </RoundedBox>
      <RoundedBox args={[2.5, 1, 1.5]} radius={0.1} position={[0, -0.15, 0]}>
        <meshStandardMaterial color="#8B4513" />
      </RoundedBox>
      <Html position={[0, 1.3, 0]} center>
        <div
          ref={dropZoneRef}
          className="px-3 py-1.5 rounded-full text-white text-xs font-bold whitespace-nowrap cursor-pointer"
          style={{ backgroundColor: color }}
          data-station-id={station.id}
        >
          {GRADE_NAMES[station.grade]}备餐台
        </div>
      </Html>
      <Html position={[0, 0.5, 0.8]} center>
        <div className="text-white text-xs bg-black/50 px-1.5 py-0.5 rounded">
          {station.meals.length}/{station.capacity}
        </div>
      </Html>
      {station.meals.slice(0, 6).map((mealId, i) => (
        <mesh key={`${station.id}-${mealId}-${i}`} position={[(i % 3 - 1) * 0.6, 0.85, Math.floor(i / 3) * 0.5 - 0.25]}>
          <boxGeometry args={[0.4, 0.2, 0.4]} />
          <meshStandardMaterial color="#FFD700" />
        </mesh>
      ))}
    </group>
  );
}

function PickupWindow3D({ window, orders, onPickupClick }: {
  window: PickupWindow;
  orders: Order[];
  onPickupClick: (orderId: string) => void;
}) {
  const queueOrders = orders.filter(o => window.queue.includes(o.id));
  const isCongested = window.queue.length > window.maxQueue;

  return (
    <group position={[0, 0, -4]}>
      <RoundedBox args={[2, 2, 0.3]} radius={0.05} position={[0, 1, 0]}>
        <meshStandardMaterial
          color={isCongested ? '#E74C3C' : '#34495E'}
          emissive={isCongested ? '#E74C3C' : '#000000'}
          emissiveIntensity={isCongested ? 0.2 : 0}
        />
      </RoundedBox>
      <Html position={[0, 2.3, 0]} center>
        <div className={`px-3 py-1.5 rounded-lg text-white text-sm font-bold whitespace-nowrap ${isCongested ? 'bg-red-500 animate-pulse' : 'bg-gray-700'}`}>
          {window.name} {window.queue.length}/{window.maxQueue}
        </div>
      </Html>
      {queueOrders.map((order, i) => (
        <group key={order.id} position={[0, 0.3, 1 + i * 0.5]}>
          <mesh onClick={(e) => { e.stopPropagation(); onPickupClick(order.id); }}>
            <capsuleGeometry args={[0.15, 0.3, 4, 8]} />
            <meshStandardMaterial color={GRADE_COLORS[order.student.grade]} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial color="#FFDAB9" />
          </mesh>
          <Html position={[0, 0.65, 0]} center>
            <div className="text-xs text-white bg-black/60 px-1.5 py-0.5 rounded whitespace-nowrap cursor-pointer hover:bg-black/80 transition-colors"
              onClick={(e) => { e.stopPropagation(); onPickupClick(order.id); }}>
              {order.student.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function DraggableMeal3D({ order, position }: {
  order: Order;
  position: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const hasAllergen = order.meal.containsAllergens.length > 0;
  const isAllergic = order.meal.containsAllergens.some(a => order.student.allergens.includes(a));

  return (
    <group position={position}>
      <RoundedBox
        ref={meshRef}
        args={[0.5, 0.3, 0.5]}
        radius={0.05}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={isAllergic ? '#FF0000' : order.meal.color}
          emissive={isAllergic ? '#FF0000' : hovered ? order.meal.color : '#000000'}
          emissiveIntensity={isAllergic ? 0.5 : hovered ? 0.2 : 0.1}
        />
      </RoundedBox>
      <Html position={[0, 0.45, 0]} center>
        <div className="flex flex-col items-center">
          <span className="text-xl">{order.meal.emoji}</span>
          {hasAllergen && (
            <div className="flex gap-0.5 mt-0.5">
              {order.meal.containsAllergens.map(a => (
                <span key={a} className="text-sm" title={a}>
                  {getAllergenLabel(a)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Html>
      {isAllergic && (
        <Html position={[0, 0.9, 0]} center>
          <div className="text-red-500 text-xl animate-bounce">⚠️</div>
        </Html>
      )}
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 15]} />
      <meshStandardMaterial color="#F5F5DC" />
    </mesh>
  );
}

function Walls() {
  return (
    <group>
      <mesh position={[0, 3, -7.5]}>
        <planeGeometry args={[20, 6]} />
        <meshStandardMaterial color="#FFF8DC" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-10, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[15, 6]} />
        <meshStandardMaterial color="#FAEBD7" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[10, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[15, 6]} />
        <meshStandardMaterial color="#FAEBD7" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-4, 4, 2]} intensity={0.5} color="#FFF0B3" />
      <pointLight position={[4, 4, 2]} intensity={0.5} color="#FFF0B3" />
      <pointLight position={[0, 4, -4]} intensity={0.6} color="#FFE4B5" />
    </>
  );
}

interface GameContentProps {
  dropZonesRef: React.MutableRefObject<Map<string, HTMLElement>>;
}

function GameContent({ dropZonesRef }: GameContentProps) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 10, 10);
    camera.lookAt(0, 0, -2);
  }, [camera]);

  const prepStations = useGameStore(state => state.prepStations);
  const pickupWindows = useGameStore(state => state.pickupWindows);
  const ordersForPrep = useGameStore(state => state.ordersForPrep);
  const ordersForPickup = useGameStore(state => state.ordersForPickup);
  const orders = useGameStore(state => state.orders);
  const assignPickup = useGameStore(state => state.assignPickup);

  const activeOrders = useMemo(() =>
    [...ordersForPrep, ...ordersForPickup].filter((o, i, arr) =>
      arr.findIndex(x => x.id === o.id) === i
    ), [ordersForPrep, ordersForPickup]);

  const highlightedOrderId = useGameStore(state => state.draggedMeal);

  const handleDropZoneReady = (stationId: string, element: HTMLElement) => {
    dropZonesRef.current.set(stationId, element);
  };

  return (
    <>
      <Lights />
      <Floor />
      <Walls />

      {prepStations.map(station => (
        <PrepStation3D
          key={station.id}
          station={station}
          isHighlighted={!!highlightedOrderId}
          onDropZoneReady={handleDropZoneReady}
        />
      ))}

      {pickupWindows.map((window, i) => (
        <group key={window.id} position={[(i - (pickupWindows.length - 1) / 2) * 3, 0, 0]}>
          <PickupWindow3D
            window={window}
            orders={orders}
            onPickupClick={assignPickup}
          />
        </group>
      ))}

      {activeOrders.slice(0, 8).map((order, i) => (
        <DraggableMeal3D
          key={order.id}
          order={order}
          position={[(i % 4 - 1.5) * 1.5, 0.3, Math.floor(i / 4) * 1 + 3]}
        />
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={20}
        maxPolarAngle={Math.PI / 3}
      />
    </>
  );
}

interface GameSceneProps {
  dropZonesRef: React.MutableRefObject<Map<string, HTMLElement>>;
}

export default function GameScene({ dropZonesRef }: GameSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 10, 10], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#87CEEB', 15, 30]} />
      <GameContent dropZonesRef={dropZonesRef} />
    </Canvas>
  );
}