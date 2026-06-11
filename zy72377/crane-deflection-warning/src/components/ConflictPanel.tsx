import React, { useState } from 'react'

interface Props {
  state: ReturnType<typeof import('../store/useAppState')['useAppState']>
}

export function ConflictPanel({ state }: Props) {
  const { thresholds, nameplateParams, conflicts, resolveConflict, currentOperator, reimportThresholds, batches } = state
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [reimportResult, setReimportResult] = useState<{ success: boolean; reason: string } | null>(null)

  const handleResolve = (id: string, status: 'confirmed' | 'rejected') => {
    if (!resolutionNote.trim()) return
    resolveConflict(id, status, resolutionNote)
    setResolvingId(null)
    setResolutionNote('')
  }

  const handleReimport = () => {
    const result = reimportThresholds('安全阈值表v2.1')
    setReimportResult(result)
  }

  const pendingConflicts = conflicts.filter(c => c.status === 'pending')
  const resolvedConflicts = conflicts.filter(c => c.status !== 'pending')
  const thresholdBatches = batches.filter(b => b.type === 'threshold')

  return (
    <>
      <div className="page-header">
        <h2>冲突检测</h2>
        <p>安全阈值表与设备铭牌参数矛盾时，先列出冲突证据，由维修师傅{currentOperator}确认或驳回，系统不自动拍板</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>重复导入防护测试</h3>
          <button className="btn btn-primary" onClick={handleReimport}>
            模拟重跑同一批安全阈值表
          </button>
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
          重跑同一批材料时，尤其是采样时间缺了半小时这种记录不能再多出一份；历史批次和本次重传要分清
        </div>
        {reimportResult && (
          <div style={{ padding: 12, borderRadius: 8, background: reimportResult.success ? '#064e3b' : '#7f1d1d', color: reimportResult.success ? '#6ee7b7' : '#fca5a5', fontSize: 13, marginBottom: 12 }}>
            {reimportResult.success ? `✓ ${reimportResult.reason}` : `✗ ${reimportResult.reason}`}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>批次号</th>
              <th>批次标签</th>
              <th>导入时间</th>
              <th>操作人</th>
              <th>实际入库数</th>
            </tr>
          </thead>
          <tbody>
            {thresholdBatches.map(b => (
              <tr key={b.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.id}</td>
                <td>{b.label}</td>
                <td>{new Date(b.importedAt).toLocaleString('zh-CN')}</td>
                <td>{b.operator}</td>
                <td>{b.recordCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>参数对比表</h3>
          <div className="meta">安全阈值表 vs 设备铭牌参数 | 冲突已在数据初始化时主动检测</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>参数名称</th>
              <th>安全阈值表值</th>
              <th>设备铭牌额定值</th>
              <th>偏差</th>
              <th>偏差率</th>
              <th>容差</th>
              <th>冲突状态</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map(t => {
              const n = nameplateParams.find(np => np.parameterName === t.parameterName)
              if (!n) return null
              const deviation = Math.abs(t.thresholdValue - n.ratedValue)
              const deviationPercent = (deviation / n.ratedValue) * 100
              const isConflict = deviationPercent > n.tolerance
              const conflict = conflicts.find(c => c.thresholdEntryId === t.id && c.nameplateParamId === n.id)
              return (
                <tr key={t.id} style={isConflict ? { background: '#1c1917' } : undefined}>
                  <td style={{ fontWeight: 600 }}>{t.parameterName}</td>
                  <td>
                    {t.thresholdValue} {t.unit}
                    <span className="param-version-tag">{t.parameterVersion}</span>
                  </td>
                  <td>
                    {n.ratedValue} {n.unit}
                    <span className="param-version-tag">{n.parameterVersion}</span>
                  </td>
                  <td style={{ color: isConflict ? '#fca5a5' : '#6ee7b7' }}>
                    {deviation.toFixed(1)} {t.unit}
                  </td>
                  <td style={{ color: isConflict ? '#fca5a5' : '#6ee7b7' }}>
                    {deviationPercent.toFixed(1)}%
                  </td>
                  <td>{n.tolerance}%</td>
                  <td>
                    {isConflict ? (
                      <span className={`status-badge ${conflict?.status || 'pending'}`}>
                        {conflict?.status === 'confirmed' ? '已确认' : conflict?.status === 'rejected' ? '已驳回' : '待确认'}
                      </span>
                    ) : (
                      <span className="status-badge safe">一致</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pendingConflicts.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>⚠️ 待处理冲突 ({pendingConflicts.length})</h3>
            <div className="meta">请维修师傅{currentOperator}逐条确认或驳回</div>
          </div>
          {pendingConflicts.map(c => (
            <div key={c.id} className="conflict-card">
              <div className="conflict-title">
                📛 {c.parameterName}：安全阈值表({c.thresholdValue}{c.unit}) vs 设备铭牌({c.nameplateRatedValue}{c.unit})
              </div>
              <div className="conflict-detail">
                <strong>冲突证据：</strong>偏差 {c.deviation.toFixed(1)}{c.unit}，偏差率 {c.deviationPercent}%，超过设备铭牌容差范围。
                <br />
                <strong>来源追溯：</strong>安全阈值表来源「{thresholds.find(t => t.id === c.thresholdEntryId)?.source}」，
                设备铭牌来源「{nameplateParams.find(n => n.id === c.nameplateParamId)?.source}」
                <br />
                <strong>发现时间：</strong>{new Date(c.createdAt).toLocaleString('zh-CN')}
                <br />
                <strong style={{ color: '#fbbf24' }}>⚠️ 不能直接照抄安全阈值表结论，需由维修师傅{currentOperator}判断以哪份参数为准</strong>
              </div>
              {resolvingId === c.id ? (
                <div>
                  <textarea
                    placeholder="请填写确认/驳回理由（必填）"
                    value={resolutionNote}
                    onChange={e => setResolutionNote(e.target.value)}
                  />
                  <div className="conflict-actions">
                    <button className="btn btn-success" onClick={() => handleResolve(c.id, 'confirmed')} disabled={!resolutionNote.trim()}>
                      ✓ 确认（以安全阈值表为准）
                    </button>
                    <button className="btn btn-danger" onClick={() => handleResolve(c.id, 'rejected')} disabled={!resolutionNote.trim()}>
                      ✗ 驳回（以设备铭牌为准）
                    </button>
                    <button className="btn btn-ghost" onClick={() => { setResolvingId(null); setResolutionNote('') }}>取消</button>
                  </div>
                </div>
              ) : (
                <div className="conflict-actions">
                  <button className="btn btn-primary" onClick={() => setResolvingId(c.id)}>处理此冲突</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {resolvedConflicts.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>已处理冲突</h3></div>
          {resolvedConflicts.map(c => (
            <div key={c.id} className="conflict-card" style={{ borderColor: c.status === 'confirmed' ? '#10b981' : '#64748b', borderLeftColor: c.status === 'confirmed' ? '#10b981' : '#64748b' }}>
              <div className="conflict-title" style={{ color: c.status === 'confirmed' ? '#6ee7b7' : '#94a3b8' }}>
                {c.status === 'confirmed' ? '✓ 已确认' : '✗ 已驳回'}：{c.parameterName}
              </div>
              <div className="conflict-detail">
                处理人：{c.resolvedBy} | 处理时间：{new Date(c.resolvedAt).toLocaleString('zh-CN')}
                <br />处理理由：{c.resolutionNote}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
