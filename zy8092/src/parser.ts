import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ArtifactsFile, SPDXSBOM, SLSAProvenance, Policy } from './types';

export function parseArtifactsFile(filePath: string): ArtifactsFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function parseSBOM(filePath: string): SPDXSBOM {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function parseProvenance(filePath: string): SLSAProvenance[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  return lines.map(line => JSON.parse(line));
}

export function parsePolicy(filePath: string): Policy {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content) as Policy;
}

export function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}
