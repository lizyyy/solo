import { EsiLevel, Patient } from '../types/game';
import { esiRules } from '../data/levels';

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getEsiColor = (level: EsiLevel): string => {
  return esiRules[level].color;
};

export const getEsiBgColor = (level: EsiLevel): string => {
  return esiRules[level].bgColor;
};

export const getEsiBorderColor = (level: EsiLevel): string => {
  return esiRules[level].borderColor;
};

export const getEsiName = (level: EsiLevel): string => {
  return esiRules[level].name;
};

export const getWaitTimeRemaining = (patient: Patient, currentTime: number): number => {
  const elapsed = currentTime - patient.arrivalTime;
  return Math.max(0, patient.maxWaitTime - elapsed);
};

export const getWaitTimePercentage = (patient: Patient, currentTime: number): number => {
  const remaining = getWaitTimeRemaining(patient, currentTime);
  return (remaining / patient.maxWaitTime) * 100;
};

export const isWaitTimeCritical = (patient: Patient, currentTime: number): boolean => {
  const percentage = getWaitTimePercentage(patient, currentTime);
  return percentage < 30;
};

export const getGenderIcon = (gender: 'male' | 'female'): string => {
  return gender === 'male' ? '♂' : '♀';
};

export const getVitalSignStatus = (key: keyof Patient['vitalSigns'], value: number | string): 'normal' | 'warning' | 'critical' => {
  const ranges: Record<string, { normal: [number, number]; warning: [number, number] }> = {
    heartRate: { normal: [60, 100], warning: [50, 120] },
    respiratoryRate: { normal: [12, 20], warning: [10, 28] },
    oxygenSaturation: { normal: [95, 100], warning: [90, 100] },
    temperature: { normal: [36.1, 37.2], warning: [35.5, 38.5] }
  };

  if (key === 'bloodPressure') {
    const [systolic] = String(value).split('/').map(Number);
    if (systolic < 90 || systolic > 180) return 'critical';
    if (systolic < 100 || systolic > 160) return 'warning';
    return 'normal';
  }

  const numValue = Number(value);
  const range = ranges[key];
  
  if (!range) return 'normal';
  
  if (numValue < range.warning[0] || numValue > range.warning[1]) return 'critical';
  if (numValue < range.normal[0] || numValue > range.normal[1]) return 'warning';
  return 'normal';
};

export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
