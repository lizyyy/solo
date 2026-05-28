import { create } from 'zustand';
import { Artwork, QualityReport } from '../types/artwork';
import { ARTWORKS } from '../data/artworks';
import { generateQualityReports, updateArtworkQualityFlags } from '../utils/qualityChecker';
import { mergeArtworkVersions } from '../utils/versionManager';

interface ArtworkState {
  artworks: Artwork[];
  selectedArtworkId: string | null;
  highlightedClusterId: string | null;
  qualityAlerts: QualityReport[];
  focusedAlertId: string | null;
  isLoading: boolean;
  
  setArtworks: (artworks: Artwork[]) => void;
  selectArtwork: (id: string | null) => void;
  highlightCluster: (id: string | null) => void;
  addVersion: (artworkId: string, newData: Partial<Artwork>) => void;
  recalculateQuality: () => void;
  focusAlert: (alertId: string | null) => void;
  loadDemoData: () => void;
  getSelectedArtwork: () => Artwork | undefined;
  getArtworkAlerts: (artworkId: string) => QualityReport[];
  clearQualityAlert: (artworkId: string) => void;
}

export const useArtworkStore = create<ArtworkState>((set, get) => ({
  artworks: [],
  selectedArtworkId: null,
  highlightedClusterId: null,
  qualityAlerts: [],
  focusedAlertId: null,
  isLoading: true,

  setArtworks: (artworks) => {
    const updated = artworks.map(updateArtworkQualityFlags);
    set({ artworks: updated });
    get().recalculateQuality();
  },

  selectArtwork: (id) => set({ selectedArtworkId: id }),

  highlightCluster: (id) => set({ highlightedClusterId: id }),

  addVersion: (artworkId, newData) => {
    const { artworks } = get();
    const existing = artworks.find(a => a.id === artworkId);
    if (!existing) return;

    const updated = mergeArtworkVersions(existing, newData);
    const updatedArtworks = artworks.map(a => 
      a.id === artworkId ? updated : a
    );
    
    set({ artworks: updatedArtworks });
    get().recalculateQuality();
  },

  recalculateQuality: () => {
    const { artworks } = get();
    const alerts = generateQualityReports(artworks);
    set({ qualityAlerts: alerts });
  },

  focusAlert: (alertId) => set({ focusedAlertId: alertId }),

  loadDemoData: () => {
    set({ isLoading: true });
    setTimeout(() => {
      const updated = ARTWORKS.map(updateArtworkQualityFlags);
      const alerts = generateQualityReports(updated);
      set({ 
        artworks: updated, 
        qualityAlerts: alerts,
        isLoading: false 
      });
    }, 500);
  },

  getSelectedArtwork: () => {
    const { artworks, selectedArtworkId } = get();
    return artworks.find(a => a.id === selectedArtworkId);
  },

  getArtworkAlerts: (artworkId) => {
    const { qualityAlerts } = get();
    return qualityAlerts.filter(a => a.artworkId === artworkId);
  },

  clearQualityAlert: (artworkId) => {
    const { qualityAlerts } = get();
    set({
      qualityAlerts: qualityAlerts.filter(a => a.artworkId !== artworkId)
    });
  }
}));
