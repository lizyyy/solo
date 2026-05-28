import {
  SynthParams,
  ValidationResult,
  ValidationError,
  ParamRange,
  PARAM_RANGES,
  DEFAULT_PARAMS,
  Warning,
  WarningSeverity,
} from '../types/synth';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function getParamRange(module: string, param: string): ParamRange | null {
  const moduleConfig = PARAM_RANGES[module as keyof typeof PARAM_RANGES];
  if (!moduleConfig || typeof moduleConfig !== 'object') return null;
  return (moduleConfig as Record<string, ParamRange>)[param] || null;
}

export function validateParam(
  module: string,
  param: string,
  value: unknown
): { valid: boolean; correctedValue?: number; warning?: Warning } {
  const range = getParamRange(module, param);
  if (!range) return { valid: true };

  if (typeof value !== 'number') {
    return {
      valid: false,
      correctedValue: range.default,
      warning: {
        type: 'out_of_range',
        message: `参数 ${module}.${param} 类型错误，已重置为默认值`,
        severity: 'high',
        param: `${module}.${param}`,
        value: Number(value) || 0,
        correctedValue: range.default,
      },
    };
  }

  if (!isInRange(value, range.min, range.max)) {
    const corrected = clamp(value, range.min, range.max);
    const severity: WarningSeverity =
      Math.abs(value - corrected) > (range.max - range.min) * 0.5 ? 'high' : 'medium';

    return {
      valid: false,
      correctedValue: corrected,
      warning: {
        type: 'out_of_range',
        message: `参数 ${module}.${param} = ${value} 超出范围 [${range.min}, ${range.max}]，已修正为 ${corrected}`,
        severity,
        param: `${module}.${param}`,
        value,
        correctedValue: corrected,
      },
    };
  }

  if (range.riskThreshold !== undefined && value > range.riskThreshold) {
    return {
      valid: true,
      warning: {
        type: 'extreme_value',
        message: `参数 ${module}.${param} = ${value} 接近上限，可能产生极端音色`,
        severity: 'low',
        param: `${module}.${param}`,
        value,
      },
    };
  }

  if (range.riskThresholdMin !== undefined && value < range.riskThresholdMin) {
    return {
      valid: true,
      warning: {
        type: 'extreme_value',
        message: `参数 ${module}.${param} = ${value} 接近下限，可能产生极端音色`,
        severity: 'low',
        param: `${module}.${param}`,
        value,
      },
    };
  }

  if (module === 'master' && param === 'volume' && value > 0.85) {
    return {
      valid: true,
      warning: {
        type: 'clipping',
        message: '主音量过高，可能导致爆峰失真',
        severity: 'medium',
        param: 'master.volume',
        value,
      },
    };
  }

  if (module === 'filter' && param === 'resonance' && value > 12) {
    return {
      valid: true,
      warning: {
        type: 'self_oscillation',
        message: '谐振值过高，滤波器可能产生自激振荡',
        severity: 'medium',
        param: 'filter.resonance',
        value,
      },
    };
  }

  return { valid: true };
}

function getLineAndColumn(content: string, position: number): { line: number; column: number } {
  const lines = content.slice(0, position).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function extractSourceContext(content: string, line: number, column: number, contextLines = 3): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - contextLines - 1);
  const end = Math.min(lines.length, line + contextLines);
  return lines
    .slice(start, end)
    .map((l, i) => `${start + i + 1}: ${l}`)
    .join('\n');
}

function parseJsonWithDiagnostics(jsonString: string): {
  data: unknown;
  error?: ValidationError;
} {
  try {
    const data = JSON.parse(jsonString);
    return { data };
  } catch (e) {
    const error = e as SyntaxError;
    const match = error.message.match(/position (\d+)/i);
    let line = 1;
    let column = 1;
    if (match) {
      const pos = parseInt(match[1], 10);
      const posInfo = getLineAndColumn(jsonString, pos);
      line = posInfo.line;
      column = posInfo.column;
    }

    return {
      data: null,
      error: {
        type: 'json_parse',
        message: `JSON 解析失败: ${error.message}`,
        line,
        column,
        source: extractSourceContext(jsonString, line, column),
      },
    };
  }
}

function validateFieldType(
  value: unknown,
  expectedType: string,
  fieldPath: string,
  errors: ValidationError[],
  jsonString: string
): boolean {
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== expectedType) {
    const lines = jsonString.split('\n');
    let line = 1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"${fieldPath.split('.').pop()}"`)) {
        line = i + 1;
        break;
      }
    }

    errors.push({
      type: 'type_mismatch',
      message: `字段 ${fieldPath} 类型错误`,
      line,
      field: fieldPath,
      value,
      expected: expectedType,
      actual: actualType,
      source: lines[line - 1]?.trim(),
    });
    return false;
  }
  return true;
}

function validateEnumValue(
  value: string,
  allowedValues: string[],
  fieldPath: string,
  errors: ValidationError[],
  jsonString: string
): boolean {
  if (!allowedValues.includes(value)) {
    const lines = jsonString.split('\n');
    let line = 1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"${fieldPath.split('.').pop()}"`)) {
        line = i + 1;
        break;
      }
    }

    errors.push({
      type: 'out_of_range',
      message: `字段 ${fieldPath} 值不合法`,
      line,
      field: fieldPath,
      value,
      expected: allowedValues.join(', '),
      actual: value,
      source: lines[line - 1]?.trim(),
    });
    return false;
  }
  return true;
}

function checkMissingField(
  obj: Record<string, unknown>,
  field: string,
  parentPath: string,
  errors: ValidationError[]
): boolean {
  if (!(field in obj)) {
    errors.push({
      type: 'missing_field',
      message: `缺少必填字段: ${parentPath}.${field}`,
      field: `${parentPath}.${field}`,
    });
    return false;
  }
  return true;
}

export function validateSynthParams(jsonString: string): ValidationResult {
  const errors: ValidationError[] = [];
  const parseResult = parseJsonWithDiagnostics(jsonString);

  if (parseResult.error) {
    return {
      valid: false,
      errors: [parseResult.error],
    };
  }

  const data = parseResult.data as Record<string, unknown>;
  const modules = ['oscillator', 'filter', 'envelope', 'lfo', 'master'];

  for (const module of modules) {
    if (!checkMissingField(data, module, '', errors)) continue;

    const moduleData = data[module] as Record<string, unknown>;
    if (!validateFieldType(moduleData, 'object', module, errors, jsonString)) continue;

    switch (module) {
      case 'oscillator':
        checkMissingField(moduleData, 'waveform', module, errors);
        checkMissingField(moduleData, 'frequency', module, errors);
        checkMissingField(moduleData, 'detune', module, errors);
        if (typeof moduleData.waveform === 'string') {
          validateEnumValue(
            moduleData.waveform,
            ['sine', 'square', 'sawtooth', 'triangle'],
            'oscillator.waveform',
            errors,
            jsonString
          );
        }
        if (typeof moduleData.frequency === 'number') {
          const range = getParamRange('oscillator', 'frequency')!;
          if (!isInRange(moduleData.frequency, range.min, range.max)) {
            const lines = jsonString.split('\n');
            let line = 1;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes('"frequency"')) {
                line = i + 1;
                break;
              }
            }
            errors.push({
              type: 'out_of_range',
              message: `oscillator.frequency 超出范围`,
              line,
              field: 'oscillator.frequency',
              value: moduleData.frequency,
              expected: `[${range.min}, ${range.max}]`,
              actual: String(moduleData.frequency),
              source: lines[line - 1]?.trim(),
            });
          }
        }
        break;

      case 'filter':
        checkMissingField(moduleData, 'type', module, errors);
        checkMissingField(moduleData, 'cutoff', module, errors);
        checkMissingField(moduleData, 'resonance', module, errors);
        if (typeof moduleData.type === 'string') {
          validateEnumValue(
            moduleData.type,
            ['lowpass', 'highpass', 'bandpass', 'notch'],
            'filter.type',
            errors,
            jsonString
          );
        }
        break;

      case 'envelope':
        ['attack', 'decay', 'sustain', 'release'].forEach((param) => {
          checkMissingField(moduleData, param, module, errors);
        });
        break;

      case 'lfo':
        checkMissingField(moduleData, 'waveform', module, errors);
        checkMissingField(moduleData, 'rate', module, errors);
        checkMissingField(moduleData, 'depth', module, errors);
        checkMissingField(moduleData, 'target', module, errors);
        if (typeof moduleData.target === 'string') {
          validateEnumValue(
            moduleData.target,
            ['volume', 'pitch', 'filter'],
            'lfo.target',
            errors,
            jsonString
          );
        }
        break;

      case 'master':
        checkMissingField(moduleData, 'volume', module, errors);
        break;
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  const correctedParams = sanitizeParams(data as unknown as SynthParams);
  return {
    valid: true,
    errors: [],
    correctedParams,
  };
}

export function sanitizeParams(params: SynthParams): SynthParams {
  const result: SynthParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));

  if (params.oscillator) {
    result.oscillator = {
      waveform: ['sine', 'square', 'sawtooth', 'triangle'].includes(params.oscillator.waveform)
        ? params.oscillator.waveform
        : DEFAULT_PARAMS.oscillator.waveform,
      frequency: clamp(params.oscillator.frequency, 20, 20000),
      detune: clamp(params.oscillator.detune, -100, 100),
    };
  }

  if (params.filter) {
    result.filter = {
      type: ['lowpass', 'highpass', 'bandpass', 'notch'].includes(params.filter.type)
        ? params.filter.type
        : DEFAULT_PARAMS.filter.type,
      cutoff: clamp(params.filter.cutoff, 20, 20000),
      resonance: clamp(params.filter.resonance, 0, 20),
      envelopeAmount: clamp(params.filter.envelopeAmount, 0, 1),
    };
  }

  if (params.envelope) {
    result.envelope = {
      attack: clamp(params.envelope.attack, 0.001, 5),
      decay: clamp(params.envelope.decay, 0.001, 5),
      sustain: clamp(params.envelope.sustain, 0, 1),
      release: clamp(params.envelope.release, 0.001, 10),
    };
  }

  if (params.lfo) {
    result.lfo = {
      waveform: ['sine', 'square', 'sawtooth', 'triangle'].includes(params.lfo.waveform)
        ? params.lfo.waveform
        : DEFAULT_PARAMS.lfo.waveform,
      rate: clamp(params.lfo.rate, 0.1, 20),
      depth: clamp(params.lfo.depth, 0, 1),
      target: ['volume', 'pitch', 'filter'].includes(params.lfo.target)
        ? params.lfo.target
        : DEFAULT_PARAMS.lfo.target,
    };
  }

  if (params.master) {
    result.master = {
      volume: clamp(params.master.volume, 0, 0.8),
    };
  }

  return result;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatValue(value: number, unit?: string, decimals = 2): string {
  const formatted = value.toFixed(decimals);
  return unit ? `${formatted}${unit}` : formatted;
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  if (minutes > 0) {
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}
