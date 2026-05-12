import { ImportType } from "../utils/importer";
export interface ImportOptions {
    dataDir?: string;
    operator?: string;
}
export declare function runImport(type: ImportType, filePath: string, options?: ImportOptions): void;
