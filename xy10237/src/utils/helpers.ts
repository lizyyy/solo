import { Sample, Material, MaterialType, SampleType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

export const createSample = (data: Partial<Sample>): Sample => {
  const now = new Date().toISOString();
  return {
    id: data.id || uuidv4(),
    name: data.name || `样品-${Date.now()}`,
    type: (data.type || 'general') as SampleType,
    description: data.description || '',
    originCountry: data.originCountry || 'CN',
    destinationCountry: data.destinationCountry || 'US',
    value: data.value || 0,
    currency: data.currency || 'USD',
    quantity: data.quantity || 1,
    materials: data.materials || [],
    createdAt: data.createdAt || now,
    updatedAt: now
  };
};

export const createMaterial = (data: Partial<Material>): Material => {
  return {
    id: data.id || uuidv4(),
    type: (data.type || 'invoice') as MaterialType,
    name: data.name || '',
    filePath: data.filePath || '',
    uploadedAt: data.uploadedAt || new Date().toISOString(),
    valid: data.valid !== undefined ? data.valid : true,
    notes: data.notes
  };
};

export const readJsonFile = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
};

export const writeJsonFile = (filePath: string, data: any): void => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};
