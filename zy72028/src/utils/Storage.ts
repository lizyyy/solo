import type { GameState, SupplementRecord, MaterialPackage } from '../types';

const STORAGE_KEYS = {
  GAMES: 'bus-dispatch-chess/games',
  SUPPLEMENTS: 'bus-dispatch-chess/supplements',
  MATERIALS: 'bus-dispatch-chess/materials'
};

export class Storage {
  private static get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private static set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage error:', e);
    }
  }

  static saveGame(game: GameState): void {
    const games = this.get<Record<string, GameState>>(STORAGE_KEYS.GAMES, {});
    games[game.id] = game;
    this.set(STORAGE_KEYS.GAMES, games);
  }

  static getGame(gameId: string): GameState | null {
    const games = this.get<Record<string, GameState>>(STORAGE_KEYS.GAMES, {});
    return games[gameId] || null;
  }

  static getAllGames(): GameState[] {
    const games = this.get<Record<string, GameState>>(STORAGE_KEYS.GAMES, {});
    return Object.values(games).sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  static saveSupplement(supplement: SupplementRecord): void {
    const supplements = this.get<Record<string, SupplementRecord[]>>(STORAGE_KEYS.SUPPLEMENTS, {});
    if (!supplements[supplement.gameId]) {
      supplements[supplement.gameId] = [];
    }
    supplements[supplement.gameId].push(supplement);
    this.set(STORAGE_KEYS.SUPPLEMENTS, supplements);
  }

  static getSupplements(gameId: string): SupplementRecord[] {
    const supplements = this.get<Record<string, SupplementRecord[]>>(STORAGE_KEYS.SUPPLEMENTS, {});
    return supplements[gameId] || [];
  }

  static saveMaterial(material: MaterialPackage): void {
    const materials = this.get<Record<string, MaterialPackage>>(STORAGE_KEYS.MATERIALS, {});
    materials[material.id] = material;
    this.set(STORAGE_KEYS.MATERIALS, materials);
  }

  static getMaterial(materialId: string): MaterialPackage | null {
    const materials = this.get<Record<string, MaterialPackage>>(STORAGE_KEYS.MATERIALS, {});
    return materials[materialId] || null;
  }

  static getAllMaterials(): MaterialPackage[] {
    const materials = this.get<Record<string, MaterialPackage>>(STORAGE_KEYS.MATERIALS, {});
    return Object.values(materials).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.GAMES);
    localStorage.removeItem(STORAGE_KEYS.SUPPLEMENTS);
    localStorage.removeItem(STORAGE_KEYS.MATERIALS);
  }
}
