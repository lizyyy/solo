import { Sample, Material } from '../types';
export declare const createSample: (data: Partial<Sample>) => Sample;
export declare const createMaterial: (data: Partial<Material>) => Material;
export declare const readJsonFile: <T>(filePath: string) => T | null;
export declare const writeJsonFile: (filePath: string, data: any) => void;
