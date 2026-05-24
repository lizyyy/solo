import { ExceptionItem } from './types';
export declare function loadExceptions(filePath: string | undefined): ExceptionItem[];
export declare function isPackageExcepted(packageName: string, packageVersion: string, exceptions: ExceptionItem[]): ExceptionItem | null;
