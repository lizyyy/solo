import { useState } from 'react'
import { Settings, AlertTriangle, Wind, Thermometer, RotateCcw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function Toolbar() {
  const {
    paramPanelOpen,
    anomalyPanelOpen,
    showAirflow,
    showHeatmap,
    setParamPanelOpen,
    setAnomalyPanelOpen,
    setShowAirflow,
    setShowHeatmap,
  } = useStore()

  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null)

  const handleResetCamera = () => {
    const controls = document.querySelector('[data-orbit-controls]') as any
    if (controls && controls.reset) {
      controls.reset()
    }
    window.dispatchEvent(new CustomEvent('reset-camera'))
  }

  const buttons = [
    {
      id: 'params',
      icon: Settings,
      label: '参数面板',
      isActive: paramPanelOpen,
      onClick: () => setParamPanelOpen(!paramPanelOpen),
    },
    {
      id: 'anomalies',
      icon: AlertTriangle,
      label: '异常面板',
      isActive: anomalyPanelOpen,
      onClick: () => setAnomalyPanelOpen(!anomalyPanelOpen),
    },
    {
      id: 'airflow',
      icon: Wind,
      label: '气流箭头',
      isActive: showAirflow,
      onClick: () => setShowAirflow(!showAirflow),
    },
    {
      id: 'heatmap',
      icon: Thermometer,
      label: '热力图',
      isActive: showHeatmap,
      onClick: () => setShowHeatmap(!showHeatmap),
    },
    {
      id: 'reset',
      icon: RotateCcw,
      label: '重置视角',
      isActive: false,
      onClick: handleResetCamera,
    },
  ]

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-30">
      <div className="bg-dc-panel rounded-lg border border-dc-border p-2 flex flex-col gap-1">
        {buttons.map((button) => {
          const Icon = button.icon
          return (
            <div key={button.id} className="relative">
              <button
                onClick={button.onClick}
                onMouseEnter={() => setHoveredTooltip(button.id)}
                onMouseLeave={() => setHoveredTooltip(null)}
                className={cn(
                  'w-10 h-10 flex items-center justify-center rounded-md transition-colors',
                  button.isActive
                    ? 'bg-dc-cold text-dc-bg'
                    : 'text-dc-muted hover:text-dc-text hover:bg-dc-bg'
                )}
              >
                <Icon className="w-5 h-5" />
              </button>
              {hoveredTooltip === button.id && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-dc-panel border border-dc-border rounded px-2 py-1 text-xs text-dc-text whitespace-nowrap z-50">
                  {button.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-dc-border" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
