export declare function importCommand(filePath: string, options: {
    sourceType?: string;
    allowDuplicate?: boolean;
    skipCheck?: boolean;
    operator?: string;
}): Promise<void>;
export declare function checkCommand(options: {
    batchId?: string;
    recordId?: string;
    operator?: string;
}): Promise<void>;
