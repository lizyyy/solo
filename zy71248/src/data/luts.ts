
import { LUTPreset } from '../types';

function generateIdentityLUT(size: number): number[][][] {
  const lut: number[][][] = [];
  for (let r = 0; r < size; r++) {
    lut[r] = [];
    for (let g = 0; g < size; g++) {
      lut[r][g] = [];
      for (let b = 0; b < size; b++) {
        const value = (r + g + b) / (3 * (size - 1));
        lut[r][g][b] = value;
      }
    }
  }
  return lut;
}

function generateCinematicLUT(size: number): number[][][] {
  const lut: number[][][] = [];
  for (let r = 0; r < size; r++) {
    lut[r] = [];
    for (let g = 0; g < size; g++) {
      lut[r][g] = [];
      for (let b = 0; b < size; b++) {
        const rn = r / (size - 1);
        const gn = g / (size - 1);
        const bn = b / (size - 1);
        
        const luminance = 0.299 * rn + 0.587 * gn + 0.114 * bn;
        const contrast = Math.pow(luminance, 0.85);
        
        const rOut = contrast * 0.95 + rn * 0.05;
        const gOut = contrast * 0.9 + gn * 0.1;
        const bOut = contrast * 0.85 + bn * 0.15 + 0.05;
        
        lut[r][g][b] = (rOut + gOut + bOut) / 3;
      }
    }
  }
  return lut;
}

function generateVintageLUT(size: number): number[][][] {
  const lut: number[][][] = [];
  for (let r = 0; r < size; r++) {
    lut[r] = [];
    for (let g = 0; g < size; g++) {
      lut[r][g] = [];
      for (let b = 0; b < size; b++) {
        const rn = r / (size - 1);
        const gn = g / (size - 1);
        const bn = b / (size - 1);
        
        const rOut = Math.pow(rn, 0.9) * 1.05;
        const gOut = Math.pow(gn, 0.95) * 0.95;
        const bOut = Math.pow(bn, 1.1) * 0.85;
        
        lut[r][g][b] = (rOut + gOut + bOut) / 3;
      }
    }
  }
  return lut;
}

function generateCoolToneLUT(size: number): number[][][] {
  const lut: number[][][] = [];
  for (let r = 0; r < size; r++) {
    lut[r] = [];
    for (let g = 0; g < size; g++) {
      lut[r][g] = [];
      for (let b = 0; b < size; b++) {
        const rn = r / (size - 1);
        const gn = g / (size - 1);
        const bn = b / (size - 1);
        
        const rOut = rn * 0.85;
        const gOut = gn * 0.95 + 0.05;
        const bOut = Math.min(bn * 1.15 + 0.05, 1);
        
        lut[r][g][b] = (rOut + gOut + bOut) / 3;
      }
    }
  }
  return lut;
}

function generateWarmToneLUT(size: number): number[][][] {
  const lut: number[][][] = [];
  for (let r = 0; r < size; r++) {
    lut[r] = [];
    for (let g = 0; g < size; g++) {
      lut[r][g] = [];
      for (let b = 0; b < size; b++) {
        const rn = r / (size - 1);
        const gn = g / (size - 1);
        const bn = b / (size - 1);
        
        const rOut = Math.min(rn * 1.15 + 0.05, 1);
        const gOut = gn * 0.95;
        const bOut = bn * 0.8;
        
        lut[r][g][b] = (rOut + gOut + bOut) / 3;
      }
    }
  }
  return lut;
}

function generateBWLUT(size: number): number[][][] {
  const lut: number[][][] = [];
  for (let r = 0; r < size; r++) {
    lut[r] = [];
    for (let g = 0; g < size; g++) {
      lut[r][g] = [];
      for (let b = 0; b < size; b++) {
        const rn = r / (size - 1);
        const gn = g / (size - 1);
        const bn = b / (size - 1);
        
        const luminance = 0.299 * rn + 0.587 * gn + 0.114 * bn;
        const contrasted = Math.pow(luminance, 0.95);
        
        lut[r][g][b] = contrasted;
      }
    }
  }
  return lut;
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
