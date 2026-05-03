import { LevelState, TileType } from './levels.js';

export const ActionType = {
  MOVE_VOLUNTEER: 'move_volunteer',
  DIRECT_PEOPLE: 'direct_people',
  USE_BROADCAST: 'use_broadcast',
  BLOCK_PATH: 'block_path',
  UNBLOCK_PATH: 'unblock_path',
  TRIGGER_EVENT: 'trigger_event'
};

export function startGame(state) {
  if (state.state !== LevelState.NOT_STARTED) {
    return { ...state };
  }
  
  return {
    ...state,
    state: LevelState.PLAYING,
    startTime: Date.now(),
    replayActions: []
  };
}

export function pauseGame(state) {
  if (state.state !== LevelState.PLAYING) {
    return { ...state };
  }
  
  return {
    ...state,
    state: LevelState.PAUSED
  };
}

export function resumeGame(state) {
  if (state.state !== LevelState.PAUSED) {
    return { ...state };
  }
  
  return {
    ...state,
    state: LevelState.PLAYING
  };
}

export function checkGameEnd(state) {
  if (state.state !== LevelState.PLAYING) {
    return state;
  }
  
  const remainingPeople = state.persons.filter(p => p.state !== 'evacuated' && p.state !== 'panicked').length;
  
  if (remainingPeople === 0) {
    return {
      ...state,
      state: LevelState.WON
    };
  }
  
  if (state.elapsedTime >= state.maxTime) {
    return {
      ...state,
      state: LevelState.LOST
    };
  }
  
  const panicRatio = state.peoplePanicked / state.totalPeople;
  if (panicRatio >= state.scoring.panicThreshold) {
    return {
      ...state,
      state: LevelState.LOST
    };
  }
  
  return state;
}

export function updateElapsedTime(state, currentTime) {
  if (state.state !== LevelState.PLAYING) {
    return state;
  }
  
  if (!state.startTime) {
    return state;
  }
  
  const elapsed = (currentTime - state.startTime) / 1000;
  const delta = elapsed - state.elapsedTime;
  
  return {
    ...state,
    elapsedTime
  };
}

export function calculateScore(state) {
  const scoring = state.scoring;
  let score = 0;
  
  score += state.peopleEvacuated * scoring.pointsPerEvacuation;
  
  const timeBonus = Math.max(0, (state.maxTime - state.elapsedTime) * scoring.timeBonusPerSecond);
  score += timeBonus;
  
  score -= state.peoplePanicked * scoring.penaltyPerPanic;
  
  const volunteersUsed = state.replayActions.filter(a => 
    a.type === ActionType.MOVE_VOLUNTEER || a.type === ActionType.DIRECT_PEOPLE
  ).length;
  score -= volunteersUsed * scoring.penaltyPerVolunteerAction;
  
  const broadcastsUsed = state.replayActions.filter(a => 
    a.type === ActionType.USE_BROADCAST
  ).length;
  score -= broadcastsUsed * scoring.penaltyPerBroadcast;
  
  return Math.max(0, score);
}

export function recordAction(state, actionType, actionData) {
  const action = {
    type: actionType,
    data: actionData,
    timestamp: state.elapsedTime,
    realTimestamp: Date.now()
  };
  
  return {
    ...state,
    replayActions: [...state.replayActions, action]
  };
}

export function updateGame(state, deltaTime, currentTime) {
  if (state.state !== LevelState.PLAYING) {
    return state;
  }
  
  let newState = { ...state };
  
  newState.elapsedTime = state.elapsedTime + deltaTime;
  
  newState = checkGameEnd(newState);
  if (newState.state !== LevelState.PLAYING) {
    return newState;
  }
  
  newState.score = calculateScore(newState);
  
  return newState;
}

export function isTileWalkable(state, x, y) {
  const grid = state.grid;
  const col = Math.floor(x);
  const row = Math.floor(y);
  
  if (col < 0 || col >= grid.width || row < 0 || row >= grid.height) {
    return false;
  }
  
  const tile = grid.tiles[row * grid.width + col];
  
  if (tile === TileType.WALL || tile === TileType.OBSTACLE) {
    return false;
  }
  
  if (state.blockedPaths.some(bp => bp.x === col && bp.y === row)) {
    return false;
  }
  
  return true;
}

export function isExitTile(state, x, y) {
  const grid = state.grid;
  const col = Math.floor(x);
  const row = Math.floor(y);
  
  if (col < 0 || col >= grid.width || row < 0 || row >= grid.height) {
    return false;
  }
  
  return grid.tiles[row * grid.width + col] === TileType.EXIT;
}

export function getTileType(state, x, y) {
  const grid = state.grid;
  const col = Math.floor(x);
  const row = Math.floor(y);
  
  if (col < 0 || col >= grid.width || row < 0 || row >= grid.height) {
    return null;
  }
  
  return grid.tiles[row * grid.width + col];
}
