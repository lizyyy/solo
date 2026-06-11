import React, { useMemo } from 'react'

interface Props {
  state: ReturnType<typeof import('../store/useAppState')['useAppState']>
}

export function DataConsistencyPanel({ state }: Props) {
  const { samplingRecords, getExportData } = state

  const pageDisplayData = useMemo(() =>
    samplingRecords.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      deflection: r.deflectionValue,
      isMissing: r.isMissingHalfHour,
      missingSource: r.missingSource,
      status: r.status,
      safetyLevel: r.calculationResult?.safetyLevel ?? '',
    })),
    [samplingRecords]
  )

  const exportData = useMemo(() => getExportData(), [getExportData])

  const apiReturnData = useMemo(() =>
    samplingRecords.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      deflectionValue: r.deflectionValue,
      isMissingHalfHour: r.isMissingHalfHour,
      missingSource: r.missingSource,
      status: r.status,
      calculationResult: r.calculationResult ? {
        safetyLevel: r.calculationResult.safetyLevel,
        deflectionRatio: r.calculationResult.deflectionRatio,
        parameterVersion: r.calculationResult.parameterVersion,
        tradeOffReason: r.calculationResult.tradeOffReason,
      } : null,
    })),
    [samplingRecords]
  )

  const consistencyCheck = useMemo(() => {
    const issues: string[] = []
    const pageMissing = pageDisplayData.filter(r => r.isMissing).map(r => r.id)
    const exportMissing = exportData.filter(r => r.isMissingHalfHour).map(r => r.recordId)
    const apiMissing = apiReturnData.filter(r => r.isMissingHalfHour).map(r => r.id)

    if (pageMissing.length !== exportMissing.length || pageMissing.length !== apiMissing.length) {
      issues.push('缺失记录数量不一致')
    }

    for (const r of pageDisplayData) {
      const exportRow = exportData.find(e => e.recordId === r.id)
      if (r.isMissing && !exportRow?.isMissingHalfHour) {
        issues.push(`记录${r.id}：页面显示缺失但导出未标记`)
      }
      if (!r.isMissing && exportRow?.isMissingHalfHour) {
        issues.push(`记录${r.id}：页面显示正常但导出标记缺失`)
      }
    }

    const pageStatusMap = new Map(pageDisplayData.map(r => [r.id, r.status]))
    const apiStatusMap = new Map(apiReturnData.map(r => [r.id, r.status]))
    for (const [id, pageStatus] of pageStatusMap) {
      const apiStatus = apiStatusMap.get(id)
      if (pageStatus !== apiStatus) {
        issues.push(`记录${id}：页面状态=${pageStatus}，接口状态=${apiStatus}`)
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues,
      source: '三端（页面展示/导出明细/接口返回）统一读取同一份 samplingRecords 数据源',
    }
  }, [pageDisplayData, exportData, apiReturnData])

  const missingRecords = samplingRecords.filter(r => r.isMissingHalfHour)

  return (
    <>
      <div className="page-header">
        <h2>数据一致性</h2>
        <p>导出明细、页面展示和接口返回读取同一份结果，采样时间缺了半小时的记录不会在一个地方显示异常、另一个地方消失</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>一致性校验结果</h3>
          <span className={`status-badge ${consistencyCheck.isConsistent ? 'pass' : 'fail'}`}>
            {consistencyCheck.isConsistent ? '✓ 一致' : '✗ 不一致'}
          </span>
        </div>
        <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 12 }}>
          <strong>数据源：</strong>{consistencyCheck.source}
        </div>
        {consistencyCheck.isConsistent ? (
          <div style={{ color: '#6ee7b7', fontSize: 13 }}>
            ✓ 三端数据完全一致，共 {samplingRecords.length} 条记录，含缺失记录 {missingRecords.length} 条
          </div>
        ) : (
          <div>
            {consistencyCheck.issues.map((issue, i) => (
              <div key={i} style={{ color: '#fca5a5', fontSize: 13, marginBottom: 4 }}>✗ {issue}</div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>缺失半小时记录专项对比</h3>
          <div className="meta">确保缺失记录在三个渠道的展示完全一致</div>
        </div>
        {missingRecords.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">✅</div><p>无缺失记录</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>记录ID</th>
                <th>缺失时段</th>
                <th>缺失来源</th>
                <th>页面展示</th>
                <th>导出标记</th>
                <th>接口返回</th>
                <th>一致性</th>
              </tr>
            </thead>
            <tbody>
              {missingRecords.map(r => {
                const exportRow = exportData.find(e => e.recordId === r.id)
                const apiRecord = apiReturnData.find(a => a.id === r.id)
                const pageStatus = r.status
                const exportMissing = exportRow?.isMissingHalfHour ?? false
                const apiStatus = apiRecord?.status ?? ''
                const consistent = pageStatus === apiStatus && exportMissing
                return (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td style={{ fontSize: 12 }}>
                      {r.missingPeriodStart && new Date(r.missingPeriodStart).toLocaleString('zh-CN')}
                      {' ~ '}
                      {r.missingPeriodEnd && new Date(r.missingPeriodEnd).toLocaleString('zh-CN')}
                    </td>
                    <td style={{ fontSize: 12, color: '#fbbf24' }}>{r.missingSource}</td>
                    <td><span className={`status-badge ${r.status}`}>{r.status === 'pending_review' ? '待复核' : r.status}</span></td>
                    <td>{exportMissing ? <span className="missing-marker">缺失30min</span> : <span className="status-badge safe">正常</span>}</td>
                    <td><span className={`status-badge ${apiStatus}`}>{apiStatus === 'pending_review' ? '待复核' : apiStatus}</span></td>
                    <td>{consistent ? <span className="status-badge safe">一致</span> : <span className="status-badge fail">不一致</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>三端数据源对照</h3>
          <div className="meta">展示同一份 samplingRecords 在三个渠道的映射</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <h4 style={{ fontSize: 14, color: '#93c5fd', marginBottom: 8 }}>页面展示</h4>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              {pageDisplayData.slice(0, 5).map(r => (
                <div key={r.id}>{r.id}: {r.isMissing ? '⚠️缺失' : `${r.deflection}mm`} [{r.status}] {r.missingSource && `来源:${r.missingSource}`}</div>
              ))}
              {pageDisplayData.length > 5 && <div>...共{pageDisplayData.length}条</div>}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 14, color: '#6ee7b7', marginBottom: 8 }}>导出明细</h4>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              {exportData.slice(0, 5).map(r => (
                <div key={r.recordId}>{r.recordId}: {r.isMissingHalfHour ? '⚠️缺失' : `${r.deflectionValue}mm`} [{r.status}] {r.missingSource && `来源:${r.missingSource}`}</div>
              ))}
              {exportData.length > 5 && <div>...共{exportData.length}条</div>}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 14, color: '#fbbf24', marginBottom: 8 }}>接口返回</h4>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              {apiReturnData.slice(0, 5).map(r => (
                <div key={r.id}>{r.id}: {r.isMissingHalfHour ? '⚠️缺失' : `${r.deflectionValue}mm`} [{r.status}] {r.missingSource && `来源:${r.missingSource}`}</div>
              ))}
              {apiReturnData.length > 5 && <div>...共{apiReturnData.length}条</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
