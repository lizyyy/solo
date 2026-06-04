import { useState } from 'react'
import {
  X,
  Thermometer,
  ArrowRightLeft,
  Zap,
  History,
  Edit3,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  User
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getStatusLabel, getOperationTypeLabel } from '@/utils/calibration'
import { formatTemperature, formatTempDiff, formatDateTime } from '@/utils/formatters'
import { formatEstimationValue } from '@/utils/estimation'
import { clsx } from 'clsx'

export function RecordDetail() {
  const {
    records,
    selectedRecordId,
    setShowDetailModal,
    manualCorrectDirection,
    rerunEstimation,
    reviewRecord,
    setShowSensorPanel
  } = useAppStore()

  const [showCorrectModal, setShowCorrectModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)

  const record = records.find((r) => r.id === selectedRecordId)

  if (!record) return null

  const isPendingReview = record.status === 'pending_review'
  const hasSensorId = !!record.sensorId

  const handleCorrect = (direction: '正方向' | '负方向') => {
    manualCorrectDirection(record.id, direction)
    setShowCorrectModal(false)
  }

  const handleRerun = () => {
    rerunEstimation(record.id)
  }

  const handleReview = (result: 'negative' | 'normal') => {
    reviewRecord(record.id, result)
    setShowReviewModal(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-industrial-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col card-shadow">
        <div className="p-4 border-b border-industrial-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-industrial-100 font-serif flex items-center gap-2">
              {record.recordNo}
              <span
                className={clsx(
                  'status-badge text-white',
                  isPendingReview ? 'bg-warning-500' : 'bg-industrial-600'
                )}
              >
                {getStatusLabel(record.status)}
              </span>
            </h2>
            <p className="text-sm text-industrial-400 mt-1">
              创建于 {formatDateTime(record.createdAt)}
            </p>
          </div>
          <button
            onClick={() => setShowDetailModal(false)}
            className="p-2 hover:bg-industrial-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-industrial-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-industrial-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-industrial-400 mb-3">
                <Thermometer className="w-5 h-5" />
                <h3 className="font-medium">温度校准数据</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-industrial-500">起始温度</span>
                  <span className="text-industrial-200">{formatTemperature(record.startTemp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-industrial-500">结束温度</span>
                  <span className="text-industrial-200">{formatTemperature(record.endTemp)}</span>
                </div>
                <div className="flex justify-between border-t border-industrial-700 pt-2">
                  <span className="text-industrial-500">温差</span>
                  <span className="text-industrial-100 font-semibold">
                    {formatTempDiff(record.tempDiff)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-industrial-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-industrial-400 mb-3">
                <ArrowRightLeft className="w-5 h-5" />
                <h3 className="font-medium">方向信息</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-industrial-500">现场标记</span>
                  <span
                    className={clsx(
                      'font-semibold',
                      isPendingReview ? 'text-warning-400' : 'text-industrial-200'
                    )}
                  >
                    {record.directionMark}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-industrial-500">归一化方向</span>
                  <span className="text-industrial-200">
                    {record.normalizedDirection === 'negative'
                      ? '负方向'
                      : record.normalizedDirection === 'positive'
                      ? '正方向'
                      : '未确定'}
                  </span>
                </div>
                {isPendingReview && (
                  <div className="flex items-center gap-2 text-warning-500 pt-2 border-t border-industrial-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span>需实验老师复核</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {record.estimatedValue !== undefined && (
            <div className="bg-industrial-700/30 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-industrial-400">
                  <Zap className="w-5 h-5" />
                  <h3 className="font-medium">估算结果</h3>
                </div>
                <button
                  onClick={handleRerun}
                  className="flex items-center gap-1 text-xs px-3 py-1 bg-industrial-600 hover:bg-industrial-500 rounded transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  重跑
                </button>
              </div>
              <div className="text-3xl font-bold text-center py-4">
                <span
                  className={
                    record.estimatedValue >= 0 ? 'text-success-400' : 'text-warning-400'
                  }
                >
                  {formatEstimationValue(record.estimatedValue)}
                </span>
              </div>
              <p className="text-xs text-industrial-500 text-center font-mono">
                伸缩量 = 温差 × 桥长(1000mm) × 线膨胀系数(1.2e-5/K)
              </p>
            </div>
          )}

          {record.oldCalibrationData && record.oldCalibrationData.length > 0 && (
            <div className="bg-supplement-500/10 border border-supplement-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-supplement-400 mb-3">
                <History className="w-5 h-5" />
                <h3 className="font-medium">补录的旧口径数据</h3>
              </div>
              {record.oldCalibrationData.map((old) => (
                <div key={old.id} className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-industrial-500">标准版本</span>
                    <span className="text-industrial-200">{old.oldStandard}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-industrial-500">校准值</span>
                    <span className="text-industrial-200">{old.value}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-industrial-500">备注</span>
                    <span className="text-industrial-400 text-xs">{old.remark}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-industrial-900/50 rounded-lg p-4">
            <h3 className="font-medium text-industrial-300 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              操作历史
            </h3>
            <div className="space-y-3">
              {record.operationHistory
                .slice()
                .reverse()
                .map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 pb-3 border-b border-industrial-700/50 last:border-0"
                  >
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        log.type === 'correct'
                          ? 'bg-warning-500/20'
                          : log.type === 'review'
                          ? 'bg-success-500/20'
                          : 'bg-industrial-700'
                      )}
                    >
                      {log.type === 'correct' ? (
                        <Edit3 className="w-4 h-4 text-warning-400" />
                      ) : log.type === 'review' ? (
                        <CheckCircle className="w-4 h-4 text-success-400" />
                      ) : (
                        <History className="w-4 h-4 text-industrial-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-industrial-200 text-sm">
                          {getOperationTypeLabel(log.type)}
                        </span>
                        <span className="text-industrial-500 text-xs">{log.operator}</span>
                      </div>
                      <p className="text-industrial-400 text-sm mt-1">{log.description}</p>
                      <p className="text-industrial-600 text-xs mt-1">
                        {formatDateTime(log.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-industrial-700 flex gap-3 justify-end">
          {!hasSensorId && (
            <button
              onClick={() => setShowSensorPanel(true)}
              className="px-4 py-2 bg-supplement-600 hover:bg-supplement-500 text-white rounded-lg transition-colors"
            >
              补录传感器编号
            </button>
          )}
          {isPendingReview && (
            <>
              <button
                onClick={() => setShowCorrectModal(true)}
                className="px-4 py-2 bg-industrial-600 hover:bg-industrial-500 text-industrial-100 rounded-lg transition-colors"
              >
                何工人工修正
              </button>
              <button
                onClick={() => setShowReviewModal(true)}
                className="px-4 py-2 bg-warning-600 hover:bg-warning-500 text-white rounded-lg transition-colors"
              >
                实验老师复核
              </button>
            </>
          )}
          <button
            onClick={() => setShowDetailModal(false)}
            className="px-4 py-2 bg-industrial-700 hover:bg-industrial-600 text-industrial-300 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>

        {showCorrectModal && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="bg-industrial-800 rounded-lg p-6 max-w-md card-shadow">
              <h3 className="text-lg font-bold text-industrial-100 mb-4">人工修正方向</h3>
              <p className="text-industrial-400 text-sm mb-4">
                当前方向标记: <span className="text-warning-400">{record.directionMark}</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleCorrect('负方向')}
                  className="flex-1 px-4 py-3 bg-warning-600 hover:bg-warning-500 text-white rounded-lg transition-colors"
                >
                  修正为负方向
                </button>
                <button
                  onClick={() => handleCorrect('正方向')}
                  className="flex-1 px-4 py-3 bg-success-600 hover:bg-success-500 text-white rounded-lg transition-colors"
                >
                  修正为正方向
                </button>
              </div>
              <button
                onClick={() => setShowCorrectModal(false)}
                className="w-full mt-3 px-4 py-2 text-industrial-400 hover:text-industrial-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {showReviewModal && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="bg-industrial-800 rounded-lg p-6 max-w-md card-shadow">
              <h3 className="text-lg font-bold text-industrial-100 mb-4">实验老师复核</h3>
              <p className="text-industrial-400 text-sm mb-4">
                现场师傅填写的"向左"是否等同于"负方向"?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleReview('negative')}
                  className="flex-1 px-4 py-3 bg-warning-600 hover:bg-warning-500 text-white rounded-lg transition-colors"
                >
                  确认为负方向
                </button>
                <button
                  onClick={() => handleReview('normal')}
                  className="flex-1 px-4 py-3 bg-industrial-600 hover:bg-industrial-500 text-white rounded-lg transition-colors"
                >
                  录入错误，归正常
                </button>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="w-full mt-3 px-4 py-2 text-industrial-400 hover:text-industrial-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
