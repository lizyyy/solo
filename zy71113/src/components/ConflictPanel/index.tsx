import useSceneStore from '../../store/useSceneStore'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'

function ConflictPanel() {
  const { conflicts, jumpToTime } = useSceneStore()

  const typeNames: Record<string, string> = {
    phase_offset: '相位偏移',
    pedestrian_conflict: '行人冲突',
    trajectory_async: '轨迹不同步',
  }

  const severityIcons = {
    high: <AlertTriangle size={16} className="text-danger" />,
    medium: <AlertCircle size={16} className="text-warning" />,
    low: <Info size={16} className="text-info" />,
  }

  return (
    <div className="p-4 border-b border-slate-700 flex-1 overflow-hidden flex flex-col">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">
        冲突检测 ({conflicts.length})
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2">
        {conflicts.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4">暂无冲突检测</div>
        ) : (
          conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="bg-slate-800 rounded-lg p-3 cursor-pointer hover:bg-slate-700 transition-colors"
              onClick={() => jumpToTime(conflict.time)}
            >
              <div className="flex items-start gap-2">
                {severityIcons[conflict.severity]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">
                      {typeNames[conflict.type]}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {conflict.time.toFixed(1)}s
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {conflict.description}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ConflictPanel
