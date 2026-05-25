import { Tile, Direction, ValveTile, CanalTile, PlotTile, SourceTile } from './types';

export function calculateWaterFlow(board: Tile[][]): Tile[][] {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  const newBoard: Tile[][] = JSON.parse(JSON.stringify(board));

  const visited: boolean[][] = Array(rows).fill(null).map(() => Array(cols).fill(false));
  const queue: [number, number][] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = newBoard[r][c];
      if (tile?.type === 'source') {
        (tile as SourceTile).hasWater = true;
        queue.push([r, c]);
        visited[r][c] = true;
      } else if (tile?.type === 'canal') {
        (tile as CanalTile).hasWater = false;
      }
    }
  }

  const directions: Record<Direction, [number, number, Direction]> = {
    top: [-1, 0, 'bottom'],
    bottom: [1, 0, 'top'],
    left: [0, -1, 'right'],
    right: [0, 1, 'left'],
  };

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const currentTile = newBoard[r][c];
    if (!currentTile) continue;

    let currentConnections: Direction[] = [];

    if (currentTile.type === 'source') {
      currentConnections = ['top', 'bottom', 'left', 'right'];
    } else if (currentTile.type === 'canal') {
      currentConnections = (currentTile as CanalTile).connections;
    } else if (currentTile.type === 'valve') {
      const valve = currentTile as ValveTile;
      if (valve.state === 'open') {
        currentConnections = valve.direction === 'horizontal' 
          ? ['left', 'right'] 
          : ['top', 'bottom'];
      } else {
        continue;
      }
    }

    for (const dir of currentConnections) {
      const [dr, dc, oppositeDir] = directions[dir];
      const nr = r + dr;
      const nc = c + dc;

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (visited[nr][nc]) continue;

      const nextTile = newBoard[nr][nc];
      if (!nextTile) continue;

      let canFlow = false;

      if (nextTile.type === 'canal') {
        const canal = nextTile as CanalTile;
        canFlow = canal.connections.includes(oppositeDir);
        if (canFlow) {
          canal.hasWater = true;
        }
      } else if (nextTile.type === 'valve') {
        const valve = nextTile as ValveTile;
        const valveConnections = valve.direction === 'horizontal' 
          ? ['left', 'right'] 
          : ['top', 'bottom'];
        canFlow = valveConnections.includes(oppositeDir);
      } else if (nextTile.type === 'plot') {
        canFlow = true;
      }

      if (canFlow) {
        visited[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
  }

  return newBoard;
}

export function getIrrigatedPlots(board: Tile[][]): PlotTile[] {
  const irrigatedPlots: PlotTile[] = [];
  const rows = board.length;
  const cols = board[0]?.length || 0;

  const directions: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r][c];
      if (tile?.type === 'plot') {
        for (const [dr, dc] of directions) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighbor = board[nr][nc];
            if (neighbor?.type === 'canal' && (neighbor as CanalTile).hasWater) {
              irrigatedPlots.push(tile as PlotTile);
              break;
            }
          }
        }
      }
    }
  }

  return irrigatedPlots;
}

export function applyIrrigation(
  board: Tile[][],
  waterAmount: number,
  evaporation: number
): { board: Tile[][]; waterUsed: number } {
  const newBoard: Tile[][] = JSON.parse(JSON.stringify(board));
  const irrigatedPlots = getIrrigatedPlots(newBoard);
  let totalWaterUsed = 0;

  const waterPerPlot = Math.floor(waterAmount / Math.max(irrigatedPlots.length, 1));

  for (const plot of irrigatedPlots) {
    for (let r = 0; r < newBoard.length; r++) {
      for (let c = 0; c < newBoard[r].length; c++) {
        const tile = newBoard[r][c];
        if (tile?.type === 'plot' && tile.id === plot.id) {
          const plotTile = tile as PlotTile;
          const actualWater = Math.max(0, waterPerPlot - evaporation);
          plotTile.currentWater += actualWater;
          totalWaterUsed += actualWater;

          if (plotTile.currentWater >= plotTile.waterNeeded) {
            plotTile.isWatered = true;
          }
          if (plotTile.currentWater > plotTile.waterNeeded * 2) {
            plotTile.overwatered = true;
          }
        }
      }
    }
  }

  return { board: newBoard, waterUsed: totalWaterUsed };
}

export function checkDownstreamWaterCutoff(
  board: Tile[][]
): { hasCutoff: boolean; affectedPlots: string[] } {
  const affectedPlots: string[] = [];
  const wateredBoard = calculateWaterFlow(board);
  
  for (let r = 0; r < wateredBoard.length; r++) {
    for (let c = 0; c < wateredBoard[r].length; c++) {
      const tile = wateredBoard[r][c];
      if (tile?.type === 'plot') {
        const plot = tile as PlotTile;
        const isNearWateredCanal = checkNearWateredCanal(wateredBoard, r, c);
        if (!isNearWateredCanal && plot.waterNeeded > 0) {
          affectedPlots.push(plot.id);
        }
      }
    }
  }

  return { hasCutoff: affectedPlots.length > 0, affectedPlots };
}

function checkNearWateredCanal(board: Tile[][], r: number, c: number): boolean {
  const directions: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];

  for (const [dr, dc] of directions) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[0].length) {
      const neighbor = board[nr][nc];
      if (neighbor?.type === 'canal' && (neighbor as CanalTile).hasWater) {
        return true;
      }
    }
  }
  return false;
}
