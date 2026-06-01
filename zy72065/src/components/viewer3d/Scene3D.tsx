import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { SlopeTerrain } from './SlopeTerrain';
import { MonitoringPoints } from './MonitoringPoints';
import { useStore } from '../../store/useStore';
import { useFilteredPoints } from '../../hooks/useFilteredPoints';
import { getStatusColor, getStatusLabel } from '../../utils/terrain';
import { AlertTriangle, XCircle } from 'lucide-react';

interface Scene3DProps {
  onPointClick: (pointId: string) => void;
}

export function Scene3D({ onPointClick }: Scene3DProps) {
  const filteredPoints = useFilteredPoints();
  const selectedPointId = useStore((state) => state.selectedPointId);
  const coordinateSystem = useStore((state) => state.coordinateSystem);

  const selectedPoint = filteredPoints.find((p) => p.id === selectedPointId);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [30, 25, 30], fov: 50 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onPointerMissed={() => onPointClick('')}
      >
        <color attach="background" args={['#1D2129']} />
        <fog attach="fog" args={['#1D2129', 50, 100]} />
        
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[20, 30, 20]}
          intensity={1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-20, 10, -20]} intensity={0.3} />
        
        <Grid
          args={[80, 80]}
          cellSize={2}
          cellThickness={0.5}
          cellColor="#2D3748"
          sectionSize={10}
          sectionThickness={1}
          sectionColor="#165DFF"
          fadeDistance={80}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={false}
        />
        
        <SlopeTerrain size={40} segments={50} />
        
        <MonitoringPoints points={filteredPoints} onPointClick={onPointClick} />
        
        {selectedPoint && (
          <Html
            position={[
              selectedPoint.coordinates.x,
              selectedPoint.coordinates.y + 2,
              selectedPoint.coordinates.z,
            ]}
            center
            zIndexRange={[100, 0]}
          >
            <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-3 min-w-[180px] shadow-xl">
              <div className="font-semibold text-white text-sm mb-1">
                {selectedPoint.name}
              </div>
              <div className="text-xs text-gray-400 mb-2">
                ID: {selectedPoint.id}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor(selectedPoint.status) }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: getStatusColor(selectedPoint.status) }}
                >
                  {getStatusLabel(selectedPoint.status)}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                位移: <span className="text-white">{selectedPoint.displacement.toFixed(1)}mm</span>
              </div>
              <div className="text-xs text-gray-400">
                坐标: ({selectedPoint.coordinates.x.toFixed(1)}, {selectedPoint.coordinates.y.toFixed(1)}, {selectedPoint.coordinates.z.toFixed(1)})
              </div>
              {selectedPoint.hasConflict && (
                <div className="mt-2 flex items-center gap-1 text-yellow-500 text-xs">
                  <AlertTriangle size={12} />
                  <span>存在数据冲突</span>
                </div>
              )}
              {selectedPoint.isCorrupted && (
                <div className="mt-2 flex items-center gap-1 text-red-500 text-xs">
                  <XCircle size={12} />
                  <span>数据损坏</span>
                </div>
              )}
            </div>
          </Html>
        )}
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={10}
          maxDistance={80}
          maxPolarAngle={Math.PI / 2.1}
        />
        
        <EffectComposer>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
      
      <div className="absolute bottom-4 left-4 bg-gray-900/80 px-3 py-2 rounded text-xs text-gray-400">
        坐标系: <span className="text-blue-400 font-mono">{coordinateSystem.toUpperCase()}</span>
      </div>
      
      <div className="absolute bottom-4 right-4 bg-gray-900/80 px-3 py-2 rounded text-xs">
        <div className="text-gray-400 mb-1">图例</div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-300">正常</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-gray-300">预警</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-gray-300">危险</span>
          </div>
        </div>
      </div>
      
      <div className="absolute top-4 right-4 bg-gray-900/80 px-3 py-2 rounded text-xs text-gray-400">
        点位数量: <span className="text-white">{filteredPoints.length}</span>
      </div>
    </div>
  );
}
