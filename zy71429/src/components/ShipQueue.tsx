import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { Ship } from '@/types/game';
import { cn } from '@/lib/utils';
import { Ship as ShipIcon, Gauge, Clock, Info } from 'lucide-react';

const priorityConfig = {
  high: {
    label: '高优先级',
    color: 'bg-alert-missed/20 text-alert-missed border-alert-missed/50',
    dotColor: 'bg-alert-missed',
  },
  medium: {
    label: '中优先级',
    color: 'bg-alert-conflict/20 text-alert-conflict border-alert-conflict/50',
    dotColor: 'bg-alert-conflict',
  },
  low: {
    label: '低优先级',
    color: 'bg-alert-info/20 text-alert-info border-alert-info/50',
    dotColor: 'bg-alert-info',
  },
};

interface ShipCardProps {
  ship: Ship;
  isSelected: boolean;
  onClick: () => void;
}

function ShipCard({ ship, isSelected, onClick }: ShipCardProps) {
  const [showSource, setShowSource] = useState(false);
  const config = priorityConfig[ship.priority];

  const formatETA = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTugPower = (power: number) => {
    if (power >= 10000) {
      return `${(power / 1000).toFixed(0)}K`;
    }
    return `${power}`;
  };

  return (
    <div
      className={cn(
        'card p-4 cursor-pointer transition-all duration-200 relative',
        isSelected && 'ring-2 ring-ocean-400 ring-offset-2 ring-offset-ocean-900'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShipIcon className="w-5 h-5 text-ocean-400" />
          <h3 className="font-display text-base text-ocean-100">{ship.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border',
              config.color
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', config.dotColor)} />
            {config.label}
          </span>
          <div
            className="relative"
            onMouseEnter={() => setShowSource(true)}
            onMouseLeave={() => setShowSource(false)}
          >
            <Info className="w-4 h-4 text-ocean-500 hover:text-ocean-300 cursor-help" />
            {showSource && (
              <div className="absolute right-0 top-6 z-20 w-64 p-3 bg-ocean-900 border border-ocean-600 rounded-lg shadow-lg text-xs font-mono animate-fade-in">
                <div className="text-ocean-400 mb-1">数据来源</div>
                <div className="text-ocean-200">
                  文件: {ship.source.file}
                </div>
                <div className="text-ocean-200">
                  行号: {ship.source.line}
                </div>
                <div className="text-ocean-400 mt-2 mb-1">原始内容</div>
                <div className="text-ocean-300 break-all">
                  {ship.source.rawContent}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-ocean-300">
          <Gauge className="w-4 h-4 text-ocean-500" />
          <span className="font-mono">
            {ship.length}m / {ship.draft}m
          </span>
        </div>
        <div className="flex items-center gap-2 text-ocean-300">
          <Clock className="w-4 h-4 text-ocean-500" />
          <span className="font-mono">ETA: {formatETA(ship.eta)}</span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-ocean-700/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ocean-400">所需拖轮功率</span>
          <span className="font-mono text-ocean-200">
            {formatTugPower(ship.tugRequired)} HP
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ShipQueue() {
  const { ships, selectedShipId, selectShip } = useGameStore();

  const waitingShips = ships
    .filter((ship) => ship.status === 'waiting')
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.eta.getTime() - b.eta.getTime();
    });

  return (
    <div className="card h-full flex flex-col">
      <div className="card-header flex items-center gap-2">
        <ShipIcon className="w-5 h-5 text-ocean-400" />
        等待队列
        <span className="ml-auto text-sm font-mono text-ocean-400">
          {waitingShips.length} 艘
        </span>
      </div>
      <div className="card-body flex-1 overflow-y-auto space-y-3">
        {waitingShips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ocean-500">
            <ShipIcon className="w-12 h-12 mb-2 opacity-50" />
            <p className="font-mono text-sm">暂无等待船舶</p>
          </div>
        ) : (
          waitingShips.map((ship) => (
            <ShipCard
              key={ship.id}
              ship={ship}
              isSelected={selectedShipId === ship.id}
              onClick={() => selectShip(ship.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
