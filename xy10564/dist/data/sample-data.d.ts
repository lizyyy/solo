import { Employee, SalaryDetail, EmploymentRecord, CityRule, HistoricalDeclaration } from '../types';
export declare const SAMPLE_EMPLOYEES: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>[];
export declare function generateSampleSalaries(employeeIdMap: Map<string, string>, year: number): Omit<SalaryDetail, 'id' | 'createdAt'>[];
export declare function generateSampleEmploymentRecords(employeeIdMap: Map<string, string>, year: number): Omit<EmploymentRecord, 'id' | 'createdAt'>[];
export declare const SAMPLE_CITY_RULES: CityRule[];
export declare function generateSampleHistoricalDeclarations(employeeIdMap: Map<string, string>, year: number): Omit<HistoricalDeclaration, 'id' | 'createdAt' | 'updatedAt'>[];
