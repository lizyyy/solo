import { ProblemVersion, ProblemWithDetails } from '../types'
import { formatDateTime, getStatusBgClass } from '../utils/format'
import { Mic, Sliders, CheckCircle, AlertTriangle, User, Headphones } from 'lucide-react'
import { Link } from 'react-router-dom'

interface ProblemTimelineProps {
  problem: ProblemWithDetails
  compact?: boolean
}

export default function ProblemTimeline({ problem, compact = false }: ProblemTimelineProps) {
  const getVersionIcon = (version: ProblemVersion, index: number) => {
    if (index === problem.versions.length - 1) {
      return <Mic className="w-4 h-4" />
    }
    if (version.tuningAction) {
      return <Sliders className="w-4 h-4" />
    }
    if (problem.confirmation && index === 0) {
      return <CheckCircle className="w-4 h-4" />
    }
    return <User className="w-4 h-4" />
  }

  const getVersionTitle = (version: ProblemVersion, index: number) => {
    if (index === problem.versions.length - 1) {
      return '发现问题'
    }
    if (version.tuningAction) {
      return '调音修改'
    }
    return '记录更新'
  }

  const sortedVersions = [...problem.versions].sort((a, b) => a.version - b.version)

  return (
    <div className="relative">
      <div className="timeline-line" />

      <div className={`space-y-${compact ? '3' : '6'}`}>
        {sortedVersions.map((version, index) => {
          const isLatest = index === sortedVersions.length - 1
          const hasAnomaly = version.anomalyDetected

          if (compact) {
            return (
              <div key={version.id} className="relative pl-8">
                <div className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 ${
                  isLatest ? 'bg-accent-amber border-accent-amber' : 'bg-stage-darker border-stage-blue'
                }`}>
                  {isLatest && <div className="absolute inset-0.5 bg-white rounded-full" />}
                </div>
                <div className={`p-3 rounded-lg ${hasAnomaly ? 'bg-accent-amber/5 border border-accent-amber/30' : 'bg-stage-dark/50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-accent-amber font-bold text-xs font-mono">V{version.version}</span>
                      <span className="text-xs text-white">{getVersionTitle(version, index)}</span>
                      {hasAnomaly && (
                        <AlertTriangle className="w-3 h-3 text-accent-amber" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatDateTime(version.createdAt)}
                    </span>
                  </div>
                  {version.tuningAction && (
                    <p className="text-xs text-slate-300 line-clamp-1">{version.tuningAction}</p>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div key={version.id} className="relative pl-10">
              <div className={`timeline-dot ${isLatest ? 'timeline-dot-active' : ''}`}>
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white">
                  {version.version}
                </span>
              </div>

              <div className={`card ${hasAnomaly ? 'border-accent-amber/50' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-accent-amber font-bold text-sm">
                      V{version.version}
                    </span>
                    <span className="text-sm text-white font-medium">
                      {getVersionTitle(version, index)}
                    </span>
                    {hasAnomaly && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-accent-amber/10 text-accent-amber border border-accent-amber/30">
                        <AlertTriangle className="w-3 h-3" />
                        异常
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {formatDateTime(version.createdAt)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div>
                    <span className="text-slate-500 text-xs">乐手</span>
                    <p className="text-white">{version.musicianName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">监听通道</span>
                    <p className="text-white font-mono">CH {version.channel}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 text-xs">问题描述</span>
                    <p className="text-white">{version.description}</p>
                  </div>
                </div>

                {version.tuningAction && (
                  <div className="bg-stage-darker rounded p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2 text-accent-green">
                      <Sliders className="w-4 h-4" />
                      <span className="text-sm font-medium">调音动作</span>
                    </div>
                    <p className="text-slate-300 text-sm mb-2">{version.tuningAction}</p>
                    {version.tuningParams && (
                      <div className="text-xs text-slate-400 font-mono space-y-1">
                        {version.tuningParams.eq && version.tuningParams.eq.length > 0 && (
                          <div>EQ: {version.tuningParams.eq.map(e => `${e.freq}Hz ${e.gain > 0 ? '+' : ''}${e.gain}dB Q${e.q}`).join(', ')}</div>
                        )}
                        {version.tuningParams.compression && (
                          <div>压缩: 阈值{version.tuningParams.compression.threshold}dB 比率{version.tuningParams.compression.ratio}:1</div>
                        )}
                        {version.tuningParams.gain !== undefined && (
                          <div>增益: {version.tuningParams.gain > 0 ? '+' : ''}{version.tuningParams.gain}dB</div>
                        )}
                        {version.tuningParams.delay !== undefined && (
                          <div>延迟: {version.tuningParams.delay}ms</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {version.changeReason && (
                  <div className="mb-3">
                    <span className="text-slate-500 text-xs">修改原因</span>
                    <p className="text-slate-300 text-sm">{version.changeReason}</p>
                  </div>
                )}

                {hasAnomaly && version.anomalyDetected && (
                  <div className="bg-accent-amber/5 border border-accent-amber/30 rounded p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2 text-accent-amber">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">异常检测</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-slate-400">原因：</span>
                        <span className="text-slate-200">{version.anomalyDetected.reason}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">影响：</span>
                        <span className="text-slate-200">{version.anomalyDetected.impact}</span>
                      </div>
                      <div>
                        <span className="text-accent-green">下一步：</span>
                        <span className="text-slate-200">{version.anomalyDetected.nextAction}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-stage-border">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>操作人: {version.operatorName}</span>
                  </div>
                  {version.parentVersion && (
                    <div className="flex items-center gap-1">
                      <span>父版本: V{version.parentVersion}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {problem.confirmation && (
          <div className={`relative ${compact ? 'pl-8' : 'pl-10'}`}>
            <div className={`timeline-dot timeline-dot-active bg-accent-green border-accent-green shadow-glow-green ${compact ? 'w-4 h-4' : ''}`}>
              <CheckCircle className={`w-3 h-3 text-white absolute inset-0 m-auto ${compact ? 'w-2.5 h-2.5' : ''}`} />
            </div>

            {compact ? (
              <div className="p-3 rounded-lg bg-accent-green/5 border border-accent-green/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-accent-green" />
                    <span className="text-xs text-accent-green font-medium">签收确认</span>
                  </div>
                  <span className="text-[10px] text-accent-green">已完成</span>
                </div>
              </div>
            ) : (
              <div className="card border-accent-green/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent-green" />
                    <span className="text-accent-green font-bold">签收确认</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs border ${getStatusBgClass('confirmed')}`}>
                    已完成
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-stage-darker rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Headphones className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-400">乐手确认</span>
                    </div>
                    {problem.confirmation.musicianSigned ? (
                      <div>
                        <p className="text-white font-medium">{problem.confirmation.musicianSignature}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(problem.confirmation.musicianSignedAt!)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">未确认</p>
                    )}
                  </div>

                  <div className="bg-stage-darker rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sliders className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-400">音响师确认</span>
                    </div>
                    {problem.confirmation.engineerSigned ? (
                      <div>
                        <p className="text-white font-medium">{problem.confirmation.engineerSignature}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(problem.confirmation.engineerSignedAt!)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">未确认</p>
                    )}
                  </div>
                </div>

                {problem.confirmation.notes && (
                  <div className="mt-3 pt-3 border-t border-stage-border">
                    <span className="text-slate-500 text-xs">备注</span>
                    <p className="text-slate-300 text-sm mt-1">{problem.confirmation.notes}</p>
                  </div>
                )}

                <div className="mt-3 text-right">
                  <Link
                    to={`/confirm/${problem.id}`}
                    className="text-xs text-accent-amber hover:text-accent-amber/80"
                  >
                    查看签收详情 →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
