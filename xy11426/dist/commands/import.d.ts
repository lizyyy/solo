interface ImportOptions {
    source: string;
    strategy?: string;
    operator?: string;
}
export declare function importCommand(filePath: string, options: ImportOptions): Promise<number>;
export declare function listCommand(): Promise<number>;
export {};
