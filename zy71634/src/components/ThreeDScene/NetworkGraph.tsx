
import { useEffect, useRef, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Wallet, Transaction, ForceParams, Node3D } from '../../types';
import { useForceSimulation } from '../../hooks/useForceSimulation';
import { WalletNode } from './WalletNode';
import { TransactionEdge } from './TransactionEdge';
import { StarsBackground } from './StarsBackground';

interface NetworkGraphProps {
  wallets: Wallet[];
  transactions: Transaction[];
  forceParams: ForceParams;
  selectedWalletId: string | null;
  highlightedPath: string[];
  onWalletSelect: (id: string | null) => void;
}

export const NetworkGraph = ({
  wallets,
  transactions,
  forceParams,
  selectedWalletId,
  highlightedPath,
  onWalletSelect,
}: NetworkGraphProps) => {
  const [nodes, setNodes] = useState<Node3D[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const simulation = useForceSimulation(
    wallets,
    transactions,
    forceParams,
    selectedWalletId,
    highlightedPath
  );

  const nodeMapRef = useRef<Map<string, Node3D>>(new Map());

  useFrame(() => {
    const currentNodes = simulation.getNodes();
    const currentEdges = simulation.getEdges();
    
    currentNodes.forEach((node) => {
      nodeMapRef.current.set(node.id, node);
    });
    
    setNodes(currentNodes);
    setEdges(currentEdges);
  });

  const handleBackgroundClick = useCallback(() => {
    onWalletSelect(null);
  }, [onWalletSelect]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[100, 100, 100]} intensity={0.8} color="#6366f1" />
      <pointLight position={[-100, -100, -100]} intensity={0.5} color="#3b82f6" />
      <pointLight position={[0, 100, -100]} intensity={0.4} color="#8b5cf6" />

      <fog attach="fog" args={['#0a1628', 200, 800]} />

      <StarsBackground />

      <group onClick={handleBackgroundClick}>
        {edges.map((edge) => (
          <TransactionEdge
            key={edge.id}
            edge={edge}
            nodeMap={nodeMapRef.current}
            isHighlighted={
              highlightedPath.includes(edge.source) &&
              highlightedPath.includes(edge.target)
            }
          />
        ))}

        {nodes.map((node) => (
          <WalletNode
            key={node.id}
            node={node}
            onClick={() => onWalletSelect(node.id)}
          />
        ))}
      </group>

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={50}
        maxDistance={500}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
      />

      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
};
