import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import type { GameResult, OperationLog, SupplementNote } from '@/types'
import { exportToJSON, exportToCSV, printHTMLReport, saveToLocalStorage } from '@/utils/export'
import { 
  ArrowLeft, Download, FileJson, FileSpreadsheet, Printer, MessageSquarePlus,
  CheckCircle, XCircle, Clock, AlertTriangle, Target, Zap, Shield
} from 'lucide-react'
import { motion } from 'framer-motion'
import { SupplementNoteModal } from '@/components/SupplementNoteModal'

export default function ResultPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showSupplementModal, setShowSupplementModal] = useState(false)
  const [selectedOperationId, setSelectedOperationId] = useState<string | undefined>(undefined)
  const [showRawData, setShowRawData] = useState(false)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

  const result = (location.state?.result || useGameStore.getState().getGameResult()) as GameResult

  if (!result) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 text-warning-orange" size={48} />
          <p className="text-paper-cream mb-4">未找到练习结果数据</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-calm-blue text-charcoal font-mono"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN')
  }

  const getFailureReasonText = (reason?: string) => {
    switch (reason) {
      case 'rule_misunderstanding':
        return '规则理解错误（风险值过高）'
      case 'timeout':
        return '操作超时（时间耗尽）'
      default:
        return '未知原因'
    }
  }

  const getOperationTypeText = (type: string) => {
    switch (type) {
      case 'place': return '放置'
      case 'remove': return '移除'
      case 'click': return '点击'
      default: return type
    }
  }

  const getMaterialTitle = (id: string) => {
    return result.materialPack?.materials?.find((m: any) => m.id === id)?.title || id
  }

  const getSlotLabel = (id?: string) => {
    if (!id) return '-'
    return result.materialPack?.slots?.find((s: any) => s.id === id)?.label || id
  }

  const getSupplementForOperation = (opId: string) => {
    return result.supplementNotes.filter((n: SupplementNote) => n.operationId === opId)
  }

  const handleExport = (type: 'json' | 'csv' | 'print' | 'save') => {
    if (type === 'json') {
      exportToJSON(result)
      setExportSuccess('JSON 文件已下载')
    } else if (type === 'csv') {
      exportToCSV(result)
      setExportSuccess('CSV 文件已下载')
    } else if (type === 'print') {
      printHTMLReport(result)
      return
    } else if (type === 'save') {
      saveToLocalStorage(result)
      setExportSuccess('已保存到本地存储')
    }
    setTimeout(() => setExportSuccess(null), 3000)
  }

  const handleAddSupplement = (operationId: string) => {
    setSelectedOperationId(operationId)
    setShowSupplementModal(true)
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/60 hover:text-paper-cream transition-colors"
          >
            <ArrowLeft size={18} />
            返回游戏
          </button>

          <div className="flex items-center gap-3">
            {exportSuccess && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-success-green text-sm font-mono"
              >
                ✓ {exportSuccess}
              </motion.span>
            )}
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 text-paper-cream 
                border border-white/20 font-mono text-sm hover:bg-white/10 transition-colors"
            >
              <FileJson size={16} />
              导出 JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 text-paper-cream 
                border border-white/20 font-mono text-sm hover:bg-white/10 transition-colors"
            >
              <FileSpreadsheet size={16} />
              导出 CSV
            </button>
            <button
              onClick={() => handleExport('print')}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 text-paper-cream 
                border border-white/20 font-mono text-sm hover:bg-white/10 transition-colors"
            >
              <Printer size={16} />
              打印报告
            </button>
            <button
              onClick={() => navigate('/export', { state: { result } })}
              className="flex items-center gap-2 px-4 py-2 bg-calm-blue text-charcoal 
                font-mono text-sm hover:bg-calm-blue/90 transition-colors"
            >
              <Download size={16} />
              完整报告
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-paper-cream text-charcoal p-6 border-l-4 border-calm-blue"
          >
            <div className="flex items-center gap-2 text-sm text-charcoal/60 mb-2">
              <Target size={16} />
              最终分数
            </div>
            <div className="font-mono text-4xl font-bold text-success-green">
              {result.finalScore}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-paper-cream text-charcoal p-6 border-l-4 border-warning-orange"
          >
            <div className="flex items-center gap-2 text-sm text-charcoal/60 mb-2">
              <Shield size={16} />
              风险值
            </div>
            <div className="font-mono text-4xl font-bold text-danger-red">
              {result.finalRisk}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-paper-cream text-charcoal p-6 border-l-4 border-success-green"
          >
            <div className="flex items-center gap-2 text-sm text-charcoal/60 mb-2">
              <Zap size={16} />
              剩余资源
            </div>
            <div className="font-mono text-4xl font-bold text-calm-blue">
              {result.finalResource}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/5 border border-white/10 p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            {result.status === 'completed' ? (
              <CheckCircle className="text-success-green" size={24} />
            ) : (
              <XCircle className="text-danger-red" size={24} />
            )}
            <div>
              <h2 className="font-mono text-xl font-bold text-paper-cream">
                {result.status === 'completed' ? '✓ 练习成功完成' : '✗ 练习失败'}
              </h2>
              {result.status === 'failed' && (
                <span className="text-warning-orange font-mono text-sm">
                  {getFailureReasonText(result.failureReason)}
                </span>
              )}
            </div>
          </div>

          {result.diagnosticDetails.length > 0 && (
            <div className={`p-4 ${result.status === 'failed' ? 'bg-danger-red/10 border border-danger-red/30' : 'bg-success-green/10 border border-success-green/30'}`}>
              <h3 className="font-mono font-bold text-sm mb-2 text-paper-cream">
                {result.status === 'failed' ? '失败诊断详情' : '完成情况分析'}
              </h3>
              <ul className="space-y-1">
                {result.diagnosticDetails.map((detail, idx) => (
                  <li key={idx} className="text-sm text-white/80 flex items-start gap-2">
                    <span className="text-calm-blue font-mono">{idx + 1}.</span>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/5 border border-white/10 p-6 mb-6"
        >
          <h3 className="font-mono font-bold text-lg text-paper-cream mb-4 flex items-center gap-2">
            <Clock size={18} className="text-calm-blue" />
            关键判定（交接用）
          </h3>
          <div className="bg-calm-blue/10 border-l-4 border-calm-blue p-4">
            <ul className="space-y-2">
              {result.exportMetadata.keyDecisions.map((decision, idx) => (
                <li key={idx} className="text-sm text-white/80">
                  <span className="text-calm-blue font-mono mr-2">•</span>
                  {decision}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="flex">
              <span className="text-white/50 min-w-[100px]">材料来源：</span>
              <span className="text-paper-cream">{result.exportMetadata.materialSource}</span>
            </div>
            <div className="flex">
              <span className="text-white/50 min-w-[100px]">处理人：</span>
              <span className="text-paper-cream">{result.exportMetadata.handler}</span>
            </div>
            <div className="flex">
              <span className="text-white/50 min-w-[100px]">开始时间：</span>
              <span className="text-paper-cream font-mono">{formatDateTime(result.exportMetadata.processingStartTime)}</span>
            </div>
            <div className="flex">
              <span className="text-white/50 min-w-[100px]">结束时间：</span>
              <span className="text-paper-cream font-mono">{formatDateTime(result.exportMetadata.processingEndTime)}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/5 border border-white/10 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono font-bold text-lg text-paper-cream">
              操作时间线（保留原始备注）
            </h3>
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="text-xs text-white/50 hover:text-paper-cream transition-colors font-mono"
            >
              {showRawData ? '隐藏原始数据' : '显示原始数据'}
            </button>
          </div>

          {showRawData && (
            <div className="bg-black/30 p-4 mb-4 overflow-x-auto text-xs font-mono text-white/70">
              <pre>{JSON.stringify(result.operationLogs.slice(0, 3), null, 2)}</pre>
              <p className="text-warning-orange mt-2">* 以上为原始数据示例，导出时会包含完整记录</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">序号</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">时间</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">操作</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">材料</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">槽位</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">正确</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">分数</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">风险</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">备注</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                {result.operationLogs.map((log: OperationLog, idx: number) => {
                  const supplements = getSupplementForOperation(log.id)
                  return (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 group">
                      <td className="py-3 px-2 text-white/50 font-mono">{idx + 1}</td>
                      <td className="py-3 px-2 text-white/70 font-mono text-xs">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 text-xs font-mono ${
                          log.operationType === 'place' ? 'bg-calm-blue/20 text-calm-blue' :
                          log.operationType === 'remove' ? 'bg-warning-orange/20 text-warning-orange' :
                          'bg-white/10 text-white/70'
                        }`}>
                          {getOperationTypeText(log.operationType)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-paper-cream">{getMaterialTitle(log.materialId)}</td>
                      <td className="py-3 px-2 text-white/70">{getSlotLabel(log.targetSlot)}</td>
                      <td className="py-3 px-2">
                        {log.isCorrect === true && <CheckCircle size={16} className="text-success-green" />}
                        {log.isCorrect === false && <XCircle size={16} className="text-danger-red" />}
                        {log.isCorrect === undefined && '-'}
                      </td>
                      <td className={`py-3 px-2 font-mono ${(log.scoreDelta || 0) >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                        {log.scoreDelta !== undefined && `${log.scoreDelta >= 0 ? '+' : ''}${log.scoreDelta}`}
                      </td>
                      <td className={`py-3 px-2 font-mono ${(log.riskDelta || 0) > 0 ? 'text-danger-red' : 'text-white/50'}`}>
                        {log.riskDelta !== undefined && log.riskDelta !== 0 && `${log.riskDelta > 0 ? '+' : ''}${log.riskDelta}`}
                      </td>
                      <td className="py-3 px-2 max-w-[250px]">
                        {log.rawNote && (
                          <div className="raw-note text-xs">{log.rawNote}</div>
                        )}
                        {supplements.length > 0 && supplements.map((note: SupplementNote) => (
                          <div key={note.id} className="supplement-note text-xs mt-2">
                            <div className="text-[10px] text-warning-orange font-medium mb-1">
                              补录于 {formatDateTime(note.addedAt)} by {note.addedBy}
                            </div>
                            {note.content}
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => handleAddSupplement(log.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-warning-orange 
                            hover:text-warning-orange/80 flex items-center gap-1 text-xs"
                        >
                          <MessageSquarePlus size={14} />
                          补录
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {result.pauseRecords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white/5 border border-white/10 p-6 mt-6"
          >
            <h3 className="font-mono font-bold text-lg text-paper-cream mb-4">
              暂停记录
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">序号</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">暂停时间</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">恢复时间</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">暂停原因</th>
                  <th className="text-left py-3 px-2 font-mono text-white/50 font-normal">故意打断</th>
                </tr>
              </thead>
              <tbody>
                {result.pauseRecords.map((record: any, idx: number) => (
                  <tr key={record.id} className="border-b border-white/5">
                    <td className="py-3 px-2 text-white/50 font-mono">{idx + 1}</td>
                    <td className="py-3 px-2 text-white/70 font-mono text-xs">{formatDateTime(record.pauseTime)}</td>
                    <td className="py-3 px-2 text-white/70 font-mono text-xs">
                      {record.resumeTime ? formatDateTime(record.resumeTime) : '-'}
                    </td>
                    <td className="py-3 px-2 text-paper-cream">{record.reason}</td>
                    <td className="py-3 px-2">
                      {record.isIntentional ? (
                        <span className="text-warning-orange">✓ 是</span>
                      ) : (
                        <span className="text-white/50">否</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {result.supplementNotes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-warning-orange/5 border border-warning-orange/30 p-6 mt-6"
          >
            <h3 className="font-mono font-bold text-lg text-warning-orange mb-4">
              补录备注差异对比
            </h3>
            <div className="space-y-3">
              {result.supplementNotes.map((note: SupplementNote, idx: number) => {
                const relatedOp = result.operationLogs.find((op: OperationLog) => op.id === note.operationId)
                return (
                  <div key={note.id} className="bg-white/5 p-4 border-l-4 border-warning-orange">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-warning-orange font-mono text-sm">补录 #{idx + 1}</span>
                        <span className="text-white/40 text-xs ml-2">by {note.addedBy} at {formatDateTime(note.addedAt)}</span>
                      </div>
                      {note.operationId && (
                        <span className="text-xs text-white/50 font-mono">
                          关联操作: {note.operationId}
                        </span>
                      )}
                    </div>
                    {relatedOp && (
                      <div className="mb-3 p-3 bg-black/30 text-xs">
                        <div className="text-white/50 mb-1">原始操作记录：</div>
                        <div className="text-white/70">
                          {formatDateTime(relatedOp.timestamp)} - {getOperationTypeText(relatedOp.operationType)} 
                          「{getMaterialTitle(relatedOp.materialId)}」
                          {relatedOp.rawNote && (
                            <div className="raw-note mt-1">{relatedOp.rawNote}</div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="supplement-note">
                      <div className="text-xs text-warning-orange font-medium mb-1">补录内容：</div>
                      {note.content}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        <div className="text-center py-8 text-white/30 text-xs">
          <p>保险理赔逃脱屋 · 会话ID: {result.sessionId}</p>
          <p className="mt-1">本结果包含完整操作痕迹，可直接用于交接</p>
        </div>
      </div>

      {showSupplementModal && (
        <SupplementNoteModal
          operationId={selectedOperationId}
          onClose={() => {
            setShowSupplementModal(false)
            setSelectedOperationId(undefined)
          }}
        />
      )}
    </div>
  )
}
