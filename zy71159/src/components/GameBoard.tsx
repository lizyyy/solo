import { useMemo } from 'react';
import { Tile, ValveTile, CanalTile, PlotTile, CROP_INFO } from '../game/types';
import { useGame } from '../hooks/useGameState';

interface TileProps {
  tile: Tile | null;
  row: number;
  col: number;
  cellSize: number;
}

function SourceTileComponent({ cellSize }: { cellSize: number }) {
  return (
    <div
      className="flex items-center justify-center bg-blue-600 rounded-lg shadow-inner"
      style={{ width: cellSize, height: cellSize }}
    >
      <div className="text-2xl animate-pulse">💧</div>
    </div>
  );
}

function CanalTileComponent({ tile, cellSize }: { tile: CanalTile; cellSize: number }) {
  const connections = tile.connections;
  const hasLeft = connections.includes('left');
  const hasRight = connections.includes('right');
  const hasTop = connections.includes('top');
  const hasBottom = connections.includes('bottom');

  const baseColor = tile.hasWater ? 'bg-blue-500' : 'bg-gray-400';
  const shadowColor = tile.hasWater ? 'shadow-blue-400/50' : '';
  const shadow = tile.hasWater ? `shadow-lg ${shadowColor}` : '';

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: cellSize, height: cellSize }}
    >
      {hasLeft && (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-3 rounded-l-full ${baseColor} ${shadow} transition-all duration-500`}>
          {tile.hasWater && (
            <div className="w-full h-full bg-blue-300 rounded-l-full animate-pulse opacity-50" />
          )}
        </div>
      )}
      
      {hasRight && (
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-3 rounded-r-full ${baseColor} ${shadow} transition-all duration-500`}>
          {tile.hasWater && (
            <div className="w-full h-full bg-blue-300 rounded-r-full animate-pulse opacity-50" />
          )}
        </div>
      )}
      
      {hasTop && (
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3 h-1/2 rounded-t-full ${baseColor} ${shadow} transition-all duration-500`}>
          {tile.hasWater && (
            <div className="w-full h-full bg-blue-300 rounded-t-full animate-pulse opacity-50" />
          )}
        </div>
      )}
      
      {hasBottom && (
        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-1/2 rounded-b-full ${baseColor} ${shadow} transition-all duration-500`}>
          {tile.hasWater && (
            <div className="w-full h-full bg-blue-300 rounded-b-full animate-pulse opacity-50" />
          )}
        </div>
      )}

      <div className={`absolute w-3 h-3 rounded-full ${baseColor} ${shadow} transition-all duration-500`} />
    </div>
  );
}

function ValveTileComponent({ 
  tile, 
  cellSize, 
  row, 
  col 
}: { tile: ValveTile; cellSize: number; row: number; col: number }) {
  const { dispatch, state } = useGame();
  const isOpen = tile.state === 'open';
  const isClickable = state.status === 'playing';
  const connections = tile.connections;
  
  const hasLeft = connections.includes('left');
  const hasRight = connections.includes('right');
  const hasTop = connections.includes('top');
  const hasBottom = connections.includes('bottom');

  const handleClick = () => {
    if (isClickable) {
      dispatch({ type: 'TOGGLE_VALVE', payload: { row, col } });
    }
  };

  const baseColor = isOpen ? 'bg-green-500' : 'bg-red-500';
  const innerColor = isOpen ? 'bg-green-300' : 'bg-red-300';
  const labelBg = isOpen ? 'bg-green-600' : 'bg-red-600';
  const shadow = isOpen ? 'shadow-lg shadow-green-400/50' : 'shadow-lg shadow-red-400/50';

  return (
    <div
      className={`relative flex items-center justify-center transition-all duration-300 ${
        isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-75'
      }`}
      style={{ width: cellSize, height: cellSize }}
      onClick={handleClick}
    >
      {hasLeft && (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-3 rounded-l-full ${baseColor} ${shadow} transition-all duration-500`}>
          {isOpen && (
            <div className={`w-full h-full ${innerColor} rounded-l-full animate-pulse opacity-50`} />
          )}
        </div>
      )}
      
      {hasRight && (
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-3 rounded-r-full ${baseColor} ${shadow} transition-all duration-500`}>
          {isOpen && (
            <div className={`w-full h-full ${innerColor} rounded-r-full animate-pulse opacity-50`} />
          )}
        </div>
      )}
      
      {hasTop && (
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3 h-1/2 rounded-t-full ${baseColor} ${shadow} transition-all duration-500`}>
          {isOpen && (
            <div className={`w-full h-full ${innerColor} rounded-t-full animate-pulse opacity-50`} />
          )}
        </div>
      )}
      
      {hasBottom && (
        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-1/2 rounded-b-full ${baseColor} ${shadow} transition-all duration-500`}>
          {isOpen && (
            <div className={`w-full h-full ${innerColor} rounded-b-full animate-pulse opacity-50`} />
          )}
        </div>
      )}

      <div className={`absolute rounded-full transition-all duration-300 ${baseColor} ${shadow} ${
        isOpen ? 'w-8 h-8' : 'w-10 h-10'
      } flex items-center justify-center z-10`}>
        <div className={`w-4 h-4 rounded-full ${innerColor}`} />
      </div>
      
      <div className={`absolute -top-1 -right-1 text-xs px-1.5 py-0.5 rounded-full font-bold text-white z-20 ${labelBg}`}>
        {isOpen ? '开' : '关'}
      </div>
    </div>
  );
}

function PlotTileComponent({ tile, cellSize }: { tile: PlotTile; cellSize: number }) {
  const cropInfo = CROP_INFO[tile.crop];
  const waterPercentage = Math.min(100, (tile.currentWater / tile.waterNeeded) * 100);
  
  let bgColor = 'bg-amber-200';
  if (tile.overwatered) {
    bgColor = 'bg-blue-300';
  } else if (tile.isWatered) {
    bgColor = 'bg-green-400';
  } else if (waterPercentage > 50) {
    bgColor = 'bg-lime-300';
  }

  return (
    <div
      className={`relative rounded-lg ${bgColor} flex flex-col items-center justify-center transition-all duration-300 shadow-md border-2 ${
        tile.isWatered ? 'border-green-600' : 'border-amber-400'
      }`}
      style={{ width: cellSize, height: cellSize }}
    >
      <div className="text-2xl">{cropInfo.emoji}</div>
      <div className="text-xs font-semibold text-gray-700">{cropInfo.name}</div>
      
      <div className="absolute bottom-1 left-1 right-1 h-2 bg-gray-300 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-500 rounded-full"
          style={{ width: `${waterPercentage}%` }}
        />
      </div>
      
      <div className="absolute top-1 right-1 text-xs font-bold">
        {tile.currentWater}/{tile.waterNeeded}
      </div>
      
      {tile.overwatered && (
        <div className="absolute top-1 left-1 text-xs">⚠️</div>
      )}
    </div>
  );
}

function EmptyTileComponent({ cellSize }: { cellSize: number }) {
  return (
    <div
      className="bg-amber-100 rounded opacity-50"
      style={{ width: cellSize, height: cellSize }}
    />
  );
}

function GameTile({ tile, row, col, cellSize }: TileProps) {
  if (!tile || tile.type === 'empty') {
    return <EmptyTileComponent cellSize={cellSize} />;
  }

  switch (tile.type) {
    case 'source':
      return <SourceTileComponent cellSize={cellSize} />;
    case 'canal':
      return <CanalTileComponent tile={tile as CanalTile} cellSize={cellSize} />;
    case 'valve':
      return <ValveTileComponent tile={tile as ValveTile} cellSize={cellSize} row={row} col={col} />;
    case 'plot':
      return <PlotTileComponent tile={tile as PlotTile} cellSize={cellSize} />;
    default:
      return <EmptyTileComponent cellSize={cellSize} />;
  }
}

export function GameBoard() {
  const { state } = useGame();
  
  const cellSize = useMemo(() => {
    const maxSize = Math.min(window.innerWidth * 0.45, 500);
    const cols = state.board[0]?.length || 8;
    return Math.floor(maxSize / cols);
  }, [state.board]);

  return (
    <div className="bg-amber-50 p-4 rounded-xl shadow-xl border-4 border-amber-800">
      <div 
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${state.board[0]?.length || 8}, ${cellSize}px)`,
        }}
      >
        {state.board.map((row, rowIndex) =>
          row.map((tile, colIndex) => (
            <GameTile
              key={`${rowIndex}-${colIndex}`}
              tile={tile}
              row={rowIndex}
              col={colIndex}
              cellSize={cellSize}
            />
          ))
        )}
      </div>
    </div>
  );
}
