import * as fs from 'fs';
import * as path from 'path';
import { PhysicsProblem, ProblemRecord, PhysicsProblemType } from '../../../shared/types';
import { seedProblems } from './seedProblems';

const DATA_DIR = path.join(__dirname, '../../../data');
const PROBLEMS_FILE = path.join(DATA_DIR, 'problems.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readProblems(): ProblemRecord[] {
  ensureDataDir();
  
  if (!fs.existsSync(PROBLEMS_FILE)) {
    const initialProblems: ProblemRecord[] = seedProblems.map(p => ({
      ...p,
      solution: undefined,
    }));
    writeProblems(initialProblems);
    return initialProblems;
  }

  try {
    const content = fs.readFileSync(PROBLEMS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    const initialProblems: ProblemRecord[] = seedProblems.map(p => ({
      ...p,
      solution: undefined,
    }));
    writeProblems(initialProblems);
    return initialProblems;
  }
}

function writeProblems(problems: ProblemRecord[]): void {
  ensureDataDir();
  fs.writeFileSync(PROBLEMS_FILE, JSON.stringify(problems, null, 2), 'utf-8');
}

export function getAllProblems(): ProblemRecord[] {
  return readProblems();
}

export function getProblemById(id: string): ProblemRecord | undefined {
  const problems = readProblems();
  return problems.find(p => p.id === id);
}

export function getProblemsByType(type: PhysicsProblemType): ProblemRecord[] {
  const problems = readProblems();
  return problems.filter(p => p.type === type);
}

export function createProblem(problem: Omit<PhysicsProblem, 'id' | 'createdAt' | 'updatedAt'>): ProblemRecord {
  const problems = readProblems();
  const newProblem: ProblemRecord = {
    ...problem,
    id: `prob-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    solution: undefined,
  };
  problems.push(newProblem);
  writeProblems(problems);
  return newProblem;
}

export function updateProblem(id: string, updates: Partial<ProblemRecord>): ProblemRecord | undefined {
  const problems = readProblems();
  const index = problems.findIndex(p => p.id === id);
  
  if (index === -1) {
    return undefined;
  }

  problems[index] = {
    ...problems[index],
    ...updates,
    id: problems[index].id,
    updatedAt: Date.now(),
  };
  
  writeProblems(problems);
  return problems[index];
}

export function deleteProblem(id: string): boolean {
  const problems = readProblems();
  const index = problems.findIndex(p => p.id === id);
  
  if (index === -1) {
    return false;
  }

  problems.splice(index, 1);
  writeProblems(problems);
  return true;
}

export function saveSolution(problemId: string, solution: any): ProblemRecord | undefined {
  return updateProblem(problemId, { 
    solution,
    updatedAt: Date.now(),
  });
}

export function resetToSeeds(): ProblemRecord[] {
  const initialProblems: ProblemRecord[] = seedProblems.map(p => ({
    ...p,
    solution: undefined,
  }));
  writeProblems(initialProblems);
  return initialProblems;
}
