import { VoltageDomain } from './types';

export const voltageDomains: VoltageDomain[] = [
  { id: 'vd_core', name: 'VCC_CORE', nominalVoltage: 1.2, color: '#00ffd5' },
  { id: 'vd_io', name: 'VCC_IO', nominalVoltage: 3.3, color: '#ff6b35' },
  { id: 'vd_ddr', name: 'VCC_DDR', nominalVoltage: 1.5, color: '#c084fc' },
  { id: 'vd_ana', name: 'VCC_ANA', nominalVoltage: 1.8, color: '#f472b6' },
  { id: 'vd_gnd', name: 'GND', nominalVoltage: 0, color: '#64748b' },
];
