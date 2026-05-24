import useSceneStore from '../../store/useSceneStore'
import { getLightStateAtTime } from '../../utils/conflictDetector'

function PhasePanel() {
  const { signalPhases, currentTime } = useSceneStore()

  const directionNames: Record<string, string> = {
    north: '北',
    south: '南',
    east: '东',
    west: '西',
  }

  return (
    <div className="p-4 border-b border-slate-700">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">信号相位</h3>
      <div className="grid grid-cols-2 gap-2">
        {signalPhases.map((phase) => {
          const state = getLightStateAtTime(phase, currentTime)
          const currentTiming = phase.timing.find(
            (t) => currentTime >= t.startTime && currentTime < t.endTime
          )
          const remaining = currentTiming ? (currentTiming.endTime - currentTime).toFixed(1) : '0.0'

          return (
            <div
              key={phase.id}
              className="bg-slate-800 rounded-lg p-3 flex items-center gap-3"
            >
              <div className={`phase-light ${state}`} />
              <div className="flex-1">
                <div className="text-sm font-medium">{directionNames[phase.direction]}向</div>
                <div className="text-xs text-slate-500">剩余 {remaining}s</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PhasePanel
