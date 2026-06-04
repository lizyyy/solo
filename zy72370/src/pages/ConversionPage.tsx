import { useState } from 'react';
import {
  Calculator,
  FileText,
  User,
  Calendar,
  Tag,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  History,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { roleLabels } from '../data/mockData';

export default function ConversionPage() {
  const unitConversion = useAppStore((s) => s.unitConversion);
  const currentRole = useAppStore((s) => s.currentRole);
  const processState = useAppStore((s) => s.processState);
  const markConversionUpdated = useAppStore((s) => s.markConversionUpdated);
  const conflicts = useAppStore((s) => s.conflicts);

  const [expandedHistory, setExpandedHistory] = useState(false);

  const pendingConflictCount = conflicts.filter((c) => c.status === 'pending').length;
  const latestConflict = conflicts.find((c) => c.status !== 'pending');

  const handleMarkUpdated = () => {
    markConversionUpdated();
  };

  return (
    <div className="min-h-screen">
      <div className="mb-6 bg-gradient-to-r from-[#5dade2]/20 to-[#0f2744] border border-[#5dade2]/30 rounded-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center">
              <Calculator className="w-8 h-8 text-[#5dade2] mr-3" />
              单位换算说明
            </h1>
            <p className="text-gray-400 text-sm max-w-2xl">
              雨滴终端速度的单位换算公式、参数版本和取舍理由。所有计算均标注参数来源和版本，
              确保结果可追溯、可复核。
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">当前角色</div>
            <div className="text-sm font-bold text-[#5dade2]">
              {roleLabels[currentRole]}
            </div>
          </div>
        </div>
      </div>

      {pendingConflictCount > 0 && (
        <div className="mb-6 bg-[#e67e22]/10 border border-[#e67e22]/30 rounded-sm p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-[#e67e22] flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-[#e67e22]">存在未处理的阈值冲突</div>
            <div className="text-sm text-gray-400">
              请先前往「阈值冲突」页面，由设备工程师何工处理冲突后，再确认换算说明更新
            </div>
          </div>
        </div>
      )}

      {!processState.nameplateReviewedByHe && (
        <div className="mb-6 bg-[#f39c12]/10 border border-[#f39c12]/30 rounded-sm p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-[#f39c12] flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-[#f39c12]">第二步未完成</div>
            <div className="text-sm text-gray-400">
              设备工程师何工尚未完成设备铭牌参数复核，请先完成第二步
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-[#0f2744] border border-[#2d5a87] rounded-sm p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center">
            <span className="w-1 h-5 bg-[#5dade2] mr-3"></span>
            终端速度计算公式
          </h3>

          <div className="bg-black/30 rounded-sm p-6 border border-[#2d5a87]/50 mb-6">
            <div className="text-center mb-4">
              <div className="text-2xl font-mono text-white tracking-wide">
                {unitConversion.formulaDisplay}
              </div>
            </div>

            <div className="border-t border-[#2d5a87] pt-4 mt-4">
              <div className="text-xs text-gray-500 mb-3">参数说明：</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-black/20 p-2 rounded-sm">
                  <span className="text-[#5dade2] font-mono font-bold">v</span>
                  <span className="text-gray-400"> = 终端速度 (m/s)</span>
                </div>
                <div className="bg-black/20 p-2 rounded-sm">
                  <span className="text-[#5dade2] font-mono font-bold">g</span>
                  <span className="text-gray-400"> = 重力加速度 (9.8 m/s²)</span>
                </div>
                <div className="bg-black/20 p-2 rounded-sm">
                  <span className="text-[#5dade2] font-mono font-bold">d</span>
                  <span className="text-gray-400"> = 雨滴直径 (m)</span>
                </div>
                <div className="bg-black/20 p-2 rounded-sm">
                  <span className="text-[#5dade2] font-mono font-bold">ρ_w</span>
                  <span className="text-gray-400"> = 水的密度 (1000 kg/m³)</span>
                </div>
                <div className="bg-black/20 p-2 rounded-sm">
                  <span className="text-[#5dade2] font-mono font-bold">ρ_a</span>
                  <span className="text-gray-400"> = 空气密度 (1.2 kg/m³)</span>
                </div>
                <div className="bg-black/20 p-2 rounded-sm">
                  <span className="text-[#5dade2] font-mono font-bold">C_d</span>
                  <span className="text-gray-400"> = 阻力系数 (~0.45)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-black/30 rounded-sm p-4 border border-[#2d5a87]/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-[#5dade2] flex items-center">
                  <Tag className="w-4 h-4 mr-2" />
                  参数版本
                </h4>
                <span className="font-mono text-xl font-bold text-white">
                  {unitConversion.parameterVersion}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">参数来源：</span>
                  <span className="text-[#f39c12] font-bold">
                    {unitConversion.parameterSourceLabel}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">最后更新：</span>
                  <span className="text-gray-300">{unitConversion.updateTime}</span>
                </div>
                <div>
                  <span className="text-gray-500">更新人：</span>
                  <span className="text-gray-300">{unitConversion.updatedBy}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1e3a5f]/50 rounded-sm p-4 border-l-4 border-[#5dade2]">
              <h4 className="text-sm font-bold text-[#5dade2] mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                取舍理由
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                {unitConversion.tradeOffReason}
              </p>
            </div>

            {latestConflict?.decision && (
              <div className="bg-[#27ae60]/10 border border-[#27ae60]/30 rounded-sm p-4">
                <h4 className="text-sm font-bold text-[#27ae60] mb-2 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  关联决策记录
                </h4>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>
                    <span className="text-gray-500">决策人：</span>
                    <span className="text-white">{latestConflict.decision.operator}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">决策时间：</span>
                    <span className="text-white">{latestConflict.decision.decisionTime}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">决策结果：</span>
                    <span
                      className={
                        latestConflict.decision.decision === 'confirm'
                          ? 'text-[#27ae60] font-bold'
                          : 'text-[#c0392b] font-bold'
                      }
                    >
                      {latestConflict.decision.decision === 'confirm' ? '确认阈值表' : '驳回阈值表'}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#27ae60]/20">
                    <span className="text-gray-500">决策理由：</span>
                    <p className="text-gray-300 mt-1">{latestConflict.decision.reason}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center">
              <History className="w-4 h-4 mr-2" />
              历史版本
              <button
                onClick={() => setExpandedHistory(!expandedHistory)}
                className="ml-auto text-gray-400 hover:text-white transition-colors"
              >
                {expandedHistory ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </h3>

            {expandedHistory && (
              <div className="space-y-3">
                {unitConversion.historyVersions.map((v, idx) => (
                  <div
                    key={idx}
                    className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-[#5dade2]">{v.version}</span>
                      <span className="text-xs text-gray-500">{v.updateTime}</span>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>
                        <span className="text-gray-500">参数来源：</span>
                        <span className="text-gray-300">{v.parameterSource}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">更新原因：</span>
                        <span className="text-gray-300">{v.reason}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!expandedHistory && (
              <div className="text-center text-xs text-gray-500 py-4">
                共 {unitConversion.historyVersions.length} 个历史版本，点击展开查看
              </div>
            )}
          </div>

          <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-6">
            <h3 className="text-sm font-bold text-white mb-4">当前状态</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">阈值冲突处理</span>
                <span
                  className={`
                    px-2 py-0.5 rounded-sm font-bold
                    ${pendingConflictCount > 0
                      ? 'bg-[#e67e22]/20 text-[#e67e22]'
                      : 'bg-[#27ae60]/20 text-[#27ae60]'
                    }
                  `}
                >
                  {pendingConflictCount > 0
                    ? `${pendingConflictCount} 项待处理`
                    : '已完成'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">何工复核铭牌</span>
                <span
                  className={`
                    px-2 py-0.5 rounded-sm font-bold
                    ${processState.nameplateReviewedByHe
                      ? 'bg-[#27ae60]/20 text-[#27ae60]'
                      : 'bg-[#f39c12]/20 text-[#f39c12]'
                    }
                  `}
                >
                  {processState.nameplateReviewedByHe ? '已完成' : '待处理'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">换算说明更新</span>
                <span
                  className={`
                    px-2 py-0.5 rounded-sm font-bold
                    ${processState.conversionUpdated
                      ? 'bg-[#27ae60]/20 text-[#27ae60]'
                      : 'bg-[#f39c12]/20 text-[#f39c12]'
                    }
                  `}
                >
                  {processState.conversionUpdated ? '已完成' : '待确认'}
                </span>
              </div>
            </div>

            {!processState.conversionUpdated &&
              pendingConflictCount === 0 &&
              processState.nameplateReviewedByHe && (
                <button
                  onClick={handleMarkUpdated}
                  className="w-full mt-4 py-3 rounded-sm font-bold text-sm bg-[#5dade2] text-[#0a1929] hover:bg-[#85c1e9] transition-colors"
                >
                  确认换算说明已更新
                </button>
              )}
          </div>

          {processState.conversionUpdated && (
            <div className="bg-[#27ae60]/10 border border-[#27ae60]/30 rounded-sm p-6 text-center">
              <CheckCircle className="w-12 h-12 text-[#27ae60] mx-auto mb-3" />
              <h4 className="font-bold text-[#27ae60] mb-1">三步流程全部完成！</h4>
              <p className="text-xs text-gray-400">
                所有记录均可追溯，参数版本和取舍理由已完整标注
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center">
          <span className="w-1 h-5 bg-[#5dade2] mr-3"></span>
          单位换算验证示例
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#27ae60]/5 border border-[#27ae60]/30 rounded-sm p-4">
            <h4 className="text-sm font-bold text-[#27ae60] mb-3">顺利记录验证</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">雨滴直径</span>
                <span className="font-mono text-white">0.5 mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">计算终端速度</span>
                <span className="font-mono text-[#5dade2]">4.2 m/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">安全阈值</span>
                <span className="font-mono text-[#f39c12]">≤ 6.0 m/s</span>
              </div>
              <div className="pt-2 border-t border-[#27ae60]/20 flex justify-between">
                <span className="text-gray-400">判定结果</span>
                <span className="text-[#27ae60] font-bold">✓ 正常</span>
              </div>
            </div>
          </div>

          <div className="bg-[#e67e22]/5 border border-[#e67e22]/30 rounded-sm p-4">
            <h4 className="text-sm font-bold text-[#e67e22] mb-3">超阈值被盖验证</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">雨滴直径</span>
                <span className="font-mono text-white">0.5 mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">原始测量值</span>
                <span className="font-mono text-[#c0392b]">7.8 m/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">平均值覆盖</span>
                <span className="font-mono text-[#5dade2]">4.5 m/s</span>
              </div>
              <div className="pt-2 border-t border-[#e67e22]/20 flex justify-between">
                <span className="text-gray-400">判定结果</span>
                <span className="text-[#e67e22] font-bold">⚠ 待复核</span>
              </div>
            </div>
          </div>

          <div className="bg-[#8e44ad]/5 border border-[#8e44ad]/30 rounded-sm p-4">
            <h4 className="text-sm font-bold text-[#8e44ad] mb-3">旧口径补录验证</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">原始口径</span>
                <span className="font-mono text-[#c0392b]">缺失</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">铭牌补录口径</span>
                <span className="font-mono text-[#8e44ad]">0.3 mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">计算终端速度</span>
                <span className="font-mono text-[#5dade2]">5.1 m/s</span>
              </div>
              <div className="pt-2 border-t border-[#8e44ad]/20 flex justify-between">
                <span className="text-gray-400">判定结果</span>
                <span className="text-[#27ae60] font-bold">✓ 正常</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-black/20 rounded-sm border border-[#2d5a87]/50">
          <div className="text-xs text-gray-400">
            <span className="text-[#5dade2] font-bold">参数版本一致性检查：</span>
            所有计算均使用参数版本 {unitConversion.parameterVersion}，
            来源为 {unitConversion.parameterSourceLabel}。
            {latestConflict && (
              <span className="text-[#27ae60] ml-2">
                ✓ 与何工决策结果一致
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
