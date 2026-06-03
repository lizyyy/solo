import { useCallback, useRef } from 'react'
import { useAppState } from '../../store'
import { parseSafetyRadiusCSV } from '../../core/engine'

const DEMO_CSV = `obstacleId,obstacleName,radius,unit,manualChange
OBS-001,塔筒底部爬梯,2.5,m,
OBS-002,机舱入口平台,3.0,m,
OBS-003,叶片根部通道,4.2,m,4.5
OBS-004,塔筒中部休息台,2.8,m,
OBS-005,发电机顶部检修口,3.5,m,
OBS-006,塔筒底部爬梯,2.5,m,`

export default function Step1Import() {
  const { state, dispatch } = useAppState()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const csv = ev.target?.result as string
      const rows = parseSafetyRadiusCSV(csv)
      dispatch({ type: 'IMPORT_RADIUS_ROWS', rows })
    }
    reader.readAsText(file)
  }, [dispatch])

  const handleDemoData = useCallback(() => {
    const rows = parseSafetyRadiusCSV(DEMO_CSV)
    dispatch({ type: 'IMPORT_RADIUS_ROWS', rows })
  }, [dispatch])

  const conflictRows = state.radiusRows.filter(r => r.status === 'conflict')

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span className="icon">📋</span>
          导入安全半径表
        </div>

        <div
          className="upload-zone"
          onClick={() => fileRef.current?.click()}
        >
          <div className="upload-icon">📂</div>
          <div className="upload-text">点击或拖拽上传安全半径表 CSV 文件</div>
          <div className="upload-hint">
            格式: obstacleId, obstacleName, radius, unit, manualChange
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button className="btn" onClick={handleDemoData}>
            使用演示数据
          </button>
        </div>

        {conflictRows.length > 0 && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            <span>⚠️</span>
            <div>
              <strong>检测到重复导入：</strong>
              {conflictRows.map(r => (
                <div key={`${r.obstacleId}-${r.originalRowNumber}`}>
                  障碍物 {r.obstacleId}（行号 {r.originalRowNumber}）已标记为冲突
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {state.radiusRows.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span className="icon">📊</span>
            安全半径表数据（{state.radiusRows.length} 条）
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>原始行号</th>
                  <th>障碍物ID</th>
                  <th>障碍物名称</th>
                  <th>安全半径</th>
                  <th>单位</th>
                  <th>人工改动</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {state.radiusRows.map((row, idx) => (
                  <tr key={`${row.obstacleId}-${idx}`}>
                    <td>{row.originalRowNumber}</td>
                    <td>{row.obstacleId}</td>
                    <td>{row.obstacleName}</td>
                    <td>{row.radius}</td>
                    <td>{row.unit}</td>
                    <td>{row.manualChange ?? '-'}</td>
                    <td>
                      <span className={`badge badge-${row.status}`}>
                        {row.status === 'pending' ? '待处理' :
                         row.status === 'conflict' ? '重复冲突' :
                         row.status === 'merged' ? '已合并' : '已确认'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="actions-bar">
            <button
              className="btn btn-primary"
              disabled={state.radiusRows.length === 0}
              onClick={() => dispatch({ type: 'SET_STEP', step: 2 })}
            >
              下一步：补看坐标原点说明 →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
