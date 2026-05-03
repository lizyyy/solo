import * as path from 'path';
import { ParsedData, ValidationError, FontConfig, FallbackConfig, SubsetDefinition } from '../types';
import { parseFontsJson } from './fontsParser';
import { parseSamplesCsv } from './samplesParser';
import { parseFallbackYaml } from './fallbackParser';
import { parseSubsetsDirectory } from './subsetsParser';

export interface ParseResult {
  data: ParsedData;
  errors: ValidationError[];
}

export function parseAllData(dataDir: string): ParseResult {
  const allErrors: ValidationError[] = [];

  const fontsPath = path.join(dataDir, 'fonts.json');
  const { fonts, errors: fontErrors } = parseFontsJson(fontsPath);
  allErrors.push(...fontErrors);

  const samplesPath = path.join(dataDir, 'samples.csv');
  const { samples, errors: sampleErrors } = parseSamplesCsv(samplesPath);
  allErrors.push(...sampleErrors);

  const fallbackPath = path.join(dataDir, 'fallback.yaml');
  const { fallbackConfig, errors: fallbackErrors } = parseFallbackYaml(fallbackPath);
  allErrors.push(...fallbackErrors);

  const subsetsPath = path.join(dataDir, 'subsets');
  const { subsets, errors: subsetErrors } = parseSubsetsDirectory(subsetsPath);
  allErrors.push(...subsetErrors);

  validateCrossReferences(fonts, fallbackConfig, subsets, allErrors);

  return {
    data: {
      fonts,
      samples,
      fallbackConfig,
      subsets
    },
    errors: allErrors
  };
}

function validateCrossReferences(
  fonts: Map<string, FontConfig>,
  fallbackConfig: FallbackConfig,
  subsets: Map<string, SubsetDefinition>,
  errors: ValidationError[]
): void {
  const fontNames = new Set(fonts.keys());

  for (const fontName of fallbackConfig.defaults.baseFonts) {
    if (!fontNames.has(fontName)) {
      errors.push({
        type: 'fallback',
        source: 'defaults.baseFonts',
        message: 'Reference to undefined font',
        detail: `Font "${fontName}" referenced in defaults.baseFonts is not defined in fonts.json`
      });
    }
  }

  if (fallbackConfig.defaults.emojiFont && !fontNames.has(fallbackConfig.defaults.emojiFont)) {
    errors.push({
      type: 'fallback',
      source: 'defaults.emojiFont',
      message: 'Reference to undefined font',
      detail: `Font "${fallbackConfig.defaults.emojiFont}" referenced in defaults.emojiFont is not defined in fonts.json`
    });
  }

  for (const chain of fallbackConfig.chains) {
    for (const fontName of chain.fonts) {
      if (!fontNames.has(fontName)) {
        errors.push({
          type: 'fallback',
          source: 'chains',
          message: 'Reference to undefined font',
          detail: `Font "${fontName}" referenced in fallback chain is not defined in fonts.json`
        });
      }
    }
  }
}

export { parseFontsJson, parseSamplesCsv, parseFallbackYaml, parseSubsetsDirectory };
