import { useMemo, useEffect, useRef } from 'react';
import { useArtworkStore } from '../store/useArtworkStore';
import { useFilterStore } from '../store/useFilterStore';
import { completeMissingFields } from '../utils/versionManager';

export function useFilteredArtworks() {
  const artworks = useArtworkStore(state => state.artworks);
  
  const selectedClassIds = useFilterStore(state => state.selectedClassIds);
  const hueRange = useFilterStore(state => state.hueRange);
  const lightnessRange = useFilterStore(state => state.lightnessRange);
  const saturationRange = useFilterStore(state => state.saturationRange);
  const showQualityFlags = useFilterStore(state => state.showQualityFlags);
  const checkFilterFailure = useFilterStore(state => state.checkFilterFailure);

  const lastResultCount = useRef<number | null>(null);

  const filtered = useMemo(() => {
    let result = [...artworks];

    if (selectedClassIds.length > 0) {
      result = result.filter(a => 
        selectedClassIds.includes(a.classId)
      );
    }

    result = result.filter(a => {
      const hue = a.hue ?? 180;
      const lightness = a.lightness ?? 50;
      const saturation = a.saturation ?? 50;

      return (
        hue >= hueRange[0] && hue <= hueRange[1] &&
        lightness >= lightnessRange[0] && lightness <= lightnessRange[1] &&
        saturation >= saturationRange[0] && saturation <= saturationRange[1]
      );
    });

    if (showQualityFlags.length > 0) {
      result = result.filter(a => 
        showQualityFlags.some(flag => a.qualityFlags[flag])
      );
    }

    return result;
  }, [artworks, selectedClassIds, hueRange, lightnessRange, saturationRange, showQualityFlags]);

  useEffect(() => {
    if (lastResultCount.current !== filtered.length) {
      lastResultCount.current = filtered.length;
      checkFilterFailure(filtered.length);
    }
  }, [filtered.length, checkFilterFailure]);

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
