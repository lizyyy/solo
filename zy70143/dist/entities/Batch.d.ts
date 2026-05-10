import 'reflect-metadata';
import { BatchStatus } from '../types';
export declare class Batch {
    id: string;
    name: string;
    code: string;
    description: string;
    status: BatchStatus;
    plannedDate: Date;
    deployedAt: Date;
    ownerId: string;
    ownerName: string;
    createdAt: Date;
    updatedAt: Date;
}
