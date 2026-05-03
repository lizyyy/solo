import * as fs from 'fs';
import * as path from 'path';
import { FontConfig, ValidationError } from '../types';

export function parseFontsJson(filePath: string): { 
  fonts: Map<string, FontConfig>; 
  errors: ValidationError[] 
} {
  const errors: ValidationError[] = [];
  const fonts = new Map<string, FontConfig>();

  try {
    if (!fs.existsSync(filePath)) {
      errors.push({
        type: 'font',
        source: filePath,
        message: 'Fonts configuration file not found',
        detail: `Expected file at: ${filePath}`
      });
      return { fonts, errors };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data.fonts)) {
      errors.push({
        type: 'font',
        source: filePath,
        message: 'Invalid fonts.json structure',
        detail: 'Expected "fonts" array at root level'
      });
      return { fonts, errors };
    }

    for (const fontData of data.fonts) {
      try {
        const font = validateFontConfig(fontData, filePath);
        if (fonts.has(font.name)) {
          errors.push({
            type: 'font',
            source: filePath,
            message: 'Duplicate font name',
            detail: `Font name "${font.name}" is defined more than once`
          });
        } else {
          fonts.set(font.name, font);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({
          type: 'font',
          source: filePath,
          message: 'Invalid font configuration',
          detail: errorMessage
        });
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push({
      type: 'font',
      source: filePath,
      message: 'Failed to parse fonts.json',
      detail: errorMessage
    });
  }

  return { fonts, errors };
}

function validateFontConfig(data: unknown, sourcePath: string): FontConfig {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Font configuration must be an object');
  }

  const font = data as Record<string, unknown>;

  if (typeof font.name !== 'string' || font.name.trim() === '') {
    throw new Error('Font must have a non-empty "name" property');
  }

  if (typeof font.family !== 'string' || font.family.trim() === '') {
    throw new Error(`Font "${font.name}" must have a non-empty "family" property`);
  }

  if (typeof font.path !== 'string' || font.path.trim() === '') {
    throw new Error(`Font "${font.name}" must have a non-empty "path" property`);
  }

  const config: FontConfig = {
    name: font.name.trim(),
    family: font.family.trim(),
    path: font.path.trim()
  };

  if (font.isVariable !== undefined) {
    if (typeof font.isVariable !== 'boolean') {
      throw new Error(`Font "${font.name}" has invalid "isVariable" type (expected boolean)`);
    }
    config.isVariable = font.isVariable;
  }

  if (font.variableAxes !== undefined) {
    if (!Array.isArray(font.variableAxes)) {
      throw new Error(`Font "${font.name}" has invalid "variableAxes" type (expected array)`);
    }
    config.variableAxes = font.variableAxes.map((axis: unknown, index: number) => {
      if (typeof axis !== 'object' || axis === null) {
        throw new Error(`Font "${font.name}" variable axis ${index} must be an object`);
      }
      const axisObj = axis as Record<string, unknown>;
      return {
        tag: String(axisObj.tag || `axis_${index}`),
        name: String(axisObj.name || `Axis ${index}`),
        min: typeof axisObj.min === 'number' ? axisObj.min : 0,
        max: typeof axisObj.max === 'number' ? axisObj.max : 1000,
        default: typeof axisObj.default === 'number' ? axisObj.default : 400
      };
    });
  }

  if (font.supportedScripts !== undefined) {
    if (!Array.isArray(font.supportedScripts)) {
      throw new Error(`Font "${font.name}" has invalid "supportedScripts" type (expected array)`);
    }
    config.supportedScripts = font.supportedScripts.map(String);
  }

  if (font.weight !== undefined) {
    if (typeof font.weight !== 'number') {
      throw new Error(`Font "${font.name}" has invalid "weight" type (expected number)`);
    }
    config.weight = font.weight;
  }

  if (font.style !== undefined) {
    if (typeof font.style !== 'string') {
      throw new Error(`Font "${font.name}" has invalid "style" type (expected string)`);
    }
    config.style = font.style;
  }

  return config;
}
