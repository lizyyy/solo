import React from 'react'
import type { Scenario, PhaseConfig } from '../../shared/types.js'
import { Car, Users, Bus, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

interface Props {
  scenario: Scenario
  phaseConfig: PhaseConfig[]
}

const DIRECTION_LABEL: Record<string, string> = {
  north: '北',
  south: '南',
  east: '东',
  west: '西',
}

export default function FlowPanel({ scenario, phaseConfig }: Props) {
  const maxVehicleFlow = Math.max(...scenario.approaches.map((a) => a.vehicleFlow))

  const approachHasActiveGreen = (approachId: string) => {
    return phaseConfig.some((phase) =>
      phase.movements.some(
        (m) => m.approachId === approachId && m.laneType === 'straight' && !m.pedestrianCrossingId
      )
    )
  }

  const crossingHasPedestrianMovement = (crossingId: string) => {
    return phaseConfig.some((phase) =>
      phase.movements.some((m) => m.pedestrianCrossingId === crossingId)
    )
  }

  const getBusGreenTime = (approachId: string) => {
    let totalGreen = 0
    phaseConfig.forEach((phase) => {
      const hasBusMovement = phase.movements.some(
        (m) => m.approachId === approachId && m.laneType === 'bus'
      )
      if (hasBusMovement) {
        totalGreen += phase.greenSeconds
      }
    })
    return totalGreen
  }

  const totalCycleLength = phaseConfig.reduce(
    (sum, phase) => sum + phase.greenSeconds + phase.yellowSeconds + phase.redClearanceSeconds,
    0
  )

  const getCycleStatus = () => {
    if (totalCycleLength < 60) {
      return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500', icon: AlertTriangle, text: '周期过短' }
    }
    if (totalCycleLength > 180) {
      return { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500', icon: XCircle, text: '周期过长' }
    }
    return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500', icon: CheckCircle, text: '周期合理' }
  }

  const cycleStatus = getCycleStatus()

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-emerald-400 font-semibold pb-2 border-b border-slate-700 mb-4 flex items-center gap-2">
              <Car className="w-4 h-4" />
              机动车流量
            </h3>
            <div className="space-y-3">
              {scenario.approaches.map((approach) => {
                const hasGreen = approachHasActiveGreen(approach.id)
                const barWidth = maxVehicleFlow > 0 ? (approach.vehicleFlow / maxVehicleFlow) * 100 : 0
                return (
                  <div key={approach.id} className="flex items-center gap-3">
                    <span className="w-12 text-sm text-slate-300">
                      {DIRECTION_LABEL[approach.direction]}进口
                    </span>
                    <div className="flex-1 h-8 bg-slate-700/50 rounded overflow-hidden relative">
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: hasGreen ? '#22C55E' : '#475569',
                        }}
                      />
                    </div>
                    <span className="w-20 text-right text-slate-100 font-mono text-sm">
                      {approach.vehicleFlow} PCU/h
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="text-emerald-400 font-semibold pb-2 border-b border-slate-700 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" />
              行人流量
            </h3>
            <div className="space-y-3">
              {scenario.pedestrianCrossings.map((crossing) => {
                const approach = scenario.approaches.find((a) => a.id === crossing.approachId)
                if (!approach) return null
                const hasMovement = crossingHasPedestrianMovement(crossing.id)
                const maxPedFlow = Math.max(...scenario.approaches.map((a) => a.pedestrianFlow))
                const barWidth = maxPedFlow > 0 ? (approach.pedestrianFlow / maxPedFlow) * 100 : 0
                return (
                  <div key={crossing.id} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="w-20 text-sm text-slate-300">
                        {DIRECTION_LABEL[approach.direction]}进口
                      </span>
                      <div className="flex-1 h-8 bg-slate-700/50 rounded overflow-hidden relative">
                        <div
                          className="h-full rounded transition-all duration-300"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: hasMovement ? '#F97316' : '#475569',
                          }}
                        />
                      </div>
                      <span className="w-24 text-right text-slate-100 font-mono text-sm">
                        {approach.pedestrianFlow} 人/小时
                      </span>
                    </div>
                    <div className="pl-7 text-xs text-slate-500">
                      平均等待: <span className="font-mono">{crossing.avgWaitSeconds}秒</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-emerald-400 font-semibold pb-2 border-b border-slate-700 mb-4 flex items-center gap-2">
              <Bus className="w-4 h-4" />
              公交线路
            </h3>
            <div className="space-y-3">
              {scenario.busRoutes.map((route) => {
                const approach = scenario.approaches.find((a) => a.id === route.approachId)
                const busGreenTime = getBusGreenTime(route.approachId)
                const hasBusPriority = busGreenTime >= 20
                const isHighFrequency = route.peakHeadwayMinutes <= 8
                return (
                  <div
                    key={route.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isHighFrequency
                        ? 'border-[#3B82F6] bg-blue-500/10'
                        : 'border-slate-600 bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bus className={`w-4 h-4 ${isHighFrequency ? 'text-[#3B82F6]' : 'text-slate-400'}`} />
                        <span className={`font-medium ${isHighFrequency ? 'text-[#3B82F6]' : 'text-slate-200'}`}>
                          {route.name}
                        </span>
                      </div>
                      {hasBusPriority ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <div className="flex items-center gap-1 text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs">需绿灯补偿</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span>
                        方向: {approach ? DIRECTION_LABEL[approach.direction] : '未知'}进口
                      </span>
                      <span>
                        高峰间隔: <span className="font-mono text-slate-200">{route.peakHeadwayMinutes}</span> 分钟
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="text-emerald-400 font-semibold pb-2 border-b border-slate-700 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              周期时长
            </h3>
            <div className={`p-5 rounded-lg border-2 ${cycleStatus.border} ${cycleStatus.bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-400 mb-1">周期时长</div>
                  <div className="text-3xl font-bold text-slate-100 font-mono">
                    {totalCycleLength} <span className="text-lg">秒</span>
                  </div>
                </div>
                <div className={`flex items-center gap-2 ${cycleStatus.color}`}>
                  <cycleStatus.icon className="w-6 h-6" />
                  <span className="font-medium">{cycleStatus.text}</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                理想范围: <span className="font-mono text-slate-400">60-180</span> 秒
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
