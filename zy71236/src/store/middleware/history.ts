import { HistoryItem, SynthParams, Warning, SourceType } from '../../types/synth';
import { generateId } from '../../utils/validator';

export function createHistoryItem(
  module: string,
  param: string,
  oldValue: unknown,
  newValue: unknown,
  warning: Warning | null,
  scoreImpact: { dimension: string; delta: number } | null,
  source: SourceType = 'user'
): HistoryItem {
  const type = warning ? 'warning' : 'parameter';

  return {
    id: generateId(),
    timestamp: Date.now(),
    type,
    module,
    param,
    oldValue,
    newValue,
    scoreImpact,
    warning,
    source,
  };
}

export function createPresetHistoryItem(
  action: 'preset_load' | 'preset_save',
  presetName: string,
  params: SynthParams
): HistoryItem {
  return {
    id: generateId(),
    timestamp: Date.now(),
    type: action,
    module: 'preset',
    param: action === 'preset_load' ? 'load' : 'save',
    oldValue: null,
    newValue: { name: presetName, params },
    scoreImpact: null,
    warning: null,
    source: 'user',
  };
}

export function createImportHistoryItem(params: SynthParams): HistoryItem {
  return {
    id: generateId(),
    timestamp: Date.now(),
    type: 'import',
    module: 'import',
    param: 'config',
    oldValue: null,
    newValue: params,
    scoreImpact: null,
    warning: null,
    source: 'import',
  };
}

export function formatParamChangeDescription(item: HistoryItem): string {
  const moduleNames: Record<string, string> = {
    oscillator: '振荡器',
    filter: '滤波器',
    envelope: '包络',
    lfo: 'LFO',
    master: '主控',
    preset: '预设',
    import: '导入',
  };

  const paramNames: Record<string, string> = {
    waveform: '波形',
    frequency: '频率',
    detune: '失谐',
    type: '类型',
    cutoff: '截止频率',
    resonance: '谐振',
    envelopeAmount: '包络量',
    attack: 'Attack',
    decay: 'Decay',
    sustain: 'Sustain',
    release: 'Release',
    rate: '速率',
    depth: '深度',
    target: '目标',
    volume: '音量',
    load: '加载',
    save: '保存',
    config: '配置',
  };

  const moduleName = moduleNames[item.module] || item.module;
  const paramName = paramNames[item.param] || item.param;

  if (item.type === 'preset_load') {
    return `加载预设: ${(item.newValue as { name: string })?.name || '未知'}`;
  }

  if (item.type === 'preset_save') {
    return `保存预设: ${(item.newValue as { name: string })?.name || '未知'}`;
  }

  if (item.type === 'import') {
    return '导入配置文件';
  }

  const formatValue = (val: unknown): string => {
    if (typeof val === 'number') {
      return val.toFixed(2);
    }
    if (typeof val === 'string') {
      return val;
    }
    return String(val);
  };

  return `${moduleName} - ${paramName}: ${formatValue(item.oldValue)} → ${formatValue(item.newValue)}`;
}
