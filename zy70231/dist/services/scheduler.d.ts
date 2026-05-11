import { Storage } from '../store/storage';
import { ScheduledTask, Conflict, RunState } from '../types/models';
export declare class Scheduler {
    private storage;
    constructor(storage: Storage);
    private parseTime;
    private formatTime;
    private timeOverlaps;
    private windowsOverlap;
    private canFitTaskInWindow;
    private findTimeSlot;
    private checkResourceAvailability;
    private addResourceOccupancy;
    run(): RunState;
    getScheduledTasks(): ScheduledTask[];
    getConflicts(): Conflict[];
    getRunHistory(): RunState[];
}
