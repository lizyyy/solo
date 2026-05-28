export interface VinylRecord {
  id: string;
  title: string;
  artist: string;
  genre: string;
  purchasePrice: number;
  suggestedPrice: number;
  popularity: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  description: string;
  source: string;
  imageUrl: string;
}

export interface CustomerPreference {
  id: string;
  name: string;
  avatar: string;
  favoriteGenres: string[];
  budget: number;
  willingnessToPay: number;
  description: string;
  source: string;
}

export interface InventoryItem {
  recordId: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  daysInStock: number;
  purchaseHistory: { day: number; quantity: number; price: number }[];
}

export interface DailyReport {
  day: number;
  startingCash: number;
  endingCash: number;
  purchases: { recordId: string; quantity: number; totalCost: number }[];
  sales: { recordId: string; quantity: number; totalRevenue: number; customerId: string }[];
  priceAdjustments: { recordId: string; oldPrice: number; newPrice: number }[];
  unsoldRecords: string[];
  events: GameEvent[];
  customerVisits: string[];
}

export interface GameEvent {
  id: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  message: string;
  suggestion: string;
  source: string;
  timestamp: number;
}

export interface GameState {
  day: number;
  maxDays: number;
  cash: number;
  initialCash: number;
  inventory: InventoryItem[];
  customerPreferences: CustomerPreference[];
  vinylCatalog: VinylRecord[];
  dailyReports: DailyReport[];
  gameEvents: GameEvent[];
  isGameOver: boolean;
  gameOverReason?: string;
  gameId: string;
  createdAt: number;
  lastSavedAt: number;
}

export interface GameHistory {
  games: {
    gameId: string;
    date: number;
    finalCash: number;
    totalDays: number;
    profit: number;
    isWin: boolean;
  }[];
}

export interface PurchaseDecision {
  recordId: string;
  quantity: number;
}

export interface PriceAdjustment {
  recordId: string;
  newPrice: number;
}
