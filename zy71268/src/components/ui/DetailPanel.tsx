import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Save } from 'lucide-react'
import { useSculptureStore } from '@/store/useSculptureStore'

function SectionCard({
  title,
  accent,
  children,
}: {
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg p-3 mb-3"
      style={{
        backgroundColor: '#1a1a2e',
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <h3 className="text-sm font-bold text-gray-200 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function ParamRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-mono ${danger ? 'text-red-400 font-bold' : 'text-gray-100'}`}>
        {value}
      </span>
    </div>
  )
}

export default function DetailPanel() {
  const sculptures = useSculptureStore((s) => s.sculptures)
  const selectedId = useSculptureStore((s) => s.selectedId)
  const sculpture = sculptures.find((s) => s.id === selectedId) ?? null
  const panelCollapsed = useSculptureStore((s) => s.panelCollapsed)
  const togglePanel = useSculptureStore((s) => s.togglePanel)
  const updateManualCheck = useSculptureStore((s) => s.updateManualCheck)

  const [notes, setNotes] = useState(sculpture?.manualCheck.notes ?? '')
  const [checkedBy, setCheckedBy] = useState(sculpture?.manualCheck.checkedBy ?? '')
  const [checkedAt, setCheckedAt] = useState(sculpture?.manualCheck.checkedAt ?? '')

  useEffect(() => {
    if (sculpture) {
      setNotes(sculpture.manualCheck.notes)
      setCheckedBy(sculpture.manualCheck.checkedBy)
      setCheckedAt(sculpture.manualCheck.checkedAt)
    }
  }, [selectedId, sculpture])

  if (panelCollapsed) {
    return (
      <button
        onClick={togglePanel}
        className="flex items-center justify-center w-8 bg-gray-900 border-l border-gray-700 hover:bg-gray-800 transition-colors"
        style={{ backgroundColor: '#16213e' }}
      >
        <ChevronLeft className="w-4 h-4 text-gray-400" />
      </button>
    )
  }

  if (!sculpture) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          width: '35%',
          backgroundColor: '#16213e',
          fontFamily: 'Noto Sans SC, sans-serif',
        }}
      >
        <span className="text-gray-500">未选择雕塑</span>
      </div>
    )
  }

  const cogOffset = Math.sqrt(
    sculpture.centerOfGravity.x ** 2 + sculpture.centerOfGravity.z ** 2
  )
  const cogExceed = cogOffset > sculpture.cogLimit.radius

  const baseUndersizeW = sculpture.base.width < sculpture.baseMinRequired.width
  const baseUndersizeD = sculpture.base.depth < sculpture.baseMinRequired.depth

  const actualAngle = Math.atan2(sculpture.windLoad.direction.z, sculpture.windLoad.direction.x)
  const designAngle = Math.atan2(
    sculpture.windLoad.designDirection.z,
    sculpture.windLoad.designDirection.x
  )
  let angleDiff = Math.abs(actualAngle - designAngle)
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
  const angleDiffDeg = (angleDiff * 180) / Math.PI

  const statusColors: Record<string, string> = {
    pending: '#facc15',
    approved: '#22c55e',
    rejected: '#ef4444',
  }
  const statusLabels: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回',
  }

  const handleSave = () => {
    updateManualCheck(sculpture.id, { notes, checkedBy, checkedAt })
  }

  return (
    <div
      className="flex flex-col overflow-y-auto border-l border-gray-700 relative"
      style={{
        width: '35%',
        backgroundColor: '#16213e',
        fontFamily: 'Noto Sans SC, sans-serif',
      }}
    >
      <button
        onClick={togglePanel}
        className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-gray-700 transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </button>

      <div className="p-3 pt-2">
        <SectionCard title="雕塑参数" accent="#3b82f6">
          <ParamRow label="名称" value={sculpture.name} />
          <ParamRow label="形状" value={sculpture.shape} />
          <ParamRow label="安装位置" value={sculpture.installLocation} />
          <div className="flex justify-between items-center py-0.5">
            <span className="text-xs text-gray-400">颜色</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-sm border border-gray-500"
                style={{ backgroundColor: sculpture.color }}
              />
              <span className="text-sm font-mono text-gray-100">{sculpture.color}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="底座尺寸" accent={baseUndersizeW || baseUndersizeD ? '#ef4444' : '#22c55e'}>
          <ParamRow
            label="实际尺寸 (W×D×H)"
            value={`${sculpture.base.width}×${sculpture.base.depth}×${sculpture.base.height}m`}
            danger={baseUndersizeW || baseUndersizeD}
          />
          <ParamRow
            label="最低要求 (W×D)"
            value={`${sculpture.baseMinRequired.width}×${sculpture.baseMinRequired.depth}m`}
          />
          {(baseUndersizeW || baseUndersizeD) && (
            <div className="text-xs text-red-400 mt-1">
              ⚠ 底座尺寸不足
              {baseUndersizeW && ` 宽度差 ${(sculpture.baseMinRequired.width - sculpture.base.width).toFixed(1)}m`}
              {baseUndersizeD && ` 深度差 ${(sculpture.baseMinRequired.depth - sculpture.base.depth).toFixed(1)}m`}
            </div>
          )}
        </SectionCard>

        <SectionCard title="重心坐标" accent={cogExceed ? '#ef4444' : '#3b82f6'}>
          <ParamRow label="X" value={sculpture.centerOfGravity.x.toFixed(3)} danger={cogExceed} />
          <ParamRow label="Y" value={sculpture.centerOfGravity.y.toFixed(3)} />
          <ParamRow label="Z" value={sculpture.centerOfGravity.z.toFixed(3)} danger={cogExceed} />
          <ParamRow
            label="偏移距离"
            value={`${cogOffset.toFixed(3)}m`}
            danger={cogExceed}
          />
          <ParamRow label="允许半径" value={`${sculpture.cogLimit.radius.toFixed(3)}m`} />
          {cogExceed && (
            <div className="text-xs text-red-400 mt-1">
              ⚠ 重心偏移超出允许范围 {(cogOffset - sculpture.cogLimit.radius).toFixed(3)}m
            </div>
          )}
        </SectionCard>

        <SectionCard title="风载数据" accent="#f59e0b">
          <ParamRow
            label="风向角度"
            value={`${((actualAngle * 180) / Math.PI).toFixed(1)}°`}
          />
          <ParamRow
            label="风力 (kN)"
            value={sculpture.windLoad.forceKN.toFixed(1)}
          />
          <ParamRow
            label="设计风向"
            value={`${((designAngle * 180) / Math.PI).toFixed(1)}°`}
          />
          <ParamRow
            label="角度偏差"
            value={`${angleDiffDeg.toFixed(1)}°`}
            danger={angleDiffDeg > 30}
          />
        </SectionCard>

        <SectionCard title="评审报告" accent={statusColors[sculpture.reviewReport.status] ?? '#888'}>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-xs text-gray-400">状态</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{
                color: statusColors[sculpture.reviewReport.status],
                backgroundColor: statusColors[sculpture.reviewReport.status] + '20',
              }}
            >
              {statusLabels[sculpture.reviewReport.status]}
            </span>
          </div>
          <ParamRow label="摘要" value={sculpture.reviewReport.summary} />
          <ParamRow label="日期" value={sculpture.reviewReport.date} />
        </SectionCard>

        <SectionCard title="人工核对" accent="#8b5cf6">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="核对备注..."
            rows={3}
            className="w-full bg-gray-800 text-gray-100 text-sm rounded p-2 border border-gray-600 focus:outline-none focus:border-purple-500 resize-none mb-2"
          />
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={checkedBy}
              onChange={(e) => setCheckedBy(e.target.value)}
              placeholder="核对人"
              className="flex-1 bg-gray-800 text-gray-100 text-sm rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-purple-500"
            />
            <input
              type="date"
              value={checkedAt}
              onChange={(e) => setCheckedAt(e.target.value)}
              className="flex-1 bg-gray-800 text-gray-100 text-sm rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-1.5 w-full bg-purple-600 hover:bg-purple-500 text-white text-sm rounded py-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            保存核对
          </button>
        </SectionCard>
      </div>
    </div>
  )
}
