import { Defect } from '../types';
export interface SampleScenario {
    name: string;
    description: string;
    batchNumber: string;
    productCode: string;
    productName: string;
    quantity: number;
    productionDate: string;
    productionLine: string;
    initialInspection: {
        sheetNumber: string;
        sampleCount: number;
        defects: Defect[];
        inspector: string;
        notes: string;
    };
    reinspection?: {
        sheetNumber: string;
        sampleCount: number;
        defects: Defect[];
        inspector: string;
        notes: string;
    };
    concession?: {
        reason: string;
        justification: string;
        riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        requestedBy: string;
        approvedBy: string;
        approvalNotes: string;
    };
    rework?: {
        approvedBy: string;
        reason: string;
    };
    closedBy: string;
    expectedFinalStatus: string;
}
export declare const SCENARIO_PASS_ON_FIRST: SampleScenario;
export declare const SCENARIO_REINSPECTION_PASS: SampleScenario;
export declare const SCENARIO_CONCESSION: SampleScenario;
export declare const SCENARIO_REWORK: SampleScenario;
export declare const ALL_SCENARIOS: SampleScenario[];
