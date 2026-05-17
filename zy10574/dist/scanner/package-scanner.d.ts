import { PackageInfo, AnomalySample } from '../types.js';
export declare function scanPackages(rootPath: string, options: {
    depth: number;
    includeDev: boolean;
}): Promise<{
    packages: PackageInfo[];
    anomalies: AnomalySample[];
}>;
