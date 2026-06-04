import { useState } from 'react';
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  FileText,
  Lock,
  Gauge,
  Ruler,
  History,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { roleLabels, rolePermissions } from '../data/mockData';
import type { RecordData } from '../types';

export default function ReviewPage() {
  const records = useAppStore((s) => s.records);
  const currentRole = useAppStore((s) => s.currentRole);
  const reviewRecord = useAppStore((s) => s.reviewRecord);
  const processState = useAppStore((s) => s.processState);

  const [selectedRecord, setSelectedRecord] = useState<RecordData | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject' | null>(null);

  const canReview = rolePermissions[currentRole].canReview;
  const pendingRecords = records.filter((r) => r.status === 'pending_review');
  const reviewedRecords = records.filter(
    (r) => r.status === 'reviewed' || r.status === 'rejected'
  );

  const handleReview = () => {
    if (!selectedRecord || !reviewDecision || !reviewNote.trim()) return;
    reviewRecord(selectedRecord.id, reviewDecision === 'approve', reviewNote);
    setSelectedRecord(null);
    setReviewNote('');
    setReviewDecision(null);
  };

  return (
    <div className="min-h-screen">
      <div className="mb-6 bg-gradient-to-r from-[#e67e22]/20 to-[#0f2744] border border-[#e67e22]/30 rounded-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center">
              <ClipboardCheck className="w-8 h-8 text-[#e67e22] mr-3" />
              记录复核
            </h1>
            <p className="text-gray-400 text-sm max-w-2xl">
              超阈值记录被平均值盖掉的记录，不得自动归为正常，必须由维修师傅手动复核。
              请仔细核对原始数据和处理历史后做出判断。
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">当前角色</div>
            <div className="text-sm font-bold text-[#5dade2]">
              {roleLabels[currentRole]}
            </div>
            {!canReview && (
              <div className="flex items-center justify-end space-x-1 mt-1 text-xs text-[#e67e22]">
                <Lock className="w-3 h-3" />
                <span>无复核权限</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-black/20 border border-[#2d5a87] rounded-sm p-4">
            <div className="text-xs text-gray-500 mb-1">待复核记录</div>
            <div className="text-2xl font-bold text-[#e67e22]">
              {pendingRecords.length}
            </div>
          </div>
          <div className="bg-[#27ae60]/10 border border-[#27ae60]/30 rounded-sm p-4">
            <div className="text-xs text-gray-500 mb-1">已复核通过</div>
            <div className="text-2xl font-bold text-[#27ae60]">
              {reviewedRecords.filter((r) => r.status === 'reviewed').length}
            </div>
          </div>
          <div className="bg-[#c0392b]/10 border border-[#c0392b]/30 rounded-sm p-4">
            <div className="text-xs text-gray-500 mb-1">已驳回</div>
            <div className="text-2xl font-bold text-[#c0392b]">
              {reviewedRecords.filter((r) => r.status === 'rejected').length}
            </div>
          </div>
        </div>
      </div>

      {!processState.nameplateReviewedByHe && (
        <div className="mb-6 bg-[#f39c12]/10 border border-[#f39c12]/30 rounded-sm p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-[#f39c12] flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-[#f39c12]">请先完成第二步</div>
            <div className="text-sm text-gray-400">
              设备工程师何工尚未完成设备铭牌参数复核和冲突处理，
              请先切换到「设备工程师（何工）」角色处理阈值冲突。
            </div>
          </div>
        </div>
      )}

      {pendingRecords.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#e67e22] mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            待复核记录 ({pendingRecords.length})
          </h2>

          <div className="space-y-4">
            {pendingRecords.map((record) => (
              <div
                key={record.id}
                className={`
                  bg-[#0f2744] border-2 border-[#e67e22]/50 rounded-sm overflow-hidden
                  ${selectedRecord?.id === record.id ? 'ring-2 ring-[#5dade2]' : ''}
                `}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-sm bg-[#e67e22]/10 border border-[#e67e22]/30 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-[#e67e22] animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{record.typeLabel}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500 font-mono">{record.id}</span>
                          <span className="text-gray-600">|</span>
                          <span className="text-xs text-gray-400">{record.dataSourceLabel}</span>
                        </div>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-sm text-xs font-bold bg-[#e67e22]/20 text-[#e67e22] border border-[#e67e22]/30">
                      待维修师傅复核
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50">
                      <div className="flex items-center space-x-2 text-gray-400 text-xs mb-1">
                        <Gauge className="w-3 h-3" />
                        <span>测量速度</span>
                      </div>
                      <div className="font-mono text-xl font-bold text-[#c0392b]">
                        {record.measuredSpeed.toFixed(1)}
                        <span className="text-sm text-gray-500 ml-1">m/s</span>
                      </div>
                      <div className="text-xs text-[#c0392b] mt-1">超出阈值</div>
                    </div>

                    <div className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50">
                      <div className="flex items-center space-x-2 text-gray-400 text-xs mb-1">
                        <Gauge className="w-3 h-3" />
                        <span>平均值</span>
                      </div>
                      <div className="font-mono text-xl font-bold text-[#5dade2]">
                        {record.averageSpeed.toFixed(1)}
                        <span className="text-sm text-gray-500 ml-1">m/s</span>
                      </div>
                      <div className="text-xs text-[#e67e22] mt-1">已覆盖原始值</div>
                    </div>

                    <div className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50">
                      <div className="flex items-center space-x-2 text-gray-400 text-xs mb-1">
                        <Ruler className="w-3 h-3" />
                        <span>安全阈值</span>
                      </div>
                      <div className="font-mono text-xl font-bold text-[#f39c12]">
                        ≤ {record.thresholdMax.toFixed(1)}
                        <span className="text-sm text-gray-500 ml-1">m/s</span>
                      </div>
                    </div>

                    <div className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50">
                      <div className="flex items-center space-x-2 text-gray-400 text-xs mb-1">
                        <Calendar className="w-3 h-3" />
                        <span>测量时间</span>
                      </div>
                      <div className="text-sm text-white font-mono">
                        {record.measurementTime.split(' ')[1]}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {record.measurementTime.split(' ')[0]}
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-sm p-4 border-l-4 border-[#e67e22]">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="w-4 h-4 text-[#e67e22]" />
                      <span className="text-xs font-bold text-[#e67e22]">关键问题</span>
                    </div>
                    <p className="text-sm text-gray-300">
                      原始测量值 <span className="text-[#c0392b] font-mono font-bold">{record.measuredSpeed} m/s</span>{' '}
                      超出安全阈值 <span className="text-[#f39c12] font-mono font-bold">{record.thresholdMax} m/s</span>，
                      但被平均值 <span className="text-[#5dade2] font-mono font-bold">{record.averageSpeed} m/s</span>{' '}
                      覆盖。如直接归为正常将掩盖异常数据，请维修师傅仔细复核。
                    </p>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center">
                      <History className="w-3 h-3 mr-2" />
                      处理历史
                    </h4>
                    <div className="space-y-2">
                      {record.processLogs.map((log, idx) => (
                        <div key={log.id} className="flex items-start space-x-3 bg-black/20 p-2 rounded-sm">
                          <div className="w-5 h-5 rounded-full bg-[#1e3a5f] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-[#5dade2] font-bold">{log.operator}</span>
                              <span className="text-xs text-gray-500">{log.timestamp}</span>
                            </div>
                            <p className="text-xs text-gray-400">{log.action}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {canReview && (
                    <div className="mt-4 pt-4 border-t border-[#2d5a87]">
                      {selectedRecord?.id !== record.id ? (
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="w-full py-3 rounded-sm font-bold text-sm bg-[#5dade2] text-[#0a1929] hover:bg-[#85c1e9] transition-colors"
                        >
                          开始复核
                        </button>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              onClick={() => setReviewDecision('approve')}
                              className={`
                                p-4 rounded-sm border-2 transition-all
                                ${reviewDecision === 'approve'
                                  ? 'border-[#27ae60] bg-[#27ae60]/20 text-[#27ae60]'
                                  : 'border-gray-600 bg-black/30 text-gray-400 hover:border-[#27ae60]/50 hover:text-white'
                                }
                              `}
                            >
                              <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                              <div className="font-bold">复核通过</div>
                              <div className="text-xs mt-1 opacity-70">确认该记录处理无误</div>
                            </button>

                            <button
                              onClick={() => setReviewDecision('reject')}
                              className={`
                                p-4 rounded-sm border-2 transition-all
                                ${reviewDecision === 'reject'
                                  ? 'border-[#c0392b] bg-[#c0392b]/20 text-[#c0392b]'
                                  : 'border-gray-600 bg-black/30 text-gray-400 hover:border-[#c0392b]/50 hover:text-white'
                                }
                              `}
                            >
                              <XCircle className="w-6 h-6 mx-auto mb-2" />
                              <div className="font-bold">驳回</div>
                              <div className="text-xs mt-1 opacity-70">该记录需重新处理</div>
                            </button>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-400 mb-2">
                              复核意见（必填）
                            </label>
                            <textarea
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              placeholder="请输入复核意见，将记录在处理历史中..."
                              className="
                                w-full bg-black/30 border border-[#2d5a87] rounded-sm p-3
                                text-white text-sm placeholder-gray-600
                                focus:outline-none focus:border-[#5dade2]
                                resize-none h-20
                              "
                            />
                          </div>

                          <div className="flex space-x-3">
                            <button
                              onClick={handleReview}
                              disabled={!reviewDecision || !reviewNote.trim()}
                              className={`
                                flex-1 py-3 rounded-sm font-bold text-sm transition-all
                                ${reviewDecision && reviewNote.trim()
                                  ? 'bg-[#5dade2] text-[#0a1929] hover:bg-[#85c1e9]'
                                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }
                              `}
                            >
                              提交复核意见
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRecord(null);
                                setReviewDecision(null);
                                setReviewNote('');
                              }}
                              className="px-6 py-3 rounded-sm font-bold text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!canReview && (
                    <div className="mt-4 bg-gray-800/50 rounded-sm p-4 border border-gray-700 text-center">
                      <Lock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        请切换到「维修师傅」角色进行复核
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviewedRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#27ae60] mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            已处理记录 ({reviewedRecords.length})
          </h2>

          <div className="space-y-4">
            {reviewedRecords.map((record) => (
              <div
                key={record.id}
                className={`
                  bg-[#0f2744] border rounded-sm overflow-hidden
                  ${record.status === 'reviewed' ? 'border-[#27ae60]/50' : 'border-[#c0392b]/50'}
                `}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`
                          w-12 h-12 rounded-sm flex items-center justify-center
                          ${record.status === 'reviewed'
                            ? 'bg-[#27ae60]/10 border border-[#27ae60]/30'
                            : 'bg-[#c0392b]/10 border border-[#c0392b]/30'}
                        `}
                      >
                        {record.status === 'reviewed' ? (
                          <CheckCircle className="w-6 h-6 text-[#27ae60]" />
                        ) : (
                          <XCircle className="w-6 h-6 text-[#c0392b]" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{record.typeLabel}</h3>
                        <div className="flex items-center space-x-3 mt-1 text-xs">
                          <span
                            className={`
                              px-2 py-0.5 rounded-sm font-bold
                              ${record.status === 'reviewed'
                                ? 'bg-[#27ae60]/20 text-[#27ae60]'
                                : 'bg-[#c0392b]/20 text-[#c0392b]'}
                            `}
                          >
                            {record.status === 'reviewed' ? '已复核通过' : '已驳回'}
                          </span>
                          {record.reviewedBy && (
                            <>
                              <span className="text-gray-500">
                                <User className="w-3 h-3 inline mr-1" />
                                {record.reviewedBy}
                              </span>
                              <span className="text-gray-500">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                {record.reviewedAt}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">测量值</div>
                      <div className="font-mono text-xl font-bold text-[#c0392b]">
                        {record.measuredSpeed} m/s
                      </div>
                    </div>
                  </div>

                  {record.reviewNote && (
                    <div className="mt-4 pt-4 border-t border-[#2d5a87]">
                      <div className="text-xs text-gray-400 mb-1">复核意见</div>
                      <p className="text-sm text-gray-300 bg-black/30 p-3 rounded-sm border-l-2 border-[#5dade2]">
                        {record.reviewNote}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingRecords.length === 0 && reviewedRecords.length === 0 && (
        <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">暂无待复核记录</p>
        </div>
      )}

      {pendingRecords.length === 0 && processState.nameplateReviewedByHe && (
        <div className="mt-6 bg-[#27ae60]/10 border border-[#27ae60]/30 rounded-sm p-4 flex items-center space-x-3">
          <CheckCircle className="w-6 h-6 text-[#27ae60]" />
          <div>
            <div className="font-bold text-[#27ae60]">所有记录已复核完成</div>
            <div className="text-sm text-gray-400">
              维修师傅已完成所有超阈值记录的复核，请前往「单位换算」页面确认换算说明更新
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
