import {
  PhysicsProblemType,
  PhysicsParameter,
  PhysicsSolution,
  ProblemRecord,
  ValidationResult,
  ExportOptions,
} from '../../../shared/types';

const API_BASE = '/api';

export async function fetchHealth(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json();
}

export async function fetchProblemTypes(): Promise<{
  type: PhysicsProblemType;
  label: string;
  description: string;
  defaultParams: PhysicsParameter[];
}[]> {
  const response = await fetch(`${API_BASE}/problems/types`);
  if (!response.ok) {
    throw new Error('Failed to fetch problem types');
  }
  const data = await response.json();
  return data.types;
}

export async function fetchDefaultParams(type: PhysicsProblemType): Promise<PhysicsParameter[]> {
  const response = await fetch(`${API_BASE}/problems/types/${type}/defaults`);
  if (!response.ok) {
    throw new Error('Failed to fetch default parameters');
  }
  const data = await response.json();
  return data.defaultParams;
}

export async function fetchAllProblems(type?: PhysicsProblemType): Promise<ProblemRecord[]> {
  const url = type 
    ? `${API_BASE}/problems?type=${type}`
    : `${API_BASE}/problems`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch problems');
  }
  const data = await response.json();
  return data.problems;
}

export async function fetchProblem(id: string): Promise<ProblemRecord> {
  const response = await fetch(`${API_BASE}/problems/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch problem');
  }
  const data = await response.json();
  return data.problem;
}

export async function createProblem(problem: {
  type: PhysicsProblemType;
  title: string;
  description: string;
  parameters: PhysicsParameter[];
  notes?: string;
}): Promise<ProblemRecord> {
  const response = await fetch(`${API_BASE}/problems`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(problem),
  });
  if (!response.ok) {
    throw new Error('Failed to create problem');
  }
  const data = await response.json();
  return data.problem;
}

export async function updateProblem(
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    parameters: PhysicsParameter[];
    notes: string;
  }>
): Promise<ProblemRecord> {
  const response = await fetch(`${API_BASE}/problems/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error('Failed to update problem');
  }
  const data = await response.json();
  return data.problem;
}

export async function deleteProblem(id: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/problems/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete problem');
  }
  const data = await response.json();
  return data.success;
}

export interface SolveResult {
  success: boolean;
  solution?: PhysicsSolution;
  validation: ValidationResult;
}

export async function solveProblem(id: string, parameters?: PhysicsParameter[]): Promise<SolveResult> {
  const response = await fetch(`${API_BASE}/problems/${id}/solve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: parameters ? JSON.stringify({ parameters }) : undefined,
  });
  
  const data = await response.json();
  return data;
}

export async function solveQuick(
  type: PhysicsProblemType,
  parameters: PhysicsParameter[]
): Promise<SolveResult> {
  const response = await fetch(`${API_BASE}/problems/solve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type, parameters }),
  });
  
  const data = await response.json();
  return data;
}

export async function exportProblem(
  id: string,
  options: ExportOptions & { format: string }
): Promise<Blob> {
  const response = await fetch(`${API_BASE}/problems/${id}/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });
  
  if (!response.ok) {
    throw new Error('Failed to export problem');
  }
  
  return response.blob();
}

export async function resetToSeeds(): Promise<{ success: boolean; count: number }> {
  const response = await fetch(`${API_BASE}/problems/reset`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to reset problems');
  }
  return response.json();
}
