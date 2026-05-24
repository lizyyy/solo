import { Artifact, FilterState, ArtifactType } from '../types';

export const filterArtifacts = (
  artifacts: Artifact[],
  filters: FilterState
): Artifact[] => {
  return artifacts.filter((artifact) => {
    if (filters.types.length > 0 && !filters.types.includes(artifact.type)) {
      return false;
    }

    if (
      filters.periods.length > 0 &&
      !filters.periods.includes(artifact.period)
    ) {
      return false;
    }

    if (
      artifact.position.z < filters.depthRange[0] ||
      artifact.position.z > filters.depthRange[1]
    ) {
      return false;
    }

    if (
      filters.layerIds.length > 0 &&
      !filters.layerIds.includes(artifact.layerId)
    ) {
      return false;
    }

    return true;
  });
};

export const getUniqueTypes = (artifacts: Artifact[]): ArtifactType[] => {
  const types = new Set<ArtifactType>();
  artifacts.forEach((a) => types.add(a.type));
  return Array.from(types);
};

export const getUniquePeriods = (artifacts: Artifact[]): string[] => {
  const periods = new Set<string>();
  artifacts.forEach((a) => periods.add(a.period));
  return Array.from(periods);
};

export const getTypeLabel = (type: ArtifactType): string => {
  const labels: Record<ArtifactType, string> = {
    pottery: '陶器',
    stone: '石器',
    bone: '骨器',
    metal: '金属器',
    other: '其他',
  };
  return labels[type] || type;
};
