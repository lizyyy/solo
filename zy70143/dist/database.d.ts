import 'reflect-metadata';
import { DataSource } from 'typeorm';
export declare const AppDataSource: DataSource;
export declare function initializeDatabase(): Promise<DataSource>;
export declare function closeDatabase(): Promise<void>;
