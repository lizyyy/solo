import type { Mode, Chord, ModulationPath, AudioSample, DataSource } from '../types';
import { getFifthsPosition, getModeBrightness, getFunctionLevel, calculatePosition, getModeScale, midiToNote } from '../utils/musicTheory';
import { MODE_TYPE_COLORS } from '../types';

export const dataSources: DataSource[] = [
  {
    id: 'src-1',
    name: '《和声学教程》',
    type: 'textbook',
    processingStage: 'final',
    processingOrder: 1,
    url: 'https://example.com/textbook',
    notes: '经典和声学教材，主要调式数据来源',
  },
  {
    id: 'src-2',
    name: '贝多芬奏鸣曲分析',
    type: 'analysis',
    processingStage: 'cleaned',
    processingOrder: 2,
    notes: '转调路径分析数据',
  },
  {
    id: 'src-3',
    name: '爵士乐理论手册',
    type: 'textbook',
    processingStage: 'validated',
    processingOrder: 3,
    notes: '包含教会调式数据',
  },
  {
    id: 'src-4',
    name: '未整理录音片段',
    type: 'recording',
    processingStage: 'raw',
    processingOrder: 4,
    notes: '待验证的音频示例',
  },
];

const createMode = (
  id: string,
  rootNote: string,
  type: Mode['type'],
  sourceId: string,
  quality: Mode['quality'] = 'normal'
): Omit<Mode, 'validation'> => {
  const fifthsPosition = getFifthsPosition(rootNote);
  const brightness = getModeBrightness(type);
  const functionLevel = type === 'major' ? 2 : type === 'minor' ? -1 : 0;

  return {
    id,
    name: `${rootNote} ${type}`,
    type,
    rootNote,
    fifthsPosition,
    functionLevel,
    brightness,
    color: MODE_TYPE_COLORS[type],
    quality,
    sourceId,
    audioSampleId: `audio-${id}`,
    position: calculatePosition(fifthsPosition, functionLevel, brightness),
  };
};

export const rawModes: Omit<Mode, 'validation'>[] = [
  createMode('mode-c-major', 'C', 'major', 'src-1', 'normal'),
  createMode('mode-g-major', 'G', 'major', 'src-1', 'normal'),
  createMode('mode-d-major', 'D', 'major', 'src-1', 'normal'),
  createMode('mode-a-major', 'A', 'major', 'src-1', 'normal'),
  createMode('mode-f-major', 'F', 'major', 'src-1', 'normal'),
  createMode('mode-bb-major', 'Bb', 'major', 'src-1', 'normal'),
  createMode('mode-a-minor', 'A', 'minor', 'src-1', 'normal'),
  createMode('mode-e-minor', 'E', 'minor', 'src-1', 'normal'),
  createMode('mode-d-minor', 'D', 'minor', 'src-1', 'normal'),
  createMode('mode-c-dorian', 'C', 'dorian', 'src-3', 'normal'),
  createMode('mode-d-dorian', 'D', 'dorian', 'src-3', 'normal'),
  createMode('mode-g-lydian', 'G', 'lydian', 'src-3', 'normal'),
  createMode('mode-f-mixolydian', 'F', 'mixolydian', 'src-3', 'borderline'),
  createMode('mode-e-phrygian', 'E', 'phrygian', 'src-3', 'borderline'),
  createMode('mode-b-major', 'B', 'major', 'src-4', 'borderline') as Omit<Mode, 'validation'>,
  {
    id: 'mode-b-major-error',
    name: 'B major (invalid)',
    type: 'major',
    rootNote: 'B',
    fifthsPosition: 10,
    functionLevel: 2,
    brightness: 5,
    color: MODE_TYPE_COLORS.major,
    quality: 'error',
    sourceId: 'src-4',
    audioSampleId: 'audio-mode-b-major-error',
    position: calculatePosition(10, 2, 5),
  },
  {
    id: 'mode-c#-major',
    name: 'C# major',
    type: 'major',
    rootNote: 'C#',
    fifthsPosition: getFifthsPosition('C#'),
    functionLevel: 2,
    brightness: getModeBrightness('major'),
    color: MODE_TYPE_COLORS.major,
    quality: 'borderline',
    sourceId: 'src-4',
    audioSampleId: 'audio-mode-c#-major',
    position: calculatePosition(getFifthsPosition('C#'), 2, getModeBrightness('major')),
  },
  {
    id: 'mode-db-major',
    name: 'Db major',
    type: 'major',
    rootNote: 'Db',
    fifthsPosition: getFifthsPosition('Db'),
    functionLevel: 2,
    brightness: getModeBrightness('major'),
    color: MODE_TYPE_COLORS.major,
    quality: 'borderline',
    sourceId: 'src-4',
    audioSampleId: 'audio-mode-db-major',
    position: calculatePosition(getFifthsPosition('Db'), 2, getModeBrightness('major')),
  },
];

export const chords: Chord[] = [
  {
    id: 'chord-c-major',
    name: 'C',
    symbol: 'C',
    function: 'tonic',
    modeId: 'mode-c-major',
    quality: 'normal',
    sourceId: 'src-1',
    audioSampleId: 'audio-chord-c-major',
    position: calculatePosition(0, getFunctionLevel('tonic'), 0),
  },
  {
    id: 'chord-f-major',
    name: 'F',
    symbol: 'F',
    function: 'subdominant',
    modeId: 'mode-c-major',
    quality: 'normal',
    sourceId: 'src-1',
    audioSampleId: 'audio-chord-f-major',
    position: calculatePosition(-1, getFunctionLevel('subdominant'), 0),
  },
  {
    id: 'chord-g-major',
    name: 'G',
    symbol: 'G',
    function: 'dominant',
    modeId: 'mode-c-major',
    quality: 'normal',
    sourceId: 'src-1',
    audioSampleId: 'audio-chord-g-major',
    position: calculatePosition(1, getFunctionLevel('dominant'), 0),
  },
  {
    id: 'chord-am',
    name: 'Am',
    symbol: 'Am',
    function: 'submediant',
    modeId: 'mode-c-major',
    quality: 'normal',
    sourceId: 'src-1',
    audioSampleId: 'audio-chord-am',
    position: calculatePosition(-3, getFunctionLevel('submediant'), 0),
  },
  {
    id: 'chord-dm',
    name: 'Dm',
    symbol: 'Dm',
    function: 'supertonic',
    modeId: 'mode-c-major',
    quality: 'normal',
    sourceId: 'src-1',
    audioSampleId: 'audio-chord-dm',
    position: calculatePosition(2, getFunctionLevel('supertonic'), 0),
  },
  {
    id: 'chord-em',
    name: 'Em',
    symbol: 'Em',
    function: 'mediant',
    modeId: 'mode-c-major',
    quality: 'borderline',
    sourceId: 'src-1',
    audioSampleId: 'audio-chord-em',
    position: calculatePosition(4, getFunctionLevel('mediant'), 0),
  },
  {
    id: 'chord-b-dim',
    name: 'Bdim',
    symbol: 'B°',
    function: 'leading',
    modeId: 'mode-c-major',
    quality: 'error',
    sourceId: 'src-4',
    audioSampleId: 'audio-chord-b-dim',
    position: calculatePosition(5, getFunctionLevel('leading'), 0),
  },
  {
    id: 'chord-a-minor-tonic',
    name: 'Am',
    symbol: 'Am',
    function: 'tonic',
    modeId: 'mode-a-minor',
    quality: 'normal',
    sourceId: 'src-1',
    audioSampleId: 'audio-chord-a-minor-tonic',
    position: calculatePosition(-3, getFunctionLevel('tonic'), -1),
  },
];

export const modulationPaths: ModulationPath[] = [
  {
    id: 'path-c-g',
    fromModeId: 'mode-c-major',
    toModeId: 'mode-g-major',
    type: 'pivot',
    isBroken: false,
    pivotChords: ['G'],
    quality: 'normal',
    sourceId: 'src-2',
  },
  {
    id: 'path-c-f',
    fromModeId: 'mode-c-major',
    toModeId: 'mode-f-major',
    type: 'pivot',
    isBroken: false,
    pivotChords: ['F'],
    quality: 'normal',
    sourceId: 'src-2',
  },
  {
    id: 'path-c-a-minor',
    fromModeId: 'mode-c-major',
    toModeId: 'mode-a-minor',
    type: 'direct',
    isBroken: false,
    quality: 'normal',
    sourceId: 'src-2',
  },
  {
    id: 'path-g-d',
    fromModeId: 'mode-g-major',
    toModeId: 'mode-d-major',
    type: 'sequential',
    isBroken: false,
    quality: 'normal',
    sourceId: 'src-2',
  },
  {
    id: 'path-d-a',
    fromModeId: 'mode-d-major',
    toModeId: 'mode-a-major',
    type: 'sequential',
    isBroken: false,
    quality: 'normal',
    sourceId: 'src-2',
  },
  {
    id: 'path-f-bb',
    fromModeId: 'mode-f-major',
    toModeId: 'mode-bb-major',
    type: 'pivot',
    isBroken: false,
    quality: 'borderline',
    sourceId: 'src-2',
  },
  {
    id: 'path-c-d-dorian',
    fromModeId: 'mode-c-major',
    toModeId: 'mode-d-dorian',
    type: 'direct',
    isBroken: true,
    quality: 'borderline',
    sourceId: 'src-3',
  },
  {
    id: 'path-c#-db',
    fromModeId: 'mode-c#-major',
    toModeId: 'mode-db-major',
    type: 'enharmonic',
    isBroken: false,
    quality: 'borderline',
    sourceId: 'src-4',
  },
  {
    id: 'path-error-broken',
    fromModeId: 'mode-c-major',
    toModeId: 'non-existent-mode',
    type: 'direct',
    isBroken: true,
    quality: 'error',
    sourceId: 'src-4',
  },
  {
    id: 'path-c-e-major',
    fromModeId: 'mode-c-major',
    toModeId: 'mode-e-minor',
    type: 'direct',
    isBroken: true,
    quality: 'borderline',
    sourceId: 'src-4',
  },
];

const createAudioSample = (
  id: string,
  targetId: string,
  targetType: AudioSample['targetType'],
  sourceId: string,
  isMismatched: boolean = false
): AudioSample => {
  let notes: string[] = [];
  
  if (targetType === 'mode') {
    const rootNote = targetId.replace('mode-', '').split('-')[0].toUpperCase();
    const modeType = rawModes.find((m) => m.id === targetId)?.type || 'major';
    notes = getModeScale(rootNote, modeType).map((m) => midiToNote(m));
  } else {
    const chordRoot = targetId.replace('chord-', '').split('-')[0].toUpperCase();
    notes = [chordRoot + '4', (chordRoot === 'B' ? 'D5' : chordRoot === 'A' ? 'C5' : chordRoot[0] + '#' + '4'), chordRoot + '5'];
  }

  return {
    id,
    targetId,
    targetType,
    notes: isMismatched ? ['C4', 'C#4', 'D4'] : notes,
    isMismatched,
    quality: isMismatched ? 'error' : 'normal',
    sourceId,
  };
};

export const audioSamples: AudioSample[] = [
  createAudioSample('audio-mode-c-major', 'mode-c-major', 'mode', 'src-1'),
  createAudioSample('audio-mode-g-major', 'mode-g-major', 'mode', 'src-1'),
  createAudioSample('audio-mode-d-major', 'mode-d-major', 'mode', 'src-1'),
  createAudioSample('audio-mode-a-major', 'mode-a-major', 'mode', 'src-1'),
  createAudioSample('audio-mode-f-major', 'mode-f-major', 'mode', 'src-1'),
  createAudioSample('audio-mode-bb-major', 'mode-bb-major', 'mode', 'src-1'),
  createAudioSample('audio-mode-a-minor', 'mode-a-minor', 'mode', 'src-1'),
  createAudioSample('audio-mode-e-minor', 'mode-e-minor', 'mode', 'src-1'),
  createAudioSample('audio-mode-d-minor', 'mode-d-minor', 'mode', 'src-1'),
  createAudioSample('audio-mode-c-dorian', 'mode-c-dorian', 'mode', 'src-3'),
  createAudioSample('audio-mode-d-dorian', 'mode-d-dorian', 'mode', 'src-3'),
  createAudioSample('audio-mode-g-lydian', 'mode-g-lydian', 'mode', 'src-3'),
  createAudioSample('audio-mode-f-mixolydian', 'mode-f-mixolydian', 'mode', 'src-3', true),
  createAudioSample('audio-mode-e-phrygian', 'mode-e-phrygian', 'mode', 'src-3'),
  createAudioSample('audio-mode-b-major-error', 'mode-b-major-error', 'mode', 'src-4', true),
  createAudioSample('audio-mode-c#-major', 'mode-c#-major', 'mode', 'src-4'),
  createAudioSample('audio-mode-db-major', 'mode-db-major', 'mode', 'src-4'),
  createAudioSample('audio-chord-c-major', 'chord-c-major', 'chord', 'src-1'),
  createAudioSample('audio-chord-f-major', 'chord-f-major', 'chord', 'src-1'),
  createAudioSample('audio-chord-g-major', 'chord-g-major', 'chord', 'src-1'),
  createAudioSample('audio-chord-am', 'chord-am', 'chord', 'src-1'),
  createAudioSample('audio-chord-dm', 'chord-dm', 'chord', 'src-1'),
  createAudioSample('audio-chord-em', 'chord-em', 'chord', 'src-1'),
  createAudioSample('audio-chord-b-dim', 'chord-b-dim', 'chord', 'src-4', true),
  createAudioSample('audio-chord-a-minor-tonic', 'chord-a-minor-tonic', 'chord', 'src-1'),
];

export const getMockData = () => ({
  modes: rawModes as Mode[],
  chords,
  modulationPaths,
  audioSamples,
  dataSources,
});
