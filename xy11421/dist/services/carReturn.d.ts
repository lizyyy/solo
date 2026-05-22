import { CarReturnRecord } from '../types';
export declare function analyzeCarReturns(minReturns?: number): Promise<CarReturnRecord[]>;
export declare function getCarDetail(vin: string): Promise<any>;
export declare function getResponsiblePersonStats(): Promise<{
    person: string;
    carCount: number;
    returnCarCount: number;
    totalCost: number;
}[]>;
