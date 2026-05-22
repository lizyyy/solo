export declare function fixCommand(recordId: string, options: {
    field: string;
    value: string;
    reason: string;
    operator?: string;
    recheck?: boolean;
}): Promise<void>;
export declare function reimportCommand(recordId: string, options: {
    operator?: string;
}): Promise<void>;
