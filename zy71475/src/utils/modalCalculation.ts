import type { BoxDimensions, SoundHole, WoodMaterial, FrequencyPeak, LengthUnit, DensityUnit } from '@/types';
import { toMM, toKgM3 } from './unitConversion';

const SPEED_OF_SOUND = 343;

export function calculateHelmholtzFrequency(dims: BoxDimensions, sh: SoundHole, lengthUnit: LengthUnit): number {
  const lengthM = toMM(dims.length, lengthUnit) / 1000;
  const widthM = toMM(dims.width, lengthUnit) / 1000;
  const depthM = toMM(dims.depth, lengthUnit) / 1000;
  const diaM = toMM(sh.diameter, lengthUnit) / 1000;

  const V = lengthM * widthM * depthM;
  const S = Math.PI * Math.pow(diaM / 2, 2);
  const L_eff = diaM * 1.7;

  const f = (SPEED_OF_SOUND / (2 * Math.PI)) * Math.sqrt(S / (V * L_eff));
  return Math.round(f * 100) / 100;
}

export function calculatePanelModes(wood: WoodMaterial, dims: BoxDimensions, lengthUnit: LengthUnit, densityUnit: DensityUnit, count: number = 5): FrequencyPeak[] {
  const E = wood.elasticModulus * 1e9;
  const rho = toKgM3(wood.density, densityUnit);
  const L = toMM(dims.length, lengthUnit) / 1000;
  const peaks: FrequencyPeak[] = [];

  for (let n = 1; n <= count; n++) {
    const f_n = (n * Math.PI / (2 * L)) * Math.sqrt(E / rho);
    peaks.push({
      id: `panel-mode-${n}`,
      recordId: '',
      frequency: Math.round(f_n * 100) / 100,
      amplitude: 1 / n,
      modeLabel: `面板模态 n=${n}`,
      isOverlapping: false,
    });
  }
  return peaks;
}

export function detectOverlappingPeaks(allPeaks: FrequencyPeak[], threshold: number = 5): FrequencyPeak[] {
  const sorted = [...allPeaks].sort((a, b) => a.frequency - b.frequency);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (Math.abs(sorted[i].frequency - sorted[j].frequency) < threshold) {
        sorted[i].isOverlapping = true;
        sorted[j].isOverlapping = true;
      }
    }
  }
  return sorted;
}

export function calculateAllPeaks(
  dims: BoxDimensions,
  sh: SoundHole,
  wood: WoodMaterial,
  lengthUnit: LengthUnit,
  densityUnit: DensityUnit,
  recordId: string
): FrequencyPeak[] {
  const helmholtz = calculateHelmholtzFrequency(dims, sh, lengthUnit);
  const panelModes = calculatePanelModes(wood, dims, lengthUnit, densityUnit, 5);

  const allPeaks: FrequencyPeak[] = [
    {
      id: `${recordId}-helmholtz`,
      recordId,
      frequency: helmholtz,
      amplitude: 1,
      modeLabel: 'Helmholtz 共振',
      isOverlapping: false,
    },
    ...panelModes.map((p) => ({
      ...p,
      id: `${recordId}-${p.id}`,
      recordId,
    })),
  ];

  return detectOverlappingPeaks(allPeaks);
}
