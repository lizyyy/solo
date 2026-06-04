import { ParameterTable, ParameterRecord, CounterExample, ExampleRecord, Conflict, ForecastResult, WorkflowState } from '../../shared/types';
import fs from 'fs/promises';
import path from 'path';

const readJSONFile = async <T>(filename: string): Promise<T> => {
  const filePath = path.resolve(process.cwd(), 'data', filename);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
};

const writeJSONFile = async <T>(filename: string, data: T): Promise<void> => {
  const filePath = path.resolve(process.cwd(), 'data', filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

export const getParameterTables = async (): Promise<ParameterTable[]> => {
  const data = await readJSONFile<{ tables: ParameterTable[]; records: ParameterRecord[] }>('parameters.json');
  return data.tables;
};

export const getParameterRecords = async (): Promise<ParameterRecord[]> => {
  const data = await readJSONFile<{ tables: ParameterTable[]; records: ParameterRecord[] }>('parameters.json');
  return data.records;
};

export const saveParameterTable = async (table: ParameterTable, records: ParameterRecord[]): Promise<void> => {
  const data = await readJSONFile<{ tables: ParameterTable[]; records: ParameterRecord[] }>('parameters.json');
  data.tables.push(table);
  data.records.push(...records);
  await writeJSONFile('parameters.json', data);
};

export const getCounterExamples = async (): Promise<CounterExample[]> => {
  const data = await readJSONFile<{ examples: CounterExample[]; records: ExampleRecord[] }>('counterExamples.json');
  return data.examples;
};

export const getExampleRecords = async (): Promise<ExampleRecord[]> => {
  const data = await readJSONFile<{ examples: CounterExample[]; records: ExampleRecord[] }>('counterExamples.json');
  return data.records;
};

export const saveCounterExample = async (example: CounterExample, records: ExampleRecord[]): Promise<void> => {
  const data = await readJSONFile<{ examples: CounterExample[]; records: ExampleRecord[] }>('counterExamples.json');
  data.examples.push(example);
  data.records.push(...records);
  await writeJSONFile('counterExamples.json', data);
};

export const getConflicts = async (): Promise<Conflict[]> => {
  return readJSONFile<Conflict[]>('conflicts.json');
};

export const saveConflicts = async (conflicts: Conflict[]): Promise<void> => {
  await writeJSONFile('conflicts.json', conflicts);
};

export const updateConflict = async (id: string, updates: Partial<Conflict>): Promise<Conflict | null> => {
  const conflicts = await getConflicts();
  const index = conflicts.findIndex(c => c.id === id);
  if (index === -1) return null;
  conflicts[index] = { ...conflicts[index], ...updates };
  await saveConflicts(conflicts);
  return conflicts[index];
};

export const getForecastResults = async (): Promise<ForecastResult[]> => {
  return readJSONFile<ForecastResult[]>('results.json');
};

export const saveForecastResults = async (results: ForecastResult[]): Promise<void> => {
  await writeJSONFile('results.json', results);
};

export const getWorkflowState = async (): Promise<WorkflowState | null> => {
  const data = await readJSONFile<Record<string, any>>('workflow.json');
  return Object.keys(data).length === 0 ? null : (data as WorkflowState);
};

export const saveWorkflowState = async (state: WorkflowState): Promise<void> => {
  await writeJSONFile('workflow.json', state);
};

export const checkDuplicateImport = async (tableId: string, productIds: string[]): Promise<number> => {
  const records = await getParameterRecords();
  const existingProductIds = new Set(
    records.filter(r => r.tableId !== tableId).map(r => r.productId)
  );
  return productIds.filter(id => existingProductIds.has(id)).length;
};
