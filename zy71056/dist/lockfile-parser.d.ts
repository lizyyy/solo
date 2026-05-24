export interface LockfilePackage {
    name: string;
    version: string;
    license?: string;
    dependencies?: Record<string, string>;
}
export declare function parseLockfile(cwd: string): Map<string, LockfilePackage>;
