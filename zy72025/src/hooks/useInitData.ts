import { useEffect } from 'react';
import { LocalStorage } from '@/storage/LocalStorage';
import { allMockLevels } from '@/data/mockLevels';

export function useInitData() {
  useEffect(() => {
    const levels = LocalStorage.getLevels();
    
    if (levels.length === 0) {
      LocalStorage.saveLevels(allMockLevels);
    }
  }, []);
}

export function initMockData() {
  LocalStorage.saveLevels(allMockLevels);
}
