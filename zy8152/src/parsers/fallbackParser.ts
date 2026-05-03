import * as fs from 'fs';
import * as yaml from 'yaml';
import { FallbackConfig, ValidationError } from '../types';

export function parseFallbackYaml(filePath: string): {
  fallbackConfig: FallbackConfig;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const fallbackConfig: FallbackConfig = {
    defaults: {
      baseFonts: []
    },
    chains: []
  };

  try {
    if (!fs.existsSync(filePath)) {
      errors.push({
        type: 'fallback',
        source: filePath,
        message: 'Fallback configuration file not found',
        detail: `Expected file at: ${filePath}`
      });
      return { fallbackConfig, errors };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.parse(content);

    if (typeof data !== 'object' || data === null) {
      errors.push({
        type: 'fallback',
        source: filePath,
        message: 'Invalid YAML structure',
        detail: 'Expected an object at root level'
      });
      return { fallbackConfig, errors };
    }

    const parsed = validateAndNormalizeFallbackConfig(data, filePath, errors);
    return { fallbackConfig: parsed, errors };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push({
      type: 'fallback',
      source: filePath,
      message: 'Failed to parse fallback.yaml',
      detail: errorMessage
    });
  }

  return { fallbackConfig, errors };
}

function validateAndNormalizeFallbackConfig(
  data: Record<string, unknown>,
  filePath: string,
  errors: ValidationError[]
): FallbackConfig {
  const config: FallbackConfig = {
    defaults: {
      baseFonts: []
    },
    chains: []
  };

  if (data.defaults !== undefined) {
    if (typeof data.defaults !== 'object' || data.defaults === null) {
      errors.push({
        type: 'fallback',
        source: filePath,
        message: 'Invalid defaults structure',
        detail: '"defaults" must be an object'
      });
    } else {
      const defaults = data.defaults as Record<string, unknown>;

      if (defaults.baseFonts !== undefined) {
        if (!Array.isArray(defaults.baseFonts)) {
          errors.push({
            type: 'fallback',
            source: filePath,
            message: 'Invalid baseFonts type',
            detail: '"defaults.baseFonts" must be an array'
          });
        } else {
          config.defaults.baseFonts = defaults.baseFonts
            .map((f: unknown) => String(f || '').trim())
            .filter((f: string) => f !== '');
        }
      }

      if (defaults.emojiFont !== undefined) {
        if (typeof defaults.emojiFont !== 'string') {
          errors.push({
            type: 'fallback',
            source: filePath,
            message: 'Invalid emojiFont type',
            detail: '"defaults.emojiFont" must be a string'
          });
        } else {
          config.defaults.emojiFont = defaults.emojiFont.trim();
        }
      }
    }
  }

  if (data.chains !== undefined) {
    if (!Array.isArray(data.chains)) {
      errors.push({
        type: 'fallback',
        source: filePath,
        message: 'Invalid chains type',
        detail: '"chains" must be an array'
      });
    } else {
      const seenKeys = new Set<string>();

      for (let i = 0; i < data.chains.length; i++) {
        const chainData = data.chains[i];
        try {
          const chain = validateFallbackChain(chainData, i);
          const key = `${chain.language}:${chain.script}`;

          if (seenKeys.has(key)) {
            errors.push({
              type: 'fallback',
              source: filePath,
              message: 'Duplicate fallback chain',
              detail: `Fallback chain for "${key}" is defined more than once (index ${i})`
            });
          } else {
            seenKeys.add(key);
            config.chains.push(chain);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          errors.push({
            type: 'fallback',
            source: filePath,
            message: `Invalid fallback chain at index ${i}`,
            detail: errorMessage
          });
        }
      }
    }
  }

  return config;
}

function validateFallbackChain(data: unknown, index: number) {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Fallback chain must be an object');
  }

  const chain = data as Record<string, unknown>;

  if (chain.language === undefined || chain.language === null) {
    throw new Error('Fallback chain is missing required "language" property');
  }

  if (chain.script === undefined || chain.script === null) {
    throw new Error('Fallback chain is missing required "script" property');
  }

  if (chain.fonts === undefined || chain.fonts === null) {
    throw new Error('Fallback chain is missing required "fonts" property');
  }

  const language = String(chain.language).trim();
  const script = String(chain.script).trim();

  if (language === '') {
    throw new Error('Fallback chain "language" cannot be empty');
  }

  if (script === '') {
    throw new Error('Fallback chain "script" cannot be empty');
  }

  if (!Array.isArray(chain.fonts)) {
    throw new Error('Fallback chain "fonts" must be an array');
  }

  const fonts = chain.fonts
    .map((f: unknown) => String(f || '').trim())
    .filter((f: string) => f !== '');

  if (fonts.length === 0) {
    throw new Error('Fallback chain "fonts" array cannot be empty');
  }

  return {
    language,
    script,
    fonts
  };
}
