import { Employee, SalaryDetail, EmploymentRecord, CityRule, HistoricalDeclaration, CalculationResult, CheckResultItem } from '../types';
export declare class CalculationService {
    private employees;
    private salaries;
    private employmentRecords;
    private cityRules;
    private historicalDeclarations;
    private declarationYear;
    private declarationMonth;
    constructor(employees: Employee[], salaries: SalaryDetail[], employmentRecords: EmploymentRecord[], cityRules: CityRule[], historicalDeclarations: HistoricalDeclaration[], declarationYear: number, declarationMonth: number);
    calculateAll(): CalculationResult[];
    calculateOne(employee: Employee): CalculationResult;
    checkDataIntegrity(): CheckResultItem[];
    private getCurrentCity;
    private getCityRule;
    private getHireRecord;
    private getResignationRecord;
    private getTransferRecord;
    private getEffectiveMonths;
    private useProbationSalary;
    private calculateAverageSalary;
}
