import type { Preset, PresetParameters } from '@/types';

interface SamplePreset extends Omit<Preset, 'id' | 'createdAt' | 'updatedAt'> {}

export function getSamplePresets(): SamplePreset[] {
  const baseParameters: PresetParameters = {
    oscillators: [
      {
        id: 'osc1',
        name: 'Oscillator 1',
        type: 'sawtooth',
        pitch: 0,
        fineTune: 0,
        level: 80,
      },
      {
        id: 'osc2',
        name: 'Oscillator 2',
        type: 'square',
        pitch: 12,
        fineTune: 0,
        level: 60,
      },
    ],
    filters: [
      {
        id: 'filter1',
        name: 'Lowpass Filter',
        type: 'lowpass',
        cutoff: 2000,
        resonance: 0.7,
        envelopeAmount: 50,
      },
    ],
    envelopes: [
      {
        id: 'env1',
        name: 'Amplitude Envelope',
        attack: 10,
        decay: 50,
        sustain: 70,
        release: 300,
      },
    ],
    lfos: [
      {
        id: 'lfo1',
        name: 'LFO 1',
        type: 'sine',
        rate: 4,
        depth: 20,
        destination: 'filter cutoff',
      },
    ],
    effects: [
      {
        id: 'reverb1',
        name: 'Reverb',
        type: 'reverb',
        mix: 30,
        parameters: { decay: 2.5, diffusion: 80 },
      },
    ],
    globalSettings: {
      volume: 75,
      polyphony: 8,
      glide: 0,
    },
  };

  const v1Parameters: PresetParameters = {
    ...baseParameters,
    oscillators: [
      ...baseParameters.oscillators!,
    ],
    filters: [
      {
        ...baseParameters.filters![0],
        cutoff: 1800,
      },
    ],
  };

  const v2Parameters: PresetParameters = {
    ...baseParameters,
    oscillators: [
      {
        ...baseParameters.oscillators![0],
        type: 'square',
        level: 85,
      },
      {
        ...baseParameters.oscillators![1],
        pitch: 7,
        level: 55,
      },
    ],
    filters: [
      {
        ...baseParameters.filters![0],
        cutoff: 3500,
        resonance: 2.5,
      },
    ],
    envelopes: [
      {
        ...baseParameters.envelopes![0],
        attack: 5,
        release: 500,
      },
    ],
    effects: [
      ...baseParameters.effects!,
      {
        id: 'delay1',
        name: 'Delay',
        type: 'delay',
        mix: 25,
        parameters: { time: 400, feedback: 40 },
      },
    ],
  };

  const v3Parameters: PresetParameters = {
    ...v2Parameters,
    oscillators: [
      {
        ...v2Parameters.oscillators![0],
        pitch: 0,
        fineTune: 0,
        level: 0,
      },
      {
        ...v2Parameters.oscillators![0],
        type: 'sawtooth',
        pitch: 0,
        fineTune: 0,
        level: 80,
      },
      {
        ...v2Parameters.oscillators![1],
        level: 0,
      },
    ],
    filters: [
      {
        ...v2Parameters.filters![0],
        cutoff: 100,
      },
    ],
    envelopes: [
      {
        ...v2Parameters.envelopes![0],
        sustain: 100,
        release: 0,
      },
    ],
    globalSettings: {
      volume: 100,
      polyphony: 1,
      glide: 0.1,
    },
    specialParameter: null,
    emptyArray: [],
    undefinedField: undefined,
  };

  return [
    {
      name: 'Bass Lead 贝斯主音',
      version: '1.0.0',
      filename: 'BassLead_v1.0.0_20240110_alan.json',
      operator: '阿蓝',
      parameters: v1Parameters,
      status: 'confirmed',
      notes: '初始版本，用于开场曲第一段',
    },
    {
      name: 'Bass Lead 贝斯主音',
      version: '1.2.0',
      filename: 'BassLead_v1.2.0_20240112_tom.json',
      operator: 'Tom',
      parameters: v2Parameters,
      status: 'confirmed',
      notes: '修改滤波参数，增加延迟效果',
    },
    {
      name: 'Bass Lead 贝斯主音',
      version: '2.0.0-beta',
      filename: '贝斯主音_v2.0.0-beta_20240115_alan.json',
      operator: '阿蓝',
      parameters: v3Parameters,
      status: 'draft',
      notes: '边界测试版本，包含空值和极值',
    },
    {
      name: 'Pad Atmosphere 氛围铺底',
      version: '1.0.0',
      filename: 'PadAtmo_v1.0.0_20240108_sarah.json',
      operator: 'Sarah',
      parameters: {
        oscillators: [
          {
            id: 'osc1',
            name: 'Osc 1',
            type: 'sine',
            pitch: 0,
            fineTune: 0,
            level: 70,
          },
        ],
        filters: [
          {
            id: 'filter1',
            name: 'Filter',
            type: 'lowpass',
            cutoff: 800,
            resonance: 0.5,
            envelopeAmount: 30,
          },
        ],
        envelopes: [
          {
            id: 'env1',
            name: 'Env',
            attack: 500,
            decay: 1000,
            sustain: 80,
            release: 2000,
          },
        ],
        effects: [
          {
            id: 'reverb1',
            name: 'Reverb',
            type: 'reverb',
            mix: 60,
            parameters: { decay: 5, diffusion: 90 },
          },
        ],
      },
      status: 'archived',
      notes: '经典氛围铺底',
    },
    {
      name: 'Lead Synth 主音合成器',
      version: '1.1.0',
      filename: 'LeadSynth_v1.1.0.json',
      operator: 'AudioTeam',
      parameters: {
        oscillators: [
          {
            id: 'osc1',
            name: 'Oscillator',
            type: 'sawtooth',
            pitch: 0,
            fineTune: 5,
            level: 90,
          },
        ],
        filters: [
          {
            id: 'filter1',
            name: 'Lowpass',
            type: 'lowpass',
            cutoff: 4000,
            resonance: 1.2,
            envelopeAmount: 60,
          },
        ],
        envelopes: [
          {
            id: 'env1',
            name: 'Amp Env',
            attack: 5,
            decay: 100,
            sustain: 60,
            release: 150,
          },
        ],
        lfos: null,
      },
      status: 'confirmed',
      notes: 'Solo 用主音',
    },
  ];
}

export const sampleComparisonReason = '演出彩排前版本核对，确认v1.2.0相对v1.0.0的参数变更';

export const sampleAnnotation = {
  comparisonId: 'sample',
  content: '这个延迟效果是彩排时临时加的，演出当天需要确认是否保留',
  operator: '阿蓝',
  type: 'note' as const,
};

export const edgeCaseDescriptions = {
  null: '参数为空值，需要确认是故意清空还是数据丢失',
  duplicate: '振荡器参数重复，可能是复制时产生的冗余',
  boundary: '参数处于极值（0或100），可能导致声音异常',
};
