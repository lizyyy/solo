import { FileEntry, FileCheckResult } from './types';
export declare class FileComparator {
    compare(repoPath: string, templatePath: string, fileEntry: FileEntry, templateContent: string | null): Promise<FileCheckResult>;
    private isContentMatch;
    private generateDiff;
    private generateId;
}
