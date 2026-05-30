import { useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useDrumKitStore } from '@/store/useDrumKitStore';
import { DrumPiece3D } from './DrumPiece3D';
import { Microphone3D } from './Microphone3D';
import { PhaseLine3D } from './PhaseLine3D';
import { CrosstalkSphere } from './CrosstalkSphere';
import { useDragControls } from '@/hooks/useDragControls';
import { Position3D } from '@/types';

export function DrumKit3D() {
  const { 
    session, 
    analysis, 
    showPhaseLines, 
    showCrosstalk,
    selectedMicId 
  } = useDrumKitStore();
  
  const { handlePointerDown, handlePointerMove, handlePointerUp, isDragging } = useDragControls();
  
  const handleMicPointerDown = (event: PointerEvent, micId: string, position: Position3D) => {
    handlePointerDown(event, micId, position);
  };
  
  const handleGroupPointerMove = (e: ThreeEvent<PointerEvent>) => {
    handlePointerMove(e.nativeEvent);
  };
  
  const handleGroupPointerUp = (e: ThreeEvent<PointerEvent>) => {
    handlePointerUp(e.nativeEvent);
  };
  
  const renderDistanceLabels = () => {
    if (!selectedMicId) return null;
    
    const selectedMic = session.microphones.find(m => m.id === selectedMicId);
    if (!selectedMic) return null;
    
    const drumPiece = session.drumPieces.find(d => d.id === selectedMic.drumPieceId);
    if (!drumPiece) return null;
    
    const distance = Math.sqrt(
      Math.pow(selectedMic.position.x - drumPiece.position.x, 2) +
      Math.pow(selectedMic.position.y - drumPiece.position.y, 2) +
      Math.pow(selectedMic.position.z - drumPiece.position.z, 2)
    );
    
    const midPoint = {
      x: (selectedMic.position.x + drumPiece.position.x) / 2,
      y: (selectedMic.position.y + drumPiece.position.y) / 2,
      z: (selectedMic.position.z + drumPiece.position.z) / 2,
    };
    
    const linePoints = [
      new THREE.Vector3(selectedMic.position.x, selectedMic.position.y, selectedMic.position.z),
      new THREE.Vector3(drumPiece.position.x, drumPiece.position.y, drumPiece.position.z),
    ];
    
    return (
      <group>
        <Line
          points={linePoints}
          color="#3b82f6"
          dashed
          dashSize={0.05}
          gapSize={0.03}
        />
        <mesh position={[midPoint.x, midPoint.y + 0.1, midPoint.z]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      </group>
    );
  };
  
  return (
    <group
      onPointerMove={handleGroupPointerMove}
      onPointerUp={handleGroupPointerUp}
      onPointerLeave={handleGroupPointerUp}
    >
      {session.drumPieces.map(piece => (
        <DrumPiece3D key={piece.id} piece={piece} />
      ))}
      
      {session.microphones.map(mic => (
        <Microphone3D 
          key={mic.id} 
          mic={mic} 
          onPointerDown={handleMicPointerDown}
          isDragging={isDragging && selectedMicId === mic.id}
        />
      ))}
      
      {showPhaseLines && analysis.phaseRelations.map(relation => {
        const mic1 = session.microphones.find(m => m.id === relation.mic1Id);
        const mic2 = session.microphones.find(m => m.id === relation.mic2Id);
        if (!mic1 || !mic2) return null;
        if (relation.isCoherent && relation.correlation > 0.8) return null;
        return (
          <PhaseLine3D 
            key={`phase-${relation.mic1Id}-${relation.mic2Id}`}
            relation={relation}
            mic1={mic1}
            mic2={mic2}
          />
        );
      })}
      
      {showCrosstalk && analysis.crosstalkMatrix.map((data, index) => {
        if (data.level <= -30) return null;
        const sourceMic = session.microphones.find(m => m.id === data.sourceMicId);
        const targetMic = session.microphones.find(m => m.id === data.targetMicId);
        if (!sourceMic || !targetMic) return null;
        return (
          <CrosstalkSphere
            key={`crosstalk-${index}`}
            data={data}
            sourceMic={sourceMic}
            targetMic={targetMic}
          />
        );
      })}
      
      {renderDistanceLabels()}
    </group>
  );
}
