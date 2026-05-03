import type { AppState, AppAction, ShootingSchedule, ManualAdjustment, SimulationResult } from '../types';
import { sampleSchedule } from '../data/sampleSchedule';

const MAX_HISTORY = 50;

export function createInitialState(): AppState {
  return {
    currentSchedule: JSON.parse(JSON.stringify(sampleSchedule)),
    simulationResult: undefined,
    selectedScene: undefined,
    selectedBattery: undefined,
    history: [],
    historyIndex: -1,
    isSimulating: false,
  };
}

function cloneSchedule(schedule: ShootingSchedule): ShootingSchedule {
  return JSON.parse(JSON.stringify(schedule));
}

function createAdjustment(
  type: ManualAdjustment['type'],
  details: ManualAdjustment['details']
): ManualAdjustment {
  return {
    id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    details,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_SCHEDULE': {
      return {
        ...state,
        currentSchedule: cloneSchedule(action.payload),
        simulationResult: undefined,
        history: [],
        historyIndex: -1,
      };
    }

    case 'RUN_SIMULATION': {
      return {
        ...state,
        simulationResult: action.payload,
        isSimulating: false,
      };
    }

    case 'SELECT_SCENE': {
      return {
        ...state,
        selectedScene: action.payload,
      };
    }

    case 'SELECT_BATTERY': {
      return {
        ...state,
        selectedBattery: action.payload,
      };
    }

    case 'SET_SIMULATING': {
      return {
        ...state,
        isSimulating: action.payload,
      };
    }

    case 'APPLY_ADJUSTMENT': {
      const adjustment = action.payload;
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), adjustment];
      
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }

      let newSchedule = cloneSchedule(state.currentSchedule);

      switch (adjustment.type) {
        case 'assign_battery': {
          const { sceneId, cameraId, batteryId } = adjustment.details as {
            sceneId: string;
            cameraId: string;
            batteryId: string;
          };
          newSchedule = assignBatteryToCamera(newSchedule, sceneId, cameraId, batteryId);
          break;
        }
        case 'unassign_battery': {
          const { sceneId, cameraId } = adjustment.details as {
            sceneId: string;
            cameraId: string;
          };
          newSchedule = unassignBatteryFromCamera(newSchedule, sceneId, cameraId);
          break;
        }
        case 'assign_charger': {
          const { batteryId, portId } = adjustment.details as {
            batteryId: string;
            portId: string;
          };
          newSchedule = assignBatteryToCharger(newSchedule, batteryId, portId);
          break;
        }
        case 'unassign_charger': {
          const { batteryId } = adjustment.details as {
            batteryId: string;
          };
          newSchedule = unassignBatteryFromCharger(newSchedule, batteryId);
          break;
        }
      }

      return {
        ...state,
        currentSchedule: newSchedule,
        simulationResult: undefined,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      
      const newIndex = state.historyIndex - 1;
      let newSchedule = cloneSchedule(sampleSchedule);
      
      for (let i = 0; i <= newIndex; i++) {
        const adjustment = state.history[i];
        switch (adjustment.type) {
          case 'assign_battery': {
            const { sceneId, cameraId, batteryId } = adjustment.details as {
              sceneId: string;
              cameraId: string;
              batteryId: string;
            };
            newSchedule = assignBatteryToCamera(newSchedule, sceneId, cameraId, batteryId);
            break;
          }
          case 'unassign_battery': {
            const { sceneId, cameraId } = adjustment.details as {
              sceneId: string;
              cameraId: string;
            };
            newSchedule = unassignBatteryFromCamera(newSchedule, sceneId, cameraId);
            break;
          }
          case 'assign_charger': {
            const { batteryId, portId } = adjustment.details as {
              batteryId: string;
              portId: string;
            };
            newSchedule = assignBatteryToCharger(newSchedule, batteryId, portId);
            break;
          }
          case 'unassign_charger': {
            const { batteryId } = adjustment.details as {
              batteryId: string;
            };
            newSchedule = unassignBatteryFromCharger(newSchedule, batteryId);
            break;
          }
        }
      }

      return {
        ...state,
        currentSchedule: newSchedule,
        simulationResult: undefined,
        historyIndex: newIndex,
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      
      const newIndex = state.historyIndex + 1;
      const adjustment = state.history[newIndex];
      let newSchedule = cloneSchedule(state.currentSchedule);

      switch (adjustment.type) {
        case 'assign_battery': {
          const { sceneId, cameraId, batteryId } = adjustment.details as {
            sceneId: string;
            cameraId: string;
            batteryId: string;
          };
          newSchedule = assignBatteryToCamera(newSchedule, sceneId, cameraId, batteryId);
          break;
        }
        case 'unassign_battery': {
          const { sceneId, cameraId } = adjustment.details as {
            sceneId: string;
            cameraId: string;
          };
          newSchedule = unassignBatteryFromCamera(newSchedule, sceneId, cameraId);
          break;
        }
        case 'assign_charger': {
          const { batteryId, portId } = adjustment.details as {
            batteryId: string;
            portId: string;
          };
          newSchedule = assignBatteryToCharger(newSchedule, batteryId, portId);
          break;
        }
        case 'unassign_charger': {
          const { batteryId } = adjustment.details as {
            batteryId: string;
          };
          newSchedule = unassignBatteryFromCharger(newSchedule, batteryId);
          break;
        }
      }

      return {
        ...state,
        currentSchedule: newSchedule,
        simulationResult: undefined,
        historyIndex: newIndex,
      };
    }

    default:
      return state;
  }
}

function assignBatteryToCamera(
  schedule: ShootingSchedule,
  sceneId: string,
  cameraId: string,
  batteryId: string
): ShootingSchedule {
  const newSchedule = cloneSchedule(schedule);
  const scene = newSchedule.scenes.find((s) => s.id === sceneId);
  
  if (scene) {
    const assignment = scene.cameras.find((c) => c.cameraId === cameraId);
    if (assignment) {
      assignment.batteryId = batteryId;
    } else {
      scene.cameras.push({ cameraId, batteryId });
    }
  }
  
  return newSchedule;
}

function unassignBatteryFromCamera(
  schedule: ShootingSchedule,
  sceneId: string,
  cameraId: string
): ShootingSchedule {
  const newSchedule = cloneSchedule(schedule);
  const scene = newSchedule.scenes.find((s) => s.id === sceneId);
  
  if (scene) {
    const assignment = scene.cameras.find((c) => c.cameraId === cameraId);
    if (assignment) {
      assignment.batteryId = undefined;
    }
  }
  
  return newSchedule;
}

function assignBatteryToCharger(
  schedule: ShootingSchedule,
  batteryId: string,
  portId: string
): ShootingSchedule {
  const newSchedule = cloneSchedule(schedule);
  
  const battery = newSchedule.batteries.find((b) => b.id === batteryId);
  if (battery) {
    if (battery.chargingPort) {
      const oldPort = newSchedule.chargers
        .flatMap((c) => c.ports)
        .find((p) => p.id === battery.chargingPort);
      if (oldPort) {
        oldPort.occupiedBy = undefined;
      }
    }
    
    const newPort = newSchedule.chargers
      .flatMap((c) => c.ports)
      .find((p) => p.id === portId);
    if (newPort) {
      if (newPort.occupiedBy) {
        const displacedBattery = newSchedule.batteries.find((b) => b.id === newPort.occupiedBy);
        if (displacedBattery) {
          displacedBattery.chargingPort = undefined;
          displacedBattery.status = 'idle';
        }
      }
      newPort.occupiedBy = batteryId;
      battery.chargingPort = portId;
      battery.status = 'charging';
    }
  }
  
  return newSchedule;
}

function unassignBatteryFromCharger(
  schedule: ShootingSchedule,
  batteryId: string
): ShootingSchedule {
  const newSchedule = cloneSchedule(schedule);
  
  const battery = newSchedule.batteries.find((b) => b.id === batteryId);
  if (battery && battery.chargingPort) {
    const port = newSchedule.chargers
      .flatMap((c) => c.ports)
      .find((p) => p.id === battery.chargingPort);
    if (port) {
      port.occupiedBy = undefined;
    }
    battery.chargingPort = undefined;
    battery.status = 'idle';
  }
  
  return newSchedule;
}

export { createAdjustment };
