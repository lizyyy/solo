import { v4 as uuidv4 } from 'uuid';
import { parse, format, addMinutes, differenceInMinutes, isSameDay } from 'date-fns';
import { Storage } from '../store/storage';
import { 
  TimeWindow, 
  MaintenanceWindow, 
  WorkTask, 
  ScheduledTask, 
  ResourceOccupancy,
  Conflict,
  RunState
} from '../types/models';

export class Scheduler {
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  private parseTime(date: string, time: string): Date {
    return parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
  }

  private formatTime(date: Date): string {
    return format(date, 'HH:mm');
  }

  private timeOverlaps(a: TimeWindow, b: TimeWindow, dateStr: string): boolean {
    const aStart = this.parseTime(dateStr, a.start);
    const aEnd = this.parseTime(dateStr, a.end);
    const bStart = this.parseTime(dateStr, b.start);
    const bEnd = this.parseTime(dateStr, b.end);
    
    return aStart < bEnd && bStart < aEnd;
  }

  private windowsOverlap(a: MaintenanceWindow, b: MaintenanceWindow): boolean {
    if (a.date !== b.date) return false;
    return this.timeOverlaps(a.time, b.time, a.date);
  }

  private canFitTaskInWindow(
    task: WorkTask, 
    window: MaintenanceWindow
  ): boolean {
    const taskSections = new Set(task.requiredBlockSections);
    const windowSections = new Set(window.blockSections);
    const hasAllSections = task.requiredBlockSections.every(s => windowSections.has(s));
    if (!hasAllSections) return false;

    const windowStart = this.parseTime(window.date, window.time.start);
    const windowEnd = this.parseTime(window.date, window.time.end);
    const windowDuration = differenceInMinutes(windowEnd, windowStart);
    
    return windowDuration >= task.estimatedDuration;
  }

  private findTimeSlot(
    task: WorkTask,
    window: MaintenanceWindow,
    existingScheduled: ScheduledTask[],
    requiredSections: string[],
    workZoneId: string
  ): TimeWindow | null {
    const windowStart = this.parseTime(window.date, window.time.start);
    const windowEnd = this.parseTime(window.date, window.time.end);
    const taskDuration = task.estimatedDuration;

    const occupiedSlots: { start: Date; end: Date }[] = [];
    
    for (const scheduled of existingScheduled) {
      if (scheduled.windowId !== window.id) continue;
      
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
      const gap = differenceInMinutes(slot.start, current);
      if (gap >= taskDuration) {
        const slotStart = current;
        const slotEnd = addMinutes(current, taskDuration);
        return {
          start: this.formatTime(slotStart),
          end: this.formatTime(slotEnd),
        };
      }
      current = slot.end;
    }

    const finalGap = differenceInMinutes(windowEnd, current);
    if (finalGap >= taskDuration) {
      const slotStart = current;
      const slotEnd = addMinutes(current, taskDuration);
      return {
        start: this.formatTime(slotStart),
        end: this.formatTime(slotEnd),
      };
    }

    return null;
  }

  private checkResourceAvailability(
    task: WorkTask,
    window: MaintenanceWindow,
    timeSlot: TimeWindow,
    workZoneId: string
  ): { available: boolean; conflict?: Conflict } {
    const resourceAvail = new Map<string, number>();
    
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
      if (occ.windowId !== window.id) continue;
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

  private addResourceOccupancy(
    task: WorkTask,
    window: MaintenanceWindow,
    timeSlot: TimeWindow,
    scheduledTaskId: string,
    workZoneId: string
  ): void {
    for (const req of task.requiredResources) {
      const res = this.storage.db.resources.get(req.resourceId);
      if (!res) continue;
      
      const occupancy: ResourceOccupancy = {
        resourceId: req.resourceId,
        windowId: window.id,
        time: timeSlot,
        assignedQuantity: req.quantity,
        scheduledTaskId,
      };
      this.storage.db.resourceOccupancies.set(uuidv4(), occupancy);
    }
  }

  run(): RunState {
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
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.priority - b.priority;
        });

      const tasks = Array.from(this.storage.db.workTasks.values());
      const unscheduledTasks = new Set<string>(tasks.map(t => t.id));
      const scheduledCount = { value: 0 };

      for (const window of windows) {
        const windowTasks = tasks.filter(task => 
          unscheduledTasks.has(task.id) && this.canFitTaskInWindow(task, window)
        );

        const existingScheduled = Array.from(this.storage.db.scheduledTasks.values());

        for (const task of windowTasks) {
          if (!unscheduledTasks.has(task.id)) continue;

          const workZoneId = task.workZoneId;
          
          const timeSlot = this.findTimeSlot(
            task, 
            window, 
            existingScheduled,
            task.requiredBlockSections,
            workZoneId
          );

          if (!timeSlot) {
            continue;
          }

          const resourceCheck = this.checkResourceAvailability(
            task, 
            window, 
            timeSlot,
            workZoneId
          );

          if (!resourceCheck.available) {
            if (resourceCheck.conflict) {
              this.storage.db.conflicts.push(resourceCheck.conflict);
            }
            continue;
          }

          const scheduledTask: ScheduledTask = {
            id: uuidv4(),
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
        if (!task) continue;
        
        this.storage.db.conflicts.push({
          type: 'time',
          severity: 'error',
          description: `任务 ${task.title} (${taskId}) 无法在任何可用天窗中安排`,
          affectedTasks: [taskId],
        });
      }

      const finalState = {
        ...runState,
        status: 'completed' as const,
        stats: {
          ...runState.stats,
          scheduledTasks: scheduledCount.value,
          conflicts: this.storage.db.conflicts.length,
        },
      };

      this.storage.updateRunState(runState.runId, finalState);
      this.storage.save();

      return finalState;
    } catch (error) {
      this.storage.updateRunState(runState.runId, { status: 'failed' });
      this.storage.save();
      throw error;
    }
  }

  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.storage.db.scheduledTasks.values());
  }

  getConflicts(): Conflict[] {
    return this.storage.db.conflicts;
  }

  getRunHistory(): RunState[] {
    return [...this.storage.db.runStates].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}
