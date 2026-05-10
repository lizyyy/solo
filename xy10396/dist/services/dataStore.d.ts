import { DeliveryOrder, ElevatorInfo, InstallationRecord, MissingPartRecord, RescheduleRecord, DamageCompensation, ProcessedData } from '../types';
export declare class DataStore {
    private dataDir;
    private data;
    constructor(dataDir?: string);
    private ensureDataDirectory;
    private loadFromDisk;
    private loadFromArray;
    private saveToDisk;
    private flattenMap;
    importOrder(order: DeliveryOrder): void;
    importOrders(orders: DeliveryOrder[]): {
        imported: number;
        errors: string[];
    };
    importElevator(elevator: ElevatorInfo): void;
    importInstallation(installation: InstallationRecord): void;
    importMissingPart(missingPart: MissingPartRecord): void;
    importReschedule(reschedule: RescheduleRecord): void;
    importCompensation(compensation: DamageCompensation): void;
    getOrder(orderId: string): DeliveryOrder | undefined;
    getAllOrders(): DeliveryOrder[];
    getElevator(orderId: string): ElevatorInfo | undefined;
    getInstallations(orderId: string): InstallationRecord[];
    getMissingParts(orderId: string): MissingPartRecord[];
    getReschedules(orderId: string): RescheduleRecord[];
    getCompensations(orderId: string): DamageCompensation[];
    getAllCompensations(): DamageCompensation[];
    getData(): ProcessedData;
    hasCompensation(orderId: string, itemId: string, damageType: string): boolean;
    updateAbnormalityResolution(orderId: string, abnormalityType: string, resolution: string): void;
}
