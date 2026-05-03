import * as fs from 'fs';
import { SwapEvent } from '../types';

export function readJsonlFile<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  return lines.map(line => JSON.parse(line) as T);
}

export function readSwapEvents(filePath: string): SwapEvent[] {
  return readJsonlFile<SwapEvent>(filePath);
}
