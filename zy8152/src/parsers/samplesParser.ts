import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { SampleEntry, ValidationError } from '../types';

export function parseSamplesCsv(filePath: string): {
  samples: SampleEntry[];
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const samples: SampleEntry[] = [];

  try {
    if (!fs.existsSync(filePath)) {
      errors.push({
        type: 'sample',
        source: filePath,
        message: 'Samples CSV file not found',
        detail: `Expected file at: ${filePath}`
      });
      return { samples, errors };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (!Array.isArray(records)) {
      errors.push({
        type: 'sample',
        source: filePath,
        message: 'Invalid CSV structure',
        detail: 'Expected array of records'
      });
      return { samples, errors };
    }

    const seenIds = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const record = records[i] as Record<string, string>;
      const lineNumber = i + 2;

      try {
        const sample = validateSampleEntry(record, lineNumber);

        if (seenIds.has(sample.id)) {
          errors.push({
            type: 'sample',
            source: filePath,
            message: 'Duplicate sample ID',
            detail: `Sample ID "${sample.id}" appears more than once (line ${lineNumber})`
          });
        } else {
          seenIds.add(sample.id);
          samples.push(sample);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({
          type: 'sample',
          source: filePath,
          message: `Invalid sample at line ${lineNumber}`,
          detail: errorMessage
        });
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push({
      type: 'sample',
      source: filePath,
      message: 'Failed to parse samples.csv',
      detail: errorMessage
    });
  }

  return { samples, errors };
}

function validateSampleEntry(record: Record<string, string>, lineNumber: number): SampleEntry {
  const requiredFields = ['id', 'language', 'script', 'text'];
  const missingFields = requiredFields.filter(field => !record[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  const id = record.id.trim();
  if (id === '') {
    throw new Error('Sample ID cannot be empty');
  }

  const language = record.language.trim();
  if (language === '') {
    throw new Error('Language cannot be empty');
  }

  const script = record.script.trim();
  if (script === '') {
    throw new Error('Script cannot be empty');
  }

  const text = record.text;
  if (text === undefined || text === null || text === '') {
    throw new Error('Text sample cannot be empty');
  }

  if (containsInvalidUnicode(text)) {
    throw new Error('Text contains invalid Unicode surrogate pairs or unpaired surrogates');
  }

  const sample: SampleEntry = {
    id,
    language,
    script,
    text
  };

  if (record.description !== undefined && record.description.trim() !== '') {
    sample.description = record.description.trim();
  }

  return sample;
}

function containsInvalidUnicode(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const codeUnit = text.charCodeAt(i);
    
    if (codeUnit >= 0xD800 && codeUnit <= 0xDBFF) {
      const nextCodeUnit = text.charCodeAt(i + 1);
      if (nextCodeUnit === undefined || nextCodeUnit < 0xDC00 || nextCodeUnit > 0xDFFF) {
        return true;
      }
      i++;
    } else if (codeUnit >= 0xDC00 && codeUnit <= 0xDFFF) {
      return true;
    }
  }
  return false;
}
