import { useMemo } from 'react';
import { useArtworkStore } from '../store/useArtworkStore';
import { useFilterStore } from '../store/useFilterStore';
import { completeMissingFields } from '../utils/versionManager';

export function useFilteredArtworks() {
  const artworks = useArtworkStore(state => state.artworks);
  const filterState = useFilterStore();
  const checkFilterFailure = useFilterStore(state => state.checkFilterFailure);

  const filtered = useMemo(() => {
    let result = [...artworks];

    if (filterState.selectedClassIds.length > 0) {
      result = result.filter(a => 
        filterState.selectedClassIds.includes(a.classId)
      );
    }

    result = result.filter(a => {
      const hue = a.hue ?? 180;
      const lightness = a.lightness ?? 50;
      const saturation = a.saturation ?? 50;

      return (
        hue >= filterState.hueRange[0] && hue <= filterState.hueRange[1] &&
        lightness >= filterState.lightnessRange[0] && lightness <= filterState.lightnessRange[1] &&
        saturation >= filterState.saturationRange[0] && saturation <= filterState.saturationRange[1]
      );
    });

    if (filterState.showQualityFlags.length > 0) {
      result = result.filter(a => 
        filterState.showQualityFlags.some(flag => a.qualityFlags[flag])
      );
    }

    checkFilterFailure(result.length);

    return result;
  }, [artworks, filterState, checkFilterFailure]);

  const filteredWithCompleteData = useMemo(() => 
    filtered.map(completeMissingFields),
    [filtered]
  );

  const stats = useMemo(() => ({
    total: artworks.length,
    filtered: filtered.length,
    byClass: filtered.reduce((acc, a) => {
      acc[a.className] = (acc[a.className] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  }), [artworks, filtered]);

  return {
    filteredArtworks: filteredWithCompleteData,
    rawFiltered: filtered,
    stats,
    isFiltered: filtered.length !== artworks.length
  };
}
