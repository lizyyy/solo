import { guqinData } from './guqin';
import { pipaData } from './pipa';
import { violinData } from './violin';
import type { InstrumentName, InstrumentDataBundle } from '@/types';

export const instrumentDataMap: Record<InstrumentName, InstrumentDataBundle> = {
  '古琴': guqinData,
  '琵琶': pipaData,
  '提琴': violinData,
};

export const instrumentList: InstrumentName[] = ['古琴', '琵琶', '提琴'];

export const getInstrumentData = (name: InstrumentName): InstrumentDataBundle => {
  return instrumentDataMap[name];
};
