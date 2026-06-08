import { useState, useEffect, useCallback } from 'react'
import { useAnnotationStore } from './store/annotationStore'
import type { WorkflowStep, ObstacleRemark, ConflictResolution } from './types'
import './App.css'

const STEP_ORDER: WorkflowStep[] = ['rangefinder_imported', 'remark_reviewed', 'field_instruction_updated']
const STEP_LABELS: Record<WorkflowStep, string> = {
  rangefinder_imported: '测距仪导入',
  remark_reviewed: '障碍物备注补看',
  field_instruction_updated: '现场班组说明更新',
}

const SELF_CHECK_TYPE_LABELS: Record<string, string> = {
  duplicate_import: '重复导入',
  mixed_coord: '坐标混用',
  recalc_after_supplement: '补录后重算',
  export_consistency: '导出一致',
}

const SEVERITY_CLASS: Record<string, string> = {
  error: 'selfCheckError',
  warning: 'selfCheckWarning',
  info: 'selfCheckInfo',
}

const SEVERITY_BADGE: Record<string, string> = {
  error: 'badgeError',
  warning: 'badgeWarning',
  info: 'badgeInfo',
}

export default function App() {
  const store = useAnnotationStore()
  const annotation = store.annotation

  const [importText, setImportText] = useState('')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [remarkText, setRemarkText] = useState('')
  const [remarkSource, setRemarkSource] = useState<ObstacleRemark['source']>('field_note')
  const [rightTab, setRightTab] = useState<'detail' | 'conflict' | 'selfcheck' | 'instruction' | 'export'>('detail')
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null)
  const [resolutionReason, setResolutionReason] = useState('')
  const [instructionEdit, setInstructionEdit] = useState('')
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    store.loadFromStorage()
  }, [])

  const currentStepIdx = STEP_ORDER.indexOf(annotation.currentStep)

  const handleImport = useCallback(() => {
    if (!importText.trim()) return
    const lines = importText.split('\n').filter((l) => l.trim())
    store.importRangefinderRecords(lines)
    setImportText('')
  }, [importText, store])

  const handleAddRemark = useCallback(() => {
    if (!selectedRecordId || !remarkText.trim()) return
    const originalLines = remarkText.split('\n')
    store.addObstacleRemark(selectedRecordId, remarkText, originalLines, remarkSource)
    setRemarkText('')
  }, [selectedRecordId, remarkText, remarkSource, store])

  const handleResolveConflict = useCallback(
    (conflictId: string, resolution: ConflictResolution) => {
      store.resolveConflict(conflictId, resolution, resolutionReason, '航测内业小魏')
      setResolvingConflictId(null)
      setResolutionReason('')
    },
    [resolutionReason, store]
  )

  const handleAdvanceWorkflow = useCallback(
    (step: WorkflowStep) => {
      store.advanceWorkflow(step)
    },
    [store]
  )

  const handleRunSelfCheck = useCallback(() => {
    store.runSelfCheck()
  }, [store])

  const handleGenerateInstruction = useCallback(() => {
    if (!selectedRecordId) return
    store.updateFieldInstruction(selectedRecordId, '', '航测内业小魏')
  }, [selectedRecordId, store])

  const handleSaveInstruction = useCallback(() => {
    if (!selectedRecordId) return
    store.updateFieldInstruction(selectedRecordId, instructionEdit, '航测内业小魏')
    setInstructionEdit('')
  }, [selectedRecordId, instructionEdit, store])

  const handleExport = useCallback(() => {
    const data = store.getExportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `slope-step-annotation-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [store])

  const handleReset = useCallback(() => {
    if (window.confirm('确定要重置所有数据吗？此操作不可恢复。')) {
      store.resetAnnotation()
      setSelectedRecordId(null)
      setRemarkText('')
      setImportText('')
    }
  }, [store])

  const selectedRecord = annotation.rangefinderRecords.find((r) => r.id === selectedRecordId)
  const relatedRemarks = annotation.obstacleRemarks.filter((r) => r.recordId === selectedRecordId)
  const relatedInstruction = annotation.fieldInstructions.find((fi) => fi.recordId === selectedRecordId)

  const pendingConflicts = annotation.conflicts.filter((c) => c.resolution === 'pending')
  const unresolvedIssues = annotation.selfCheckIssues.filter((i) => !i.resolved)

  return (
    <div className="app">
      <header className="appHeader">
        <div>
          <div className="appTitle">山地步道坡坎标注</div>
          <div className="appSubtitle">测距仪记录 · 障碍物备注 · 冲突检测 · 现场说明</div>
        </div>
        <div className="headerActions">
          <button className="btn" onClick={handleRunSelfCheck}>
            运行自检
          </button>
          <button className="btn" onClick={handleExport}>
            导出明细
          </button>
          <button className="btn btnDanger" onClick={handleReset}>
            重置
          </button>
        </div>
      </header>

      <div className="workflowStepper">
        {STEP_ORDER.map((step, idx) => {
          const stepIdx = STEP_ORDER.indexOf(step)
          let cls = 'stepPending'
          if (stepIdx < currentStepIdx) cls = 'stepDone'
          else if (stepIdx === currentStepIdx) cls = 'stepActive'

          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
              {idx > 0 && (
                <div className={`stepConnector${stepIdx <= currentStepIdx ? ' stepDone' : ''}`} />
              )}
              <div className={`step ${cls}`}>
                <div className="stepNumber">
                  {stepIdx < currentStepIdx ? '✓' : idx + 1}
                </div>
                <div className="stepLabel">{STEP_LABELS[step]}</div>
              </div>
            </div>
          )
        })}
      </div>

      {currentStepIdx < 2 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
          {currentStepIdx === 0 && annotation.rangefinderRecords.length > 0 && (
            <button
              className="btn btnPrimary"
              onClick={() => handleAdvanceWorkflow('remark_reviewed')}
            >
              进入障碍物备注补看 →
            </button>
          )}
          {currentStepIdx === 1 && (
            <button
              className="btn btnPrimary"
              onClick={() => handleAdvanceWorkflow('field_instruction_updated')}
            >
              进入现场班组说明更新 →
            </button>
          )}
        </div>
      )}

      <div className="mainGrid">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="cardHeader">
              <span className="cardTitle">测距仪记录导入</span>
              <span className="cardBadge badgeInfo">
                {annotation.rangefinderRecords.length} 条
              </span>
            </div>
            <div className="cardBody">
              <div className="importArea">
                <textarea
                  className="importTextarea"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`每行一条记录，格式示例：\nP001,经度:116.397,纬度:39.908,高程:52.3,坡度:15,坡向:NE,距离:120.5\nP002,X=432100.5,Y=4420300.2,高程:78.1,坡度:22,坡向:SW\nP003,经度:116.401,纬度:39.912,X=432150,高程:61.0,坡度:18`}
                />
                <div className="importHint">
                  支持逗号/制表符/分号分隔，自动识别经纬度与米制坐标混用
                </div>
                <div className="importActions">
                  <button className="btn btnPrimary" onClick={handleImport}>
                    导入
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      setImportText(
                        `P001,经度:116.397,纬度:39.908,高程:52.3,坡度:15,坡向:NE,距离:120.5\nP002,X=432100.5,Y=4420300.2,高程:78.1,坡度:22,坡向:SW,距离:85.3\nP003,经度:116.401,纬度:39.912,X=432150,高程:61.0,坡度:18,坡向:E,距离:96.7\nP004,经度/纬度:116.405/39.915,高程:44.8,坡度:30,坡向:NW,距离:200.1\nP005,X=432200,Y=4420500,高程:55.2,坡度:12,坡向:S,距离:67.8\nP006,高程:63.5,经度:116.410,X=432300,坡度:25,坡向:SE,距离:150.2`
                      )
                    }
                  >
                    载入样例
                  </button>
                </div>
              </div>

              {annotation.rangefinderRecords.length === 0 ? (
                <div className="emptyState">尚未导入测距仪记录</div>
              ) : (
                <div className="recordList">
                  {annotation.rangefinderRecords.map((r) => (
                    <div
                      key={r.id}
                      className={`recordItem${r.id === selectedRecordId ? ' recordItemSelected' : ''}`}
                      onClick={() => setSelectedRecordId(r.id)}
                    >
                      <div className="recordHeader">
                        <span className="recordPointId">{r.pointId}</span>
                        {r.coord.isMixed && (
                          <span className="mixedCoordTag">⚠ 坐标混用</span>
                        )}
                      </div>
                      <div className="recordCoord">{r.coord.raw}</div>
                      <div className="recordMeta">
                        {r.elevation !== null && <span>高程 {r.elevation}m</span>}
                        {r.slopeAngle !== null && <span>坡度 {r.slopeAngle}°</span>}
                        {r.slopeDirection && <span>坡向 {r.slopeDirection}</span>}
                        {r.distance !== null && <span>距离 {r.distance}m</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="detailPanel">
          <div className="card">
            <div className="tabs">
              <div
                className={`tab${rightTab === 'detail' ? ' tabActive' : ''}`}
                onClick={() => setRightTab('detail')}
              >
                详情
              </div>
              <div
                className={`tab${rightTab === 'conflict' ? ' tabActive' : ''}`}
                onClick={() => setRightTab('conflict')}
              >
                冲突
                {pendingConflicts.length > 0 && (
                  <span className="tabBadge badgeError">{pendingConflicts.length}</span>
                )}
              </div>
              <div
                className={`tab${rightTab === 'selfcheck' ? ' tabActive' : ''}`}
                onClick={() => setRightTab('selfcheck')}
              >
                自检
                {unresolvedIssues.length > 0 && (
                  <span className="tabBadge badgeWarning">{unresolvedIssues.length}</span>
                )}
              </div>
              <div
                className={`tab${rightTab === 'instruction' ? ' tabActive' : ''}`}
                onClick={() => setRightTab('instruction')}
              >
                现场说明
              </div>
              <div
                className={`tab${rightTab === 'export' ? ' tabActive' : ''}`}
                onClick={() => setRightTab('export')}
              >
                导出预览
              </div>
            </div>

            <div className="cardBody">
              {rightTab === 'detail' && (
                <>
                  {!selectedRecord ? (
                    <div className="emptyState">选择一条记录查看详情</div>
                  ) : (
                    <>
                      <div className="fieldLabel">点号</div>
                      <div className="fieldValue">{selectedRecord.pointId}</div>

                      <div className="fieldLabel">坐标</div>
                      <div className="fieldValue">
                        {selectedRecord.coord.raw}
                        {selectedRecord.coord.isMixed && (
                          <div className="coordMixedInfo">
                            ⚠ {selectedRecord.coord.mixedDetail}
                            <br />
                            不自动归正常，留待巡检组复核
                          </div>
                        )}
                      </div>

                      {selectedRecord.elevation !== null && (
                        <>
                          <div className="fieldLabel">高程</div>
                          <div className="fieldValue">{selectedRecord.elevation}m</div>
                        </>
                      )}
                      {selectedRecord.slopeAngle !== null && (
                        <>
                          <div className="fieldLabel">坡度</div>
                          <div className="fieldValue">{selectedRecord.slopeAngle}°</div>
                        </>
                      )}
                      {selectedRecord.slopeDirection && (
                        <>
                          <div className="fieldLabel">坡向</div>
                          <div className="fieldValue">{selectedRecord.slopeDirection}</div>
                        </>
                      )}
                      {selectedRecord.distance !== null && (
                        <>
                          <div className="fieldLabel">距离</div>
                          <div className="fieldValue">{selectedRecord.distance}m</div>
                        </>
                      )}

                      <div className="separator" />

                      <div className="remarkSection">
                        <div className="remarkTitle">障碍物备注（保留原始多行格式）</div>
                        {relatedRemarks.length > 0 ? (
                          relatedRemarks.map((rm) => (
                            <div key={rm.id} style={{ marginBottom: 8 }}>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: 'var(--color-text-secondary)',
                                  marginBottom: 4,
                                }}
                              >
                                {rm.source === 'field_note'
                                  ? '现场笔记'
                                  : rm.source === 'photo_desc'
                                    ? '照片描述'
                                    : '补录'}{' '}
                                · {rm.addedBy} · {new Date(rm.addedAt).toLocaleString()}
                              </div>
                              <div className="remarkOriginalLines">
                                {rm.originalLines.join('\n')}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            暂无障碍物备注
                          </div>
                        )}

                        {currentStepIdx >= 1 && (
                          <div className="addRemarkRow">
                            <textarea
                              className="remarkInput"
                              value={remarkText}
                              onChange={(e) => setRemarkText(e.target.value)}
                              placeholder={'每行一条备注，保留原始换行格式\n例如：\n此处有落差约2m的坡坎\n右侧岩壁松动，注意落石\n经度:116.402（与测距仪记录不同）'}
                            />
                            <select
                              className="remarkSourceSelect"
                              value={remarkSource}
                              onChange={(e) =>
                                setRemarkSource(e.target.value as ObstacleRemark['source'])
                              }
                            >
                              <option value="field_note">现场笔记</option>
                              <option value="photo_desc">照片描述</option>
                              <option value="supplementary">补录</option>
                            </select>
                            <button
                              className="btn btnSm"
                              onClick={handleAddRemark}
                              disabled={!remarkText.trim()}
                            >
                              添加
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {rightTab === 'conflict' && (
                <>
                  {annotation.conflicts.length === 0 ? (
                    <div className="emptyState">暂无冲突</div>
                  ) : (
                    annotation.conflicts.map((c) => {
                      const record = annotation.rangefinderRecords.find(
                        (r) => r.id === c.recordId
                      )
                      return (
                        <div key={c.id} className="conflictItem">
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                            {record?.pointId || '未知'} · {c.rangefinderField}
                          </div>
                          <div className="conflictFields">
                            <div className="conflictField conflictRangefinder">
                              <div className="conflictLabel">测距仪记录</div>
                              <div className="conflictValue">{c.rangefinderValue}</div>
                            </div>
                            <div className="conflictField conflictRemark">
                              <div className="conflictLabel">障碍物备注</div>
                              <div className="conflictValue">{c.remarkValue}</div>
                            </div>
                          </div>
                          {c.resolution === 'pending' ? (
                            <>
                              {resolvingConflictId === c.id ? (
                                <div className="conflictResolutionForm">
                                  <textarea
                                    className="resolutionTextarea"
                                    value={resolutionReason}
                                    onChange={(e) => setResolutionReason(e.target.value)}
                                    placeholder="填写确认或驳回理由..."
                                  />
                                  <div className="conflictActions">
                                    <button
                                      className="btn btnSm btnSuccess"
                                      onClick={() =>
                                        handleResolveConflict(c.id, 'confirmed')
                                      }
                                    >
                                      确认
                                    </button>
                                    <button
                                      className="btn btnSm btnDanger"
                                      onClick={() =>
                                        handleResolveConflict(c.id, 'rejected')
                                      }
                                    >
                                      驳回
                                    </button>
                                    <button
                                      className="btn btnSm"
                                      onClick={() => setResolvingConflictId(null)}
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="conflictActions">
                                  <button
                                    className="btn btnSm"
                                    onClick={() => setResolvingConflictId(c.id)}
                                  >
                                    处理冲突
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ marginTop: 6 }}>
                              <span
                                className={`resolvedTag ${c.resolution === 'confirmed' ? 'resolvedConfirmed' : 'resolvedRejected'}`}
                              >
                                {c.resolution === 'confirmed' ? '已确认' : '已驳回'}
                              </span>
                              {c.resolutionReason && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--color-text-secondary)',
                                    marginLeft: 8,
                                  }}
                                >
                                  {c.resolutionReason}
                                </span>
                              )}
                              {c.resolvedBy && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--color-text-secondary)',
                                    marginLeft: 8,
                                  }}
                                >
                                  {c.resolvedBy} ·{' '}
                                  {c.resolvedAt && new Date(c.resolvedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </>
              )}

              {rightTab === 'selfcheck' && (
                <>
                  {annotation.selfCheckIssues.length === 0 ? (
                    <div className="emptyState">
                      点击"运行自检"检查数据质量
                      <br />
                      <span style={{ fontSize: 11 }}>
                        覆盖：重复导入 · 坐标混用 · 补录后重算 · 导出一致
                      </span>
                    </div>
                  ) : (
                    annotation.selfCheckIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className={`selfCheckItem ${SEVERITY_CLASS[issue.severity]}${issue.resolved ? ' selfCheckResolved' : ''}`}
                      >
                        <div className="selfCheckHeader">
                          <span
                            className={`selfCheckType cardBadge ${SEVERITY_BADGE[issue.severity]}`}
                          >
                            {SELF_CHECK_TYPE_LABELS[issue.type] || issue.type}
                          </span>
                          {!issue.resolved && (
                            <button
                              className="btn btnSm"
                              onClick={() => store.resolveSelfCheckIssue(issue.id)}
                            >
                              标记已处理
                            </button>
                          )}
                        </div>
                        <div style={{ marginTop: 4 }}>{issue.message}</div>
                        <div className="selfCheckDetail">{issue.detail}</div>
                      </div>
                    ))
                  )}
                </>
              )}

              {rightTab === 'instruction' && (
                <>
                  {!selectedRecord ? (
                    <div className="emptyState">选择一条记录查看/生成现场说明</div>
                  ) : (
                    <>
                      {!relatedInstruction ? (
                        <div style={{ marginBottom: 12 }}>
                          <button
                            className="btn btnPrimary"
                            onClick={handleGenerateInstruction}
                          >
                            生成现场班组说明
                          </button>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--color-text-secondary)',
                              marginBottom: 8,
                            }}
                          >
                            版本 v{relatedInstruction.version} · 更新于{' '}
                            {new Date(relatedInstruction.updatedAt).toLocaleString()} ·{' '}
                            {relatedInstruction.updatedBy}
                          </div>
                          <div className="instructionContent">
                            {relatedInstruction.content}
                          </div>

                          {relatedInstruction.coordMixedFlag && (
                            <div className="coordMixedInfo" style={{ marginTop: 8 }}>
                              ⚠ 坐标混用来源：{relatedInstruction.coordMixedSource}
                              <br />
                              下一步动作：{relatedInstruction.coordMixedNextAction}
                            </div>
                          )}

                          {relatedInstruction.paramVersions.length > 0 && (
                            <>
                              {relatedInstruction.paramVersions.map((pv, idx) => (
                                <div key={idx} className="paramVersion">
                                  <div className="paramVersionTitle">
                                    {pv.model} v{pv.version}
                                  </div>
                                  <div className="paramVersionDetail">
                                    参数：
                                    {Object.entries(pv.parameters)
                                      .map(([k, v]) => `${k}=${v}`)
                                      .join(', ')}
                                    <br />
                                    取舍理由：{pv.tradeOffReason}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          <div className="separator" />
                          <div className="fieldLabel">编辑说明</div>
                          <textarea
                            className="remarkInput"
                            value={instructionEdit}
                            onChange={(e) => setInstructionEdit(e.target.value)}
                            placeholder="修改现场说明内容..."
                          />
                          <button
                            className="btn btnSm btnPrimary"
                            onClick={handleSaveInstruction}
                            disabled={!instructionEdit.trim()}
                          >
                            保存修改
                          </button>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {rightTab === 'export' && (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <button className="btn btnPrimary" onClick={handleExport}>
                      下载 JSON 导出
                    </button>
                    <button
                      className="btn"
                      style={{ marginLeft: 8 }}
                      onClick={() => setShowExport(!showExport)}
                    >
                      {showExport ? '隐藏' : '预览'}导出数据
                    </button>
                  </div>
                  {showExport && (
                    <div className="exportPreview">
                      {JSON.stringify(store.getExportData(), null, 2)}
                    </div>
                  )}
                  <div className="separator" />
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <div>导出数据、页面展示、接口返回均读取同一份 Store 数据源</div>
                    <div style={{ marginTop: 4 }}>
                      坐标混用标记在导出、页面、接口中保持一致，不会一处异常另一处消失
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
