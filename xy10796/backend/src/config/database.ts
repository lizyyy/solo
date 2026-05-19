import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

const dbFile = path.resolve('db.json');

export interface DatabaseSchema {
  environments: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
    baseUrl?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
  datasets: Array<{
    id: string;
    version: string;
    name: string;
    description?: string;
    status: string;
    recordCount: number;
    importOrder: number;
    schema?: Record<string, any>;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
  tasks: Array<{
    id: string;
    idempotencyKey: string;
    environmentId: string;
    datasetId: string;
    status: string;
    importOrder: number;
    retryCount: number;
    maxRetries: number;
    totalRecords: number;
    successRecords: number;
    failedRecords: number;
    errorMessage?: string;
    startedAt?: string;
    completedAt?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
  seedRecords: Array<{
    id: string;
    taskId: string;
    recordId: string;
    recordData: Record<string, any>;
    status: string;
    errorMessage?: string;
    importedAt?: string;
    rolledBackAt?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  rollbackRecords: Array<{
    id: string;
    taskId: string;
    reason: string;
    reviewedBy?: string;
    reviewComment?: string;
    status: string;
    rolledBackRecords: number;
    errorMessage?: string;
    startedAt?: string;
    completedAt?: string;
    reviewedAt?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
  cleanupStrategies: Array<{
    id: string;
    name: string;
    description?: string;
    environmentId: string;
    cleanupType: string;
    retentionDays: number;
    status: string;
    lastExecutedAt?: string;
    errorMessage?: string;
    correctionPath?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
}

const defaultData: DatabaseSchema = {
  environments: [],
  datasets: [],
  tasks: [],
  seedRecords: [],
  rollbackRecords: [],
  cleanupStrategies: [],
};

const adapter = new JSONFile<DatabaseSchema>(dbFile);
export const db = new Low(adapter, defaultData);

export const connectDB = async () => {
  await db.read();
  console.log('Database connected successfully');
};
