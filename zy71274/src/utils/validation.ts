import type { EnergyLevel, Transition, SpectrumLine, ValidationResult } from '@/types';
import { wavelengthToColor, colorDistance } from './physics';

export function validateEnergyLevels(levels: EnergyLevel[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  const sorted = [...levels].sort((a, b) => a.n - b.n);
  
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].energy_eV >= sorted[i + 1].energy_eV) {
      results.push({
        type: 'energy_order',
        level: 'error',
        message: `能级顺序错误: n=${sorted[i].n}的能量(${sorted[i].energy_eV}eV)应小于n=${sorted[i + 1].n}的能量(${sorted[i + 1].energy_eV}eV)`,
        suggestion: '氢原子能级能量应随n增大而增大(更接近0)',
        affected_ids: [sorted[i].id, sorted[i + 1].id]
      });
    }
  }
  
  return results;
}

export function validateTransitions(transitions: Transition[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  transitions.forEach((t) => {
    if (t.probability < 0 || t.probability > 1) {
      results.push({
        type: 'probability',
        level: 'error',
        message: `跃迁ID=${t.id}: 概率值${t.probability}超出正常范围[0, 1]`,
        suggestion: '请将概率值修正到0到1之间，建议值: ' + Math.min(1, Math.max(0, t.probability)).toFixed(2),
        affected_ids: [t.id]
      });
    }
  });
  
  return results;
}

export function validateSpectrumLines(
  lines: SpectrumLine[],
  transitions: Transition[],
  levels: EnergyLevel[]
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  lines.forEach((line) => {
    const transition = transitions.find(t => t.id === line.transition_id);
    if (!transition) return;
    
    const fromLevel = levels.find(l => l.id === transition.from_level);
    const toLevel = levels.find(l => l.id === transition.to_level);
    
    if (fromLevel && toLevel) {
      const expectedColor = wavelengthToColor(line.wavelength_nm);
      const distance = colorDistance(line.color_hex, expectedColor);
      
      if (distance > 80) {
        results.push({
          type: 'spectrum_color',
          level: 'error',
          message: `光谱线ID=${line.id}: 波长${line.wavelength_nm}nm的颜色配置${line.color_hex}与理论颜色${expectedColor}不匹配`,
          suggestion: `建议将颜色修正为: ${expectedColor}`,
          affected_ids: [line.id]
        });
      }
    }
    
    if (line.wavelength_nm < 10 || line.wavelength_nm > 2000) {
      results.push({
        type: 'spectrum_color',
        level: 'warning',
        message: `光谱线ID=${line.id}: 波长${line.wavelength_nm}nm不在可见光有效范围内`,
        suggestion: '可见光波长范围约为380-750nm',
        affected_ids: [line.id]
      });
    }
  });
  
  return results;
}

export function runAllValidations(
  levels: EnergyLevel[],
  transitions: Transition[],
  spectrumLines: SpectrumLine[]
): ValidationResult[] {
  return [
    ...validateEnergyLevels(levels),
    ...validateTransitions(transitions),
    ...validateSpectrumLines(spectrumLines, transitions, levels)
  ];
}
