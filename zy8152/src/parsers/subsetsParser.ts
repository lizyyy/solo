import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { SubsetDefinition, UnicodeRange, ValidationError } from '../types';

export function parseSubsetsDirectory(dirPath: string): {
  subsets: Map<string, SubsetDefinition>;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const subsets = new Map<string, SubsetDefinition>();

  try {
    if (!fs.existsSync(dirPath)) {
      errors.push({
        type: 'subset',
        source: dirPath,
        message: 'Subsets directory not found',
        detail: `Expected directory at: ${dirPath}`
      });
      return { subsets, errors };
    }

    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      errors.push({
        type: 'subset',
        source: dirPath,
        message: 'Subsets path is not a directory',
        detail: `Expected directory, found file at: ${dirPath}`
      });
      return { subsets, errors };
    }

    const files = fs.readdirSync(dirPath);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    if (yamlFiles.length === 0) {
      errors.push({
        type: 'subset',
        source: dirPath,
        message: 'No subset definition files found',
        detail: `Expected .yaml or .yml files in: ${dirPath}`
      });
      return { subsets, errors };
    }

    for (const fileName of yamlFiles) {
      const filePath = path.join(dirPath, fileName);
      try {
        const subset = parseSubsetFile(filePath);
        const subsetName = subset.name || path.basename(fileName, path.extname(fileName));

        if (subsets.has(subsetName)) {
          errors.push({
            type: 'subset',
            source: filePath,
            message: 'Duplicate subset name',
            detail: `Subset name "${subsetName}" is defined in multiple files`
          });
        } else {
          subset.name = subsetName;
          subsets.set(subsetName, subset);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({
          type: 'subset',
          source: filePath,
          message: 'Failed to parse subset file',
          detail: errorMessage
        });
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push({
      type: 'subset',
      source: dirPath,
      message: 'Failed to process subsets directory',
      detail: errorMessage
    });
  }

  return { subsets, errors };
}

function parseSubsetFile(filePath: string): SubsetDefinition {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = yaml.parse(content);

  if (typeof data !== 'object' || data === null) {
    throw new Error('Subset file must contain an object at root level');
  }

  const subset = data as Record<string, unknown>;

  if (subset.unicodeRanges === undefined || subset.unicodeRanges === null) {
    throw new Error('Subset file is missing required "unicodeRanges" property');
  }

  if (!Array.isArray(subset.unicodeRanges)) {
    throw new Error('"unicodeRanges" must be an array');
  }

  const definition: SubsetDefinition = {
    name: '',
    unicodeRanges: []
  };

  if (subset.name !== undefined) {
    if (typeof subset.name !== 'string') {
      throw new Error('"name" must be a string');
    }
    definition.name = subset.name.trim();
  }

  if (subset.description !== undefined) {
    if (typeof subset.description !== 'string') {
      throw new Error('"description" must be a string');
    }
    definition.description = subset.description.trim();
  }

  for (let i = 0; i < subset.unicodeRanges.length; i++) {
    const rangeData = subset.unicodeRanges[i];
    try {
      const range = validateUnicodeRange(rangeData, i);
      definition.unicodeRanges.push(range);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid range at index ${i}: ${errorMessage}`);
    }
  }

  if (definition.unicodeRanges.length === 0) {
    throw new Error('Subset must contain at least one valid unicode range');
  }

  return definition;
}

function validateUnicodeRange(data: unknown, index: number): UnicodeRange {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Unicode range must be an object');
  }

  const range = data as Record<string, unknown>;

  if (range.start === undefined || range.start === null) {
    throw new Error('Range is missing required "start" property');
  }

  if (range.end === undefined || range.end === null) {
    throw new Error('Range is missing required "end" property');
  }

  let start: number;
  let end: number;

  if (typeof range.start === 'string') {
    start = parseUnicodeValue(range.start);
  } else if (typeof range.start === 'number') {
    start = Math.floor(range.start);
  } else {
    throw new Error('"start" must be a number or hex string (e.g., "U+0041")');
  }

  if (typeof range.end === 'string') {
    end = parseUnicodeValue(range.end);
  } else if (typeof range.end === 'number') {
    end = Math.floor(range.end);
  } else {
    throw new Error('"end" must be a number or hex string (e.g., "U+007E")');
  }

  if (start < 0 || start > 0x10FFFF) {
    throw new Error(`"start" value ${start} is outside valid Unicode range (0-0x10FFFF)`);
  }

  if (end < 0 || end > 0x10FFFF) {
    throw new Error(`"end" value ${end} is outside valid Unicode range (0-0x10FFFF)`);
  }

  if (start > end) {
    throw new Error(`"start" (${start}) must be less than or equal to "end" (${end})`);
  }

  const result: UnicodeRange = { start, end };

  if (range.name !== undefined && typeof range.name === 'string') {
    result.name = range.name.trim();
  }

  return result;
}

function parseUnicodeValue(value: string): number {
  value = value.trim().toUpperCase();

  if (value.startsWith('U+')) {
    value = value.substring(2);
  } else if (value.startsWith('0X')) {
    value = value.substring(2);
  }

  const num = parseInt(value, 16);
  if (isNaN(num)) {
    throw new Error(`Invalid Unicode value: "${value}"`);
  }

  return num;
}
