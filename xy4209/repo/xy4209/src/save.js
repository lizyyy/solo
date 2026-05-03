const STORAGE_KEYS = {
  HIGH_SCORES: 'evacuation_sim_high_scores',
  GAME_SETTINGS: 'evacuation_sim_settings',
  REPLAY_DATA: 'evacuation_sim_replays'
};

export function saveHighScore(levelId, score, elapsedTime, metadata = {}) {
  try {
    const highScores = getHighScores();
    
    if (!highScores[levelId]) {
      highScores[levelId] = [];
    }
    
    const scoreEntry = {
      score,
      elapsedTime,
      date: new Date().toISOString(),
      peopleEvacuated: metadata.peopleEvacuated || 0,
      peoplePanicked: metadata.peoplePanicked || 0,
      actionsTaken: metadata.actionsTaken || 0
    };
    
    highScores[levelId].push(scoreEntry);
    highScores[levelId].sort((a, b) => b.score - a.score);
    
    highScores[levelId] = highScores[levelId].slice(0, 10);
    
    localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(highScores));
    
    return { success: true, entry: scoreEntry };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function getHighScores(levelId = null) {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
    const highScores = stored ? JSON.parse(stored) : {};
    
    if (levelId) {
      return highScores[levelId] || [];
    }
    
    return highScores;
  } catch (error) {
    return levelId ? [] : {};
  }
}

export function getHighestScore(levelId) {
  const scores = getHighScores(levelId);
  if (scores.length === 0) return null;
  return scores[0];
}

export function isNewHighScore(levelId, score) {
  const highest = getHighestScore(levelId);
  if (!highest) return true;
  return score > highest.score;
}

export function saveReplay(levelId, replayData, metadata = {}) {
  try {
    const replays = getReplays();
    
    const replayEntry = {
      id: `replay_${Date.now()}`,
      levelId,
      data: replayData,
      metadata: {
        ...metadata,
        date: new Date().toISOString()
      }
    };
    
    replays.push(replayEntry);
    
    const recentReplays = replays.slice(-20);
    
    localStorage.setItem(STORAGE_KEYS.REPLAY_DATA, JSON.stringify(recentReplays));
    
    return { success: true, replayId: replayEntry.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function getReplays(levelId = null) {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.REPLAY_DATA);
    const replays = stored ? JSON.parse(stored) : [];
    
    if (levelId) {
      return replays.filter(r => r.levelId === levelId);
    }
    
    return replays;
  } catch (error) {
    return [];
  }
}

export function getReplay(replayId) {
  const replays = getReplays();
  return replays.find(r => r.id === replayId) || null;
}

export function saveGameState(state) {
  try {
    const serializedState = {
      levelId: state.levelId,
      levelName: state.levelName,
      elapsedTime: state.elapsedTime,
      grid: state.grid,
      persons: state.persons,
      volunteers: state.volunteers,
      events: state.events,
      currentEvent: state.currentEvent,
      scoring: state.scoring,
      score: state.score,
      peopleEvacuated: state.peopleEvacuated,
      peoplePanicked: state.peoplePanicked,
      blockedPaths: state.blockedPaths,
      activeBroadcasts: state.activeBroadcasts,
      replayActions: state.replayActions,
      totalPeople: state.totalPeople,
      savedAt: new Date().toISOString()
    };
    
    const key = `save_${state.levelId}_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(serializedState));
    
    const saveList = getSaveList();
    saveList.push({
      key,
      levelId: state.levelId,
      levelName: state.levelName,
      savedAt: serializedState.savedAt
    });
    
    localStorage.setItem('evacuation_sim_saves', JSON.stringify(saveList.slice(-10)));
    
    return { success: true, key };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function getSaveList() {
  try {
    const stored = localStorage.getItem('evacuation_sim_saves');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

export function loadGameState(saveKey) {
  try {
    const stored = localStorage.getItem(saveKey);
    if (!stored) {
      return { success: false, error: '存档不存在' };
    }
    
    const state = JSON.parse(stored);
    return { success: true, state };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function deleteSave(saveKey) {
  try {
    localStorage.removeItem(saveKey);
    
    const saveList = getSaveList().filter(s => s.key !== saveKey);
    localStorage.setItem('evacuation_sim_saves', JSON.stringify(saveList));
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function saveSettings(settings) {
  try {
    const existing = getSettings();
    const updated = { ...existing, ...settings };
    localStorage.setItem(STORAGE_KEYS.GAME_SETTINGS, JSON.stringify(updated));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function getSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GAME_SETTINGS);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    return {};
  }
}

export function clearAllData() {
  try {
    localStorage.removeItem(STORAGE_KEYS.HIGH_SCORES);
    localStorage.removeItem(STORAGE_KEYS.GAME_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.REPLAY_DATA);
    localStorage.removeItem('evacuation_sim_saves');
    
    const saveList = getSaveList();
    for (const save of saveList) {
      localStorage.removeItem(save.key);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function exportStorageData() {
  try {
    return {
      highScores: getHighScores(),
      replays: getReplays(),
      saves: getSaveList().map(saveInfo => {
        const result = loadGameState(saveInfo.key);
        return result.success ? { ...saveInfo, state: result.state } : saveInfo;
      }),
      settings: getSettings(),
      exportedAt: new Date().toISOString()
    };
  } catch (error) {
    return null;
  }
}

export function importStorageData(data) {
  try {
    if (data.highScores) {
      localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(data.highScores));
    }
    
    if (data.replays) {
      localStorage.setItem(STORAGE_KEYS.REPLAY_DATA, JSON.stringify(data.replays));
    }
    
    if (data.settings) {
      localStorage.setItem(STORAGE_KEYS.GAME_SETTINGS, JSON.stringify(data.settings));
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
