import { create } from 'zustand';
import type { Pin, VoltageDomain, Conflict, ChipPackage } from '@/data/types';
import { chipPackage } from '@/data/chipData';
import { pins } from '@/data/pinData';
import { voltageDomains } from '@/data/voltageDomainData';
import { detectConflicts } from '@/utils/conflictEngine';

interface ChipStore {
  chip: ChipPackage;
  pins: Pin[];
  voltageDomains: VoltageDomain[];
  conflicts: Conflict[];
  init: () => void;
}

export const useChipStore = create<ChipStore>((set) => ({
  chip: chipPackage,
  pins: pins,
  voltageDomains: voltageDomains,
  conflicts: [],
  init: () => {
    const conflicts = detectConflicts(pins, voltageDomains);
    set({ conflicts });
  },
}));
