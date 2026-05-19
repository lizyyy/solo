"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShiftSchedule = createShiftSchedule;
exports.lockVehicle = lockVehicle;
exports.releaseVehicle = releaseVehicle;
exports.lockCharger = lockCharger;
exports.releaseCharger = releaseCharger;
exports.reportException = reportException;
exports.startShift = startShift;
exports.completeShift = completeShift;
const types_1 = require("../types");
const db_1 = require("../db");
async function createShiftSchedule(params) {
    const existingShift = await (0, db_1.getShiftByDateAndType)(params.date, params.shiftType);
    if (existingShift) {
        throw new Error(`该日期的 ${params.shiftType} 班次已存在`);
    }
    const pendingTasks = (await (0, db_1.getTasks)()).filter(t => t.status === types_1.TaskStatus.PENDING);
    const availableVehicles = (await (0, db_1.getVehicles)()).filter(v => v.status === types_1.VehicleStatus.AVAILABLE);
    const availableChargers = (await (0, db_1.getChargers)()).filter(c => c.status === types_1.ChargerStatus.AVAILABLE);
    const sortedTasks = [...pendingTasks].sort((a, b) => b.priority - a.priority);
    const vehicleAssignments = [];
    const chargerReservations = [];
    let vehicleIndex = 0;
    for (const task of sortedTasks) {
        if (vehicleIndex >= availableVehicles.length)
            break;
        const vehicle = availableVehicles[vehicleIndex];
        if (vehicle.batteryLevel < task.requiredBattery) {
            const availableCharger = availableChargers.find(c => !chargerReservations.some(r => r.chargerId === c.id));
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
        await (0, db_1.updateTask)(task.id, {
            status: types_1.TaskStatus.ASSIGNED,
            assignedVehicleId: vehicle.id,
            shiftId: ''
        });
        if (assignment.taskIds.length >= 3) {
            vehicleIndex++;
        }
    }
    const shift = await (0, db_1.addShift)({
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
            await (0, db_1.updateTask)(taskId, { shiftId: shift.id });
        }
    }
    return shift;
}
async function lockVehicle(vehicleId, taskId) {
    const vehicle = await (0, db_1.getVehicles)().then(vs => vs.find(v => v.id === vehicleId));
    if (!vehicle) {
        throw new Error('车辆不存在');
    }
    if (vehicle.status !== types_1.VehicleStatus.AVAILABLE) {
        throw new Error(`车辆状态为 ${vehicle.status}，无法锁定`);
    }
    await (0, db_1.updateVehicle)(vehicleId, {
        status: types_1.VehicleStatus.IN_USE,
        currentTaskId: taskId
    });
}
async function releaseVehicle(vehicleId, batteryDrained = 0) {
    const vehicle = await (0, db_1.getVehicles)().then(vs => vs.find(v => v.id === vehicleId));
    if (!vehicle) {
        throw new Error('车辆不存在');
    }
    const newBatteryLevel = Math.max(0, vehicle.batteryLevel - batteryDrained);
    if (newBatteryLevel < 20) {
        const availableCharger = (await (0, db_1.getChargers)()).find(c => c.status === types_1.ChargerStatus.AVAILABLE);
        if (availableCharger) {
            await (0, db_1.updateCharger)(availableCharger.id, {
                status: types_1.ChargerStatus.OCCUPIED,
                currentVehicleId: vehicleId
            });
            await (0, db_1.updateVehicle)(vehicleId, {
                status: types_1.VehicleStatus.CHARGING,
                currentTaskId: undefined,
                currentChargerId: availableCharger.id,
                batteryLevel: newBatteryLevel
            });
            return;
        }
    }
    await (0, db_1.updateVehicle)(vehicleId, {
        status: types_1.VehicleStatus.AVAILABLE,
        currentTaskId: undefined,
        batteryLevel: newBatteryLevel
    });
}
async function lockCharger(chargerId, vehicleId) {
    const charger = await (0, db_1.getChargers)().then(cs => cs.find(c => c.id === chargerId));
    if (!charger) {
        throw new Error('充电桩不存在');
    }
    if (charger.status !== types_1.ChargerStatus.AVAILABLE) {
        throw new Error(`充电桩状态为 ${charger.status}，无法锁定`);
    }
    await (0, db_1.updateCharger)(chargerId, {
        status: types_1.ChargerStatus.OCCUPIED,
        currentVehicleId: vehicleId
    });
}
async function releaseCharger(chargerId) {
    const charger = await (0, db_1.getChargers)().then(cs => cs.find(c => c.id === chargerId));
    if (!charger) {
        throw new Error('充电桩不存在');
    }
    if (charger.currentVehicleId) {
        await (0, db_1.updateVehicle)(charger.currentVehicleId, {
            status: types_1.VehicleStatus.AVAILABLE,
            currentChargerId: undefined
        });
    }
    await (0, db_1.updateCharger)(chargerId, {
        status: types_1.ChargerStatus.AVAILABLE,
        currentVehicleId: undefined
    });
}
async function reportException(params) {
    await (0, db_1.addException)({
        shiftId: params.shiftId,
        type: params.type,
        vehicleId: params.vehicleId,
        chargerId: params.chargerId,
        taskId: params.taskId,
        description: params.description
    });
    if (params.taskId) {
        await (0, db_1.updateTask)(params.taskId, { status: types_1.TaskStatus.EXCEPTION });
    }
    if (params.vehicleId) {
        await (0, db_1.updateVehicle)(params.vehicleId, { status: types_1.VehicleStatus.MAINTENANCE });
    }
    if (params.chargerId) {
        await (0, db_1.updateCharger)(params.chargerId, { status: types_1.ChargerStatus.MAINTENANCE });
    }
}
async function startShift(shiftId) {
    const shift = await (0, db_1.getShiftById)(shiftId);
    if (!shift) {
        throw new Error('班次不存在');
    }
    await (0, db_1.updateShift)(shiftId, { status: 'active' });
    for (const reservation of shift.chargerReservations) {
        await lockCharger(reservation.chargerId, reservation.vehicleId);
    }
}
async function completeShift(shiftId) {
    const shift = await (0, db_1.getShiftById)(shiftId);
    if (!shift) {
        throw new Error('班次不存在');
    }
    await (0, db_1.updateShift)(shiftId, { status: 'completed' });
    for (const assignment of shift.vehicleAssignments) {
        await releaseVehicle(assignment.vehicleId);
    }
    for (const reservation of shift.chargerReservations) {
        await releaseCharger(reservation.chargerId);
    }
    const shiftTasks = (await (0, db_1.getTasks)()).filter(t => t.shiftId === shiftId);
    for (const task of shiftTasks) {
        if (task.status === types_1.TaskStatus.ASSIGNED || task.status === types_1.TaskStatus.IN_PROGRESS) {
            await (0, db_1.updateTask)(task.id, { status: types_1.TaskStatus.COMPLETED, endTime: new Date().toISOString() });
        }
    }
}
