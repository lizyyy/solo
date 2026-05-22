import { ImportOptions } from '../services/importer';
export declare function importCommand(filePaths: string[], workDir: string, options: ImportOptions & {
    batch?: string;
    mode?: string;
}): Promise<void>;
