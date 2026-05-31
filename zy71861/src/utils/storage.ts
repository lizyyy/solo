import { EvidenceChain, StudentMistake, LectureSnapshot, ManualCorrection, Commentary } from '@/types';

const STORAGE_KEYS = {
  CHAINS: 'geometry_chains',
  MISTAKES: 'geometry_mistakes',
  SNAPSHOTS: 'geometry_snapshots',
  CORRECTIONS: 'geometry_corrections',
  COMMENTARIES: 'geometry_commentaries',
};

export const storage = {
  saveChains: (chains: EvidenceChain[]): void => {
    localStorage.setItem(STORAGE_KEYS.CHAINS, JSON.stringify(chains));
  },

  getChains: (): EvidenceChain[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CHAINS);
    return data ? JSON.parse(data) : [];
  },

  saveMistakes: (mistakes: StudentMistake[]): void => {
    localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(mistakes));
  },

  getMistakes: (): StudentMistake[] => {
    const data = localStorage.getItem(STORAGE_KEYS.MISTAKES);
    return data ? JSON.parse(data) : [];
  },

  saveSnapshots: (snapshots: LectureSnapshot[]): void => {
    localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
  },

  getSnapshots: (): LectureSnapshot[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
    return data ? JSON.parse(data) : [];
  },

  saveCorrections: (corrections: ManualCorrection[]): void => {
    localStorage.setItem(STORAGE_KEYS.CORRECTIONS, JSON.stringify(corrections));
  },

  getCorrections: (): ManualCorrection[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CORRECTIONS);
    return data ? JSON.parse(data) : [];
  },

  saveCommentaries: (commentaries: Commentary[]): void => {
    localStorage.setItem(STORAGE_KEYS.COMMENTARIES, JSON.stringify(commentaries));
  },

  getCommentaries: (): Commentary[] => {
    const data = localStorage.getItem(STORAGE_KEYS.COMMENTARIES);
    return data ? JSON.parse(data) : [];
  },

  clearAll: (): void => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  },

  exportAll: (): string => {
    return JSON.stringify({
      chains: storage.getChains(),
      mistakes: storage.getMistakes(),
      snapshots: storage.getSnapshots(),
      corrections: storage.getCorrections(),
      commentaries: storage.getCommentaries(),
    }, null, 2);
  },
};
