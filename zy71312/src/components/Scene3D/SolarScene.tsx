import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { Roof } from './Roof';
import { SolarPanel } from './SolarPanel';
import { Sun } from './Sun';
import { useSolarStore } from '../../store/useSolarStore';

function SceneController({ timeOfDay }: { timeOfDay: number }) {
  const params = useSolarStore((state) => state.params);
  const results = useSolarStore((state) => state.results);

  return (
    <>
      <ambientLight intensity={0.4} />

      <Sky
        distance={450000}
        sunPosition={[100, 50, 100]}
        inclination={0.5}
        azimuth={0.25}
      />

      <Sun
        latitude={Math.abs(params.latitude)}
        timeOfDay={timeOfDay}
        dayOfYear={172}
        showTrajectory={true}
      />

      <Roof angle={params.roofAngle} width={10} depth={8} />

      <SolarPanel
        tiltAngle={results.optimalAngle}
        count={Math.min(params.panelCount, 12)}
        panelWidth={1.2}
        panelHeight={2}
        roofWidth={10}
        roofDepth={8}
        showLabels={false}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#3d5c3d" />
      </mesh>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
        target={[0, 1, 0]}
      />
    </>
  );
}

export const SolarScene: React.FC = () => {
  const [timeOfDay, setTimeOfDay] = useState(12);
  const animationRef = useRef<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (isAnimating) {
      let time = 6;
      const animate = () => {
        time += 0.02;
        if (time > 18) time = 6;
        setTimeOfDay(time);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating]);

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-sky-300 to-sky-100">
      <Canvas
        shadows
        camera={{ position: [15, 12, 15], fov: 50 }}
        gl={{ antialias: true }}
      >
        <fog attach="fog" args={['#87ceeb', 30, 80]} />
        <SceneController timeOfDay={timeOfDay} />
      </Canvas>

      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            时间: {Math.floor(timeOfDay)}:{String(Math.floor((timeOfDay % 1) * 60)).padStart(2, '0')}
          </span>
          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {isAnimating ? '暂停' : '播放'}
          </button>
        </div>
        <input
          type="range"
          min="6"
          max="18"
          step="0.1"
          value={timeOfDay}
          onChange={(e) => {
            setIsAnimating(false);
            setTimeOfDay(parseFloat(e.target.value));
          }}
          className="w-48 mt-2"
        />
      </div>

      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="text-sm text-gray-600">
          <div className="font-medium text-gray-800 mb-1">操作提示</div>
          <div>🖱️ 左键拖动: 旋转视角</div>
          <div>🖱️ 滚轮: 缩放</div>
          <div>🖱️ 右键拖动: 平移</div>
        </div>
      </div>
    </div>
  );
};
