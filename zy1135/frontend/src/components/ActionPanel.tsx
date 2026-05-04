import { useState } from 'react';
import { Action, GameState } from '../types';
import { useGameStore } from '../store/gameStore';

interface ActionPanelProps {
  gameState: GameState;
  selectedLocation: string | null;
  globalActions: Action[];
  locationActions: Action[];
}

const ActionPanel = ({
  gameState,
  selectedLocation,
  globalActions,
  locationActions,
}: ActionPanelProps) => {
  const { performAction, endTurn, isLoading } = useGameStore();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const allActions = [...globalActions, ...locationActions];

  const canPerformAction = (action: Action): boolean => {
    if (gameState.actionPoints < action.actionPoints) return false;
    if (gameState.resources.energy < action.energyCost) return false;

    if (action.requirements) {
      if (action.requirements.toolDurability !== undefined) {
        if (gameState.resources.toolDurability < action.requirements.toolDurability) {
          return false;
        }
      }

      if (action.requirements.inventory) {
        for (const req of action.requirements.inventory) {
          const item = gameState.inventory.find((i) => i.id === req.itemId);
          if (!item || item.quantity < req.quantity) {
            return false;
          }
        }
      }

      if (action.requirements.facility) {
        const facility = gameState.facilities.find(
          (f) => f.id === action.requirements!.facility!.facilityId
        );
        if (!facility || facility.level < action.requirements.facility.minLevel) {
          return false;
        }
      }
    }

    return true;
  };

  const handlePerformAction = async (action: Action) => {
    await performAction(action.id, action.location || selectedLocation || undefined);
    setSelectedAction(null);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">🎮 行动</h2>
        <button
          onClick={endTurn}
          disabled={isLoading}
          className="btn-primary"
        >
          🌙 结束今天
        </button>
      </div>

      {selectedAction ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedAction(null)}
            className="text-sm text-ocean hover:underline"
          >
            ← 返回行动列表
          </button>

          {(() => {
            const action = allActions.find((a) => a.id === selectedAction);
            if (!action) return null;

            const canDo = canPerformAction(action);

            return (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-gray-800 mb-2">{action.name}</h3>
                <p className="text-gray-600 mb-4">{action.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">行动点:</span>
                    <span className={`font-medium ${gameState.actionPoints >= action.actionPoints ? 'text-green-600' : 'text-red-600'}`}>
                      {action.actionPoints}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">体力消耗:</span>
                    <span className={`font-medium ${gameState.resources.energy >= action.energyCost ? 'text-green-600' : 'text-red-600'}`}>
                      {action.energyCost}
                    </span>
                  </div>
                </div>

                {action.requirements && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">需要:</h4>
                    <div className="space-y-1 text-sm">
                      {action.requirements.toolDurability !== undefined && (
                        <div className={gameState.resources.toolDurability >= action.requirements.toolDurability ? 'text-green-600' : 'text-red-600'}>
                          • 工具耐久 ≥ {action.requirements.toolDurability}
                        </div>
                      )}
                      {action.requirements.inventory?.map((req) => {
                        const item = gameState.inventory.find((i) => i.id === req.itemId);
                        const hasEnough = item && item.quantity >= req.quantity;
                        return (
                          <div key={req.itemId} className={hasEnough ? 'text-green-600' : 'text-red-600'}>
                            • {req.itemId} x{req.quantity} {hasEnough ? `(已有 ${item?.quantity})` : `(缺少, 只有 ${item?.quantity || 0})`}
                          </div>
                        );
                      })}
                      {action.requirements.facility && (
                        <div className="text-gray-600">
                          • 设施 {action.requirements.facility.facilityId} ≥ {action.requirements.facility.minLevel} 级
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">效果:</h4>
                  <p className="text-sm text-gray-600">{action.effects.description}</p>
                </div>

                <button
                  onClick={() => handlePerformAction(action)}
                  disabled={!canDo || isLoading}
                  className="btn-primary w-full"
                >
                  {isLoading ? '执行中...' : canDo ? '执行行动' : '条件不足'}
                </button>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-4">
          {globalActions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                通用行动
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {globalActions.map((action) => {
                  const canDo = canPerformAction(action);
                  return (
                    <button
                      key={action.id}
                      onClick={() => setSelectedAction(action.id)}
                      className={canDo ? 'action-card text-left' : 'action-card-disabled text-left'}
                    >
                      <h4 className="font-semibold text-gray-800 text-sm">{action.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {action.actionPoints} 行动点 | {action.energyCost} 体力
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {locationActions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {selectedLocation
                  ? `${gameState.locations.find((l) => l.id === selectedLocation)?.name} 行动`
                  : '地点行动'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {locationActions.map((action) => {
                  const canDo = canPerformAction(action);
                  return (
                    <button
                      key={action.id}
                      onClick={() => setSelectedAction(action.id)}
                      className={canDo ? 'action-card text-left' : 'action-card-disabled text-left'}
                    >
                      <h4 className="font-semibold text-gray-800 text-sm">{action.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {action.actionPoints} 行动点 | {action.energyCost} 体力
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedLocation && locationActions.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              该地点没有可用的特定行动
            </div>
          )}

          {!selectedLocation && allActions.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              选择一个地点以查看可用行动
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionPanel;
