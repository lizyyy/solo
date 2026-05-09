const GameStatus = {
  IDLE: 'IDLE',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  REPLAY: 'REPLAY'
};

const ErrorType = {
  NONE: 'NONE',
  WRONG_PORT: 'WRONG_PORT',
  OVERWEIGHT: 'OVERWEIGHT',
  CRANE_BUSY: 'CRANE_BUSY',
  PORT_FULL: 'PORT_FULL',
  TIME_OUT: 'TIME_OUT'
};

const PORTS = [
  { id: 'SH', name: '上海港', weightLimit: 50, color: '#3498db' },
  { id: 'SZ', name: '深圳港', weightLimit: 40, color: '#e74c3c' },
  { id: 'GZ', name: '广州港', weightLimit: 45, color: '#2ecc71' },
  { id: 'TJ', name: '天津港', weightLimit: 35, color: '#f39c12' }
];

const CONTAINER_COLORS = [
  '#1abc9c', '#9b59b6', '#34495e', '#e67e22', '#16a085'
];

const GAME_CONFIG = {
  initialTime: 120,
  containersPerRound: 12,
  minWeight: 10,
  maxWeight: 50,
  baseScore: 100,
  weightBonusMultiplier: 2,
  penalty: 50,
  portFullThreshold: 8,
  portOverweightPenalty: 100,
  maxPenalties: 5
};

module.exports = {
  GameStatus,
  ErrorType,
  PORTS,
  CONTAINER_COLORS,
  GAME_CONFIG
};
