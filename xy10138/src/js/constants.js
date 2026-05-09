const GameConstants = {
  GRID_WIDTH: 12,
  GRID_HEIGHT: 10,
  CELL_SIZE: 60,
  
  GAME_TIME: 120,
  
  SCORE: {
    PICKUP_SUCCESS: 100,
    PICKUP_FAIL_DUPLICATE: -50,
    PICKUP_FAIL_EMPTY: -20,
    COLLISION: -100,
    MOVE: -1,
  },
  
  GAME_STATE: {
    IDLE: 'idle',
    PLAYING: 'playing',
    PAUSED: 'paused',
    ENDED: 'ended',
    REPLAYING: 'replaying',
  },
  
  DIRECTIONS: {
    UP: { dx: 0, dy: -1 },
    DOWN: { dx: 0, dy: 1 },
    LEFT: { dx: -1, dy: 0 },
    RIGHT: { dx: 1, dy: 0 },
  },
  
  COLORS: {
    ROBOT_1: '#FF6B6B',
    ROBOT_2: '#4ECDC4',
    ROBOT_3: '#45B7D1',
    CARGO: '#FFE66D',
    PICKED_CARGO: '#95A5A6',
    WALL: '#2C3E50',
    FLOOR: '#ECF0F1',
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameConstants;
}
