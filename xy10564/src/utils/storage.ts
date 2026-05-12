import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import {
  Employee,
  SalaryDetail,
  EmploymentRecord,
  CityRule,
  HistoricalDeclaration,
  ManualCorrection,
  OperationLog,
  ProjectConfig,
} from '../types';

const DATA_FILES = {
  config: 'config.json',
  employees: 'employees.json',
  salaries: 'salaries.json',
  employmentRecords: 'employment-records.json',
  cityRules: 'city-rules.json',
  historicalDeclarations: 'historical-declarations.json',
  manualCorrections: 'manual-corrections.json',
  operationLogs: 'operation-logs.json',
};

export class StorageService {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = path.resolve(dataDir);
  }

  init(projectConfig: ProjectConfig): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const defaultData = {
      [DATA_FILES.config]: projectConfig,
      [DATA_FILES.employees]: [],
      [DATA_FILES.salaries]: [],
      [DATA_FILES.employmentRecords]: [],
      [DATA_FILES.cityRules]: [],
      [DATA_FILES.historicalDeclarations]: [],
      [DATA_FILES.manualCorrections]: [],
      [DATA_FILES.operationLogs]: [],
    };

    for (const [filename, content] of Object.entries(defaultData)) {
      const filePath = path.join(this.dataDir, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
      }
    }
  }

  exists(): boolean {
    return fs.existsSync(path.join(this.dataDir, DATA_FILES.config));
  }

  getConfig(): ProjectConfig {
    return this.readFile<ProjectConfig>(DATA_FILES.config);
  }

  updateConfig(partial: Partial<ProjectConfig>): ProjectConfig {
    const config = this.getConfig();
    const updated = {
      ...config,
      ...partial,
      updatedAt: dayjs().toISOString(),
    };
    this.writeFile(DATA_FILES.config, updated);
    return updated;
  }

  getEmployees(): Employee[] {
    return this.readFile<Employee[]>(DATA_FILES.employees);
  }

  saveEmployees(employees: Employee[]): void {
    this.writeFile(DATA_FILES.employees, employees);
  }

  addEmployee(employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Employee {
    const employees = this.getEmployees();
    const newEmployee: Employee = {
      ...employee,
      id: uuidv4(),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    };
    employees.push(newEmployee);
    this.saveEmployees(employees);
    return newEmployee;
  }

  getSalaries(): SalaryDetail[] {
    return this.readFile<SalaryDetail[]>(DATA_FILES.salaries);
  }

  saveSalaries(salaries: SalaryDetail[]): void {
    this.writeFile(DATA_FILES.salaries, salaries);
  }

  addSalary(salary: Omit<SalaryDetail, 'id' | 'createdAt'>): SalaryDetail {
    const salaries = this.getSalaries();
    const newSalary: SalaryDetail = {
      ...salary,
      id: uuidv4(),
      createdAt: dayjs().toISOString(),
    };
    salaries.push(newSalary);
    this.saveSalaries(salaries);
    return newSalary;
  }

  getEmploymentRecords(): EmploymentRecord[] {
    return this.readFile<EmploymentRecord[]>(DATA_FILES.employmentRecords);
  }

  saveEmploymentRecords(records: EmploymentRecord[]): void {
    this.writeFile(DATA_FILES.employmentRecords, records);
  }

  addEmploymentRecord(
    record: Omit<EmploymentRecord, 'id' | 'createdAt'>
  ): EmploymentRecord {
    const records = this.getEmploymentRecords();
    const newRecord: EmploymentRecord = {
      ...record,
      id: uuidv4(),
      createdAt: dayjs().toISOString(),
    };
    records.push(newRecord);
    this.saveEmploymentRecords(records);
    return newRecord;
  }

  getCityRules(): CityRule[] {
    return this.readFile<CityRule[]>(DATA_FILES.cityRules);
  }

  saveCityRules(rules: CityRule[]): void {
    this.writeFile(DATA_FILES.cityRules, rules);
  }

  addCityRule(rule: CityRule): void {
    const rules = this.getCityRules();
    rules.push(rule);
    this.saveCityRules(rules);
  }

  getHistoricalDeclarations(): HistoricalDeclaration[] {
    return this.readFile<HistoricalDeclaration[]>(DATA_FILES.historicalDeclarations);
  }

  saveHistoricalDeclarations(declarations: HistoricalDeclaration[]): void {
    this.writeFile(DATA_FILES.historicalDeclarations, declarations);
  }

  addHistoricalDeclaration(
    declaration: Omit<HistoricalDeclaration, 'id' | 'createdAt' | 'updatedAt'>
  ): HistoricalDeclaration {
    const declarations = this.getHistoricalDeclarations();
    const now = dayjs().toISOString();
    const newDeclaration: HistoricalDeclaration = {
      ...declaration,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    declarations.push(newDeclaration);
    this.saveHistoricalDeclarations(declarations);
    return newDeclaration;
  }

  getManualCorrections(): ManualCorrection[] {
    return this.readFile<ManualCorrection[]>(DATA_FILES.manualCorrections);
  }

  saveManualCorrections(corrections: ManualCorrection[]): void {
    this.writeFile(DATA_FILES.manualCorrections, corrections);
  }

  addManualCorrection(
    correction: Omit<ManualCorrection, 'id' | 'createdAt'>
  ): ManualCorrection {
    const corrections = this.getManualCorrections();
    const newCorrection: ManualCorrection = {
      ...correction,
      id: uuidv4(),
      createdAt: dayjs().toISOString(),
    };
    corrections.push(newCorrection);
    this.saveManualCorrections(corrections);
    return newCorrection;
  }

  getOperationLogs(): OperationLog[] {
    return this.readFile<OperationLog[]>(DATA_FILES.operationLogs);
  }

  saveOperationLogs(logs: OperationLog[]): void {
    this.writeFile(DATA_FILES.operationLogs, logs);
  }

  addOperationLog(
    log: Omit<OperationLog, 'id' | 'timestamp'>
  ): OperationLog {
    const logs = this.getOperationLogs();
    const newLog: OperationLog = {
      ...log,
      id: uuidv4(),
      timestamp: dayjs().toISOString(),
    };
    logs.push(newLog);
    this.saveOperationLogs(logs);
    return newLog;
  }

  private readFile<T>(filename: string): T {
    const filePath = path.join(this.dataDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  private writeFile<T>(filename: string, data: T): void {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  getDataDir(): string {
    return this.dataDir;
  }
}
