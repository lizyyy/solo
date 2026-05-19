import { Patient, Escort, Task, SensitiveFieldType } from '../models/types';
export declare function maskName(name: string): string;
export declare function maskIdCard(idCard: string): string;
export declare function maskPhone(phone: string): string;
export declare function maskPatient(patient: Patient, fields?: SensitiveFieldType[]): Patient;
export declare function maskEscort(escort: Escort, fields?: SensitiveFieldType[]): Escort;
export declare function maskTask(task: Task, fields?: SensitiveFieldType[]): Task;
export declare function maskTaskList(tasks: Task[], fields?: SensitiveFieldType[]): Task[];
export declare function maskEscortList(escorts: Escort[], fields?: SensitiveFieldType[]): Escort[];
export declare function createSensitiveLogger(): {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, data?: any) => void;
};
