import { create } from 'zustand';
import type {
  GameState,
  Artwork,
  Collector,
  Booth,
  AuctionRecord,
  ReplayScene,
  ReportData
} from '../types';
import { mockArtworks, mockCollectors, mockBooths } from '../data/mockData';
import { executeAuctionRound } from '../utils/auctionEngine';
import { sanitizeReport } from '../utils/sanitizer';

interface GameStore {
  gameState: GameState;
  artworks: Artwork[];
  collectors: Collector[];
  booths: Booth[];
  auctionRecords: AuctionRecord[];
  replayScenes: ReplayScene[];
  currentAuctionIndex: number;
  isAuctionRunning: boolean;

  initGame: () => void;
  setPhase: (phase: GameState['phase']) => void;
  assignArtworkToBooth: (artworkId: string, boothId: string) => void;
  removeArtworkFromBooth: (boothId: string) => void;
  setReservePrice: (boothId: string, price: number) => void;
  setRoyaltyRate: (boothId: string, rate: number) => void;
  updateArtwork: (artworkId: string, updates: Partial<Artwork>) => void;
  resolveConflict: (artworkId: string, conflictIndex: number) => void;
  startAuctionRound: () => Promise<void>;
  processNextAuction: () => void;
  calculateSettlement: () => void;
  generateReport: (sanitized?: boolean) => ReportData;
  nextRound: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: {
    currentRound: 1,
    totalRounds: 3,
    phase: 'home',
    totalRevenue: 0,
    totalRoyalties: 0,
    galleryReputation: 100
  },
  artworks: [],
  collectors: [],
  booths: [],
  auctionRecords: [],
  replayScenes: [],
  currentAuctionIndex: 0,
  isAuctionRunning: false,

  initGame: () => {
    set({
      gameState: {
        currentRound: 1,
        totalRounds: 3,
        phase: 'artworks',
        totalRevenue: 0,
        totalRoyalties: 0,
        galleryReputation: 100
      },
      artworks: JSON.parse(JSON.stringify(mockArtworks)),
      collectors: JSON.parse(JSON.stringify(mockCollectors)),
      booths: JSON.parse(JSON.stringify(mockBooths)),
      auctionRecords: [],
      replayScenes: [],
      currentAuctionIndex: 0,
      isAuctionRunning: false
    });
  },

  setPhase: (phase) => {
    set(state => ({
      gameState: { ...state.gameState, phase }
    }));
  },

  assignArtworkToBooth: (artworkId, boothId) => {
    set(state => {
      const artwork = state.artworks.find(a => a.id === artworkId);
      const newBooths = state.booths.map(b => {
        if (b.artworkId === artworkId) {
          return { ...b, artworkId: null, reservePrice: 0, royaltyRate: 0 };
        }
        return b;
      }).map(b => {
        if (b.id === boothId) {
          return {
            ...b,
            artworkId,
            reservePrice: artwork ? Math.floor(artwork.estimatedValue * 0.8) : 0,
            royaltyRate: artwork ? artwork.baseRoyaltyRate : 0
          };
        }
        return b;
      });
      return { booths: newBooths };
    });
  },

  removeArtworkFromBooth: (boothId) => {
    set(state => ({
      booths: state.booths.map(b =>
        b.id === boothId
          ? { ...b, artworkId: null, reservePrice: 0, royaltyRate: 0 }
          : b
      )
    }));
  },

  setReservePrice: (boothId, price) => {
    set(state => ({
      booths: state.booths.map(b =>
        b.id === boothId ? { ...b, reservePrice: price }
        : b
      )
    }));
  },

  setRoyaltyRate: (boothId, rate) => {
    set(state => ({
      booths: state.booths.map(b =>
        b.id === boothId ? { ...b, royaltyRate: rate }
        : b
      )
    }));
  },

  updateArtwork: (artworkId, updates) => {
    set(state => ({
      artworks: state.artworks.map(a =>
        a.id === artworkId ? { ...a, ...updates } : a
      )
    }));
  },

  resolveConflict: (artworkId, conflictIndex) => {
    set(state => ({
      artworks: state.artworks.map(a => {
        if (a.id === artworkId) {
          const newDetails = [...a.conflictDetails];
          newDetails.splice(conflictIndex, 1);
          return {
            ...a,
            conflictStatus: newDetails.length > 0 ? 'flagged' : 'resolved',
            conflictDetails: newDetails
          };
        }
        return a;
      })
    }));
  },

  startAuctionRound: async () => {
    set({ isAuctionRunning: true, currentAuctionIndex: 0 });
  },

  processNextAuction: () => {
    const state = get();
    const activeBooths = state.booths.filter(b => b.artworkId);
    const currentBooth = activeBooths[state.currentAuctionIndex];

    if (!currentBooth) {
      set({
        isAuctionRunning: false,
        gameState: {
          ...state.gameState,
          phase: 'settlement'
        }
      });
      return;
    }

    const artwork = state.artworks.find(a => a.id === currentBooth.artworkId);
    if (!artwork) return;

    const result = executeAuctionRound(artwork, currentBooth, state.collectors);

    const record: AuctionRecord = {
      id: `record-${Date.now()}-${Math.random()}`,
      roundNumber: state.gameState.currentRound,
      artworkId: result.artworkId,
      boothId: result.boothId,
      finalBidderId: result.finalBidderId,
      finalPrice: result.finalPrice,
      bidHistory: result.bidHistory,
      scenarioType: result.scenarioType,
      scenarioDetails: result.scenarioDetails,
      status: result.status
    };

    const scene: ReplayScene = {
      id: `scene-${Date.now()}`,
      type: result.scenarioType,
      round: state.gameState.currentRound,
      artworkId: artwork.id,
      timestamp: Date.now(),
      decisionPoint: {
        reservePrice: currentBooth.reservePrice,
        estimatedValue: artwork.estimatedValue,
        royaltyRate: currentBooth.royaltyRate,
        boothHeat: currentBooth.heatLevel
      },
      outcome: {
        status: result.status,
        finalPrice: result.finalPrice,
        collectorSatisfaction: result.satisfactionChange,
        heatChange: result.heatChange
      },
      learnings: result.scenarioType !== 'normal'
        ? [result.scenarioDetails]
        : ['作品成功成交，画廊声誉提升']
    };

    const newCollectors = state.collectors.map(c => {
      if (result.finalBidderId === c.id) {
        return {
          ...c,
          budget: c.budget - result.finalPrice,
          satisfaction: Math.max(0, Math.min(100, c.satisfaction + result.satisfactionChange)),
          bidCount: c.bidCount + 1
        };
      }
      return c;
    });

    const newBooths = state.booths.map(b => {
      if (b.id === currentBooth.id) {
        const newHeat = Math.max(1, Math.min(6, b.heatLevel + result.heatChange));
        return {
          ...b,
          heatLevel: newHeat,
          heatBonus: 0.7 + newHeat * 0.1
        };
      }
      return b;
    });

    set(s => ({
      auctionRecords: [...s.auctionRecords,
      record],
      replayScenes: [...s.replayScenes,
      scene],
      collectors: newCollectors,
      booths: newBooths,
      currentAuctionIndex: s.currentAuctionIndex + 1
    }));
  },

  calculateSettlement: () => {
    const state = get();
    const roundRecords = state.auctionRecords.filter(
      r => r.roundNumber === state.gameState.currentRound
    );

    let totalRevenue = 0;
    let totalRoyalties = 0;

    roundRecords.forEach(record => {
      if (record.status === 'sold') {
        totalRevenue += record.finalPrice;
        const booth = state.booths.find(b => b.id === record.boothId);
        if (booth) {
          totalRoyalties += record.finalPrice * (booth.royaltyRate / 100);
        }
      }
    });

    set(s => ({
      gameState: {
        ...s.gameState,
        totalRevenue: s.gameState.totalRevenue + totalRevenue,
        totalRoyalties: s.gameState.totalRoyalties + totalRoyalties,
        phase: 'settlement'
      }
    }));
  },

  generateReport: (sanitized = true) => {
    const state = get();

    const soldCount = state.auctionRecords.filter(r => r.status === 'sold').length;
    const unsoldCount = state.auctionRecords.filter(r => r.status === 'unsold').length;
    const totalRevenue = state.auctionRecords
      .filter(r => r.status === 'sold')
      .reduce((sum, r) => sum + r.finalPrice, 0);
    const totalRoyalties = state.auctionRecords
      .filter(r => r.status === 'sold')
      .reduce((sum, r) => {
        const booth = state.booths.find(b => b.id === r.boothId);
        return sum + r.finalPrice * (booth?.royaltyRate || 0) / 100;
      }, 0);

    const byRound: ReportData['byRound'] = [];
    for (let i = 1; i <= state.gameState.totalRounds; i++) {
      const roundRecords = state.auctionRecords.filter(r => r.roundNumber === i);
      const roundRevenue = roundRecords
        .filter(r => r.status === 'sold')
        .reduce((sum, r) => sum + r.finalPrice, 0);
      const roundSold = roundRecords.filter(r => r.status === 'sold').length;
      byRound.push({
        round: i,
        revenue: roundRevenue,
        sold: roundSold,
        heat: state.booths.reduce((sum, b) => sum + b.heatLevel, 0) / state.booths.length
      });
    }

    const byArtwork = state.auctionRecords.map(r => ({
      artworkId: r.artworkId,
      title: state.artworks.find(a => a.id === r.artworkId)?.title || 'Unknown',
      status: r.status,
      finalPrice: r.finalPrice,
      scenario: r.scenarioType
    }));

    const scenarioCounts: Record<string, { count: number; impact: number }> = {};
    state.replayScenes.forEach(scene => {
      if (!scenarioCounts[scene.type]) {
        scenarioCounts[scene.type] = { count: 0, impact: 0 };
      }
      scenarioCounts[scene.type].count++;
      scenarioCounts[scene.type].impact += scene.outcome.heatChange;
    });
    const scenarios = Object.entries(scenarioCounts).map(([type, data]) => ({
      type: type as ReportData['scenarios'][0]['type'],
      count: data.count,
      impact: data.impact
    }));

    const report: ReportData = {
      summary: {
        totalAuctions: state.auctionRecords.length,
        soldCount,
        unsoldCount,
        totalRevenue,
        totalRoyalties,
        avgSalePrice: soldCount > 0 ? totalRevenue / soldCount : 0
      },
      byRound,
      byArtwork,
      scenarios
    };

    return sanitized ? sanitizeReport(report) : report;
  },

  nextRound: () => {
    set(state => {
      if (state.gameState.currentRound >= state.gameState.totalRounds) {
        return {
          gameState: { ...state.gameState, phase: 'report' }
        };
      }
      return {
        gameState: {
          ...state.gameState,
          currentRound: state.gameState.currentRound + 1,
          phase: 'curation'
        },
        booths: state.booths.map(b => ({
          ...b,
          artworkId: null,
          reservePrice: 0,
          royaltyRate: 0
        })),
        currentAuctionIndex: 0,
        isAuctionRunning: false
      };
    });
  },

  resetGame: () => {
    set({
      gameState: {
        currentRound: 1,
        totalRounds: 3,
        phase: 'home',
        totalRevenue: 0,
        totalRoyalties: 0,
        galleryReputation: 100
      },
      artworks: [],
      collectors: [],
      booths: [],
      auctionRecords: [],
      replayScenes: [],
      currentAuctionIndex: 0,
      isAuctionRunning: false
    });
  }
}));
