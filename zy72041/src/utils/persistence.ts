import type { GameState } from '@/types';

const STORAGE_PREFIX = 'subway-puzzle-';

export class PersistenceManager {
  static saveGameState(state: GameState): void {
    try {
      const key = `${STORAGE_PREFIX}${state.gameId}`;
      localStorage.setItem(key, JSON.stringify(state));
      
      const gameList = this.listSavedGames();
      const existingIndex = gameList.findIndex(g => g.gameId === state.gameId);
      if (existingIndex >= 0) {
        gameList[existingIndex] = { gameId: state.gameId, levelId: state.levelId, lastModified: Date.now(), status: state.status };
      } else {
        gameList.push({ gameId: state.gameId, levelId: state.levelId, lastModified: Date.now(), status: state.status });
      }
      localStorage.setItem(`${STORAGE_PREFIX}game-list`, JSON.stringify(gameList));
    } catch (e) {
      console.error('保存游戏状态失败:', e);
    }
  }

  static loadGameState(gameId: string): GameState | null {
    try {
      const key = `${STORAGE_PREFIX}${gameId}`;
      const data = localStorage.getItem(key);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as GameState;
    } catch (e) {
      console.error('加载游戏状态失败:', e);
      return null;
    }
  }

  static clearGameState(gameId: string): void {
    try {
      const key = `${STORAGE_PREFIX}${gameId}`;
      localStorage.removeItem(key);
      
      const gameList = this.listSavedGames().filter(g => g.gameId !== gameId);
      localStorage.setItem(`${STORAGE_PREFIX}game-list`, JSON.stringify(gameList));
    } catch (e) {
      console.error('清除游戏状态失败:', e);
    }
  }

  static listSavedGames(): Array<{ gameId: string; levelId: string; lastModified: number; status: string }> {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}game-list`);
      if (!data) {
        return [];
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('获取游戏列表失败:', e);
      return [];
    }
  }

  static clearAllGames(): void {
    try {
      const gameList = this.listSavedGames();
      gameList.forEach(game => {
        const key = `${STORAGE_PREFIX}${game.gameId}`;
        localStorage.removeItem(key);
      });
      localStorage.removeItem(`${STORAGE_PREFIX}game-list`);
    } catch (e) {
      console.error('清除所有游戏失败:', e);
    }
  }

  static getLastSavedGame(): GameState | null {
    try {
      const gameList = this.listSavedGames();
      if (gameList.length === 0) {
        return null;
      }
      
      gameList.sort((a, b) => b.lastModified - a.lastModified);
      return this.loadGameState(gameList[0].gameId);
    } catch (e) {
      console.error('获取最近保存的游戏失败:', e);
      return null;
    }
  }
}
