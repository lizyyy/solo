import type { Material } from '../types';

export const MATERIALS: Material[] = [
  {
    id: 'pla',
    name: 'PLA',
    thermalExpansionCoeff: 80,
    glassTransitionTemp: 60,
    meltingTemp: 190,
    adhesionStrength: 4,
    recommendedBedTemp: 60,
    recommendedNozzleTemp: 200,
    heatResistance: 2,
    warpResistance: 4,
  },
  {
    id: 'abs',
    name: 'ABS',
    thermalExpansionCoeff: 95,
    glassTransitionTemp: 105,
    meltingTemp: 240,
    adhesionStrength: 3,
    recommendedBedTemp: 100,
    recommendedNozzleTemp: 240,
    heatResistance: 4,
    warpResistance: 2,
  },
  {
    id: 'petg',
    name: 'PETG',
    thermalExpansionCoeff: 70,
    glassTransitionTemp: 85,
    meltingTemp: 230,
    adhesionStrength: 4,
    recommendedBedTemp: 80,
    recommendedNozzleTemp: 230,
    heatResistance: 3,
    warpResistance: 4,
  },
  {
    id: 'nylon',
    name: '尼龙(PA)',
    thermalExpansionCoeff: 110,
    glassTransitionTemp: 55,
    meltingTemp: 260,
    adhesionStrength: 2,
    recommendedBedTemp: 90,
    recommendedNozzleTemp: 250,
    heatResistance: 4,
    warpResistance: 1,
  },
  {
    id: 'tpu',
    name: 'TPU',
    thermalExpansionCoeff: 150,
    glassTransitionTemp: -40,
    meltingTemp: 220,
    adhesionStrength: 5,
    recommendedBedTemp: 50,
    recommendedNozzleTemp: 220,
    heatResistance: 2,
    warpResistance: 5,
  },
  {
    id: 'pc',
    name: 'PC(聚碳酸酯)',
    thermalExpansionCoeff: 75,
    glassTransitionTemp: 150,
    meltingTemp: 280,
    adhesionStrength: 3,
    recommendedBedTemp: 120,
    recommendedNozzleTemp: 270,
    heatResistance: 5,
    warpResistance: 3,
  },
];

export const getMaterialById = (id: string): Material | undefined => {
  return MATERIALS.find((m) => m.id === id);
};

export const getMaterialName = (id: string): string => {
  return MATERIALS.find((m) => m.id === id)?.name || '未知材料';
};
