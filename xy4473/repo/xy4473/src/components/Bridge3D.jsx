import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { RiskLevelColors } from '../types';

function BridgeDeck({ position, width, length, riskLevel, onClick, isSelected, label }) {
  const meshRef = useRef();
  const color = isSelected ? '#1890ff' : RiskLevelColors[riskLevel] || '#8b8b8b';

  useFrame((state) => {
    if (meshRef.current && isSelected) {
      meshRef.current.material.emissive = new THREE.Color('#1890ff');
      meshRef.current.material.emissiveIntensity = 0.3;
    } else if (meshRef.current) {
      meshRef.current.material.emissive = new THREE.Color(0, 0, 0);
      meshRef.current.material.emissiveIntensity = 0;
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[width, 0.5, length]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
      </mesh>
      {label && (
        <Text
          position={[0, 1, 0]}
          fontSize={0.8}
          color="#333"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

function BridgePier({ position, height, riskLevel, onClick, isSelected, label }) {
  const meshRef = useRef();
  const color = isSelected ? '#1890ff' : RiskLevelColors[riskLevel] || '#a0a0a0';

  useFrame((state) => {
    if (meshRef.current && isSelected) {
      meshRef.current.material.emissive = new THREE.Color('#1890ff');
      meshRef.current.material.emissiveIntensity = 0.3;
    } else if (meshRef.current) {
      meshRef.current.material.emissive = new THREE.Color(0, 0, 0);
      meshRef.current.material.emissiveIntensity = 0;
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <cylinderGeometry args={[1.5, 1.8, height, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.2} />
      </mesh>
      {label && (
        <Text
          position={[0, height / 2 + 1, 0]}
          fontSize={0.6}
          color="#333"
          anchorX="center"
          anchorY="middle"
          rotation={[0, Math.PI / 4, 0]}
        >
          {label}
        </Text>
      )}
    </group>
  );
}

function BridgeGirder({ position, width, length, height, riskLevel, onClick, isSelected, label }) {
  const meshRef = useRef();
  const color = isSelected ? '#1890ff' : RiskLevelColors[riskLevel] || '#909090';

  useFrame((state) => {
    if (meshRef.current && isSelected) {
      meshRef.current.material.emissive = new THREE.Color('#1890ff');
      meshRef.current.material.emissiveIntensity = 0.3;
    } else if (meshRef.current) {
      meshRef.current.material.emissive = new THREE.Color(0, 0, 0);
      meshRef.current.material.emissiveIntensity = 0;
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[width, height, length]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
      </mesh>
      {label && (
        <Text
          position={[0, height / 2 + 0.5, 0]}
          fontSize={0.5}
          color="#333"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

function BridgeScene({ components, selectedComponent, onSelectComponent }) {
  const componentMap = useMemo(() => {
    const map = {};
    components.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [components]);

  const deckComponents = components.filter((c) => c.type === 'deck');
  const pierComponents = components.filter((c) => c.type === 'pier');
  const girderComponents = components.filter((c) => c.type === 'girder');

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} />

      {deckComponents.map((deck) => (
        <BridgeDeck
          key={deck.id}
          position={[deck.positionX || 0, deck.positionY || 0, deck.positionZ || 0]}
          width={deck.width || 15}
          length={deck.length || 30}
          riskLevel={deck.analysis?.riskLevel}
          isSelected={selectedComponent?.id === deck.id}
          onClick={() => onSelectComponent(deck)}
          label={deck.name}
        />
      ))}

      {pierComponents.map((pier) => (
        <BridgePier
          key={pier.id}
          position={[pier.positionX || 0, (pier.height || 10) / 2, pier.positionZ || 0]}
          height={pier.height || 10}
          riskLevel={pier.analysis?.riskLevel}
          isSelected={selectedComponent?.id === pier.id}
          onClick={() => onSelectComponent(pier)}
          label={pier.name}
        />
      ))}

      {girderComponents.map((girder) => (
        <BridgeGirder
          key={girder.id}
          position={[girder.positionX || 0, girder.positionY || 0, girder.positionZ || 0]}
          width={girder.width || 2}
          length={girder.length || 30}
          height={girder.height || 1.5}
          riskLevel={girder.analysis?.riskLevel}
          isSelected={selectedComponent?.id === girder.id}
          onClick={() => onSelectComponent(girder)}
          label={girder.name}
        />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#87ceeb" opacity={0.3} transparent />
      </mesh>

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={100}
      />
    </>
  );
}

export default function Bridge3D({ components, selectedComponent, onSelectComponent }) {
  return (
    <Canvas
      camera={{ position: [30, 30, 30], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <BridgeScene
        components={components}
        selectedComponent={selectedComponent}
        onSelectComponent={onSelectComponent}
      />
    </Canvas>
  );
}
