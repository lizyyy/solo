export interface WorkspacePackage {
    name: string;
    version: string;
    path: string;
    isPrivate: boolean;
    license: string | null;
}
export declare function detectWorkspacePackages(cwd: string): Promise<Map<string, WorkspacePackage>>;
export declare function isWorkspacePackage(packageName: string, workspacePackages: Map<string, WorkspacePackage>): WorkspacePackage | null;
export declare function findLicenseFile(packagePath: string): string | null;
export declare function readLicenseText(licensePath: string): string | null;
