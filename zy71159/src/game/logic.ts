import {
  Tile,
  TileType,
  CropType,
  PlotTile,
  ValveTile,
  CanalTile,
  SourceTile,
  EmptyTile,
  GameState,
  GameAction,
  GameSnapshot,
  PlotResult,
  IrrigationReport,
  ValveAction,
  WEATHER_INFO,
  CROP_INFO,
  Direction,
} from './types';
import { getLevelById } from './levels';
import { calculateWaterFlow, applyIrrigation, checkDownstreamWaterCutoff } from './waterFlow';

function generateTileId(type: string, row: number, col: number): string {
  return `${type}-${row}-${col}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function parseTileConfig(config: string, row: number, col: number): Tile | null {
  if (!config) return null;

  const parts = config.split('-');
  const type = parts[0] as TileType;

  switch (type) {
    case 'source':
      return {
        id: generateTileId('source', row, col),
        type: 'source',
        hasWater: true,
      } as SourceTile;

    case 'canal': {
      const direction = parts[1] as 'h' | 'v';
      const connections: Direction[] = direction === 'h' 
        ? ['left', 'right'] 
        : ['top', 'bottom'];
      return {
        id: generateTileId('canal', row, col),
        type: 'canal',
        hasWater: false,
        connections,
      } as CanalTile;
    }

    case 'valve': {
      const direction = parts[1] === 'h' ? 'horizontal' : 'vertical';
      return {
        id: generateTileId('valve', row, col),
        type: 'valve',
        state: 'closed',
        direction,
      } as ValveTile;
    }

    case 'plot': {
      const crop = parts[1] as CropType;
      const cropInfo = CROP_INFO[crop] || CROP_INFO.vegetable;
      return {
        id: generateTileId('plot', row, col),
        type: 'plot',
        crop,
        waterNeeded: cropInfo.baseWater * 3,
        currentWater: 0,
        isWatered: false,
        overwatered: false,
      } as PlotTile;
    }

    default:
      return {
        id: generateTileId('empty', row, col),
        type: 'empty',
      } as EmptyTile;
  }
}

export function initializeBoard(layout: (string | null)[][]): Tile[][] {
  return layout.map((row, rowIndex) =>
    row.map((config, colIndex) => parseTileConfig(config || '', rowIndex, colIndex))
  );
}

export function createInitialState(levelId: number): GameState {
  const level = getLevelById(levelId);
  if (!level) {
    throw new Error(`Level ${levelId} not found`);
  }

  const board = initializeBoard(level.boardLayout);
  const boardWithWater = calculateWaterFlow(board);

  return {
    level: levelId,
    round: 1,
    maxRounds: level.maxRounds,
    status: 'playing',
    score: 0,
    totalWater: level.initialWater,
    waterUsed: 0,
    waterUsedPerRound: [],
    currentWeather: level.weatherPool[0],
    weatherDeck: [...level.weatherPool.slice(1)],
    board: boardWithWater,
    history: [],
    failureReasons: [],
    valveActionsThisRound: [],
    replayIndex: 0,
  };
}

export function calculateScore(board: Tile[][]): number {
  let score = 0;

  for (const row of board) {
    for (const tile of row) {
      if (tile?.type === 'plot') {
        const plot = tile as PlotTile;
        if (plot.isWatered) {
          score += 50;
          if (!plot.overwatered) {
            score += 25;
          }
        }
        if (plot.overwatered) {
          score -= 30;
        }
      }
    }
  }

  return score;
}

export function checkWinCondition(board: Tile[][]): boolean {
  for (const row of board) {
    for (const tile of row) {
      if (tile?.type === 'plot') {
        const plot = tile as PlotTile;
        if (!plot.isWatered) {
          return false;
        }
      }
    }
  }
  return true;
}

export function analyzeFailureReasons(
  board: Tile[][],
  waterUsed: number,
  totalWater: number
): string[] {
  const reasons: string[] = [];

  const cutoff = checkDownstreamWaterCutoff(board);
  if (cutoff.hasCutoff) {
    reasons.push(`下游断水：${cutoff.affectedPlots.length} 个地块无法获得灌溉`);
  }

  let underwateredCount = 0;
  let overwateredCount = 0;
  for (const row of board) {
    for (const tile of row) {
      if (tile?.type === 'plot') {
        const plot = tile as PlotTile;
        if (!plot.isWatered) underwateredCount++;
        if (plot.overwatered) overwateredCount++;
      }
    }
  }

  if (underwateredCount > 0) {
    reasons.push(`灌溉不足：${underwateredCount} 个地块未达到需水量`);
  }
  if (overwateredCount > 0) {
    reasons.push(`过度灌溉：${overwateredCount} 个地块被淹`);
  }

  if (waterUsed > totalWater * 0.8) {
    reasons.push('水资源利用率低：消耗了超过80%的可用水量');
  }

  return reasons;
}

export function createSnapshot(state: GameState): GameSnapshot {
  return {
    round: state.round,
    board: JSON.parse(JSON.stringify(state.board)),
    score: state.score,
    waterUsed: state.waterUsed,
    totalWater: state.totalWater,
    weather: state.currentWeather,
    valveActions: [...state.valveActionsThisRound],
  };
}

export function generateReport(state: GameState): IrrigationReport {
  const level = getLevelById(state.level);
  const plotResults: PlotResult[] = [];

  for (const row of state.board) {
    for (const tile of row) {
      if (tile?.type === 'plot') {
        const plot = tile as PlotTile;
        let status: PlotResult['status'] = 'underwatered';
        if (plot.overwatered) {
          status = 'overwatered';
        } else if (plot.isWatered) {
          status = 'success';
        }
        plotResults.push({
          plotId: plot.id,
          crop: plot.crop,
          waterNeeded: plot.waterNeeded,
          waterReceived: plot.currentWater,
          status,
        });
      }
    }
  }

  const keyActions: IrrigationReport['keyActions'] = [];
  state.history.forEach((snapshot) => {
    snapshot.valveActions.forEach((action) => {
      keyActions.push({
        round: action.round,
        action: `阀门 ${action.valveId.slice(0, 8)} 从 ${action.from === 'open' ? '开启' : '关闭'} 切换为 ${action.to === 'open' ? '开启' : '关闭'}`,
        impact: action.to === 'open' ? '可能增加灌溉区域' : '可能减少灌溉区域',
      });
    });
  });

  return {
    levelName: level?.name || '未知关卡',
    totalRounds: state.round,
    finalScore: state.score,
    isWin: state.status === 'won',
    waterUsage: {
      total: state.waterUsed,
      perRound: state.waterUsedPerRound,
    },
    plotResults,
    failureReasons: state.failureReasons,
    keyActions: keyActions.slice(0, 10),
  };
}

export function exportReportToText(report: IrrigationReport): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(50));
  lines.push('农田灌溉游戏结算报告');
  lines.push('='.repeat(50));
  lines.push(`关卡: ${report.levelName}`);
  lines.push(`总回合: ${report.totalRounds}`);
  lines.push(`最终得分: ${report.finalScore}`);
  lines.push(`游戏结果: ${report.isWin ? '胜利' : '失败'}`);
  lines.push('');
  
  lines.push('-'.repeat(50));
  lines.push('水资源使用情况');
  lines.push('-'.repeat(50));
  lines.push(`总用水量: ${report.waterUsage.total}`);
  lines.push(`每回合用水量: ${report.waterUsage.perRound.join(', ')}`);
  lines.push('');
  
  lines.push('-'.repeat(50));
  lines.push('地块灌溉结果');
  lines.push('-'.repeat(50));
  report.plotResults.forEach((result, index) => {
    const cropInfo = CROP_INFO[result.crop];
    const statusText = result.status === 'success' ? '✓ 达标' 
      : result.status === 'overwatered' ? '✗ 过度灌溉' 
      : '✗ 灌溉不足';
    lines.push(`地块${index + 1} (${cropInfo?.emoji} ${cropInfo?.name}): ${statusText}`);
    lines.push(`  需水量: ${result.waterNeeded}, 实际获得: ${result.waterReceived}`);
  });
  lines.push('');
  
  if (report.failureReasons.length > 0) {
    lines.push('-'.repeat(50));
    lines.push('失败原因分析');
    lines.push('-'.repeat(50));
    report.failureReasons.forEach((reason, index) => {
      lines.push(`${index + 1}. ${reason}`);
    });
    lines.push('');
  }
  
  lines.push('-'.repeat(50));
  lines.push('关键操作记录');
  lines.push('-'.repeat(50));
  if (report.keyActions.length > 0) {
    report.keyActions.forEach((action) => {
      lines.push(`[回合${action.round}] ${action.action}`);
      lines.push(`  影响: ${action.impact}`);
    });
  } else {
    lines.push('无阀门操作记录');
  }
  lines.push('');
  
  lines.push('='.repeat(50));
  lines.push('报告生成时间: ' + new Date().toLocaleString('zh-CN'));
  lines.push('='.repeat(50));
  
  return lines.join('\n');
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TOGGLE_VALVE': {
      if (state.status !== 'playing') return state;
      
      const { row, col } = action.payload;
      const tile = state.board[row]?.[col];
      if (tile?.type !== 'valve') return state;

      const newBoard: Tile[][] = JSON.parse(JSON.stringify(state.board));
      const valve = newBoard[row][col] as ValveTile;
      const oldState = valve.state;
      valve.state = valve.state === 'open' ? 'closed' : 'open';

      const valveAction: ValveAction = {
        valveId: valve.id,
        from: oldState,
        to: valve.state,
        round: state.round,
      };

      const boardWithWater = calculateWaterFlow(newBoard);

      return {
        ...state,
        board: boardWithWater,
        valveActionsThisRound: [...state.valveActionsThisRound, valveAction],
      };
    }

    case 'NEXT_ROUND': {
      if (state.status !== 'playing') return state;

      const weatherInfo = WEATHER_INFO[state.currentWeather];
      const waterAmount = 5 + weatherInfo.bonus;
      
      const { board: irrigatedBoard, waterUsed } = applyIrrigation(
        state.board,
        waterAmount,
        weatherInfo.evaporation
      );

      const newScore = calculateScore(irrigatedBoard);
      const isWin = checkWinCondition(irrigatedBoard);
      const isLastRound = state.round >= state.maxRounds;

      let newStatus: GameState['status'] = state.status;
      let failureReasons = state.failureReasons;

      if (isWin) {
        newStatus = 'won';
      } else if (isLastRound) {
        newStatus = 'lost';
        failureReasons = analyzeFailureReasons(
          irrigatedBoard,
          state.waterUsed + waterUsed,
          state.totalWater
        );
      }

      const snapshot = createSnapshot(state);
      const newWeather = state.weatherDeck[0] || 'sunny';
      const newWeatherDeck = state.weatherDeck.slice(1);

      return {
        ...state,
        board: irrigatedBoard,
        round: state.round + 1,
        score: newScore,
        waterUsed: state.waterUsed + waterUsed,
        waterUsedPerRound: [...state.waterUsedPerRound, waterUsed],
        currentWeather: newWeather,
        weatherDeck: newWeatherDeck,
        status: newStatus,
        history: [...state.history, snapshot],
        failureReasons,
        valveActionsThisRound: [],
      };
    }

    case 'PAUSE':
      if (state.status !== 'playing') return state;
      return { ...state, status: 'paused' };

    case 'RESUME':
      if (state.status !== 'paused') return state;
      return { ...state, status: 'playing' };

    case 'RESTART':
      return createInitialState(state.level);

    case 'LOAD_LEVEL':
      return createInitialState(action.payload.levelId);

    case 'START_REPLAY':
      return {
        ...state,
        status: 'replaying',
        replayIndex: 0,
      };

    case 'REPLAY_STEP': {
      if (state.status !== 'replaying') return state;
      
      const { direction } = action.payload;
      let newIndex = state.replayIndex;
      
      if (direction === 'forward') {
        newIndex = Math.min(state.replayIndex + 1, state.history.length - 1);
      } else {
        newIndex = Math.max(state.replayIndex - 1, 0);
      }

      const snapshot = state.history[newIndex];
      if (!snapshot) return state;

      return {
        ...state,
        replayIndex: newIndex,
        board: JSON.parse(JSON.stringify(snapshot.board)),
        score: snapshot.score,
        waterUsed: snapshot.waterUsed,
        currentWeather: snapshot.weather,
      };
    }

    case 'EXIT_REPLAY': {
      const lastSnapshot = state.history[state.history.length - 1];
      return {
        ...state,
        status: state.status === 'won' || state.status === 'lost' ? state.status : 'playing',
        replayIndex: 0,
        board: lastSnapshot ? JSON.parse(JSON.stringify(lastSnapshot.board)) : state.board,
        score: lastSnapshot?.score || state.score,
        waterUsed: lastSnapshot?.waterUsed || state.waterUsed,
        currentWeather: lastSnapshot?.weather || state.currentWeather,
      };
    }

    default:
      return state;
  }
}
