import { useGameStore } from '../../store/useGameStore';
import { INJURY_NAMES } from '../../game/data/constants';
import { INJURY_COLORS } from '../../game/types';
import { getEquipmentByType } from '../../game/data/equipment';

export function VictimPanel() {
  const { gameState, selectVictim } = useGameStore();

  const activeVictims = gameState.victims.filter(v => !v.isRescued);

  return (
    <div className="bg-slate-800/90 rounded-lg p-4 backdrop-blur-sm">
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <span>🆘</span>
        伤员列表
        <span className="text-sm font-normal text-slate-400">
          ({activeVictims.length} 待救援)
        </span>
      </h3>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {activeVictims.length === 0 ? (
          <div className="text-slate-400 text-sm text-center py-4">
            所有伤员已救援！
          </div>
        ) : (
          activeVictims.map((victim) => {
            const isSelected = gameState.selectedVictimId === victim.id;
            const timePercent = (victim.timeRemaining / victim.maxTime) * 100;
            const isCritical = timePercent < 30;

            return (
              <div
                key={victim.id}
                onClick={() => selectVictim(victim.id)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-600 ring-2 ring-blue-400'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{victim.name}</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: INJURY_COLORS[victim.injury],
                      color: 'white',
                    }}
                  >
                    {INJURY_NAMES[victim.injury]}
                  </span>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>剩余时间</span>
                    <span className={isCritical ? 'text-red-400 font-bold animate-pulse' : ''}>
                      {Math.ceil(victim.timeRemaining)}秒
                    </span>
                  </div>
                  <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isCritical ? 'bg-red-500' : timePercent < 50 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${timePercent}%` }}
                    />
                  </div>
                </div>

                {victim.requiredEquipment.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-slate-400">需要:</span>
                    {victim.requiredEquipment.map((eq) => {
                      const equipment = getEquipmentByType(eq);
                      return (
                        <span
                          key={eq}
                          className="px-1.5 py-0.5 bg-slate-600 rounded text-xs text-slate-200"
                        >
                          {equipment?.icon} {equipment?.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
