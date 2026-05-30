import type { Preset, KeyboardModel, PedalMapping } from '@/types';

const INCOMPATIBILITY_RULES: Record<string, string[]> = {
  'Nord Stage 3': ['FM Synth', 'Wavetable Lead'],
  'Korg Kronos': ['Drawbar Organ v1'],
  'Yamaha MODX': ['VA Bass', 'Analog Pad'],
  'Roland Fantom': ['FM Synth'],
  'Kurzweil PC4': ['Wavetable Lead', 'Granular Texture'],
};

export function detectOverrides(presets: Preset[]): {
  newerId: string;
  olderId: string;
  description: string;
}[] {
  const overrides: { newerId: string; olderId: string; description: string }[] = [];
  const byName = new Map<string, Preset[]>();

  for (const p of presets) {
    if (p.isArchived) continue;
    const list = byName.get(p.name) || [];
    list.push(p);
    byName.set(p.name, list);
  }

  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const newer = sorted[i - 1];
      const older = sorted[i];
      const paramsDiffer = JSON.stringify(newer.params) !== JSON.stringify(older.params);
      if (paramsDiffer || newer.version !== older.version) {
        overrides.push({
          newerId: newer.id,
          olderId: older.id,
          description: `预设 "${name}" 存在覆盖：v${newer.version} 覆盖 v${older.version}`,
        });
      }
    }
  }

  return overrides;
}

export function checkModelCompatibility(
  preset: Preset,
  model: KeyboardModel
): { compatible: boolean; reason: string } {
  const modelKey = `${model.brand} ${model.model}`;
  const incompatiblePresets = INCOMPATIBILITY_RULES[modelKey] || [];
  if (incompatiblePresets.includes(preset.name)) {
    return {
      compatible: false,
      reason: `预设 "${preset.name}" 与型号 "${modelKey}" 不兼容`,
    };
  }
  return { compatible: true, reason: '' };
}

export function detectPolarityReversal(
  mappings: PedalMapping[]
): {
  mappingId: string;
  previousMappingId: string | null;
  description: string;
}[] {
  const issues: {
    mappingId: string;
    previousMappingId: string | null;
    description: string;
  }[] = [];
  const byName = new Map<string, PedalMapping[]>();

  for (const m of mappings) {
    if (!m.isActive) continue;
    const list = byName.get(m.name) || [];
    list.push(m);
    byName.set(m.name, list);
  }

  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    );
    const current = sorted[0];
    const previous = sorted[1];
    if (current.polarity !== previous.polarity) {
      issues.push({
        mappingId: current.id,
        previousMappingId: previous.id,
        description: `踏板 "${name}" 极性反转：从 ${previous.polarity === 'normal' ? '正极性' : '反极性'} 变为 ${current.polarity === 'normal' ? '正极性' : '反极性'}`,
      });
    }
  }

  return issues;
}

export function runFullCompatibilityCheck(
  presets: Preset[],
  models: KeyboardModel[],
  mappings: PedalMapping[]
): {
  overrides: ReturnType<typeof detectOverrides>;
  modelIssues: { presetId: string; modelId: string; reason: string }[];
  polarityIssues: ReturnType<typeof detectPolarityReversal>;
} {
  const activePresets = presets.filter((p) => !p.isArchived);
  const overrides = detectOverrides(presets);
  const modelIssues: { presetId: string; modelId: string; reason: string }[] = [];

  for (const preset of activePresets) {
    for (const model of models) {
      const result = checkModelCompatibility(preset, model);
      if (!result.compatible) {
        modelIssues.push({ presetId: preset.id, modelId: model.id, reason: result.reason });
      }
    }
  }

  const polarityIssues = detectPolarityReversal(mappings);

  return { overrides, modelIssues, polarityIssues };
}
