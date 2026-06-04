import React from 'react'

interface Props {
  state: ReturnType<typeof import('../store/useAppState')['useAppState']>
}

const CHECK_LABELS: Record<string, string> = {
  duplicate_import: '重复导入检测',
  missing_half_hour: '采样时间缺半小时',
  recalc_after_supplement: '补录后重算',
  export_consistency: '导出一致性',
}

const CHECK_DESCS: Record<string, string> = {
  duplicate_import: '检测安全阈值表是否存在参数名称、数值、单位完全相同的重复记录',
  missing_half_hour: '检测采样数据中是否存在半小时以上的时间间隔缺失',
  recalc_after_supplement: '检测设备铭牌参数补录后是否需要重新计算挠度预警结果',
  export_consistency: '验证导出明细、页面展示和接口返回是否读取同一份结果数据',
}

export function SelfCheckPanel({ state }: Props) {
  const { selfCheckResults, runSelfCheck } = state

  return (
    <>
      <div className="page-header">
        <h2>系统自检</h2>
        <p>至少覆盖重复导入、采样时间缺了半小时、补录后重算、导出一致这四个最容易出错的点</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>自检项</h3>
          <button className="btn btn-primary" onClick={runSelfCheck}>
            🔄 运行自检
          </button>
        </div>
        <div className="selfcheck-grid">
          {Object.entries(CHECK_LABELS).map(([key, label]) => {
            const result = selfCheckResults.find(r => r.checkType === key)
            return (
              <div key={key} className="selfcheck-item" style={{
                borderColor: result?.status === 'pass' ? '#10b981' : result?.status === 'warning' ? '#f59e0b' : result?.status === 'fail' ? '#ef4444' : '#334155'
              }}>
                <div className="check-header">
                  <div className="check-name">{label}</div>
                  {result && <span className={`status-badge ${result.status}`}>{result.status === 'pass' ? '通过' : result.status === 'warning' ? '警告' : '失败'}</span>}
                </div>
                <div className="check-msg">{CHECK_DESCS[key]}</div>
                {result && (
                  <>
                    <div className="check-detail" style={{ marginTop: 8 }}>{result.message}</div>
                    <div className="check-detail">{result.details}</div>
                    <div className="check-detail" style={{ marginTop: 4, fontSize: 11 }}>
                      检查时间：{new Date(result.checkedAt).toLocaleString('zh-CN')}
                    </div>
                  </>
                )}
                {!result && (
                  <div className="check-detail" style={{ marginTop: 8, color: '#475569' }}>尚未运行</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {selfCheckResults.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>自检历史</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>检查项</th>
                <th>结果</th>
                <th>消息</th>
                <th>详情</th>
                <th>检查时间</th>
              </tr>
            </thead>
            <tbody>
              {selfCheckResults.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{CHECK_LABELS[r.checkType] || r.checkType}</td>
                  <td><span className={`status-badge ${r.status}`}>{r.status === 'pass' ? '通过' : r.status === 'warning' ? '警告' : '失败'}</span></td>
                  <td>{r.message}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8', maxWidth: 300 }}>{r.details}</td>
                  <td style={{ fontSize: 12 }}>{new Date(r.checkedAt).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
