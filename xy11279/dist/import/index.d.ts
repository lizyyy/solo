import { Vehicle, Charger, Task, ImportResult } from '../types';
export declare function importVehiclesFromCSV(filePath: string): Promise<ImportResult<Vehicle>>;
export declare function importChargersFromJSON(filePath: string): Promise<ImportResult<Charger>>;
export declare function importTasksFromCSV(filePath: string): Promise<ImportResult<Task>>;
