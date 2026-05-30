import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, RefreshCw } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useHallStore } from '@/store/useHallStore';
import { useScreenshot } from '@/hooks/useScreenshot';
import { HallModel } from '@/components/scene/HallModel';
import { ReflectSurface3D } from '@/components/scene/ReflectSurface3D';
import { SoundSource3D } from '@/components/scene/SoundSource3D';
import { SeatZone3D } from '@/components/scene/SeatZone3D';
import Nav from '@/components/Nav';

interface CompareSceneProps {
  surfacesAngles: Record<string, number>;
  onCameraChange?: (pos: THREE.Vector3, target: THREE.Vector3) => void;
  syncCamera?: { position: THREE.Vector3; target: THREE.Vector3 } | null;
  showDiffs?: boolean;
  otherSurfacesAngles?: Record<string, number>;
  controlsRef?: React.RefObject<any>;
}

function CameraSync({ onCameraChange, syncCamera, controlsRef }: { 
  onCameraChange?: (pos: THREE.Vector3, target: THREE.Vector3) => void; 
  syncCamera?: { position: THREE.Vector3; target: THREE.Vector3 } | null;
  controlsRef?: React.RefObject<any>;
}) {
  const { camera } = useThree();
  const lastPos = useRef<THREE.Vector3 | null>(null);
  const lastTarget = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (syncCamera && controlsRef?.current) {
      camera.position.copy(syncCamera.position);
      controlsRef.current.target.copy(syncCamera.target);
      controlsRef.current.update();
    }
  }, [syncCamera, camera, controlsRef]);

  useFrame(() => {
    if (onCameraChange && controlsRef?.current) {
      const currentPos = camera.position.clone();
      const currentTarget = controlsRef.current.target.clone();
      
      if (!lastPos.current || !lastPos.current.equals(currentPos) ||
          !lastTarget.current || !lastTarget.current.equals(currentTarget)) {
        lastPos.current = currentPos;
        lastTarget.current = currentTarget;
        onCameraChange(currentPos, currentTarget);
      }
    }
  });

  return null;
}

function CompareSceneContent({ surfacesAngles, onCameraChange, syncCamera, showDiffs, otherSurfacesAngles, controlsRef }: CompareSceneProps) {
  const hall = useHallStore((s) => s.hall);
  const surfaces = useHallStore((s) => s.surfaces);
  const sources = useHallStore((s) => s.sources);
  const zones = useHallStore((s) => s.zones);

  const modifiedSurfaces = surfaces.map((s) => ({
    ...s,
    angle: surfacesAngles[s.id] ?? s.angle,
  }));

  if (!hall) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} />

      <Environment preset="city" />

      <HallModel hall={hall} />

      {modifiedSurfaces.map((surface) => {
        const hasDiff = showDiffs && otherSurfacesAngles && Math.abs((otherSurfacesAngles[surface.id] ?? surface.angle) - surface.angle) > 0;
        const diffAngle = hasDiff ? (otherSurfacesAngles![surface.id] ?? surface.angle) - surface.angle : 0;
        const diffColor = diffAngle > 0 ? '#22c55e' : diffAngle < 0 ? '#ef4444' : undefined;
        return (
          <ReflectSurface3D
            key={surface.id}
            surface={surface}
            showDiff={hasDiff}
            diffColor={diffColor}
          />
        );
      })}

      {sources.map((source) => (
        <SoundSource3D key={source.id} source={source} />
      ))}

      {zones.map((zone) => (
        <SeatZone3D key={zone.id} zone={zone} />
      ))}

      <EffectComposer>
        <Bloom intensity={0.5} luminanceThreshold={0.9} luminanceSmoothing={0.9} />
      </EffectComposer>

      <OrbitControls ref={controlsRef} makeDefault />
      <CameraSync onCameraChange={onCameraChange} syncCamera={syncCamera} controlsRef={controlsRef} />
    </>
  );
}

export default function ComparePage() {
  const hall = useHallStore((s) => s.hall);
  const surfaces = useHallStore((s) => s.surfaces);
  const schemes = useHallStore((s) => s.schemes);
  const frequencyCoverages = useHallStore((s) => s.frequencyCoverages);
  const compareSchemeIds = useHallStore((s) => s.compareSchemeIds);
  const setCompareSchemes = useHallStore((s) => s.setCompareSchemes);
  const loadData = useHallStore((s) => s.loadData);
  const useErrorProneData = useHallStore((s) => s.useErrorProneData);

  const { canvasRef, captureScreenshot } = useScreenshot();

  const leftControlsRef = useRef<any>(null);
  const rightControlsRef = useRef<any>(null);

  const [leftCamera, setLeftCamera] = useState<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [rightCamera, setRightCamera] = useState<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);

  useEffect(() => {
    loadData(useErrorProneData);
    if (schemes.length >= 2) {
      setCompareSchemes([schemes[0].id, schemes[1].id]);
    }
  }, []);

  const leftScheme = schemes.find((s) => s.id === compareSchemeIds[0]);
  const rightScheme = schemes.find((s) => s.id === compareSchemeIds[1]);

  const handleLeftCameraChange = (pos: THREE.Vector3, target: THREE.Vector3) => {
    if (syncEnabled) {
      setLeftCamera({ position: pos, target });
      setRightCamera({ position: pos.clone(), target: target.clone() });
    }
  };

  const handleRightCameraChange = (pos: THREE.Vector3, target: THREE.Vector3) => {
    if (syncEnabled) {
      setRightCamera({ position: pos, target });
      setLeftCamera({ position: pos.clone(), target: target.clone() });
    }
  };

  const getAngleDiffs = () => {
    if (!leftScheme || !rightScheme) return [];
    return surfaces
      .map((s) => {
        const leftAngle = leftScheme.surfaceAngles[s.id] ?? s.angle;
        const rightAngle = rightScheme.surfaceAngles[s.id] ?? s.angle;
        return {
          surfaceId: s.id,
          surfaceName: s.name,
          leftAngle,
          rightAngle,
          diff: rightAngle - leftAngle,
        };
      })
      .filter((d) => d.diff !== 0);
  };

  const getCoverageDiffs = () => {
    const zoneIds = [...new Set(frequencyCoverages.map((c) => c.zoneId))];
    return zoneIds.map((zoneId) => {
      const coverages = frequencyCoverages.filter((c) => c.zoneId === zoneId);
      const avgCoverage = coverages.reduce((sum, c) => sum + c.coveragePercent, 0) / coverages.length;
      return {
        zoneId,
        avgCoverage: Math.round(avgCoverage),
      };
    });
  };

  const angleDiffs = getAngleDiffs();
  const coverageDiffs = getCoverageDiffs();

  if (!hall) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Nav />

      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              返回概览
            </Link>
            <div className="h-6 w-px bg-gray-600" />
            <h1 className="text-white text-xl font-semibold">方案对比</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSyncEnabled(!syncEnabled)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                syncEnabled
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${syncEnabled ? 'animate-spin' : ''}`} />
              同步相机
            </button>
            <button
              onClick={captureScreenshot}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Camera className="w-4 h-4" />
              导出截图
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-8">
          <div className="flex-1">
            <label className="text-gray-400 text-sm block mb-2">左侧方案</label>
            <select
              value={compareSchemeIds[0]}
              onChange={(e) => setCompareSchemes([e.target.value, compareSchemeIds[1]])}
              className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none"
            >
              {schemes.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-amber-400 font-bold text-2xl">VS</div>
          <div className="flex-1">
            <label className="text-gray-400 text-sm block mb-2">右侧方案</label>
            <select
              value={compareSchemeIds[1]}
              onChange={(e) => setCompareSchemes([compareSchemeIds[0], e.target.value])}
              className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none"
            >
              {schemes.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="w-1/2 relative border-r border-gray-700">
          <div className="absolute top-4 left-4 z-10 bg-gray-900/80 px-3 py-2 rounded-lg">
            <span className="text-white font-medium">{leftScheme?.name || '方案A'}</span>
          </div>
          <Canvas
            camera={{ position: [15, 15, 15], fov: 50 }}
            gl={{ preserveDrawingBuffer: true }}
            shadows
          >
            <CompareSceneContent
              surfacesAngles={leftScheme?.surfaceAngles ?? {}}
              onCameraChange={handleLeftCameraChange}
              syncCamera={syncEnabled ? rightCamera : null}
              showDiffs={true}
              otherSurfacesAngles={rightScheme?.surfaceAngles}
              controlsRef={leftControlsRef}
            />
          </Canvas>
        </div>

        <div className="w-1/2 relative">
          <div className="absolute top-4 left-4 z-10 bg-gray-900/80 px-3 py-2 rounded-lg">
            <span className="text-white font-medium">{rightScheme?.name || '方案B'}</span>
          </div>
          <Canvas
            ref={canvasRef as React.RefObject<HTMLCanvasElement>}
            camera={{ position: [15, 15, 15], fov: 50 }}
            gl={{ preserveDrawingBuffer: true }}
            shadows
          >
            <CompareSceneContent
              surfacesAngles={rightScheme?.surfaceAngles ?? {}}
              onCameraChange={handleRightCameraChange}
              syncCamera={syncEnabled ? leftCamera : null}
              showDiffs={true}
              otherSurfacesAngles={leftScheme?.surfaceAngles}
              controlsRef={rightControlsRef}
            />
          </Canvas>
        </div>
      </div>

      <div className="bg-gray-800 border-t border-gray-700 p-6">
        <h3 className="text-white font-semibold text-lg mb-4">差异汇总</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-gray-400 text-sm mb-3">表面角度差异</h4>
            {angleDiffs.length === 0 ? (
              <div className="text-gray-500 text-sm">无角度差异</div>
            ) : (
              <div className="space-y-2">
                {angleDiffs.map((diff) => (
                  <div
                    key={diff.surfaceId}
                    className="flex items-center justify-between bg-gray-900/50 px-4 py-2 rounded-lg"
                  >
                    <span className="text-gray-300">{diff.surfaceName}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-sm">
                        {diff.leftAngle}° → {diff.rightAngle}°
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          diff.diff > 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {diff.diff > 0 ? '+' : ''}
                        {diff.diff}°
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-gray-400 text-sm mb-3">覆盖度对比</h4>
            <div className="space-y-2">
              {coverageDiffs.map((cov) => (
                <div
                  key={cov.zoneId}
                  className="flex items-center justify-between bg-gray-900/50 px-4 py-2 rounded-lg"
                >
                  <span className="text-gray-300">{cov.zoneId}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          cov.avgCoverage >= 80
                            ? 'bg-green-500'
                            : cov.avgCoverage >= 60
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${cov.avgCoverage}%` }}
                      />
                    </div>
                    <span className="text-white font-mono w-12 text-right">
                      {cov.avgCoverage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
