import dayjs from 'dayjs';
import { RISK_TYPES } from './config.js';

export class RiskDetector {
  constructor() {
    this.risks = [];
    this.detectedRiskIds = new Set();
    this.state = {
      slotOccupancy: new Map(),
      elevatorUsage: new Map(),
      activeTasks: [],
      carPositions: new Map(),
      taskTimings: new Map()
    };
  }

  reset() {
    this.risks = [];
    this.detectedRiskIds = new Set();
    this.state = {
      slotOccupancy: new Map(),
      elevatorUsage: new Map(),
      activeTasks: [],
      carPositions: new Map(),
      taskTimings: new Map()
    };
  }

  updateState(state) {
    if (state.slotOccupancy) {
      state.slotOccupancy.forEach((value, key) => {
        this.state.slotOccupancy.set(key, value);
      });
    }
    if (state.elevatorUsage) {
      state.elevatorUsage.forEach((value, key) => {
        this.state.elevatorUsage.set(key, value);
      });
    }
    if (state.activeTasks) {
      this.state.activeTasks = [...state.activeTasks];
    }
    if (state.carPositions) {
      state.carPositions.forEach((value, key) => {
        this.state.carPositions.set(key, value);
      });
    }
    if (state.taskTimings) {
      state.taskTimings.forEach((value, key) => {
        this.state.taskTimings.set(key, value);
      });
    }
  }

  detectSlotConflict(command, context) {
    if (!command.toSlot) return null;

    const currentOccupancy = this.state.slotOccupancy.get(command.toSlot);
    
    if (currentOccupancy && currentOccupancy.vehicleId !== command.vehicleId) {
      const riskId = `slot_conflict_${command.toSlot}_${dayjs(command.time).valueOf()}`;
      
      if (this.detectedRiskIds.has(riskId)) return null;
      this.detectedRiskIds.add(riskId);

      return {
        id: riskId,
        type: RISK_TYPES.SLOT_CONFLICT,
        time: command.time,
        description: `车位 ${command.toSlot} 被重复占用`,
        details: {
          slotId: command.toSlot,
          currentVehicle: currentOccupancy.vehicleId,
          newVehicle: command.vehicleId,
          commandId: command.id,
          lineNumber: command.lineNumber
        },
        position: context.slotPosition || { x: 0, y: 0, z: 0 }
      };
    }

    return null;
  }

  detectElevatorConflict(command, context) {
    if (!command.elevatorId) return null;

    const currentUsage = this.state.elevatorUsage.get(command.elevatorId);
    
    if (currentUsage && currentUsage.taskId !== command.id) {
      const riskId = `elevator_conflict_${command.elevatorId}_${dayjs(command.time).valueOf()}`;
      
      if (this.detectedRiskIds.has(riskId)) return null;
      this.detectedRiskIds.add(riskId);

      return {
        id: riskId,
        type: RISK_TYPES.ELEVATOR_CONFLICT,
        time: command.time,
        description: `升降机 ${command.elevatorId} 被跨层抢占`,
        details: {
          elevatorId: command.elevatorId,
          currentTask: currentUsage.taskId,
          newTask: command.id,
          targetFloor: command.toFloor,
          currentFloor: currentUsage.targetFloor,
          lineNumber: command.lineNumber
        },
        position: context.elevatorPosition || { x: -5, y: 0, z: 0 }
      };
    }

    return null;
  }

  detectPathBlocked(command, context) {
    if (!command.path || command.path.length < 2) return null;

    const blockedPositions = [];
    const path = command.path;

    for (let i = 0; i < path.length; i++) {
      const pathPoint = path[i];
      
      for (const [vehicleId, pos] of this.state.carPositions) {
        if (vehicleId === command.vehicleId) continue;

        const distance = Math.sqrt(
          Math.pow(pathPoint.x - pos.x, 2) + 
          Math.pow(pathPoint.z - pos.z, 2)
        );

        if (distance < 2.5) {
          blockedPositions.push({
            pathIndex: i,
            pathPoint: pathPoint,
            blockingVehicle: vehicleId,
            blockingPosition: pos,
            distance: distance
          });
        }
      }
    }

    if (blockedPositions.length > 0) {
      const riskId = `path_blocked_${command.id}_${dayjs(command.time).valueOf()}`;
      
      if (this.detectedRiskIds.has(riskId)) return null;
      this.detectedRiskIds.add(riskId);

      return {
        id: riskId,
        type: RISK_TYPES.PATH_BLOCKED,
        time: command.time,
        description: `车辆 ${command.vehicleId} 的行驶路径被阻塞`,
        details: {
          vehicleId: command.vehicleId,
          commandId: command.id,
          blockedPositions: blockedPositions,
          blockingVehicles: blockedPositions.map(b => b.blockingVehicle),
          lineNumber: command.lineNumber
        },
        position: blockedPositions[0].pathPoint
      };
    }

    return null;
  }

  detectPickupTimeout(command, context) {
    if (command.type !== 'pickup' && command.type !== 'exit') return null;

    const taskTiming = this.state.taskTimings.get(command.id);
    if (!taskTiming) return null;

    const timeLimit = context.timeLimit || 180;
    const elapsed = dayjs(command.time).diff(dayjs(taskTiming.startTime), 'second');

    if (elapsed > timeLimit) {
      const riskId = `pickup_timeout_${command.id}_${dayjs(command.time).valueOf()}`;
      
      if (this.detectedRiskIds.has(riskId)) return null;
      this.detectedRiskIds.add(riskId);

      return {
        id: riskId,
        type: RISK_TYPES.PICKUP_TIMEOUT,
        time: command.time,
        description: `取车任务 ${command.id} 超时`,
        details: {
          taskId: command.id,
          vehicleId: command.vehicleId,
          startTime: taskTiming.startTime,
          currentTime: command.time,
          elapsedSeconds: elapsed,
          timeLimit: timeLimit,
          lineNumber: command.lineNumber
        },
        position: context.vehiclePosition || { x: 0, y: 0, z: 0 }
      };
    }

    return null;
  }

  detectParkTimeout(command, context) {
    if (command.type !== 'park' && command.type !== 'enter') return null;

    const taskTiming = this.state.taskTimings.get(command.id);
    if (!taskTiming) return null;

    const timeLimit = context.timeLimit || 120;
    const elapsed = dayjs(command.time).diff(dayjs(taskTiming.startTime), 'second');

    if (elapsed > timeLimit) {
      const riskId = `park_timeout_${command.id}_${dayjs(command.time).valueOf()}`;
      
      if (this.detectedRiskIds.has(riskId)) return null;
      this.detectedRiskIds.add(riskId);

      return {
        id: riskId,
        type: RISK_TYPES.PARK_TIMEOUT,
        time: command.time,
        description: `入库任务 ${command.id} 超时`,
        details: {
          taskId: command.id,
          vehicleId: command.vehicleId,
          startTime: taskTiming.startTime,
          currentTime: command.time,
          elapsedSeconds: elapsed,
          timeLimit: timeLimit,
          lineNumber: command.lineNumber
        },
        position: context.vehiclePosition || { x: 0, y: 0, z: 0 }
      };
    }

    return null;
  }

  detectOvercapacity(command, context) {
    if (!command.vehicleId) return null;

    const vehicleWeight = context.vehicleWeight || 1500;
    const maxCapacity = context.maxCapacity || 2500;

    if (vehicleWeight > maxCapacity) {
      const riskId = `overcapacity_${command.vehicleId}_${dayjs(command.time).valueOf()}`;
      
      if (this.detectedRiskIds.has(riskId)) return null;
      this.detectedRiskIds.add(riskId);

      return {
        id: riskId,
        type: RISK_TYPES.DEVICE_OVERCAPACITY,
        time: command.time,
        description: `车辆 ${command.vehicleId} 超重`,
        details: {
          vehicleId: command.vehicleId,
          vehicleWeight: vehicleWeight,
          maxCapacity: maxCapacity,
          overWeight: vehicleWeight - maxCapacity,
          commandId: command.id,
          lineNumber: command.lineNumber
        },
        position: context.vehiclePosition || { x: 0, y: 0, z: 0 }
      };
    }

    return null;
  }

  processCommand(command, context = {}) {
    const newRisks = [];

    const slotConflict = this.detectSlotConflict(command, context);
    if (slotConflict) newRisks.push(slotConflict);

    const elevatorConflict = this.detectElevatorConflict(command, context);
    if (elevatorConflict) newRisks.push(elevatorConflict);

    const pathBlocked = this.detectPathBlocked(command, context);
    if (pathBlocked) newRisks.push(pathBlocked);

    const pickupTimeout = this.detectPickupTimeout(command, context);
    if (pickupTimeout) newRisks.push(pickupTimeout);

    const parkTimeout = this.detectParkTimeout(command, context);
    if (parkTimeout) newRisks.push(parkTimeout);

    const overcapacity = this.detectOvercapacity(command, context);
    if (overcapacity) newRisks.push(overcapacity);

    this.risks.push(...newRisks);
    return newRisks;
  }

  getAllRisks() {
    return [...this.risks].sort((a, b) => 
      dayjs(a.time).valueOf() - dayjs(b.time).valueOf()
    );
  }

  getRisksByType(typeId) {
    return this.risks.filter(r => r.type.id === typeId);
  }

  getRisksBySeverity(severity) {
    return this.risks.filter(r => r.type.severity === severity);
  }

  getRisksAtTime(time) {
    const targetTime = dayjs(time);
    return this.risks.filter(r => {
      const riskTime = dayjs(r.time);
      return Math.abs(targetTime.diff(riskTime, 'second')) < 1;
    });
  }

  getRiskStatistics() {
    const stats = {
      total: this.risks.length,
      byType: {},
      bySeverity: {
        critical: 0,
        error: 0,
        warning: 0
      }
    };

    Object.values(RISK_TYPES).forEach(type => {
      stats.byType[type.id] = {
        name: type.name,
        count: 0,
        severity: type.severity
      };
    });

    this.risks.forEach(risk => {
      const typeId = risk.type.id;
      const severity = risk.type.severity;
      
      if (stats.byType[typeId]) {
        stats.byType[typeId].count++;
      }
      stats.bySeverity[severity]++;
    });

    return stats;
  }

  exportToJSON() {
    return {
      version: '1.0',
      exportTime: dayjs().toISOString(),
      totalRisks: this.risks.length,
      statistics: this.getRiskStatistics(),
      risks: this.risks.map(risk => ({
        id: risk.id,
        type: risk.type.id,
        typeName: risk.type.name,
        severity: risk.type.severity,
        time: risk.time,
        description: risk.description,
        details: risk.details,
        position: risk.position
      }))
    };
  }
}

export const riskDetector = new RiskDetector();
