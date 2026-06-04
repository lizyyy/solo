import { SurveyRawRow, BoundaryNote } from '../types';
export interface MutualInfoInput {
    answerValues: number[];
    targetLabels: number[];
}
export declare function calculateMutualInformation(input: MutualInfoInput): number;
export declare function calculateMutualInfoForRow(row: SurveyRawRow, allRows: SurveyRawRow[], boundaryNotes: BoundaryNote[]): {
    score: number;
    threshold: number;
    isAtThreshold: boolean;
};
export declare function evaluateBoundaryCondition(answerValue: number, note: BoundaryNote): boolean;
export declare function calculateCorrelationScore(row: SurveyRawRow, notes: BoundaryNote[]): number;
