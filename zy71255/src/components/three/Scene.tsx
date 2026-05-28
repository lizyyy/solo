import { useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { Enterprise, Transaction, Gap, Issue } from '../../types';
import { InstancedEnterpriseNodes, EnterpriseNode } from './EnterpriseNode';
import FlowLine from './FlowLine';
import Starfield from './Starfield';
import Particles from './Particles';
import Effects from './Effects';

interface SceneContentProps {
  enterprises: Enterprise[];
  transactions: Transaction[];
  gaps: Gap[];
  issues: Issue[];
  selectedEnterpriseId: string | null;
  selectedTransactionId: string | null;
  highlightedTransactions: string[];
  timeProgress: number;
  useInstanced?: boolean;
  onSelectEnterprise: (id: string) => void;
  onFocusEnterprise: (id: string) => void;
  onSelectTransaction: (id: string) => void;
}

const SceneContent = ({
  enterprises,
  transactions,
  gaps,
  issues,
  selectedEnterpriseId,
  selectedTransactionId,
  highlightedTransactions,
  timeProgress,
  useInstanced = true,
  onSelectEnterprise,
  onFocusEnterprise,
  onSelectTransaction
}: SceneContentProps) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  const maxTransactionAmount = useMemo(() => {
    if (transactions.length === 0) return 1000;
    return Math.max(...transactions.map(t => t.amount));
  }, [transactions]);

  const highlightedEnterpriseIds = useMemo(() => {
    const ids = new Set<string>();
    highlightedTransactions.forEach(transactionId => {
      const transaction = transactions.find(t => t.id === transactionId);
      if (transaction) {
        ids.add(transaction.fromId);
        ids.add(transaction.toId);
      }
    });
    if (selectedTransactionId) {
      const transaction = transactions.find(t => t.id === selectedTransactionId);
      if (transaction) {
        ids.add(transaction.fromId);
        ids.add(transaction.toId);
      }
    }
    return Array.from(ids);
  }, [transactions, highlightedTransactions, selectedTransactionId]);

  const enterpriseMap = useMemo(() => {
    return new Map(enterprises.map(e => [e.id, e]));
  }, [enterprises]);

  const gapMap = useMemo(() => {
    return new Map(gaps.map(g => [g.enterpriseId, g]));
  }, [gaps]);

  const issueMap = useMemo(() => {
    return new Map(issues.map(i => [i.enterpriseId, i]));
  }, [issues]);

  const handleFocusEnterprise = (id: string) => {
    const enterprise = enterprises.find(e => e.id === id);
    if (enterprise && controlsRef.current) {
      const [x, y, z] = enterprise.position;
      const targetPosition = new THREE.Vector3(x, y + 5, z + 10);

      if (camera) {
        const startPos = camera.position.clone();
        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);

          camera.position.lerpVectors(startPos, targetPosition, eased);
          camera.lookAt(x, y, z);

          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };

        requestAnimationFrame(animate);
      }
    }
    onFocusEnterprise(id);
  };

  return (
    <>
      <ambientLight intensity={0.3} />
      <hemisphereLight args={['#87CEEB', '#1a1a2e', 0.5]} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} color="#9D4EDD" />

      <Starfield />
      <Particles />

      <gridHelper
        args={[50, 50, '#333366', '#222244']}
        position={[0, -5, 0]}
      />

      {useInstanced ? (
        <InstancedEnterpriseNodes
          enterprises={enterprises}
          gaps={gaps}
          issues={issues}
          selectedEnterpriseId={selectedEnterpriseId}
          highlightedEnterpriseIds={highlightedEnterpriseIds}
          onSelect={onSelectEnterprise}
          onFocus={handleFocusEnterprise}
        />
      ) : (
        enterprises.map(enterprise => {
          const gap = gapMap.get(enterprise.id);
          const issue = issueMap.get(enterprise.id);
          const hasGap = !!gap && gap.gap > 0;
          const gapSize = gap ? Math.min(gap.gap / Math.max(gap.required, 1), 1) : 0;
          const hasIssue = !!issue;
          const isSelected = enterprise.id === selectedEnterpriseId;
          const isHighlighted = highlightedEnterpriseIds.includes(enterprise.id);

          return (
            <EnterpriseNode
              key={enterprise.id}
              enterprise={enterprise}
              isSelected={isSelected}
              isHighlighted={isHighlighted}
              hasIssue={hasIssue}
              hasGap={hasGap}
              gapSize={gapSize}
              onSelect={onSelectEnterprise}
              onFocus={handleFocusEnterprise}
            />
          );
        })
      )}

      {transactions.map(transaction => {
        const fromEnterprise = enterpriseMap.get(transaction.fromId);
        const toEnterprise = enterpriseMap.get(transaction.toId);

        if (!fromEnterprise || !toEnterprise) return null;

        const isHighlighted =
          highlightedTransactions.includes(transaction.id) ||
          transaction.id === selectedTransactionId;

        return (
          <FlowLine
            key={transaction.id}
            transaction={transaction}
            fromPos={fromEnterprise.position}
            toPos={toEnterprise.position}
            isHighlighted={isHighlighted}
            progress={timeProgress}
            maxAmount={maxTransactionAmount}
            onSelect={onSelectTransaction}
          />
        );
      })}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2 + 0.1}
      />

      <Effects enableChromaticAberration />
    </>
  );
};

interface SceneProps {
  enterprises: Enterprise[];
  transactions: Transaction[];
  gaps: Gap[];
  issues: Issue[];
  selectedEnterpriseId: string | null;
  selectedTransactionId: string | null;
  highlightedTransactions: string[];
  timeProgress?: number;
  useInstanced?: boolean;
  onSelectEnterprise: (id: string) => void;
  onFocusEnterprise: (id: string) => void;
  onSelectTransaction: (id: string) => void;
}

const Scene = ({
  enterprises,
  transactions,
  gaps,
  issues,
  selectedEnterpriseId,
  selectedTransactionId,
  highlightedTransactions,
  timeProgress = 1,
  useInstanced = true,
  onSelectEnterprise,
  onFocusEnterprise,
  onSelectTransaction
}: SceneProps) => {
  return (
    <Canvas
      camera={{
        position: [0, 15, 20],
        fov: 60,
        near: 0.1,
        far: 1000
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      }}
      dpr={[1, 2]}
      style={{ background: 'linear-gradient(to bottom, #0a0a1a, #1a1a3a)' }}
    >
      <SceneContent
        enterprises={enterprises}
        transactions={transactions}
        gaps={gaps}
        issues={issues}
        selectedEnterpriseId={selectedEnterpriseId}
        selectedTransactionId={selectedTransactionId}
        highlightedTransactions={highlightedTransactions}
        timeProgress={timeProgress}
        useInstanced={useInstanced}
        onSelectEnterprise={onSelectEnterprise}
        onFocusEnterprise={onFocusEnterprise}
        onSelectTransaction={onSelectTransaction}
      />
    </Canvas>
  );
};

export default Scene;
