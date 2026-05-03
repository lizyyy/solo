import type {
  ShootingSchedule,
  SimulationConfig,
  SimulationResult,
  TimeStepState,
  Risk,
  BatterySnapshot,
  BatteryStatus,
  TimePoint,
  Scene,
  Battery,
  ChargingPort,
} from '../types';
import {
  timeToMinutes,
  minutesToTime,
  isTimeInRange,
  isMidnightCrossing,
  getRangeDurationMinutes,
  addMinutes,
  compareTime,
  generateTimeSteps,
  formatTime,
} from '../utils/time';

const DEFAULT_CONFIG: SimulationConfig = {
  lowBatteryThreshold: 20,
  criticalBatteryThreshold: 5,
  timeStepMinutes: 5,
};

interface SchedulerState {
  batteries: Map<string, BatterySnapshot>;
  chargingPorts: Map<string, { port: ChargingPort; batteryId?: string }>;
  activeScenes: Set<string>;
  currentRisks: Risk[];
  allRisks: Risk[];
  timeSteps: TimeStepState[];
}

function createBatterySnapshot(battery: Battery): BatterySnapshot {
  return {
    batteryId: battery.id,
    charge: battery.currentCharge,
    status: battery.status,
    assignedTo: battery.assignedTo,
    chargingPort: battery.chargingPort,
  };
}

function findCameraById(schedule: ShootingSchedule, cameraId: string) {
  return schedule.cameras.find((c) => c.id === cameraId);
}

function findBatteryType(schedule: ShootingSchedule, batteryId: string) {
  const battery = schedule.batteries.find((b) => b.id === batteryId);
  return battery?.type;
}

function isBatteryCompatibleWithCamera(schedule: ShootingSchedule, batteryId: string, cameraId: string): boolean {
  const camera = findCameraById(schedule, cameraId);
  const batteryType = findBatteryType(schedule, batteryId);
  if (!camera || !batteryType) return false;
  return camera.compatibleBatteryTypes.includes(batteryType);
}

function isBatteryCompatibleWithPort(schedule: ShootingSchedule, batteryId: string, portId: string): boolean {
  const batteryType = findBatteryType(schedule, batteryId);
  const port = schedule.chargers.flatMap((c) => c.ports).find((p) => p.id === portId);
  if (!batteryType || !port) return false;
  return port.compatibleBatteryTypes.includes(batteryType);
}

function getChargingSpeed(schedule: ShootingSchedule, portId: string): number {
  const port = schedule.chargers.flatMap((c) => c.ports).find((p) => p.id === portId);
  return port?.chargingSpeed ?? 15;
}

function generateRiskId(): string {
  return `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function checkSceneOverlaps(schedule: ShootingSchedule): Risk[] {
  const risks: Risk[] = [];
  const scenes = [...schedule.scenes];

  for (let i = 0; i < scenes.length; i++) {
    for (let j = i + 1; j < scenes.length; j++) {
      const sceneA = scenes[i];
      const sceneB = scenes[j];

      const assignmentsA = sceneA.cameras.filter((a) => a.batteryId);
      const assignmentsB = sceneB.cameras.filter((a) => a.batteryId);

      for (const assignA of assignmentsA) {
        for (const assignB of assignmentsB) {
          if (assignA.batteryId === assignB.batteryId) {
            const rangeA = sceneA.timeRange;
            const rangeB = sceneB.timeRange;

            const startA = timeToMinutes(rangeA.start);
            const endA = timeToMinutes(rangeA.end);
            const startB = timeToMinutes(rangeB.start);
            const endB = timeToMinutes(rangeB.end);

            const crossA = startA > endA;
            const crossB = startB > endB;

            let hasOverlap = false;
            if (!crossA && !crossB) {
              hasOverlap = startA < endB && startB < endA;
            } else if (crossA && !crossB) {
              hasOverlap = startA < endB || startB < endA;
            } else if (!crossA && crossB) {
              hasOverlap = startB < endA || startA < endB;
            } else {
              hasOverlap = true;
            }

            if (hasOverlap) {
              const battery = schedule.batteries.find((b) => b.id === assignA.batteryId);
              risks.push({
                id: generateRiskId(),
                type: 'simultaneous_use',
                severity: 'critical',
                time: rangeA.start,
                description: `电池 "${battery?.name || assignA.batteryId}" 被场景 "${sceneA.name}" 和 "${sceneB.name}" 同时分配，时间可能重叠`,
                details: {
                  batteryId: assignA.batteryId,
                  scenes: [sceneA.id, sceneB.id],
                  sceneNames: [sceneA.name, sceneB.name],
                },
              });
            }
          }
        }
      }
    }
  }

  return risks;
}

function checkCrossSceneLateReturns(schedule: ShootingSchedule): Risk[] {
  const risks: Risk[] = [];

  for (const scene of schedule.scenes) {
    for (const nextScene of schedule.scenes) {
      if (scene.id === nextScene.id) continue;

      const sceneEndMinutes = timeToMinutes(scene.timeRange.end);
      const nextStartMinutes = timeToMinutes(nextScene.timeRange.start);

      const sceneCrosses = isMidnightCrossing(scene.timeRange);
      const nextCrosses = isMidnightCrossing(nextScene.timeRange);

      let isSequential = false;
      if (!sceneCrosses && !nextCrosses) {
        isSequential = sceneEndMinutes <= nextStartMinutes;
      } else if (sceneCrosses && !nextCrosses) {
        isSequential = true;
      } else {
        continue;
      }

      if (!isSequential) continue;

      const gapMinutes = nextStartMinutes - sceneEndMinutes;
      if (gapMinutes < 0 && !sceneCrosses) continue;

      for (const assign of scene.cameras) {
        if (!assign.batteryId) continue;

        const nextAssign = nextScene.cameras.find((a) => a.batteryId === assign.batteryId);
        if (!nextAssign) continue;

        const effectiveGap = sceneCrosses ? (1440 - sceneEndMinutes) + nextStartMinutes : gapMinutes;

        if (effectiveGap < 15) {
          const battery = schedule.batteries.find((b) => b.id === assign.batteryId);
          risks.push({
            id: generateRiskId(),
            type: 'cross_scene_late',
            severity: effectiveGap < 5 ? 'high' : 'medium',
            time: scene.timeRange.end,
            description: `电池 "${battery?.name || assign.batteryId}" 从场景 "${scene.name}" 转场到 "${nextScene.name}" 只有 ${effectiveGap} 分钟，可能来不及更换/充电`,
            details: {
              batteryId: assign.batteryId,
              fromScene: scene.id,
              toScene: nextScene.id,
              gapMinutes: effectiveGap,
            },
            sceneId: scene.id,
          });
        }
      }
    }
  }

  return risks;
}

function getOverallTimeRange(schedule: ShootingSchedule): { start: TimePoint; end: TimePoint } {
  if (schedule.scenes.length === 0) {
    return { start: { hour: 0, minute: 0 }, end: { hour: 23, minute: 59 } };
  }

  let minMinutes = Infinity;
  let maxMinutes = -Infinity;
  let hasMidnightCrossing = false;

  for (const scene of schedule.scenes) {
    const startMin = timeToMinutes(scene.timeRange.start);
    const endMin = timeToMinutes(scene.timeRange.end);

    if (isMidnightCrossing(scene.timeRange)) {
      hasMidnightCrossing = true;
    }

    minMinutes = Math.min(minMinutes, startMin);
    maxMinutes = Math.max(maxMinutes, startMin > endMin ? endMin + 1440 : endMin);
  }

  const start = minutesToTime(minMinutes);
  const end = minutesToTime(maxMinutes);

  return { start, end };
}

export function runSimulation(
  schedule: ShootingSchedule,
  config: Partial<SimulationConfig> = {}
): SimulationResult {
  const fullConfig: SimulationConfig = { ...DEFAULT_CONFIG, ...config };

  const state: SchedulerState = {
    batteries: new Map(),
    chargingPorts: new Map(),
    activeScenes: new Set(),
    currentRisks: [],
    allRisks: [],
    timeSteps: [],
  };

  for (const battery of schedule.batteries) {
    state.batteries.set(battery.id, createBatterySnapshot(battery));
  }

  for (const charger of schedule.chargers) {
    for (const port of charger.ports) {
      state.chargingPorts.set(port.id, { port, batteryId: port.occupiedBy });
      if (port.occupiedBy) {
        const battery = state.batteries.get(port.occupiedBy);
        if (battery) {
          battery.chargingPort = port.id;
          battery.status = 'charging';
        }
      }
    }
  }

  const preCheckRisks = [...checkSceneOverlaps(schedule), ...checkCrossSceneLateReturns(schedule)];
  state.allRisks.push(...preCheckRisks);

  const { start, end } = getOverallTimeRange(schedule);
  const isMidnightCrossingSchedule = schedule.scenes.some((s) => isMidnightCrossing(s.timeRange));
  const timeSteps = generateTimeSteps(start, end, fullConfig.timeStepMinutes);

  for (const currentTime of timeSteps) {
    const stepRisks: Risk[] = [];
    const activeSceneIds: string[] = [];

    for (const scene of schedule.scenes) {
      if (isTimeInRange(currentTime, scene.timeRange)) {
        activeSceneIds.push(scene.id);
        state.activeScenes.add(scene.id);

        for (const assignment of scene.cameras) {
          if (!assignment.batteryId) continue;

          const battery = state.batteries.get(assignment.batteryId);
          if (!battery) continue;

          if (battery.assignedTo && battery.assignedTo !== assignment.cameraId) {
            stepRisks.push({
              id: generateRiskId(),
              type: 'simultaneous_use',
              severity: 'critical',
              time: currentTime,
              description: `电池 "${battery.batteryId}" 同时被分配到多台相机`,
              details: {
                batteryId: battery.batteryId,
                currentCamera: battery.assignedTo,
                newCamera: assignment.cameraId,
                sceneId: scene.id,
              },
              sceneId: scene.id,
            });
            continue;
          }

          if (battery.chargingPort) {
            const portState = state.chargingPorts.get(battery.chargingPort);
            if (portState) {
              portState.batteryId = undefined;
            }
            battery.chargingPort = undefined;
          }

          battery.assignedTo = assignment.cameraId;
          battery.status = 'in_use';
        }
      } else {
        if (state.activeScenes.has(scene.id)) {
          for (const assignment of scene.cameras) {
            if (!assignment.batteryId) continue;
            const battery = state.batteries.get(assignment.batteryId);
            if (battery && battery.assignedTo === assignment.cameraId) {
              battery.assignedTo = undefined;
              if (battery.charge <= fullConfig.criticalBatteryThreshold) {
                battery.status = 'critical';
              } else if (battery.charge <= fullConfig.lowBatteryThreshold) {
                battery.status = 'low';
              } else {
                battery.status = 'idle';
              }
            }
          }
          state.activeScenes.delete(scene.id);
        }
      }
    }

    const chargingPortQueue: Map<string, string[]> = new Map();

    for (const [batteryId, battery] of state.batteries) {
      if (battery.status === 'in_use') {
        const camera = findCameraById(schedule, battery.assignedTo!);
        if (camera) {
          const powerConsumptionPerHour = camera.powerConsumption;
          const consumptionPerStep = (powerConsumptionPerHour / 60) * fullConfig.timeStepMinutes;
          battery.charge = Math.max(0, battery.charge - consumptionPerStep);

          if (battery.charge === 0) {
            stepRisks.push({
              id: generateRiskId(),
              type: 'battery_depleted',
              severity: 'critical',
              time: currentTime,
              description: `电池 "${getBatteryName(batteryId)}" 在 ${formatTime(currentTime)} 完全耗尽！`,
              details: {
                batteryId,
                cameraId: battery.assignedTo,
                sceneIds: activeSceneIds,
              },
            });
          } else if (battery.charge <= fullConfig.criticalBatteryThreshold) {
            battery.status = 'critical';
            stepRisks.push({
              id: generateRiskId(),
              type: 'battery_critical',
              severity: 'high',
              time: currentTime,
              description: `电池 "${getBatteryName(batteryId)}" 电量危急 (${battery.charge.toFixed(1)}%)`,
              details: {
                batteryId,
                charge: battery.charge,
                cameraId: battery.assignedTo,
              },
            });
          } else if (battery.charge <= fullConfig.lowBatteryThreshold && battery.status !== 'low') {
            battery.status = 'low';
            stepRisks.push({
              id: generateRiskId(),
              type: 'battery_low',
              severity: 'medium',
              time: currentTime,
              description: `电池 "${getBatteryName(batteryId)}" 电量低 (${battery.charge.toFixed(1)}%)`,
              details: {
                batteryId,
                charge: battery.charge,
                cameraId: battery.assignedTo,
              },
            });
          }
        }
      } else if (battery.chargingPort) {
        const chargingSpeed = getChargingSpeed(schedule, battery.chargingPort);
        const chargePerStep = (chargingSpeed / 60) * fullConfig.timeStepMinutes;
        const capacity = schedule.batteries.find((b) => b.id === batteryId)?.capacity ?? 100;
        battery.charge = Math.min(capacity, battery.charge + chargePerStep);

        if (battery.charge >= fullConfig.lowBatteryThreshold && battery.status === 'low') {
          battery.status = 'charging';
        }
        if (battery.charge >= fullConfig.criticalBatteryThreshold && battery.status === 'critical') {
          battery.status = 'charging';
        }
      } else if (battery.status === 'idle' || battery.status === 'low' || battery.status === 'critical') {
        for (const [portId, portState] of state.chargingPorts) {
          if (portState.batteryId) continue;
          if (!isBatteryCompatibleWithPort(schedule, batteryId, portId)) continue;

          if (!chargingPortQueue.has(portId)) {
            chargingPortQueue.set(portId, []);
          }
          chargingPortQueue.get(portId)!.push(batteryId);
          break;
        }
      }
    }

    for (const [portId, waitingBatteries] of chargingPortQueue) {
      if (waitingBatteries.length === 0) continue;

      const portState = state.chargingPorts.get(portId);
      if (!portState || portState.batteryId) continue;

      const sortedBatteries = waitingBatteries
        .map((id) => state.batteries.get(id)!)
        .filter(Boolean)
        .sort((a, b) => a.charge - b.charge);

      const selectedBattery = sortedBatteries[0];
      if (selectedBattery) {
        portState.batteryId = selectedBattery.batteryId;
        selectedBattery.chargingPort = portId;
        selectedBattery.status = 'charging';
      }
    }

    for (const [portId, portState] of state.chargingPorts) {
      if (!portState.batteryId) continue;

      const battery = state.batteries.get(portState.batteryId);
      if (!battery || battery.chargingPort !== portId) {
        portState.batteryId = undefined;
      }
    }

    function getBatteryName(id: string): string {
      return schedule.batteries.find((b) => b.id === id)?.name || id;
    }

    const snapshot: BatterySnapshot[] = Array.from(state.batteries.values()).map((b) => ({ ...b }));

    const chargingPortUsage: Record<string, string | undefined> = {};
    for (const [portId, portState] of state.chargingPorts) {
      chargingPortUsage[portId] = portState.batteryId;
    }

    const timeStepState: TimeStepState = {
      time: { ...currentTime },
      batterySnapshots: snapshot,
      activeScenes: [...activeSceneIds],
      risks: [...stepRisks],
      chargingPortUsage: { ...chargingPortUsage },
    };

    state.timeSteps.push(timeStepState);
    state.allRisks.push(...stepRisks);
  }

  return {
    schedule,
    config: fullConfig,
    timeSteps: state.timeSteps,
    allRisks: state.allRisks,
    isMidnightCrossing: isMidnightCrossingSchedule,
  };
}
