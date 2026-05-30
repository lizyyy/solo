import { useEffect, useCallback } from 'react';
import { useDrumKitStore } from '@/store/useDrumKitStore';
import {
  calculatePhaseRelation,
  calculateCrosstalk,
  detectOcclusion,
  getDistance,
} from '@/utils/acousticMath';
import {
  validateMicrophone,
  validateDrumPiece,
  checkPhaseInversionPair,
  validateOverheadStereoPair,
  generateId,
} from '@/utils/validation';

export function useAcousticAnalysis() {
  const { session, setAnalysis, analysis } = useDrumKitStore();
  
  const runAnalysis = useCallback(() => {
    const { drumPieces, microphones } = session;
    const errors = [];
    const phaseRelations = [];
    const crosstalkMatrix = [];
    const distanceMatrix: Record<string, number> = {};
    
    drumPieces.forEach(piece => {
      errors.push(...validateDrumPiece(piece, generateId));
    });
    
    microphones.forEach(mic => {
      const drumPiece = drumPieces.find(p => p.id === mic.drumPieceId);
      errors.push(...validateMicrophone(mic, drumPiece, generateId));
      
      if (drumPiece) {
        const occlusion = detectOcclusion(mic, drumPiece, drumPieces, generateId);
        if (occlusion) {
          errors.push(occlusion);
        }
        
        const distKey = `${mic.id}_${drumPiece.id}`;
        distanceMatrix[distKey] = getDistance(mic.position, drumPiece.position);
      }
    });
    
    for (let i = 0; i < microphones.length; i++) {
      for (let j = i + 1; j < microphones.length; j++) {
        const mic1 = microphones[i];
        const mic2 = microphones[j];
        
        const phaseRel = calculatePhaseRelation(mic1, mic2);
        phaseRelations.push(phaseRel);
        
        const distKey = `${mic1.id}_${mic2.id}`;
        distanceMatrix[distKey] = getDistance(mic1.position, mic2.position);
        
        const phaseError = checkPhaseInversionPair(mic1, mic2, generateId);
        if (phaseError) {
          errors.push(phaseError);
        }
        
        const stereoError = validateOverheadStereoPair(mic1, mic2, generateId);
        if (stereoError) {
          errors.push(stereoError);
        }
        
        if (mic1.drumPieceId && mic2.drumPieceId) {
          const drumPiece1 = drumPieces.find(p => p.id === mic1.drumPieceId);
          const drumPiece2 = drumPieces.find(p => p.id === mic2.drumPieceId);
          
          if (drumPiece1) {
            crosstalkMatrix.push(calculateCrosstalk(mic1, mic2, drumPiece1));
          }
          if (drumPiece2 && drumPiece1?.id !== drumPiece2?.id) {
            crosstalkMatrix.push(calculateCrosstalk(mic2, mic1, drumPiece2));
          }
        }
      }
    }
    
    if (analysis.phaseRelations.length === 0 && phaseRelations.length === 0) {
      return;
    }
    
    setAnalysis({
      phaseRelations,
      crosstalkMatrix,
      distanceMatrix,
      errors,
    });
  }, [session, setAnalysis, analysis.phaseRelations.length]);
  
  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);
  
  return { runAnalysis };
}
