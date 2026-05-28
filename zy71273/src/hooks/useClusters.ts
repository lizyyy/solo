import { useMemo } from 'react';
import { useArtworkStore } from '../store/useArtworkStore';
import { useSceneStore } from '../store/useSceneStore';
import { calculateClassClusters, calculateColorClusters } from '../utils/clusterAnalysis';
import { completeMissingFields } from '../utils/versionManager';

export function useClusters() {
  const artworks = useArtworkStore(state => state.artworks);
  const clusterMode = useSceneStore(state => state.settings.clusterMode);
  const highlightedClusterId = useArtworkStore(state => state.highlightedClusterId);

  const clusters = useMemo(() => {
    const completeArtworks = artworks.map(completeMissingFields);
    
    switch (clusterMode) {
      case 'class':
        return calculateClassClusters(completeArtworks);
      case 'color':
        return calculateColorClusters(completeArtworks, 5);
      default:
        return [];
    }
  }, [artworks, clusterMode]);

  const highlightedCluster = useMemo(() => 
    clusters.find(c => c.clusterId === highlightedClusterId),
    [clusters, highlightedClusterId]
  );

  const getArtworkCluster = (artworkId: string) => {
    return clusters.find(c => c.members.includes(artworkId));
  };

  const getClusterColor = (cluster: { color?: string; className?: string; clusterId?: string }) => {
    if (cluster.color) return cluster.color;
    return `hsl(${(parseInt(cluster.clusterId || '0') * 60) % 360}, 70%, 60%)`;
  };

  return {
    clusters,
    highlightedCluster,
    getArtworkCluster,
    isHighlighted: (artworkId: string) => {
      if (!highlightedClusterId) return false;
      const cluster = clusters.find(c => c.clusterId === highlightedClusterId);
      return cluster?.members.includes(artworkId) ?? false;
    },
    getClusterColor
  };
}
