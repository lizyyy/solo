import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CubeFrame } from './CubeFrame';
import { AxesHelper } from './AxesHelper';
import { PigmentPoints } from './PigmentPoints';
import { Pigment } from '../../types';

interface FormulaCubeProps {
  pigments: Pigment[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function FormulaCube({ pigments, selectedId, onSelect }: FormulaCubeProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [1.2, 1, 1.2], fov: 50 }}
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <pointLight position={[-5, -5, -5]} intensity={0.5} />
        <pointLight position={[0, 5, -5]} intensity={0.3} color="#60a5fa" />

        <CubeFrame />
        <AxesHelper />
        
        <PigmentPoints
          pigments={pigments}
          selectedId={selectedId}
          onSelect={onSelect}
        />

        <gridHelper args={[2, 20, '#334155', '#1e293b']} position={[0, -0.51, 0]} />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={0.8}
          maxDistance={3}
          enablePan={false}
        />
      </Canvas>
    </div>
  );
}
