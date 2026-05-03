import * as fs from 'fs';
import * as yaml from 'yaml';
import { CabinetsConfig, RulesConfig } from '../types';

export function readYamlFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.parse(content) as T;
}

export function readCabinetsConfig(filePath: string): CabinetsConfig {
  return readYamlFile<CabinetsConfig>(filePath);
}

export function readRulesConfig(filePath: string): RulesConfig {
  return readYamlFile<RulesConfig>(filePath);
}
