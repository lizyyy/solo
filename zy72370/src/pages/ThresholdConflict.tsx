import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Gauge,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { roleLabels, rolePermissions } from '../data/mockData';

export default function ThresholdConflict() {
  const conflicts = useAppStore((s) => s.conflicts);
  const thresholdTable = useAppStore((s) => s.thresholdTable);
  const nameplateParams = useAppStore((s) => s.nameplateParams);
  const currentRole = useAppStore((s) => s.currentRole);
  const resolveConflict = useAppStore((s) => s.resolveConflict);
  const processState = useAppStore((s) => s.processState);

  const [expandedId, setExpandedId] = useState<string | null>(conflicts[0]?.id || null);
  const [decision, setDecision] = useState<'confirm' | 'reject' | null>(null);
  const [reason, setReason] = useState('');

  const canDecide = rolePermissions[currentRole].canDecideConflict;
  const pendingConflicts = conflicts.filter((c) => c.status === 'pending');
  const resolvedConflicts = conflicts.filter((c) => c.status !== 'pending');

  const handleResolve = (conflictId: string) => {
    if (!decision || !reason.trim()) return;
    resolveConflict(conflictId, decision, reason);
    setDecision(null);
    setReason('');
    setExpandedId(null);
  };

  return (
    <div className="min-h-screen">
      <div className="mb-6 bg-gradient-to-r from-[#c0392b]/20 to-[#0f2744] border border-[#c0392b]/30 rounded-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center">
              <AlertTriangle className="w-8 h-8 text-[#e67e22] mr-3" />
              阈值冲突处理
            </h1>
            <p className="text-gray-400 text-sm max-w-2xl">
              安全阈值表与设备铭牌参数存在冲突，请设备工程师何工确认或驳回。
              系统不会自动决策，所有冲突必须人工处理。
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">当前角色</div>
            <div className="text-sm font-bold text-[#5dade2]">
              {roleLabels[currentRole]}
            </div>
            {!canDecide && (
              <div className="flex items-center justify-end space-x-1 mt-1 text-xs text-[#e67e22]">
                <Lock className="w-3 h-3" />
                <span>无决策权限</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-6">
          <h3 className="text-sm font-bold text-[#f39c12] mb-4 flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            安全阈值表
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-black/30 p-3 rounded-sm border border-[#2d5a87]/50">
              <span className="text-xs text-gray-400">版本</span>
              <span className="font-mono text-white font-bold">
                {thresholdTable.version}
              </span>
            </div>
            <div className="flex items-center justify-between bg-black/30 p-3 rounded-sm border border-[#2d5a87]/50">
              <span className="text-xs text-gray-400">最大允许速度</span>
              <span className="font-mono text-[#c0392b] font-bold">
                {thresholdTable.maxAllowedSpeed} m/s
              </span>
            </div>
            <div className="flex items-center justify-between bg-black/30 p-3 rounded-sm border border-[#2d5a87]/50">
              <span className="text-xs text-gray-400">最小允许速度</span>
              <span className="font-mono text-white font-bold">
                {thresholdTable.minAllowedSpeed} m/s
              </span>
            </div>
            <div className="flex items-center justify-between bg-black/30 p-3 rounded-sm border border-[#2d5a87]/50">
              <span className="text-xs text-gray-400">导入时间</span>
              <span className="text-sm text-gray-300">{thresholdTable.importDate}</span>
            </div>
            <div className="flex items-center justify-between bg-black/30 p-3 rounded-sm border border-[#2d5a87]/50">
              <span className="text-xs text-gray-400">导入人</span>
              <span className="text-sm text-gray-300">{thresholdTable.importBy}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-6">
          <h3 className="text-sm font-bold text-[#8e44ad] mb-4 flex items-center">
            <Gauge className="w-4 h-4 mr-2" />
            设备铭牌参数
          </h3>
          <div className="space-y-4">
            {nameplateParams.map((np) => (
              <div
                key={np.id}
                className="bg-black/30 p-4 rounded-sm border border-[#2d5a87]/50"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-white">{np.equipmentName}</span>
                  <span className="text-xs text-gray-500 font-mono">{np.equipmentId}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">口径：</span>
                    <span className="text-[#8e44ad] font-mono font-bold">{np.caliber}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">额定速度：</span>
                    <span className="text-[#c0392b] font-mono font-bold">{np.ratedSpeed} m/s</span>
                  </div>
                  <div>
                    <span className="text-gray-500">校准日期：</span>
                    <span className="text-gray-300">{np.calibrationDate}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">参数版本：</span>
                    <span className="text-gray-300 font-mono">{np.parameterVersion}</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-[#2d5a87]/50 text-xs">
                  <span className="text-gray-500">制造商：</span>
                  <span className="text-gray-400">{np.manufacturer}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {pendingConflicts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#e67e22] mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            待处理冲突 ({pendingConflicts.length})
          </h2>

          <div className="space-y-4">
            {pendingConflicts.map((conflict) => {
              const isExpanded = expandedId === conflict.id;
              const diff = Math.abs(conflict.thresholdValue - conflict.nameplateValue);

              return (
                <div
                  key={conflict.id}
                  className={`
                    bg-[#0f2744] border-2 border-[#e67e22]/50 rounded-sm overflow-hidden
                    transition-all duration-300
                    ${isExpanded ? 'shadow-lg shadow-[#e67e22]/10' : ''}
                  `}
                >
                  <div
                    className="p-5 cursor-pointer hover:bg-[#1e3a5f]/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : conflict.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-sm bg-[#e67e22]/10 border border-[#e67e22]/30 flex items-center justify-center">
                          <AlertTriangle className="w-6 h-6 text-[#e67e22] animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{conflict.item}</h3>
                          <p className="text-xs text-gray-400 mt-1">
                            冲突项：{conflict.id}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">阈值表值</div>
                          <div className="font-mono text-xl font-bold text-[#f39c12]">
                            {conflict.thresholdValue}
                          </div>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-500 mb-1">差值</span>
                          <span className="font-mono text-lg font-bold text-[#c0392b]">
                            {diff.toFixed(1)}
                          </span>
                          <XCircle className="w-4 h-4 text-[#c0392b] mt-1" />
                        </div>

                        <div className="text-left">
                          <div className="text-xs text-gray-500 mb-1">铭牌值</div>
                          <div className="font-mono text-xl font-bold text-[#8e44ad]">
                            {conflict.nameplateValue}
                          </div>
                        </div>

                        <button className="text-gray-400 hover:text-white transition-colors">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[#2d5a87] p-5 bg-black/20">
                      <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                          <h4 className="text-sm font-bold text-[#f39c12] mb-3">
                            阈值表证据
                          </h4>
                          <div className="bg-black/30 rounded-sm p-3 border border-[#f39c12]/30">
                            <div className="text-xs text-gray-400 mb-1">来源</div>
                            <div className="text-sm text-white mb-2">
                              {conflict.thresholdSource}
                            </div>
                            <div className="text-xs text-gray-400 mb-1">版本</div>
                            <div className="text-sm font-mono text-white">
                              {conflict.thresholdVersion}
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-[#8e44ad] mb-3">
                            铭牌参数证据
                          </h4>
                          <div className="bg-black/30 rounded-sm p-3 border border-[#8e44ad]/30">
                            <div className="text-xs text-gray-400 mb-1">来源</div>
                            <div className="text-sm text-white mb-2">
                              {conflict.nameplateSource}
                            </div>
                            <div className="text-xs text-gray-400 mb-1">版本</div>
                            <div className="text-sm font-mono text-white">
                              {conflict.nameplateVersion}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mb-6">
                        <h4 className="text-sm font-bold text-white mb-3">冲突证据链</h4>
                        <ul className="space-y-2">
                          {conflict.evidence.map((ev, idx) => (
                            <li
                              key={idx}
                              className="flex items-start space-x-3 bg-black/30 p-3 rounded-sm border border-[#2d5a87]/50"
                            >
                              <span className="w-5 h-5 rounded-full bg-[#1e3a5f] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-sm text-gray-300">{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {canDecide ? (
                        <div className="bg-[#1e3a5f]/50 rounded-sm p-4 border border-[#5dade2]/30">
                          <h4 className="text-sm font-bold text-[#5dade2] mb-4 flex items-center">
                            <User className="w-4 h-4 mr-2" />
                            何工，请做出决策
                          </h4>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <button
                              onClick={() => setDecision('confirm')}
                              className={`
                                p-4 rounded-sm border-2 transition-all
                                ${decision === 'confirm'
                                  ? 'border-[#27ae60] bg-[#27ae60]/20 text-[#27ae60]'
                                  : 'border-gray-600 bg-black/30 text-gray-400 hover:border-[#27ae60]/50 hover:text-white'
                                }
                              `}
                            >
                              <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                              <div className="font-bold">确认阈值表</div>
                              <div className="text-xs mt-1 opacity-70">
                                使用阈值表 v1.3 的 6.0 m/s
                              </div>
                            </button>

                            <button
                              onClick={() => setDecision('reject')}
                              className={`
                                p-4 rounded-sm border-2 transition-all
                                ${decision === 'reject'
                                  ? 'border-[#c0392b] bg-[#c0392b]/20 text-[#c0392b]'
                                  : 'border-gray-600 bg-black/30 text-gray-400 hover:border-[#c0392b]/50 hover:text-white'
                                }
                              `}
                            >
                              <XCircle className="w-6 h-6 mx-auto mb-2" />
                              <div className="font-bold">驳回阈值表</div>
                              <div className="text-xs mt-1 opacity-70">
                                改用铭牌参数的 5.5 m/s
                              </div>
                            </button>
                          </div>

                          <div className="mb-4">
                            <label className="block text-xs text-gray-400 mb-2">
                              决策理由（必填）
                            </label>
                            <textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="请输入决策理由，将记录在单位换算说明中..."
                              className="
                                w-full bg-black/30 border border-[#2d5a87] rounded-sm p-3
                                text-white text-sm placeholder-gray-600
                                focus:outline-none focus:border-[#5dade2]
                                resize-none h-20
                              "
                            />
                          </div>

                          <button
                            onClick={() => handleResolve(conflict.id)}
                            disabled={!decision || !reason.trim()}
                            className={`
                              w-full py-3 rounded-sm font-bold text-sm transition-all
                              ${decision && reason.trim()
                                ? 'bg-[#5dade2] text-[#0a1929] hover:bg-[#85c1e9]'
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              }
                            `}
                          >
                            确认并提交决策
                          </button>
                        </div>
                      ) : (
                        <div className="bg-gray-800/50 rounded-sm p-4 border border-gray-700 text-center">
                          <Lock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">
                            请切换到「设备工程师（何工）」角色进行决策
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {resolvedConflicts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#27ae60] mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            已处理冲突 ({resolvedConflicts.length})
          </h2>

          <div className="space-y-4">
            {resolvedConflicts.map((conflict) => (
              <div
                key={conflict.id}
                className={`
                  bg-[#0f2744] border rounded-sm overflow-hidden
                  ${conflict.status === 'confirmed' ? 'border-[#27ae60]/50' : 'border-[#c0392b]/50'}
                `}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`
                          w-12 h-12 rounded-sm flex items-center justify-center
                          ${conflict.status === 'confirmed'
                            ? 'bg-[#27ae60]/10 border border-[#27ae60]/30'
                            : 'bg-[#c0392b]/10 border border-[#c0392b]/30'
                          }
                        `}
                      >
                        {conflict.status === 'confirmed' ? (
                          <CheckCircle className="w-6 h-6 text-[#27ae60]" />
                        ) : (
                          <XCircle className="w-6 h-6 text-[#c0392b]" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{conflict.item}</h3>
                        <div className="flex items-center space-x-3 mt-1 text-xs">
                          <span
                            className={`
                              px-2 py-0.5 rounded-sm font-bold
                              ${conflict.status === 'confirmed'
                                ? 'bg-[#27ae60]/20 text-[#27ae60]'
                                : 'bg-[#c0392b]/20 text-[#c0392b]'
                              }
                            `}
                          >
                            {conflict.status === 'confirmed' ? '已确认阈值表' : '已驳回阈值表'}
                          </span>
                          {conflict.decision && (
                            <>
                              <span className="text-gray-500">
                                <User className="w-3 h-3 inline mr-1" />
                                {conflict.decision.operator}
                              </span>
                              <span className="text-gray-500">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                {conflict.decision.decisionTime}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">阈值表值</div>
                        <div className="font-mono text-xl font-bold text-[#f39c12]">
                          {conflict.thresholdValue}
                        </div>
                      </div>

                      <div className="text-left">
                        <div className="text-xs text-gray-500 mb-1">最终采用</div>
                        <div
                          className={`
                            font-mono text-xl font-bold
                            ${conflict.status === 'confirmed' ? 'text-[#f39c12]' : 'text-[#8e44ad]'}
                          `}
                        >
                          {conflict.status === 'confirmed'
                            ? conflict.thresholdValue
                            : conflict.nameplateValue}
                        </div>
                      </div>
                    </div>
                  </div>

                  {conflict.decision && (
                    <div className="mt-4 pt-4 border-t border-[#2d5a87]">
                      <div className="text-xs text-gray-400 mb-1">决策理由</div>
                      <p className="text-sm text-gray-300 bg-black/30 p-3 rounded-sm border-l-2 border-[#5dade2]">
                        {conflict.decision.reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {processState.nameplateReviewedByHe && (
        <div className="mt-6 bg-[#27ae60]/10 border border-[#27ae60]/30 rounded-sm p-4 flex items-center space-x-3">
          <CheckCircle className="w-6 h-6 text-[#27ae60]" />
          <div>
            <div className="font-bold text-[#27ae60]">第二步已完成</div>
            <div className="text-sm text-gray-400">
              何工已完成设备铭牌参数复核和冲突处理，请前往「单位换算」页面确认换算说明更新
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
