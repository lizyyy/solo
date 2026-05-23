interface TasksOptions {
    status?: string;
    retry?: string;
    manual?: string;
}
export declare function tasksCommand(options: TasksOptions): Promise<number>;
export {};
