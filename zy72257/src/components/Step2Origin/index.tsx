import { useCallback, useRef } from 'react'
import { useAppState } from '../../store'
import { parseCoordinateOriginCSV, mergeData, runSelfChecks, buildExportPayload } from '../../core/engine'

const DEMO_CSV = `obstacleId,obstacleName,originDescription,fieldObservation
OBS-001,塔基爬梯入口,以塔基中心为原点，X轴正方向3m,现场确认爬梯入口偏移约0.2m
OBS-002,机舱入口平台,以机舱底板中心为原点，Y轴正方向2m,与图纸一致
OBS-003,叶片根部检修通道,以轮毂中心为原点，Z轴正方向1.5m,现场测量实际偏移0.3m
OBS-004,塔筒中部休息平台,以塔筒中心为原点，X轴负方向1m,现场说法与图纸标注一致
OBS-005,发电机顶部检修口,以发电机中心为原点，Z轴正方向2m,现场确认无误`

export default function Step2Origin() {
  const { state, dispatch } = useAppState()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const csv = ev.target?.result as string
      const notes = parseCoordinateOriginCSV(csv)
      dispatch({ type: 'IMPORT_ORIGIN_NOTES', notes })
    }
    reader.readAsText(file)
  }, [dispatch])

  const handleDemoData = useCallback(() => {
    const notes = parseCoordinateOriginCSV(DEMO_CSV)
    dispatch({ type: 'IMPORT_ORIGIN_NOTES', notes })
  }, [dispatch])

  const handleMerge = useCallback(() => {
    const merged = mergeData(state.radiusRows, state.originNotes)
    const issues = runSelfChecks(state.radiusRows, state.originNotes, merged)
    const payload = buildExportPayload(merged, issues)
    dispatch({ type: 'MERGE_COMPLETE', merged, issues, payload })
    dispatch({ type: 'SET_STEP', step: 3 })
  }, [state.radiusRows, state.originNotes, dispatch])

  const dualNamePreview = (() => {
    const radiusIds = new Map(state.radiusRows.map(r => [r.obstacleId, r.obstacleName]))
    const originIds = new Map(state.originNotes.map(n => [n.obstacleId, n.obstacleName]))
    const conflicts: { id: string; radiusName: string; originName: string }[] = []
    for (const [id, name] of radiusIds) {
      const originName = originIds.get(id)
      if (originName && originName !== name) {
        conflicts.push({ id, radiusName: name, originName })
      }
    }
    return conflicts
  })()

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span className="icon">📍</span>
          补看坐标原点说明
        </div>

        <div className="alert alert-info">
          <span>ℹ️</span>
          <div>
            园区运维小陶在此补看坐标原点说明中的现场说法，
            与安全半径表主流程数据合并到同一结果中。
          </div>
        </div>

        <div
          className="upload-zone"
          onClick={() => fileRef.current?.click()}
        >
          <div className="upload-icon">📌</div>
          <div className="upload-text">点击或拖拽上传坐标原点说明 CSV 文件</div>
          <div className="upload-hint">
            格式: obstacleId, obstacleName, originDescription, fieldObservation
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
      </div>

      {state.originNotes.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span className="icon">📝</span>
            坐标原点说明数据（{state.originNotes.length} 条）
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>障碍物ID</th>
                  <th>障碍物名称</th>
                  <th>原点描述</th>
                  <th>现场说法</th>
                </tr>
              </thead>
              <tbody>
                {state.originNotes.map((note, idx) => (
                  <tr key={`${note.obstacleId}-${idx}`}>
                    <td>{note.obstacleId}</td>
                    <td>{note.obstacleName}</td>
                    <td>{note.originDescription}</td>
                    <td>{note.fieldObservation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dualNamePreview.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span className="icon">⚠️</span>
            名称不一致预警
          </div>
          <div className="alert alert-warning">
            <span>⚠️</span>
            <div>
              以下障碍物在安全半径表和坐标原点说明中名称不同，
              合并后将被标记为<strong>异常待复核</strong>，不会自动归正常：
            </div>
          </div>
          {dualNamePreview.map(c => (
            <div key={c.id} className="self-check-item warning">
              <span className="sc-type">双命名</span>
              <span className="sc-detail">
                障碍物 {c.id}：安全半径表="{c.radiusName}" vs 坐标原点说明="{c.originName}"
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="actions-bar">
          <button className="btn" onClick={() => dispatch({ type: 'SET_STEP', step: 1 })}>
            ← 上一步
          </button>
          <button
            className="btn btn-primary"
            disabled={state.radiusRows.length === 0 || state.originNotes.length === 0}
            onClick={handleMerge}
          >
            合并数据并进入三维标注视图 →
          </button>
        </div>
      </div>
    </div>
  )
}
