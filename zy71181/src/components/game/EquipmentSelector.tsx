import { useGameStore } from '../../store/useGameStore';
import { EQUIPMENT_LIST } from '../../game/data/equipment';
import { INJURY_NAMES } from '../../game/data/constants';

export function EquipmentSelector() {
  const { gameState, toggleEquipment, confirmDispatch, cancelSelection } = useGameStore();

  const selectedPatroller = gameState.patrollers.find(
    (p) => p.id === gameState.selectedPatrollerId
  );
  const selectedVictim = gameState.victims.find(
    (v) => v.id === gameState.selectedVictimId
  );

  const canDispatch = selectedPatroller && selectedVictim;

  const handleDispatch = () => {
    if (confirmDispatch()) {
    }
  };

  return (
    <div className="bg-slate-800/90 rounded-lg p-4 backdrop-blur-sm">
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <span>🎒</span>
        派遣控制
      </h3>

      {!canDispatch ? (
        <div className="text-slate-400 text-sm py-4 text-center">
          {!selectedPatroller && !selectedVictim && (
            <p>请先选择巡逻员和伤员</p>
          )}
          {!selectedPatroller && selectedVictim && (
            <p>请选择一名待命的巡逻员</p>
          )}
          {selectedPatroller && !selectedVictim && (
            <p>请选择一名需要救援的伤员</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">巡逻员:</span>
                <span className="text-white ml-1">{selectedPatroller?.name}</span>
              </div>
              <div>
                <span className="text-slate-400">伤员:</span>
                <span className="text-white ml-1">{selectedVictim?.name}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">伤情:</span>
                <span className="text-white ml-1">
                  {selectedVictim && INJURY_NAMES[selectedVictim.injury]}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-300 mb-2">选择装备:</div>
            <div className="grid grid-cols-2 gap-2">
              {EQUIPMENT_LIST.map((eq) => {
                const isSelected = gameState.selectedEquipment.includes(eq.type);
                const isRequired = selectedVictim?.requiredEquipment.includes(eq.type);

                return (
                  <button
                    key={eq.type}
                    onClick={() => toggleEquipment(eq.type)}
                    className={`p-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600 ring-2 ring-blue-400'
                        : 'bg-slate-700 hover:bg-slate-600'
                    } ${isRequired && !isSelected ? 'ring-2 ring-orange-500' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{eq.icon}</span>
                      <div>
                        <div className="text-sm text-white font-medium">
                          {eq.name}
                        </div>
                        <div className="text-xs text-slate-300">
                          {eq.speedBonus > 0
                            ? `+${eq.speedBonus}速度`
                            : eq.speedBonus < 0
                            ? `${eq.speedBonus}速度`
                            : ''}
                        </div>
                      </div>
                    </div>
                    {isRequired && (
                      <div className="text-xs text-orange-400 mt-1">必需</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={cancelSelection}
              className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDispatch}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium"
            >
              🚀 派遣救援
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
