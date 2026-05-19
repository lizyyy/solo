import { Shift, ShiftType, Task, Vehicle, VehicleStatus, Charger, ChargerStatus, TaskStatus, ExceptionType } from '../types';
import { getShiftByDateAndType, addShift, updateShift, getTasks, getVehicles, getChargers, updateTask, updateVehicle, updateCharger, addException, getShiftById } from '../db';

export interface ScheduleParams {
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  operatorIds: string[];
}

export async function createShiftSchedule(params: ScheduleParams): Promise<Shift> {
  const existingShift = await getShiftByDateAndType(params.date, params.shiftType);
  if (existingShift) {
    throw new Error(`该日期的 ${params.shiftType} 班次已存在`);
  }
  
  const pendingTasks = (await getTasks()).filter(t => t.status === TaskStatus.PENDING);
  const availableVehicles = (await getVehicles()).filter(v => v.status === VehicleStatus.AVAILABLE);
  const availableChargers = (await getChargers()).filter(c => c.status === ChargerStatus.AVAILABLE);
  
  const sortedTasks = [...pendingTasks].sort((a, b) => b.priority - a.priority);
  
  const vehicleAssignments: Shift['vehicleAssignments'] = [];
  const chargerReservations: Shift['chargerReservations'] = [];
  
  let vehicleIndex = 0;
  for (const task of sortedTasks) {
    if (vehicleIndex >= availableVehicles.length) break;
    
    const vehicle = availableVehicles[vehicleIndex];
    
    if (vehicle.batteryLevel < task.requiredBattery) {
      const availableCharger = availableChargers.find(c => 
        !chargerReservations.some(r => r.chargerId === c.id)
      );
      
      if (availableCharger) {
        chargerReservations.push({
          chargerId: availableCharger.id,
          vehicleId: vehicle.id,
          startTime: params.startTime,
          endTime: params.endTime
        });
      }
      continue;
    }
    
    let assignment = vehicleAssignments.find(a => a.vehicleId === vehicle.id);
    if (!assignment) {
      assignment = { vehicleId: vehicle.id, taskIds: [] };
      vehicleAssignments.push(assignment);
    }
    
    assignment.taskIds.push(task.id);
    await updateTask(task.id, { 
      status: TaskStatus.ASSIGNED, 
      assignedVehicleId: vehicle.id,
      shiftId: ''
    });
    
    if (assignment.taskIds.length >= 3) {
      vehicleIndex++;
    }
  }
  
  const shift = await addShift({
    date: params.date,
    type: params.shiftType,
    startTime: params.startTime,
    endTime: params.endTime,
    operatorIds: params.operatorIds,
    vehicleAssignments,
    chargerReservations,
    status: 'planned'
  });
  
  for (const assignment of vehicleAssignments) {
    for (const taskId of assignment.taskIds) {
      await updateTask(taskId, { shiftId: shift.id });
    }
  }
  
  return shift;
}

export async function lockVehicle(vehicleId: string, taskId: string): Promise<void> {
  const vehicle = await getVehicles().then(vs => vs.find(v => v.id === vehicleId));
  if (!vehicle) {
    throw new Error('车辆不存在');
  }
  
  if (vehicle.status !== VehicleStatus.AVAILABLE) {
    throw new Error(`车辆状态为 ${vehicle.status}，无法锁定`);
  }
  
  await updateVehicle(vehicleId, { 
    status: VehicleStatus.IN_USE, 
    currentTaskId: taskId 
  });
}

export async function releaseVehicle(vehicleId: string, batteryDrained: number = 0): Promise<void> {
  const vehicle = await getVehicles().then(vs => vs.find(v => v.id === vehicleId));
  if (!vehicle) {
    throw new Error('车辆不存在');
  }
  
  const newBatteryLevel = Math.max(0, vehicle.batteryLevel - batteryDrained);
  
  if (newBatteryLevel < 20) {
    const availableCharger = (await getChargers()).find(c => c.status === ChargerStatus.AVAILABLE);
    if (availableCharger) {
      await updateCharger(availableCharger.id, { 
        status: ChargerStatus.OCCUPIED, 
        currentVehicleId: vehicleId 
      });
      await updateVehicle(vehicleId, { 
        status: VehicleStatus.CHARGING, 
        currentTaskId: undefined,
        currentChargerId: availableCharger.id,
        batteryLevel: newBatteryLevel
      });
      return;
    }
  }
  
  await updateVehicle(vehicleId, { 
    status: VehicleStatus.AVAILABLE, 
    currentTaskId: undefined,
    batteryLevel: newBatteryLevel
  });
}

export async function lockCharger(chargerId: string, vehicleId: string): Promise<void> {
  const charger = await getChargers().then(cs => cs.find(c => c.id === chargerId));
  if (!charger) {
    throw new Error('充电桩不存在');
  }
  
  if (charger.status !== ChargerStatus.AVAILABLE) {
    throw new Error(`充电桩状态为 ${charger.status}，无法锁定`);
  }
  
  await updateCharger(chargerId, { 
    status: ChargerStatus.OCCUPIED, 
    currentVehicleId: vehicleId 
  });
}

export async function releaseCharger(chargerId: string): Promise<void> {
  const charger = await getChargers().then(cs => cs.find(c => c.id === chargerId));
  if (!charger) {
    throw new Error('充电桩不存在');
  }
  
  if (charger.currentVehicleId) {
    await updateVehicle(charger.currentVehicleId, { 
      status: VehicleStatus.AVAILABLE, 
      currentChargerId: undefined 
    });
  }
  
  await updateCharger(chargerId, { 
    status: ChargerStatus.AVAILABLE, 
    currentVehicleId: undefined 
  });
}

export async function reportException(params: {
  shiftId: string;
  type: ExceptionType;
  vehicleId?: string;
  chargerId?: string;
  taskId?: string;
  description: string;
}): Promise<void> {
  await addException({
    shiftId: params.shiftId,
    type: params.type,
    vehicleId: params.vehicleId,
    chargerId: params.chargerId,
    taskId: params.taskId,
    description: params.description
  });
  
  if (params.taskId) {
    await updateTask(params.taskId, { status: TaskStatus.EXCEPTION });
  }
  
  if (params.vehicleId) {
    await updateVehicle(params.vehicleId, { status: VehicleStatus.MAINTENANCE });
  }
  
  if (params.chargerId) {
    await updateCharger(params.chargerId, { status: ChargerStatus.MAINTENANCE });
  }
}

export async function startShift(shiftId: string): Promise<void> {
  const shift = await getShiftById(shiftId);
  if (!shift) {
    throw new Error('班次不存在');
  }
  
  await updateShift(shiftId, { status: 'active' });
  
  for (const reservation of shift.chargerReservations) {
    await lockCharger(reservation.chargerId, reservation.vehicleId);
  }
}

export async function completeShift(shiftId: string): Promise<void> {
  const shift = await getShiftById(shiftId);
  if (!shift) {
    throw new Error('班次不存在');
  }
  
  await updateShift(shiftId, { status: 'completed' });
  
  for (const assignment of shift.vehicleAssignments) {
    await releaseVehicle(assignment.vehicleId);
  }
  
  for (const reservation of shift.chargerReservations) {
    await releaseCharger(reservation.chargerId);
  }
  
  const shiftTasks = (await getTasks()).filter(t => t.shiftId === shiftId);
  for (const task of shiftTasks) {
    if (task.status === TaskStatus.ASSIGNED || task.status === TaskStatus.IN_PROGRESS) {
      await updateTask(task.id, { status: TaskStatus.COMPLETED, endTime: new Date().toISOString() });
    }
  }
}
