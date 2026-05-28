import type { EnergyLevel, Transition, SpectrumLine, ExternalField, IssueTrack } from '@/types';

export const initialEnergyLevels: EnergyLevel[] = [
  {
    id: 1,
    n: 1,
    energy_eV: -13.6,
    color: '#ef4444',
    height: 0,
    notes: '基态能级，电子最稳定的状态',
    original_value: JSON.stringify({ n: 1, energy_eV: -13.6, color: '#ef4444' })
  },
  {
    id: 2,
    n: 2,
    energy_eV: -3.4,
    color: '#f97316',
    height: 1.5,
    notes: '第一激发态，Lyman系跃迁终点',
    original_value: JSON.stringify({ n: 2, energy_eV: -3.4, color: '#f97316' })
  },
  {
    id: 3,
    n: 3,
    energy_eV: -1.51,
    color: '#eab308',
    height: 2.8,
    notes: '第二激发态，Balmer系跃迁终点',
    original_value: JSON.stringify({ n: 3, energy_eV: -1.51, color: '#eab308' })
  },
  {
    id: 4,
    n: 4,
    energy_eV: -0.85,
    color: '#22c55e',
    height: 3.8,
    notes: '第三激发态',
    original_value: JSON.stringify({ n: 4, energy_eV: -0.85, color: '#22c55e' })
  },
  {
    id: 5,
    n: 5,
    energy_eV: -0.54,
    color: '#06b6d4',
    height: 4.5,
    notes: '第四激发态',
    original_value: JSON.stringify({ n: 5, energy_eV: -0.54, color: '#06b6d4' })
  },
  {
    id: 6,
    n: 6,
    energy_eV: -0.38,
    color: '#7c3aed',
    height: 5.0,
    notes: '第五激发态，接近电离态',
    original_value: JSON.stringify({ n: 6, energy_eV: -0.38, color: '#7c3aed' })
  }
];

export const initialTransitions: Transition[] = [
  {
    id: 1,
    from_level: 2,
    to_level: 1,
    probability: 0.85,
    selection_rule: 'Δn = -1',
    original_value: JSON.stringify({ probability: 0.85 })
  },
  {
    id: 2,
    from_level: 3,
    to_level: 1,
    probability: 0.62,
    selection_rule: 'Δn = -2',
    original_value: JSON.stringify({ probability: 0.62 })
  },
  {
    id: 3,
    from_level: 3,
    to_level: 2,
    probability: 0.78,
    selection_rule: 'Δn = -1',
    original_value: JSON.stringify({ probability: 0.78 })
  },
  {
    id: 4,
    from_level: 4,
    to_level: 2,
    probability: 0.55,
    selection_rule: 'Δn = -2',
    original_value: JSON.stringify({ probability: 0.55 })
  },
  {
    id: 5,
    from_level: 5,
    to_level: 2,
    probability: 0.42,
    selection_rule: 'Δn = -3',
    original_value: JSON.stringify({ probability: 0.42 })
  },
  {
    id: 6,
    from_level: 4,
    to_level: 1,
    probability: 1.2,
    selection_rule: 'Δn = -3',
    original_value: JSON.stringify({ probability: 1.2 })
  }
];

export const initialSpectrumLines: SpectrumLine[] = [
  {
    id: 1,
    transition_id: 1,
    wavelength_nm: 121.6,
    color_hex: '#8b5cf6',
    intensity: 85,
    series: 'Lyman系',
    original_value: JSON.stringify({ wavelength_nm: 121.6, color_hex: '#8b5cf6' })
  },
  {
    id: 2,
    transition_id: 2,
    wavelength_nm: 102.6,
    color_hex: '#7c3aed',
    intensity: 62,
    series: 'Lyman系',
    original_value: JSON.stringify({ wavelength_nm: 102.6, color_hex: '#7c3aed' })
  },
  {
    id: 3,
    transition_id: 3,
    wavelength_nm: 656.3,
    color_hex: '#ef4444',
    intensity: 78,
    series: 'Balmer系(H-α)',
    original_value: JSON.stringify({ wavelength_nm: 656.3, color_hex: '#ef4444' })
  },
  {
    id: 4,
    transition_id: 4,
    wavelength_nm: 486.1,
    color_hex: '#22c55e',
    intensity: 55,
    series: 'Balmer系(H-β)',
    original_value: JSON.stringify({ wavelength_nm: 486.1, color_hex: '#22c55e' })
  },
  {
    id: 5,
    transition_id: 5,
    wavelength_nm: 434.0,
    color_hex: '#06b6d4',
    intensity: 42,
    series: 'Balmer系(H-γ)',
    original_value: JSON.stringify({ wavelength_nm: 434.0, color_hex: '#06b6d4' })
  },
  {
    id: 6,
    transition_id: 6,
    wavelength_nm: 97.3,
    color_hex: '#ff0000',
    intensity: 40,
    series: 'Lyman系',
    original_value: JSON.stringify({ wavelength_nm: 97.3, color_hex: '#ff0000' })
  }
];

export const initialExternalField: ExternalField = {
  field_type: 'magnetic',
  strength: 0,
  direction: [0, 1, 0],
  effect_description: '无外场时显示正常光谱'
};

export const initialIssueTracks: IssueTrack[] = [
  {
    id: 'issue-001',
    issue_type: 'probability',
    description: '跃迁ID=6的概率值1.2超过了正常范围[0,1]',
    discovered_by: '系统自动检测',
    discovered_at: new Date('2026-05-20T10:30:00'),
    status: 'discovered'
  },
  {
    id: 'issue-002',
    issue_type: 'spectrum_color',
    description: '光谱线ID=6的波长97.3nm属于紫外线，不应显示为红色',
    discovered_by: '系统自动检测',
    discovered_at: new Date('2026-05-20T10:30:00'),
    status: 'discovered'
  }
];
