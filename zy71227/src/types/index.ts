export type GamePhase = 'home' | 'artworks' | 'curation' | 'auction' | 'settlement' | 'report';

export type ScenarioType = 'normal' | 'reserve_too_high' | 'royalty_missing' | 'duplicate_bidder';

export type AuctionStatus = 'pending' | 'active' | 'sold' | 'unsold';

export type ConflictStatus = 'none' | 'flagged' | 'resolved';

export type Genre = 'abstract' | 'digital' | 'generative' | 'photography' | 'pixel' | '3d';

export interface Artwork {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  estimatedValue: number;
  baseRoyaltyRate: number;
  imageUrl: string;
  tags: string[];
  conflictStatus: ConflictStatus;
  conflictDetails: string[];
}

export interface Collector {
  id: string;
  name: string;
  avatar: string;
  budget: number;
  preferredGenres: Genre[];
  preferredArtists: string[];
  satisfaction: number;
  bidCount: number;
}

export interface Booth {
  id: string;
  heatLevel: number;
  heatBonus: number;
  artworkId: string | null;
  reservePrice: number;
  royaltyRate: number;
}

export interface Bid {
  collectorId: string;
  amount: number;
  timestamp: number;
}

export interface AuctionRecord {
  id: string;
  roundNumber: number;
  artworkId: string;
  boothId: string;
  finalBidderId: string | null;
  finalPrice: number;
  bidHistory: Bid[];
  scenarioType: ScenarioType;
  scenarioDetails: string;
  status: AuctionStatus;
}

export interface ReplayScene {
  id: string;
  type: ScenarioType;
  round: number;
  artworkId: string;
  timestamp: number;
  decisionPoint: {
    reservePrice: number;
    estimatedValue: number;
    royaltyRate: number;
    boothHeat: number;
  };
  outcome: {
    status: AuctionStatus;
    finalPrice: number;
    collectorSatisfaction: number;
    heatChange: number;
  };
  learnings: string[];
}

export interface GameState {
  currentRound: number;
  totalRounds: number;
  phase: GamePhase;
  totalRevenue: number;
  totalRoyalties: number;
  galleryReputation: number;
}

export interface Conflict {
  artworkId: string;
  type: 'duplicate_id' | 'value_range' | 'royalty_rate';
  message: string;
}

export interface ReportData {
  summary: {
    totalAuctions: number;
    soldCount: number;
    unsoldCount: number;
    totalRevenue: number;
    totalRoyalties: number;
    avgSalePrice: number;
  };
  byRound: {
    round: number;
    revenue: number;
    sold: number;
    heat: number;
  }[];
  byArtwork: {
    artworkId: string;
    title: string;
    status: AuctionStatus;
    finalPrice: number;
    scenario: ScenarioType;
  }[];
  scenarios: {
    type: ScenarioType;
    count: number;
    impact: number;
  }[];
}
