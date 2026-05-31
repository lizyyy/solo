import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useMemo } from 'react'
import type { InspectionCheckItem, ConsistencyIssue } from '@/types'

export default function InspectionExport() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projects = useStore((s) => s.projects)
  const getProjectPositions = useStore((s) => s.getProjectPositions)
  const anomalyNotes = useStore((s) => s.anomalyNotes)

  const project = projects.find((p) => p.id === projectId)
  const positions = getProjectPositions(projectId ?? '')
  const projectAnomalies = anomalyNotes.filter(
    (n) => positions.some((p) => p.id === n.positionId) && !n.resolved,
  )

  const checkItems: InspectionCheckItem[] = useMemo(() => {
    if (!projectId) return []
    const noPendingMaterial = !positions.some((p) => p.status === 'pending_material')
    const noUnresolvedAnomalies = projectAnomalies.length === 0
    const noCadConflict = !positions.some(
      (p) =>
        p.status === 'conclusion_changed' &&
        anomalyNotes.some(
          (n) => n.positionId === p.id && n.category === 'cad_conflict' && !n.resolved,
        ),
    )
    const noDuplicates = !positions.some((p) => p.isDuplicate)
    const allCalibratedOrChanged = positions.every(
      (p) => p.status === 'calibrated' || p.status === 'conclusion_changed',
    )

    const pendingPositions = positions.filter((p) => p.status === 'pending_material')
    const cadConflictPositions = positions.filter(
      (p) =>
        p.status === 'conclusion_changed' &&
        anomalyNotes.some(
          (n) => n.positionId === p.id && n.category === 'cad_conflict' && !n.resolved,
        ),
    )
    const duplicatePositions = positions.filter((p) => p.isDuplicate)
    const uncalibratedPositions = positions.filter(
      (p) => p.status !== 'calibrated' && p.status !== 'conclusion_changed',
    )

    return [
      {
        id: 'check_1',
        projectId,
        label: '所有灯位均有设备备注',
        passed: noPendingMaterial,
        detail: noPendingMaterial
          ? '所有灯位已补充设备备注'
          : `${pendingPositions.map((p) => p.code).join('、')} 尚未补充设备备注`,
      },
      {
        id: 'check_2',
        projectId,
        label: '无未解决的异常',
        passed: noUnresolvedAnomalies,
        detail: noUnresolvedAnomalies
          ? '所有异常已解决'
          : `仍有 ${projectAnomalies.length} 条未解决异常`,
      },
      {
        id: 'check_3',
        projectId,
        label: 'CAD改动已同步到明细',
        passed: noCadConflict,
        detail: noCadConflict
          ? 'CAD改动已全部同步'
          : `${cadConflictPositions.map((p) => p.code).join('、')} 存在未同步的CAD改动`,
      },
      {
        id: 'check_4',
        projectId,
        label: '无重复灯位',
        passed: noDuplicates,
        detail: noDuplicates
          ? '无重复灯位'
          : `${duplicatePositions.map((p) => p.code).join('、')} 为重复灯位`,
      },
      {
        id: 'check_5',
        projectId,
        label: '所有灯位已校准或已确认',
        passed: allCalibratedOrChanged,
        detail: allCalibratedOrChanged
          ? '所有灯位已完成校准或确认'
          : `${uncalibratedPositions.map((p) => p.code).join('、')} 尚未校准或确认`,
      },
    ]
  }, [projectId, positions, projectAnomalies, anomalyNotes])

  const consistencyIssues: ConsistencyIssue[] = useMemo(() => {
    if (!projectId) return []
    const issues: ConsistencyIssue[] = []

    positions
      .filter((p) => p.status === 'conclusion_changed')
      .forEach((p) => {
        if (p.currentValue !== p.originalValue) {
          issues.push({
            id: `ci_${p.id}_value`,
            projectId,
            positionId: p.id,
            inspectionValue: p.originalValue,
            detailValue: p.currentValue,
            field: '灯位值',
          })
        }
      })

    const locationGroups = new Map<string, typeof positions>()
    positions.forEach((p) => {
      if (!locationGroups.has(p.location)) locationGroups.set(p.location, [])
      locationGroups.get(p.location)!.push(p)
    })
    locationGroups.forEach((locs) => {
      if (locs.length < 2) return
      const first = locs[0]
      locs.slice(1).forEach((p) => {
        if (p.currentValue !== first.currentValue) {
          issues.push({
            id: `ci_${p.id}_dup`,
            projectId,
            positionId: p.id,
            inspectionValue: first.currentValue,
            detailValue: p.currentValue,
            field: '重复灯位值',
          })
        }
      })
    })

    return issues
  }, [projectId, positions])

  const passedCount = checkItems.filter((c) => c.passed).length
  const allPassed = checkItems.every((c) => c.passed) && consistencyIssues.length === 0

  const handleExport = () => {
    const header = '灯位编号,位置,状态,来源,当前值,最后修改\n'
    const rows = positions
      .map((p) => `${p.code},${p.location},${p.status},${p.source},${p.currentValue},${p.lastModified}`)
      .join('\n')
    const bom = '\uFEFF'
    const csv = bom + header + rows
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `巡检单_${project?.name ?? '未知'}_${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-surface-900 p-6 text-gray-200">项目不存在</div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-900 text-gray-200 font-sans pb-36">
      <header className="sticky top-0 z-10 bg-surface-800 border-b border-surface-600 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/project/${projectId}`)} className="p-1.5 rounded hover:bg-surface-600 transition">
            <ArrowLeft size={20} className="text-accent-amber" />
          </button>
          <h1 className="text-lg font-semibold truncate">巡检单导出 - {project.name}</h1>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-surface-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-accent-amber">复核清单</span>
            <span className={`text-xs font-mono ${passedCount === 5 ? 'text-accent-green' : 'text-accent-red'}`}>
              {passedCount} / {checkItems.length} 通过
            </span>
          </div>
          {checkItems.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 py-2.5 border-t border-surface-600">
              {item.passed ? (
                <CheckCircle size={18} className="text-accent-green shrink-0 mt-0.5" />
              ) : (
                <XCircle size={18} className="text-accent-red shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className={`text-xs mt-0.5 ${item.passed ? 'text-accent-green' : 'text-accent-red'}`}>
                  {item.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-surface-800 rounded-lg p-4">
          <span className="text-sm font-semibold text-accent-amber">一致性校验</span>
          {consistencyIssues.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-accent-green">
              <CheckCircle size={16} />
              一致性校验通过
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-600 text-gray-500">
                    <th className="text-left py-1.5 px-2 font-medium">灯位编号</th>
                    <th className="text-left py-1.5 px-2 font-medium">字段</th>
                    <th className="text-left py-1.5 px-2 font-medium">巡检单值</th>
                    <th className="text-left py-1.5 px-2 font-medium">明细值</th>
                  </tr>
                </thead>
                <tbody>
                  {consistencyIssues.map((issue) => {
                    const pos = positions.find((p) => p.id === issue.positionId)
                    return (
                      <tr key={issue.id} className="border-b border-surface-700 bg-accent-red/5">
                        <td className="py-1.5 px-2 font-mono text-accent-red">{pos?.code ?? '-'}</td>
                        <td className="py-1.5 px-2">{issue.field}</td>
                        <td className="py-1.5 px-2">{issue.inspectionValue}</td>
                        <td className="py-1.5 px-2">{issue.detailValue}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-surface-800 border-t border-surface-600 px-4 pt-3 pb-5 z-10">
        <button
          onClick={handleExport}
          disabled={!allPassed}
          className={`w-full py-3.5 rounded-lg text-base font-semibold transition ${
            allPassed
              ? 'bg-accent-green text-surface-900 hover:bg-accent-green/80 cursor-pointer'
              : 'bg-surface-600 text-gray-500 cursor-not-allowed'
          }`}
        >
          {allPassed ? '导出巡检单' : '请先处理以上问题'}
        </button>
        <div className="mt-2.5 text-[11px] text-gray-500 leading-relaxed space-y-0.5">
          <div>• 讲解路线样例：在灯位校准详情页的讲解路线面板中放置，按路线顺序排列</div>
          <div>• 模型重复摆放：在详情页顶部警告横幅查看，逐一确认后可标记解决</div>
          <div>• 导出复核：确保复核清单全部通过、一致性校验无问题后导出</div>
        </div>
      </div>
    </div>
  )
}
