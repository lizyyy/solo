import { Escort } from '../models/types';
export declare class EscortService {
    createEscort(name: string, phone: string, employeeId: string): Escort;
    updateEscort(escortId: string, updates: Partial<Pick<Escort, 'name' | 'phone' | 'status'>>): Escort;
    getEscortById(escortId: string): Escort | undefined;
    getEscortByEmployeeId(employeeId: string): Escort | undefined;
    getAllEscorts(): Escort[];
    getAvailableEscorts(): Escort[];
    deleteEscort(escortId: string): void;
}
export declare const escortService: EscortService;
