import { useGameStore } from '@/store/gameStore';
import { TASK_CONFIG, CREW_STATUS_LABELS } from '@/types/game';

interface Props {
  selectedBoothId: string | null;
  selectedCrewId: string | null;
  onSelectCrew: (crewId: string) => void;
  onAssignTask: (taskType: 'utilities' | 'structure' | 'fire_safety') => void;
  onRequestInspection: (type: 'utilities' | 'structure' | 'fire') => void;
  onEmergencyDelivery: (materialType: string) => void;
}

export default function SidePanel({
  selectedBoothId,
  selectedCrewId,
  onSelectCrew,
  onAssignTask,
  onRequestInspection,
  onEmergencyDelivery,
}: Props) {
  const state = useGameStore();
  const selectedBooth = state.booths.find((b) => b.id === selectedBoothId);

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">施工队</h3>
        <div className="space-y-2">
          {state.crews.map((crew) => (
            <div
              key={crew.id}
              onClick={() => onSelectCrew(crew.id)}
              className={`p-2 rounded cursor-pointer transition-all ${
                selectedCrewId === crew.id
                  ? 'bg-sky-900 border border-sky-500'
                  : crew.status === 'idle'
                  ? 'bg-slate-700 hover:bg-slate-600 border border-transparent'
                  : 'bg-slate-700/50 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{crew.name}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    crew.status === 'idle'
                      ? 'bg-slate-600 text-slate-300'
                      : crew.status === 'working'
                      ? 'bg-sky-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {CREW_STATUS_LABELS[crew.status]}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                效率: {crew.efficiency.toFixed(1)}x
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedBooth && (
        <div className="p-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">
            {selectedBooth.name} - 分配任务
          </h3>
          <div className="space-y-2">
            {(['utilities', 'structure', 'fire_safety'] as const).map((type) => {
              const config = TASK_CONFIG[type];
              const progressKey =
                type === 'utilities'
                  ? 'utilitiesProgress'
                  : type === 'structure'
                  ? 'structureProgress'
                  : 'fireSafetyProgress';
              const progress = selectedBooth[progressKey];
              const done = progress >= 100;

              return (
                <button
                  key={type}
                  onClick={() => onAssignTask(type)}
                  disabled={done || !selectedCrewId || state.crews.find((c) => c.id === selectedCrewId)?.status !== 'idle'}
                  className={`w-full px-3 py-2 rounded text-left transition-all ${
                    done
                      ? 'bg-emerald-900/50 text-emerald-400 cursor-default'
                      : selectedCrewId && state.crews.find((c) => c.id === selectedCrewId)?.status === 'idle'
                      ? 'bg-slate-700 hover:bg-slate-600 text-white'
                      : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                  }`}
                  style={!done ? { borderLeft: `3px solid ${config.color}` } : {}}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{config.label}</span>
                    <span className="text-xs text-slate-400">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">验收申请</h3>
        <div className="space-y-2">
          {state.inspections.map((inspection) => {
            const labels: Record<string, string> = {
              utilities: '水电验收',
              structure: '展架验收',
              fire: '消防验收',
            };

            return (
              <button
                key={inspection.type}
                onClick={() => onRequestInspection(inspection.type)}
                disabled={!inspection.unlocked || inspection.passed}
                className={`w-full px-3 py-2 rounded text-left transition-all ${
                  inspection.passed
                    ? 'bg-emerald-900/50 text-emerald-400 cursor-default'
                    : inspection.unlocked
                    ? 'bg-sky-900/50 hover:bg-sky-800/50 text-sky-300'
                    : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{labels[inspection.type]}</span>
                  <span className="text-xs">
                    {inspection.passed
                      ? '✓ 通过'
                      : inspection.unlocked
                      ? '🔓 可申请'
                      : '🔒 锁定'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedBooth && (
        <div className="p-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">紧急措施</h3>
          <button
            onClick={() => onEmergencyDelivery('utilities')}
            className="w-full px-3 py-2 rounded bg-amber-900/50 hover:bg-amber-800/50 text-amber-400 text-sm transition-all"
          >
            🚨 紧急补货（扣 10 分）
          </button>
        </div>
      )}

      <div className="p-3 flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">材料状态</h3>
        <div className="space-y-1">
          {state.materials.map((m) => {
            const boothNum = m.requiredFor[0].replace('booth-', '');
            const isLate =
              m.actualDeliveryTurn !== null && m.actualDeliveryTurn > m.deliveryTurn;
            return (
              <div
                key={m.id}
                className={`text-xs px-2 py-1 rounded ${
                  m.delivered
                    ? 'bg-emerald-900/30 text-emerald-400'
                    : isLate || state.currentTurn > m.deliveryTurn
                    ? 'bg-amber-900/30 text-amber-400'
                    : 'bg-slate-700/30 text-slate-400'
                }`}
              >
                <span className="font-medium">展位{boothNum}</span> - {m.name}
                {m.delivered ? ' ✓' : isLate ? ' (延误)' : ''}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
