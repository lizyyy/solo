
import { LUTPreset } from '../types';

type LUTData = number[][][][];

function generateIdentityLUT(size: number): LUTData {
  const lut: LUTData = [];
  for (let ri = 0; ri < size; ri++) {
    lut[ri] = [];
    for (let gi = 0; gi < size; gi++) {
      lut[ri][gi] = [];
      for (let bi = 0; bi < size; bi++) {
        lut[ri][gi][bi] = [
          Math.round(ri / (size - 1) * 255),
          Math.round(gi / (size - 1) * 255),
          Math.round(bi / (size - 1) * 255),
        ];
      }
    }
  }
  return lut;
}

function generateCinematicLUT(size: number): LUTData {
  const lut: LUTData = [];
  for (let ri = 0; ri < size; ri++) {
    lut[ri] = [];
    for (let gi = 0; gi < size; gi++) {
      lut[ri][gi] = [];
      for (let bi = 0; bi < size; bi++) {
        const rn = ri / (size - 1);
        const gn = gi / (size - 1);
        const bn = bi / (size - 1);

        const luminance = 0.299 * rn + 0.587 * gn + 0.114 * bn;
        const contrast = Math.pow(luminance, 0.85);

        const rOut = clamp01(contrast * 0.95 + rn * 0.05 + 0.02);
        const gOut = clamp01(contrast * 0.90 + gn * 0.10);
        const bOut = clamp01(contrast * 0.85 + bn * 0.15 + 0.06);

        lut[ri][gi][bi] = [
          Math.round(rOut * 255),
          Math.round(gOut * 255),
          Math.round(bOut * 255),
        ];
      }
    }
  }
  return lut;
}

function generateVintageLUT(size: number): LUTData {
  const lut: LUTData = [];
  for (let ri = 0; ri < size; ri++) {
    lut[ri] = [];
    for (let gi = 0; gi < size; gi++) {
      lut[ri][gi] = [];
      for (let bi = 0; bi < size; bi++) {
        const rn = ri / (size - 1);
        const gn = gi / (size - 1);
        const bn = bi / (size - 1);

        const rOut = clamp01(Math.pow(rn, 0.9) * 1.1 + 0.03);
        const gOut = clamp01(Math.pow(gn, 0.95) * 0.95);
        const bOut = clamp01(Math.pow(bn, 1.1) * 0.82);

        lut[ri][gi][bi] = [
          Math.round(rOut * 255),
          Math.round(gOut * 255),
          Math.round(bOut * 255),
        ];
      }
    }
  }
  return lut;
}

function generateCoolToneLUT(size: number): LUTData {
  const lut: LUTData = [];
  for (let ri = 0; ri < size; ri++) {
    lut[ri] = [];
    for (let gi = 0; gi < size; gi++) {
      lut[ri][gi] = [];
      for (let bi = 0; bi < size; bi++) {
        const rn = ri / (size - 1);
        const gn = gi / (size - 1);
        const bn = bi / (size - 1);

        const rOut = clamp01(rn * 0.82);
        const gOut = clamp01(gn * 0.95 + 0.04);
        const bOut = clamp01(bn * 1.18 + 0.06);

        lut[ri][gi][bi] = [
          Math.round(rOut * 255),
          Math.round(gOut * 255),
          Math.round(bOut * 255),
        ];
      }
    }
  }
  return lut;
}

function generateWarmToneLUT(size: number): LUTData {
  const lut: LUTData = [];
  for (let ri = 0; ri < size; ri++) {
    lut[ri] = [];
    for (let gi = 0; gi < size; gi++) {
      lut[ri][gi] = [];
      for (let bi = 0; bi < size; bi++) {
        const rn = ri / (size - 1);
        const gn = gi / (size - 1);
        const bn = bi / (size - 1);

        const rOut = clamp01(rn * 1.18 + 0.06);
        const gOut = clamp01(gn * 0.95 + 0.02);
        const bOut = clamp01(bn * 0.78);

        lut[ri][gi][bi] = [
          Math.round(rOut * 255),
          Math.round(gOut * 255),
          Math.round(bOut * 255),
        ];
      }
    }
  }
  return lut;
}

function generateBWLUT(size: number): LUTData {
  const lut: LUTData = [];
  for (let ri = 0; ri < size; ri++) {
    lut[ri] = [];
    for (let gi = 0; gi < size; gi++) {
      lut[ri][gi] = [];
      for (let bi = 0; bi < size; bi++) {
        const rn = ri / (size - 1);
        const gn = gi / (size - 1);
        const bn = bi / (size - 1);

        const luminance = 0.299 * rn + 0.587 * gn + 0.114 * bn;
        const contrasted = clamp01(Math.pow(luminance, 0.9));

        const v = Math.round(contrasted * 255);
        lut[ri][gi][bi] = [v, v, v];
      }
    }
  }
  return lut;
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

const LUT_SIZE = 16;

export const LUT_PRESETS: LUTPreset[] = [
  {
    id: 'none',
    name: '无 LUT',
    description: '不应用任何色彩风格',
    data: generateIdentityLUT(LUT_SIZE),
  },
  {
    id: 'cinematic',
    name: '电影感',
    description: '高对比度，偏冷色调，经典电影风格',
    data: generateCinematicLUT(LUT_SIZE),
  },
  {
    id: 'vintage',
    name: '复古',
    description: '暖色调，褪色效果，怀旧感',
    data: generateVintageLUT(LUT_SIZE),
  },
  {
    id: 'cool',
    name: '冷调',
    description: '青蓝色调，科技感，冷峻氛围',
    data: generateCoolToneLUT(LUT_SIZE),
  },
  {
    id: 'warm',
    name: '暖调',
    description: '金黄色调，温暖阳光，怀旧胶片',
    data: generateWarmToneLUT(LUT_SIZE),
  },
  {
    id: 'bw',
    name: '黑白',
    description: '高对比黑白，经典银盐质感',
    data: generateBWLUT(LUT_SIZE),
  },
];

export function getLUTById(id: string): LUTPreset | undefined {
  return LUT_PRESETS.find((lut) => lut.id === id);
}
