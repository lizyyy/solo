import { useCallback, useRef } from 'react';
import type { Body, Marble, PhysicsParams, EnergyState, ErrorMark } from '@/types';
import { rk4Step } from '@/utils/physics/integrator';
import { updateBodies, checkCollision } from '@/utils/physics/gravity';
import { calculateEnergyState, checkEscapeCondition } from '@/utils/physics/energy';
import { useGameStore } from '@/store/useGameStore';

interface PhysicsEngineResult {
  step: () => {
    result: 'continue' | 'escape' | 'collide' | 'timeout';
    collisionBodyId?: string;
    escapeDistance?: number;
  };
  getCurrentEnergy: () => EnergyState;
  getErrorMarks: () => ErrorMark[];
}

const MAX_SIMULATION_TIME = 30;
const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 500;

export function usePhysicsEngine(): PhysicsEngineResult {
  const errorMarksRef = useRef<ErrorMark[]>([]);

  const step = useCallback(() => {
    const {
      bodies,
      marble,
      physicsParams,
      currentFrame,
      simulationTime,
      errorMarks: currentErrorMarks,
    } = useGameStore.getState();

    errorMarksRef.current = [...currentErrorMarks];

    if (simulationTime >= MAX_SIMULATION_TIME) {
      return { result: 'timeout' as const };
    }

    const bodiesResult = updateBodies(bodies, physicsParams, currentFrame);
    let newBodies = bodiesResult.bodies;
    errorMarksRef.current = bodiesResult.errors;

    const marbleResult = rk4Step(marble, newBodies, physicsParams, currentFrame, errorMarksRef.current);
    let newMarble = marbleResult.marble;
    errorMarksRef.current = marbleResult.errors;

    const collisionResult = checkCollision(newMarble, newBodies, currentFrame, errorMarksRef.current);
    errorMarksRef.current = collisionResult.errors;

    if (collisionResult.collided) {
      const store = useGameStore.getState();
      store.setMarble(newMarble);
      store.setBodies(newBodies);
      store.setErrorMarks(errorMarksRef.current);
      return {
        result: 'collide' as const,
        collisionBodyId: collisionResult.bodyId,
      };
    }

    const escapeResult = checkEscapeCondition(
      newMarble,
      newBodies,
      physicsParams.gravitationalConstant,
      physicsParams.escapeThreshold,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    );

    if (escapeResult.escaped) {
      const store = useGameStore.getState();
      store.setMarble(newMarble);
      store.setBodies(newBodies);
      store.setErrorMarks(errorMarksRef.current);
      return {
        result: 'escape' as const,
        escapeDistance: escapeResult.escapeDistance,
      };
    }

    const energy = calculateEnergyState(newMarble, newBodies, physicsParams.gravitationalConstant);

    const store = useGameStore.getState();
    store.setMarble(newMarble);
    store.setBodies(newBodies);
    store.addEnergyHistory(energy);
    store.addTrajectoryPoint({ x: newMarble.x, y: newMarble.y }, energy);
    store.setErrorMarks(errorMarksRef.current);
    store.incrementFrame();
    store.setSimulationTime(simulationTime + physicsParams.timeStep);

    return { result: 'continue' as const };
  }, []);

  const getCurrentEnergy = useCallback((): EnergyState => {
    const { marble, bodies, physicsParams } = useGameStore.getState();
    return calculateEnergyState(marble, bodies, physicsParams.gravitationalConstant);
  }, []);

  const getErrorMarks = useCallback((): ErrorMark[] => {
    return errorMarksRef.current;
  }, []);

  return {
    step,
    getCurrentEnergy,
    getErrorMarks,
  };
}
