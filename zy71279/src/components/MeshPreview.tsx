import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { MeshData, ViewMode } from '@/types';

interface MeshPreviewProps {
  originalMesh: MeshData | null;
  simplifiedMesh: MeshData | null;
  viewMode: ViewMode;
  showOriginal?: boolean;
  maxError?: number;
  perFaceErrors?: { faceIndex: number; error: number }[];
}

function MeshGeometry({ mesh, color, wireframe = false }: { mesh: MeshData; color: string; wireframe?: boolean }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
    geo.setIndex(new THREE.Uint32BufferAttribute(mesh.faces, 1));
    if (mesh.normals.length > 0) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    geo.computeBoundingBox();
    return geo;
  }, [mesh]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        wireframe={wireframe}
        side={THREE.DoubleSide}
        flatShading={wireframe}
      />
    </mesh>
  );
}

function HeatmapMesh({
  mesh,
  perFaceErrors,
  maxError
}: {
  mesh: MeshData;
  perFaceErrors: { faceIndex: number; error: number }[];
  maxError: number;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
    geo.setIndex(new THREE.Uint32BufferAttribute(mesh.faces, 1));
    geo.computeVertexNormals();

    const errorMap = new Map(perFaceErrors.map(e => [e.faceIndex, e.error]));

    const faceCount = mesh.faceCount;
    const colors = new Float32Array(faceCount * 3 * 3);

    for (let i = 0; i < faceCount; i++) {
      const error = errorMap.get(i) || 0;
      const normalizedError = Math.min(1, error / Math.max(maxError, 0.001));

      let r, g, b;
      if (normalizedError < 0.5) {
        const t = normalizedError * 2;
        r = t;
        g = 1;
        b = 0;
      } else {
        const t = (normalizedError - 0.5) * 2;
        r = 1;
        g = 1 - t;
        b = 0;
      }

      for (let j = 0; j < 3; j++) {
        const idx = i * 9 + j * 3;
        colors[idx] = r;
        colors[idx + 1] = g;
        colors[idx + 2] = b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [mesh, perFaceErrors, maxError]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        flatShading
      />
    </mesh>
  );
}

function ErrorPoints({ points, maxError }: { points: { position: number[]; error: number }[]; maxError: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {points.map((point, index) => {
        const normalizedError = Math.min(1, point.error / Math.max(maxError, 0.001));
        const color = new THREE.Color().setHSL(0.3 - normalizedError * 0.3, 1, 0.5);
        return (
          <mesh key={index} position={point.position as [number, number, number]}>
            <sphereGeometry args={[Math.max(0.1, normalizedError * 0.5), 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

function SceneGrid() {
  return (
    <group>
      <gridHelper args={[20, 20, 0xcccccc, 0xeeeeee]} position={[0, -0.01, 0]} />
      <axesHelper args={[2]} />
    </group>
  );
}

export const MeshPreview: React.FC<MeshPreviewProps> = ({
  originalMesh,
  simplifiedMesh,
  viewMode,
  showOriginal = false,
  maxError = 1,
  perFaceErrors = []
}) => {
  const displayMesh = showOriginal ? originalMesh : simplifiedMesh;

  if (!displayMesh) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <div className="text-center">
          <div className="text-4xl mb-2">📦</div>
          <p className="text-gray-400 text-sm">请上传3D模型</p>
          <p className="text-gray-300 text-xs mt-1">支持 STL / OBJ 格式</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <Canvas shadows className="rounded-lg">
        <PerspectiveCamera makeDefault position={[3, 2, 3]} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={0.5}
          maxDistance={20}
        />
        <Environment preset="city" />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-3, 2, -3]} intensity={0.3} />

        <SceneGrid />

        {viewMode === 'heatmap' && perFaceErrors.length > 0 && (
          <HeatmapMesh
            mesh={displayMesh}
            perFaceErrors={perFaceErrors}
            maxError={maxError}
          />
        )}

        {viewMode === 'wireframe' && (
          <MeshGeometry mesh={displayMesh} color="#3b82f6" wireframe />
        )}

        {viewMode === 'solid' && (
          <>
            <MeshGeometry mesh={displayMesh} color={showOriginal ? '#60a5fa' : '#34d399'} />
            {simplifiedMesh && showOriginal && (
              <mesh position={[0, 0, 0]}>
                <meshStandardMaterial color="#ef4444" wireframe transparent opacity={0.3} />
              </mesh>
            )}
          </>
        )}
      </Canvas>

      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm text-xs space-y-0.5">
        <div className="font-medium text-gray-700">{displayMesh.name}</div>
        <div className="text-gray-500">
          {displayMesh.vertexCount.toLocaleString()} 顶点 · {displayMesh.faceCount.toLocaleString()} 面
        </div>
        <div className="text-gray-400 text-[10px]">
          {viewMode === 'solid' ? '实体模式' : viewMode === 'wireframe' ? '线框模式' : '误差热力图'}
        </div>
      </div>

      {viewMode === 'heatmap' && (
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">0</span>
            <div className="w-32 h-2 rounded bg-gradient-to-r from-green-400 via-yellow-400 to-red-500" />
            <span className="text-xs text-gray-500">{maxError.toFixed(3)} mm</span>
          </div>
        </div>
      )}
    </div>
  );
};
