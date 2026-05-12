export interface ImportOptions {
    storePath?: string;
    file?: string;
    sample?: boolean;
    failure?: boolean;
    overwrite?: boolean;
    operator: string;
}
export declare function importCommand(options: ImportOptions): void;
