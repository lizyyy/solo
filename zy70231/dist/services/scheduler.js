"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
const uuid_1 = require("uuid");
const date_fns_1 = require("date-fns");
class Scheduler {
    constructor(storage) {
        this.storage = storage;
    }
    parseTime(date, time) {
        return (0, date_fns_1.parse)(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    }
    formatTime(date) {
        return (0, date_fns_1.format)(date, 'HH:mm');
    }
    timeOverlaps(a, b, dateStr) {
        const aStart = this.parseTime(dateStr, a.start);
        const aEnd = this.parseTime(dateStr, a.end);
        const bStart = this.parseTime(dateStr, b.start);
        const bEnd = this.parseTime(dateStr, b.end);
        return aStart < bEnd && bStart < aEnd;
    }
    windowsOverlap(a, b) {
        if (a.date !== b.date)
            return false;
        return this.timeOverlaps(a.time, b.time, a.date);
    }
    canFitTaskInWindow(task, window) {
        const taskSections = new Set(task.requiredBlockSections);
        const windowSections = new Set(window.blockSections);
        const hasAllSections = task.requiredBlockSections.every(s => windowSections.has(s));
        if (!hasAllSections)
            return false;
        const windowStart = this.parseTime(window.date, window.time.start);
        const windowEnd = this.parseTime(window.date, window.time.end);
        const windowDuration = (0, date_fns_1.differenceInMinutes)(windowEnd, windowStart);
        return windowDuration >= task.estimatedDuration;
    }
    findTimeSlot(task, window, existingScheduled, requiredSections, workZoneId) {
        const windowStart = this.parseTime(window.date, window.time.start);
        const windowEnd = this.parseTime(window.date, window.time.end);
        const taskDuration = task.estimatedDuration;
        const occupiedSlots = [];
        for (const scheduled of existingScheduled) {
            if (scheduled.windowId !== window.id)
                continue;
            const schedStart = this.parseTime(window.date, scheduled.assignedTime.start);
            const schedEnd = this.parseTime(window.date, scheduled.assignedTime.end);
            const scheduledSections = new Set(scheduled.assignedBlockSections);
            const hasOverlapSection = requiredSections.some(s => scheduledSections.has(s));
            const sameWorkZone = scheduled.workZoneId === workZoneId;
            if (hasOverlapSection || sameWorkZone) {
                occupiedSlots.push({ start: schedStart, end: schedEnd });
            }
        }
        occupiedSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
        let current = windowStart;
        for (const slot of occupiedSlots) {
            const gap = (0, date_fns_1.differenceInMinutes)(slot.start, current);
            if (gap >= taskDuration) {
                const slotStart = current;
                const slotEnd = (0, date_fns_1.addMinutes)(current, taskDuration);
                return {
                    start: this.formatTime(slotStart),
                    end: this.formatTime(slotEnd),
                };
            }
            current = slot.end;
        }
        const finalGap = (0, date_fns_1.differenceInMinutes)(windowEnd, current);
        if (finalGap >= taskDuration) {
            const slotStart = current;
            const slotEnd = (0, date_fns_1.addMinutes)(current, taskDuration);
            return {
                start: this.formatTime(slotStart),
                end: this.formatTime(slotEnd),
            };
        }
        return null;
    }
    checkResourceAvailability(task, window, timeSlot, workZoneId) {
        const resourceAvail = new Map();
        for (const [id, res] of this.storage.db.resources) {
            if (res.workZoneId === workZoneId) {
                resourceAvail.set(res.id, res.quantity);
            }
        }
        for (const req of task.requiredResources) {
            if (!resourceAvail.has(req.resourceId)) {
                return {
                    available: false,
                    conflict: {
                        type: 'resource',
                        severity: 'error',
                        description: `任务需要资源 ${req.resourceId}，但工区 ${workZoneId} 没有该资源`,
                        affectedTasks: [task.id],
                    },
                };
            }
        }
        for (const [id, occ] of this.storage.db.resourceOccupancies) {
            if (occ.windowId !== window.id)
                continue;
            if (this.timeOverlaps(occ.time, timeSlot, window.date)) {
                const current = resourceAvail.get(occ.resourceId) || 0;
                resourceAvail.set(occ.resourceId, Math.max(0, current - occ.assignedQuantity));
            }
        }
        for (const req of task.requiredResources) {
            const available = resourceAvail.get(req.resourceId) || 0;
            if (available < req.quantity) {
                return {
                    available: false,
                    conflict: {
                        type: 'resource',
                        severity: 'error',
                        description: `天窗 ${window.date} ${window.time.start}-${window.time.end} 中资源 ${req.resourceId} 不足: 需要 ${req.quantity}, 可用 ${available}`,
                        affectedTasks: [task.id],
                    },
                };
            }
        }
        return { available: true };
    }
    addResourceOccupancy(task, window, timeSlot, scheduledTaskId, workZoneId) {
        for (const req of task.requiredResources) {
            const res = this.storage.db.resources.get(req.resourceId);
            if (!res)
                continue;
            const occupancy = {
                resourceId: req.resourceId,
                windowId: window.id,
                time: timeSlot,
                assignedQuantity: req.quantity,
                scheduledTaskId,
            };
            this.storage.db.resourceOccupancies.set((0, uuid_1.v4)(), occupancy);
        }
    }
    run() {
        const runState = this.storage.addRunState({
            status: 'running',
            stats: {
                totalWindows: this.storage.db.maintenanceWindows.size,
                totalTasks: this.storage.db.workTasks.size,
                scheduledTasks: 0,
                conflicts: 0,
            },
        });
        try {
            this.storage.clearRunData(runState.runId);
            const windows = Array.from(this.storage.db.maintenanceWindows.values())
                .sort((a, b) => {
                if (a.date !== b.date)
                    return a.date.localeCompare(b.date);
                return a.priority - b.priority;
            });
            const tasks = Array.from(this.storage.db.workTasks.values());
            const unscheduledTasks = new Set(tasks.map(t => t.id));
            const scheduledCount = { value: 0 };
            for (const window of windows) {
                const windowTasks = tasks.filter(task => unscheduledTasks.has(task.id) && this.canFitTaskInWindow(task, window));
                const existingScheduled = Array.from(this.storage.db.scheduledTasks.values());
                for (const task of windowTasks) {
                    if (!unscheduledTasks.has(task.id))
                        continue;
                    const workZoneId = task.workZoneId;
                    const timeSlot = this.findTimeSlot(task, window, existingScheduled, task.requiredBlockSections, workZoneId);
                    if (!timeSlot) {
                        continue;
                    }
                    const resourceCheck = this.checkResourceAvailability(task, window, timeSlot, workZoneId);
                    if (!resourceCheck.available) {
                        if (resourceCheck.conflict) {
                            this.storage.db.conflicts.push(resourceCheck.conflict);
                        }
                        continue;
                    }
                    const scheduledTask = {
                        id: (0, uuid_1.v4)(),
                        taskId: task.id,
                        windowId: window.id,
                        workZoneId: workZoneId,
                        assignedTime: timeSlot,
                        assignedResources: task.requiredResources.map(r => ({
                            resourceId: r.resourceId,
                            quantity: r.quantity,
                        })),
                        assignedBlockSections: [...task.requiredBlockSections],
                        status: 'scheduled',
                    };
                    this.storage.db.scheduledTasks.set(scheduledTask.id, scheduledTask);
                    this.addResourceOccupancy(task, window, timeSlot, scheduledTask.id, workZoneId);
                    unscheduledTasks.delete(task.id);
                    scheduledCount.value++;
                    existingScheduled.push(scheduledTask);
                }
            }
            for (const taskId of unscheduledTasks) {
                const task = this.storage.db.workTasks.get(taskId);
                if (!task)
                    continue;
                this.storage.db.conflicts.push({
                    type: 'time',
                    severity: 'error',
                    description: `任务 ${task.title} (${taskId}) 无法在任何可用天窗中安排`,
                    affectedTasks: [taskId],
                });
            }
            const finalState = {
                ...runState,
                status: 'completed',
                stats: {
                    ...runState.stats,
                    scheduledTasks: scheduledCount.value,
                    conflicts: this.storage.db.conflicts.length,
                },
            };
            this.storage.updateRunState(runState.runId, finalState);
            this.storage.save();
            return finalState;
        }
        catch (error) {
            this.storage.updateRunState(runState.runId, { status: 'failed' });
            this.storage.save();
            throw error;
        }
    }
    getScheduledTasks() {
        return Array.from(this.storage.db.scheduledTasks.values());
    }
    getConflicts() {
        return this.storage.db.conflicts;
    }
    getRunHistory() {
        return [...this.storage.db.runStates].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
}
exports.Scheduler = Scheduler;
//# sourceMappingURL=scheduler.js.map