import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';

export const Canvas3D: React.FC = () => {
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        gl={{ antialias: true }}
        onClick={() => {
          // 点击空白处取消选中
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
};
