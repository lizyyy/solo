import { PassengerLostItem, DriverTurnedInItem, WarehouseItem, ImportResult } from '../types';
export declare class CsvImporter {
    importPassengerLostItems(csvContent: string): Promise<ImportResult<PassengerLostItem>>;
    importDriverTurnedInItems(csvContent: string): Promise<ImportResult<DriverTurnedInItem>>;
    importWarehouseItems(csvContent: string): Promise<ImportResult<WarehouseItem>>;
    private parsePassengerRow;
    private parseDriverRow;
    private parseWarehouseRow;
    private normalizeDate;
}
