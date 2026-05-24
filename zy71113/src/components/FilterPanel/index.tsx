import useSceneStore from '../../store/useSceneStore'
import { Car, User, Lightbulb, AlertOctagon, Zap, Route } from 'lucide-react'

function FilterPanel() {
  const { filters, setFilters } = useSceneStore()

  const filterOptions = [
    { key: 'showVehicles', label: '车辆', icon: <Car size={16} /> },
    { key: 'showPedestrians', label: '行人', icon: <User size={16} /> },
    { key: 'showTrafficLights', label: '信号灯', icon: <Lightbulb size={16} /> },
    { key: 'showAccidentPoints', label: '事故点', icon: <AlertOctagon size={16} /> },
    { key: 'showConflicts', label: '冲突点', icon: <Zap size={16} /> },
    { key: 'showTrajectories', label: '轨迹线', icon: <Route size={16} /> },
  ]

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">筛选显示</h3>
      <div className="space-y-2">
        {filterOptions.map((option) => (
          <label
            key={option.key}
            className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <input
              type="checkbox"
              checked={filters[option.key as keyof typeof filters]}
              onChange={(e) =>
                setFilters({ [option.key]: e.target.checked } as Partial<typeof filters>)
              }
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-info focus:ring-info focus:ring-offset-0"
            />
            <span className="text-slate-400">{option.icon}</span>
            <span className="text-sm text-slate-300">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default FilterPanel
