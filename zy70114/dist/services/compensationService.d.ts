import { Compensation, CompensationStatus, CompensationType, LiabilityParty, TargetParty } from '../types';
export declare const COMPENSATION_RULES: Record<LiabilityParty, {
    type: CompensationType;
    target: TargetParty;
    base: number;
    perMinute: number;
    min: number;
    max: number;
}[]>;
export declare const getCompensationTypeName: (type: CompensationType) => string;
export declare const getCompensationStatusName: (status: CompensationStatus) => string;
export declare const calculateCompensation: (rule: (typeof COMPENSATION_RULES)["merchant"][0], overtimeMinutes: number, orderAmount: number) => number;
export declare const generateCompensations: (orderId: string, orderAmount: number, operatorId: string, operatorRole: string) => Compensation[];
export declare const getCompensations: (orderId: string) => Compensation[];
export declare const getCompensationById: (compensationId: string) => Compensation;
export declare const updateCompensationStatus: (compensationId: string, newStatus: CompensationStatus, operatorId: string, operatorRole: string, remark?: string) => Compensation;
export declare const approveCompensation: (compensationId: string, operatorId: string, operatorRole: string) => Compensation;
export declare const rejectCompensation: (compensationId: string, reason: string, operatorId: string, operatorRole: string) => Compensation;
export declare const executeCompensation: (compensationId: string, operatorId: string, operatorRole: string) => Compensation;
