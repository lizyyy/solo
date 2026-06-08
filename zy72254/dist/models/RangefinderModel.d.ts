import { RangefinderRecord, Point3D } from '../types';
export declare function createRangefinderRecord(params: {
    obstructionId: string;
    measuredBy: string;
    distance: number;
    fromPoint: Point3D;
    toPoint: Point3D;
    notes?: string;
    accuracy?: number;
}): RangefinderRecord;
export declare function calculateDistance(from: Point3D, to: Point3D): number;
export declare function validateRangefinderRecord(record: RangefinderRecord): {
    valid: boolean;
    errors: string[];
};
