import { Command } from 'commander';
export declare function formatDate(timestamp: number): string;
export declare function printTask(task: any, showSensitive?: boolean): void;
export declare function getStatusColor(status: string): string;
export declare function getPriorityColor(priority: string): string;
export declare function printTaskList(tasks: any[], showSensitive?: boolean): void;
export declare function printEscortList(escorts: any[], showSensitive?: boolean): void;
export declare function printStats(stats: any): void;
export declare function setupCommands(): Command;
