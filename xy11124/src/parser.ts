import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Contraindication, TreatmentPackage, ParseError, SourceInfo } from './types';

interface ParsedData {
  contraindications: Contraindication[];
  packages: TreatmentPackage[];
  errors: ParseError[];
}

function getLineNumber(content: string, position: number): number {
  return content.substring(0, position).split('\n').length;
}

function parseJsonWithLineNumbers(content: string, filePath: string): { data: any; errors: ParseError[] } {
  const errors: ParseError[] = [];
  let data: any = null;

  try {
    data = JSON.parse(content);
  } catch (e: any) {
    const match = e.message.match(/position (\d+)/);
    const position = match ? parseInt(match[1], 10) : 0;
    errors.push({
      file: filePath,
      line: getLineNumber(content, position),
      message: 'JSON解析失败',
      error: e.message
    });
  }

  return { data, errors };
}

function parseYamlWithLineNumbers(content: string, filePath: string): { data: any; errors: ParseError[] } {
  const errors: ParseError[] = [];
  let data: any = null;

  try {
    data = yaml.load(content);
  } catch (e: any) {
    errors.push({
      file: filePath,
      line: e.mark?.line ? e.mark.line + 1 : undefined,
      message: 'YAML解析失败',
      error: e.message
    });
  }

  return { data, errors };
}

function validateContraindication(obj: any, index: number, filePath: string): Contraindication | null {
  const required = ['id', 'patientId', 'patientName', 'type', 'description', 'level', 'effectiveDate', 'expiryDate', 'status'];
  for (const field of required) {
    if (!(field in obj)) {
      return null;
    }
  }

  return {
    ...obj,
    source: {
      file: filePath,
      line: index + 2
    }
  };
}

function validatePackage(obj: any, index: number, filePath: string): TreatmentPackage | null {
  const required = ['id', 'name', 'category', 'treatments', 'contraindications', 'price', 'duration'];
  for (const field of required) {
    if (!(field in obj)) {
      return null;
    }
  }

  return {
    ...obj,
    source: {
      file: filePath,
      line: index + 2
    }
  };
}

export function parseFile(filePath: string): ParsedData {
  const result: ParsedData = {
    contraindications: [],
    packages: [],
    errors: []
  };

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    let parsed: any;
    let parseErrors: ParseError[] = [];

    if (ext === '.json') {
      const jsonResult = parseJsonWithLineNumbers(content, filePath);
      parsed = jsonResult.data;
      parseErrors = jsonResult.errors;
    } else if (ext === '.yaml' || ext === '.yml') {
      const yamlResult = parseYamlWithLineNumbers(content, filePath);
      parsed = yamlResult.data;
      parseErrors = yamlResult.errors;
    } else {
      result.errors.push({
        file: filePath,
        message: '不支持的文件格式',
        error: `仅支持 .json, .yaml, .yml 格式`
      });
      return result;
    }

    result.errors.push(...parseErrors);

    if (!parsed) {
      return result;
    }

    if (parsed.contraindications && Array.isArray(parsed.contraindications)) {
      for (let i = 0; i < parsed.contraindications.length; i++) {
        const validated = validateContraindication(parsed.contraindications[i], i, filePath);
        if (validated) {
          result.contraindications.push(validated);
        } else {
          result.errors.push({
            file: filePath,
            line: i + 2,
            message: '禁忌项数据不完整',
            error: `第 ${i + 1} 个禁忌项缺少必填字段`
          });
        }
      }
    }

    if (parsed.packages && Array.isArray(parsed.packages)) {
      for (let i = 0; i < parsed.packages.length; i++) {
        const validated = validatePackage(parsed.packages[i], i, filePath);
        if (validated) {
          result.packages.push(validated);
        } else {
          result.errors.push({
            file: filePath,
            line: i + 2,
            message: '理疗套餐数据不完整',
            error: `第 ${i + 1} 个理疗套餐缺少必填字段`
          });
        }
      }
    }

  } catch (e: any) {
    result.errors.push({
      file: filePath,
      message: '文件读取失败',
      error: e.message
    });
  }

  return result;
}

export function parseFiles(filePaths: string[]): ParsedData {
  const combined: ParsedData = {
    contraindications: [],
    packages: [],
    errors: []
  };

  for (const filePath of filePaths) {
    const parsed = parseFile(filePath);
    combined.contraindications.push(...parsed.contraindications);
    combined.packages.push(...parsed.packages);
    combined.errors.push(...parsed.errors);
  }

  return combined;
}
