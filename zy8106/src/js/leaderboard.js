import { STORAGE_KEYS } from './constants.js';
import { deepClone, formatTime } from './utils.js';

class Leaderboard {
  constructor() {
    this.storage = window.localStorage;
  }

  getLeaderboard() {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.LEADERBOARD);
      if (!raw) return {};
      
      const leaderboard = JSON.parse(raw);
      return leaderboard || {};
    } catch (error) {
      console.error('读取排行榜失败:', error);
      return {};
    }
  }

  setLeaderboard(leaderboard) {
    try {
      this.storage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(leaderboard));
      return { success: true };
    } catch (error) {
      console.error('保存排行榜失败:', error);
      return { success: false, error: error.message };
    }
  }

  addScore(levelId, score, playerName = '匿名玩家', metadata = {}) {
    const leaderboard = this.getLeaderboard();
    
    if (!leaderboard[levelId]) {
      leaderboard[levelId] = [];
    }
    
    const entry = {
      id: Date.now().toString(),
      score: score,
      playerName: playerName,
      timestamp: Date.now(),
      formattedTime: formatTime(Date.now()),
      metadata: deepClone(metadata)
    };
    
    leaderboard[levelId].push(entry);
    
    leaderboard[levelId].sort((a, b) => b.score - a.score);
    
    if (leaderboard[levelId].length > 10) {
      leaderboard[levelId] = leaderboard[levelId].slice(0, 10);
    }
    
    this.setLeaderboard(leaderboard);
    
    const rank = leaderboard[levelId].findIndex(e => e.id === entry.id) + 1;
    
    return {
      success: true,
      entry,
      rank,
      isNewHighScore: rank === 1
    };
  }

  getLevelScores(levelId) {
    const leaderboard = this.getLeaderboard();
    const scores = leaderboard[levelId] || [];
    
    return deepClone(scores.map((score, index) => ({
      ...score,
      rank: index + 1
    })));
  }

  getHighestScore(levelId) {
    const scores = this.getLevelScores(levelId);
    return scores.length > 0 ? scores[0] : null;
  }

  getPlayerBestScore(levelId, playerName) {
    const scores = this.getLevelScores(levelId);
    const playerScores = scores.filter(s => s.playerName === playerName);
    
    if (playerScores.length === 0) return null;
    
    return playerScores.sort((a, b) => b.score - a.score)[0];
  }

  clearLevelScores(levelId) {
    const leaderboard = this.getLeaderboard();
    delete leaderboard[levelId];
    return this.setLeaderboard(leaderboard);
  }

  clearAllScores() {
    try {
      this.storage.removeItem(STORAGE_KEYS.LEADERBOARD);
      return { success: true };
    } catch (error) {
      console.error('清除排行榜失败:', error);
      return { success: false, error: error.message };
    }
  }

  getOverallRanking() {
    const leaderboard = this.getLeaderboard();
    const playerTotals = new Map();
    
    for (const [levelId, scores] of Object.entries(leaderboard)) {
      const levelPlayers = new Set();
      
      for (const score of scores) {
        if (!levelPlayers.has(score.playerName)) {
          levelPlayers.add(score.playerName);
          
          if (!playerTotals.has(score.playerName)) {
            playerTotals.set(score.playerName, {
              playerName: score.playerName,
              totalScore: 0,
              levelsCompleted: 0,
              highestScore: 0,
              bestRank: Infinity
            });
          }
          
          const playerData = playerTotals.get(score.playerName);
          playerData.totalScore += score.score;
          playerData.levelsCompleted++;
          
          if (score.score > playerData.highestScore) {
            playerData.highestScore = score.score;
          }
          
          const levelScores = this.getLevelScores(levelId);
          const rank = levelScores.findIndex(s => s.id === score.id) + 1;
          if (rank < playerData.bestRank) {
            playerData.bestRank = rank;
          }
        }
      }
    }
    
    const ranking = Array.from(playerTotals.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((player, index) => ({
        ...player,
        rank: index + 1
      }));
    
    return ranking;
  }

  exportLeaderboard() {
    const leaderboard = this.getLeaderboard();
    return {
      success: true,
      data: JSON.stringify(leaderboard, null, 2),
      filename: `leaderboard-${Date.now()}.json`
    };
  }

  importLeaderboard(jsonData, merge = true) {
    try {
      const newLeaderboard = JSON.parse(jsonData);
      
      if (merge) {
        const currentLeaderboard = this.getLeaderboard();
        
        for (const [levelId, scores] of Object.entries(newLeaderboard)) {
          if (!currentLeaderboard[levelId]) {
            currentLeaderboard[levelId] = [];
          }
          
          currentLeaderboard[levelId].push(...scores);
          
          currentLeaderboard[levelId].sort((a, b) => b.score - a.score);
          
          if (currentLeaderboard[levelId].length > 10) {
            currentLeaderboard[levelId] = currentLeaderboard[levelId].slice(0, 10);
          }
        }
        
        return this.setLeaderboard(currentLeaderboard);
      } else {
        return this.setLeaderboard(newLeaderboard);
      }
    } catch (error) {
      return { success: false, error: 'JSON格式错误: ' + error.message };
    }
  }

  getStatistics() {
    const leaderboard = this.getLeaderboard();
    const levelCount = Object.keys(leaderboard).length;
    let totalEntries = 0;
    let highestScoreOverall = 0;
    const uniquePlayers = new Set();
    
    for (const [levelId, scores] of Object.entries(leaderboard)) {
      totalEntries += scores.length;
      
      for (const score of scores) {
        uniquePlayers.add(score.playerName);
        if (score.score > highestScoreOverall) {
          highestScoreOverall = score.score;
        }
      }
    }
    
    return {
      levelCount,
      totalEntries,
      uniquePlayers: uniquePlayers.size,
      highestScoreOverall
    };
  }
}

export const leaderboard = new Leaderboard();
export default Leaderboard;
