import type {
  PowerNode,
  UserNode,
  RepairTeam,
  Weather,
  GameEvent,
  GameHistoryTurn,
  PlayerAction,
  ScoreBreakdown,
  GameState,
  LevelConfig
} from './types';
import { PRIORITY_CONFIG, WEATHER_CONFIG, GAME_CONFIG } from './config';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function isUserNode(node: PowerNode): node is UserNode {
  return node.type === 'user';
}

export function calculatePowerStatus(nodes: PowerNode[]): PowerNode[] {
  const updatedNodes = nodes.map(n => ({ ...n, powered: false }));
  const visited = new Set<string>();
  const operationalSubstations = updatedNodes.filter(
    n => n.type === 'substation' && n.status === 'operational'
  );

  const traverse = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = updatedNodes.find(n => n.id === nodeId);
    if (!node || node.status !== 'operational') return;

    node.powered = true;

    for (const connectedId of node.connectedTo) {
      traverse(connectedId);
    }
  };

  for (const substation of operationalSubstations) {
    traverse(substation.id);
  }

  return updatedNodes;
}

export function processRepairs(
  teams: RepairTeam[],
  nodes: PowerNode[],
  weather: Weather
): { teams: RepairTeam[]; nodes: PowerNode[]; completedRepairs: string[] } {
  const completedRepairs: string[] = [];
  const updatedTeams = teams.map(team => ({ ...team }));
  const updatedNodes = nodes.map(node => ({ ...node }));

  for (const team of updatedTeams) {
    if (team.status === 'repairing' && team.currentTarget) {
      const node = updatedNodes.find(n => n.id === team.currentTarget);
      if (node && node.status === 'repairing') {
        const repairAmount = (team.efficiency * (1 - weather.repairPenalty)) / node.repairTime;
        node.repairProgress = Math.min(1, node.repairProgress + repairAmount);

        if (node.repairProgress >= 1) {
          node.status = 'operational';
          node.health = node.maxHealth;
          node.repairProgress = 0;
          team.status = 'cooling';
          team.cooldown = team.maxCooldown;
          team.currentTarget = null;
          completedRepairs.push(node.id);
        }
      }
    } else if (team.status === 'cooling') {
      team.cooldown = Math.max(0, team.cooldown - 1);
      if (team.cooldown === 0) {
        team.status = 'idle';
      }
    }
  }

  return { teams: updatedTeams, nodes: updatedNodes, completedRepairs };
}

export function applyWeatherDamage(nodes: PowerNode[], weather: Weather): PowerNode[] {
  if (weather.damageMultiplier === 0) return nodes;

  return nodes.map(node => {
    if (node.type === 'user') return node;
    
    const damageChance = weather.damageMultiplier * 0.3;
    if (Math.random() < damageChance && node.status === 'operational') {
      const damage = Math.random() * 30 + 20;
      const newHealth = Math.max(0, node.health - damage);
      return {
        ...node,
        health: newHealth,
        status: newHealth <= 0 ? 'damaged' : node.status
      };
    }
    return node;
  });
}

export function updateOutageTimes(nodes: PowerNode[]): PowerNode[] {
  return nodes.map(node => {
    if (isUserNode(node) && !node.powered) {
      return {
        ...node,
        outageTime: node.outageTime + 1
      };
    }
    return node;
  });
}

export function calculateScore(
  nodes: PowerNode[],
  turn: number,
  maxTurns: number,
  difficulty: string
): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    criticalUsers: 0,
    importantUsers: 0,
    normalUsers: 0,
    speedBonus: 0,
    difficultyBonus: 0,
    penalties: 0,
    total: 0
  };

  const userNodes = nodes.filter(isUserNode);
  const baseScore = GAME_CONFIG.scoring.baseScorePerUser;

  for (const user of userNodes) {
    const config = PRIORITY_CONFIG[user.priority];
    if (user.powered) {
      const points = baseScore * config.scoreMultiplier * user.population / 100;
      if (user.priority === 'critical') breakdown.criticalUsers += points;
      else if (user.priority === 'important') breakdown.importantUsers += points;
      else breakdown.normalUsers += points;
    } else {
      breakdown.penalties -= config.penaltyPerTurn;
    }
  }

  const remainingTurns = maxTurns - turn;
  breakdown.speedBonus = remainingTurns * GAME_CONFIG.scoring.speedBonusPerTurn;

  const difficultyMultiplier = GAME_CONFIG.scoring.difficultyMultiplier[difficulty as keyof typeof GAME_CONFIG.scoring.difficultyMultiplier] || 1;
  const baseTotal = breakdown.criticalUsers + breakdown.importantUsers + breakdown.normalUsers + breakdown.penalties;
  breakdown.difficultyBonus = baseTotal * (difficultyMultiplier - 1);

  breakdown.total = Math.floor(
    breakdown.criticalUsers +
    breakdown.importantUsers +
    breakdown.normalUsers +
    breakdown.speedBonus +
    breakdown.difficultyBonus +
    breakdown.penalties
  );

  return { score: breakdown.total, breakdown };
}

export function checkVictory(nodes: PowerNode[]): boolean {
  const userNodes = nodes.filter(isUserNode);
  const criticalUsers = userNodes.filter(u => u.priority === 'critical');
  const importantUsers = userNodes.filter(u => u.priority === 'important');
  const normalUsers = userNodes.filter(u => u.priority === 'normal');

  const allCriticalPowered = criticalUsers.every(u => u.powered);
  const allImportantPowered = importantUsers.every(u => u.powered);
  const normalRatio = normalUsers.filter(u => u.powered).length / (normalUsers.length || 1);

  return allCriticalPowered && allImportantPowered && normalRatio >= GAME_CONFIG.victoryConditions.normalUsersPoweredRatio;
}

export function checkDefeat(
  nodes: PowerNode[],
  turn: number,
  maxTurns: number,
  highOutageTurns: number
): { defeated: boolean; reason: string | null } {
  const userNodes = nodes.filter(isUserNode);

  const criticalUsers = userNodes.filter(u => u.priority === 'critical');
  for (const user of criticalUsers) {
    if (user.outageTime >= user.maxOutageTime) {
      return { defeated: true, reason: `特级保障用户「${user.name}」停电超时，游戏结束！` };
    }
  }

  const importantUsers = userNodes.filter(u => u.priority === 'important');
  const importantOutageCount = importantUsers.filter(u => u.outageTime >= u.maxOutageTime).length;
  if (importantOutageCount >= GAME_CONFIG.defeatConditions.maxImportantUsersOutage) {
    return { defeated: true, reason: `${importantOutageCount} 个重要用户停电超时，游戏结束！` };
  }

  const outageRatio = userNodes.filter(u => !u.powered).length / (userNodes.length || 1);
  if (outageRatio >= GAME_CONFIG.defeatConditions.maxOutageRatio) {
    if (highOutageTurns + 1 >= GAME_CONFIG.defeatConditions.maxOutageRatioTurns) {
      return { defeated: true, reason: `大面积停电持续 ${highOutageTurns + 1} 回合，游戏结束！` };
    }
  }

  if (turn >= maxTurns) {
    return { defeated: true, reason: '已达到最大回合数，任务失败！' };
  }

  return { defeated: false, reason: null };
}

export function createEvent(
  turn: number,
  type: GameEvent['type'],
  message: string
): GameEvent {
  return {
    id: generateId(),
    turn,
    type,
    message,
    timestamp: Date.now()
  };
}

export function createHistoryTurn(
  turn: number,
  nodes: PowerNode[],
  teams: RepairTeam[],
  weather: Weather,
  score: number,
  actions: PlayerAction[]
): GameHistoryTurn {
  return {
    turn,
    nodes: JSON.parse(JSON.stringify(nodes)),
    teams: JSON.parse(JSON.stringify(teams)),
    weather: { ...weather },
    score,
    actions: JSON.parse(JSON.stringify(actions))
  };
}

export function processTurn(
  state: GameState
): Partial<GameState> {
  let nodes = [...state.nodes];
  let teams = [...state.teams];
  const events = [...state.events];
  let highOutageTurns = state.highOutageTurns;

  const repairResult = processRepairs(teams, nodes, state.weather);
  teams = repairResult.teams;
  nodes = repairResult.nodes;

  for (const nodeId of repairResult.completedRepairs) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      events.push(createEvent(state.turn, 'repair_complete', `✅ ${node.name} 抢修完成！`));
    }
  }

  nodes = calculatePowerStatus(nodes);

  nodes = applyWeatherDamage(nodes, state.weather);
  nodes.forEach(node => {
    if (node.status === 'damaged' && state.nodes.find(n => n.id === node.id)?.status === 'operational') {
      events.push(createEvent(state.turn, 'damage', `⚠️ ${node.name} 因天气原因受损！`));
    }
  });

  nodes = updateOutageTimes(nodes);

  const userNodes = nodes.filter(isUserNode);
  const outageRatio = userNodes.filter(u => !u.powered).length / (userNodes.length || 1);
  if (outageRatio >= GAME_CONFIG.defeatConditions.maxOutageRatio) {
    highOutageTurns++;
  } else {
    highOutageTurns = 0;
  }

  const { score, breakdown } = calculateScore(
    nodes,
    state.turn,
    state.maxTurns,
    state.difficulty
  );

  const newTurn = state.turn + 1;
  let weatherDuration = state.weatherDuration + 1;
  let weather = state.weather;
  let nextWeather = state.nextWeather;

  if (weatherDuration >= state.weather.duration) {
    weather = nextWeather;
    weatherDuration = 0;
    const weatherTypes = Object.keys(WEATHER_CONFIG) as (keyof typeof WEATHER_CONFIG)[];
    const randomWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
    nextWeather = WEATHER_CONFIG[randomWeather];
    events.push(createEvent(newTurn, 'weather_change', `🌤️ 天气变化: ${weather.description}`));
  }

  const history = [...state.history];
  history.push(createHistoryTurn(
    state.turn,
    state.nodes,
    state.teams,
    state.weather,
    state.score,
    state.currentTurnActions
  ));

  const defeatCheck = checkDefeat(nodes, newTurn, state.maxTurns, highOutageTurns);
  if (defeatCheck.defeated) {
    events.push(createEvent(newTurn, 'defeat', defeatCheck.reason!));
    return {
      status: 'defeat',
      turn: newTurn,
      nodes,
      teams,
      weather,
      nextWeather,
      weatherDuration,
      score,
      scoreBreakdown: breakdown,
      events,
      history,
      currentTurnActions: [],
      defeatReason: defeatCheck.reason,
      highOutageTurns
    };
  }

  if (checkVictory(nodes)) {
    events.push(createEvent(newTurn, 'victory', '🎉 恭喜！电网恢复任务完成！'));
    return {
      status: 'victory',
      turn: newTurn,
      nodes,
      teams,
      weather,
      nextWeather,
      weatherDuration,
      score,
      scoreBreakdown: breakdown,
      events,
      history,
      currentTurnActions: [],
      highOutageTurns
    };
  }

  return {
    status: 'playing',
    turn: newTurn,
    nodes,
    teams,
    weather,
    nextWeather,
    weatherDuration,
    score,
    scoreBreakdown: breakdown,
    events,
    history,
    currentTurnActions: [],
    highOutageTurns
  };
}

export function initializeGameState(level: LevelConfig): GameState {
  const nodes = level.nodes.map((n, index) => ({
    id: n.id || `node-${index}`,
    type: n.type || 'user',
    name: n.name || '未命名节点',
    position: n.position || { x: 0, y: 0, z: 0 },
    status: n.status || 'operational',
    health: n.health ?? 100,
    maxHealth: n.maxHealth ?? 100,
    connectedTo: n.connectedTo || [],
    repairTime: n.repairTime ?? 1,
    repairProgress: 0,
    powered: false,
    ...(n.type === 'user' ? {
      priority: (n as any).priority || 'normal',
      maxOutageTime: (n as any).maxOutageTime ?? 10,
      outageTime: (n as any).outageTime ?? 0,
      population: (n as any).population ?? 100
    } : {})
  })) as PowerNode[];

  const teams = level.teams.map((t, index) => ({
    id: t.id || `team-${index}`,
    name: t.name || `抢修${index + 1}队`,
    status: t.status || 'idle',
    efficiency: t.efficiency ?? 1,
    currentTarget: t.currentTarget || null,
    cooldown: t.cooldown ?? 0,
    maxCooldown: t.maxCooldown ?? 1,
    position: t.position || { x: 0, y: 2, z: 5 }
  })) as RepairTeam[];

  const poweredNodes = calculatePowerStatus(nodes);
  const initialWeather = WEATHER_CONFIG[level.initialWeather];
  const nextWeatherType = level.weatherSequence[1] || 'clear';
  const nextWeather = WEATHER_CONFIG[nextWeatherType];

  const { score, breakdown } = calculateScore(
    poweredNodes,
    0,
    level.maxTurns,
    level.difficulty
  );

  return {
    status: 'playing',
    turn: 1,
    maxTurns: level.maxTurns,
    score,
    scoreBreakdown: breakdown,
    weather: initialWeather,
    nextWeather,
    weatherDuration: 0,
    nodes: poweredNodes,
    teams,
    selectedNode: null,
    selectedTeam: null,
    events: [
      createEvent(1, 'info', '🌪️ 风暴过境，电网多处受损！请立即组织抢修。'),
      createEvent(1, 'info', `⚡ 当前天气: ${initialWeather.description}`)
    ],
    history: [],
    currentTurnActions: [],
    defeatReason: null,
    difficulty: level.difficulty,
    highOutageTurns: 0
  };
}
