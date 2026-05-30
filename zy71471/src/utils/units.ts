import type { TimeUnit, ResistanceUnit, CapacitanceUnit } from '@/types';

export const convertTimeToSeconds = (value: number, unit: TimeUnit): number => {
  switch (unit) {
    case 'μs':
      return value * 1e-6;
    case 'ms':
      return value * 1e-3;
    case 's':
    default:
      return value;
  }
};

export const convertSecondsToTime = (value: number, unit: TimeUnit): number => {
  switch (unit) {
    case 'μs':
      return value * 1e6;
    case 'ms':
      return value * 1e3;
    case 's':
    default:
      return value;
  }
};

export const convertResistanceToOhms = (value: number, unit: ResistanceUnit): number => {
  switch (unit) {
    case 'MΩ':
      return value * 1e6;
    case 'kΩ':
      return value * 1e3;
    case 'Ω':
    default:
      return value;
  }
};

export const convertOhmsToResistance = (value: number, unit: ResistanceUnit): number => {
  switch (unit) {
    case 'MΩ':
      return value * 1e-6;
    case 'kΩ':
      return value * 1e-3;
    case 'Ω':
    default:
      return value;
  }
};

export const convertCapacitanceToFarads = (value: number, unit: CapacitanceUnit): number => {
  switch (unit) {
    case 'pF':
      return value * 1e-12;
    case 'nF':
      return value * 1e-9;
    case 'μF':
      return value * 1e-6;
    case 'F':
    default:
      return value;
  }
};

export const convertFaradsToCapacitance = (value: number, unit: CapacitanceUnit): number => {
  switch (unit) {
    case 'pF':
      return value * 1e12;
    case 'nF':
      return value * 1e9;
    case 'μF':
      return value * 1e6;
    case 'F':
    default:
      return value;
  }
};

export const formatTime = (seconds: number, targetUnit: TimeUnit): string => {
  const value = convertSecondsToTime(seconds, targetUnit);
  return `${value.toFixed(4)} ${targetUnit}`;
};

export const formatResistance = (ohms: number, targetUnit: ResistanceUnit): string => {
  const value = convertOhmsToResistance(ohms, targetUnit);
  return `${value.toFixed(2)} ${targetUnit}`;
};

export const formatCapacitance = (farads: number, targetUnit: CapacitanceUnit): string => {
  const value = convertFaradsToCapacitance(farads, targetUnit);
  return `${value.toFixed(2)} ${targetUnit}`;
};

export const calculateTheoreticalTau = (
  resistance: number | null,
  resistanceUnit: ResistanceUnit,
  capacitance: number | null,
  capacitanceUnit: CapacitanceUnit
): number | null => {
  if (resistance === null || capacitance === null) return null;
  const r = convertResistanceToOhms(resistance, resistanceUnit);
  const c = convertCapacitanceToFarads(capacitance, capacitanceUnit);
  return r * c;
};
