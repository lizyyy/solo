import { Info, Droplets, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { roleLabels } from '../data/mockData';
import ProcessTimeline from '../components/ProcessTimeline';
import RecordCard from '../components/RecordCard';
import SpeedChart from '../components/SpeedChart';

export default function Home() {
  const records = useAppStore((s) => s.records);
  const currentRole = useAppStore((s) => s.currentRole);
  const thresholdTable = useAppStore((s) => s.thresholdTable);
  const nameplateParams = useAppStore((s) => s.nameplateParams);
  const processState = useAppStore((s) => s.processState);

  const pendingCount = records.filter((r) => r.status === 'pending_review').length;
  const normalCount = records.filter(
    (r) => r.status === 'normal' || r.status === 'reviewed'
  ).length;

  return (
    <div className="min-h-screen">
      <div className="mb-6 bg-gradient-to-r from-[#1e3a5f] to-[#0f2744] border border-[#2d5a87] rounded-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center">
              <Droplets className="w-8 h-8 text-[#5dade2] mr-3" />
              雨滴终端速度演示系统
            </h1>
            <p className="text-gray-400 text-sm max-w-2xl">
              展示三种数据处理结果的差异：顺利记录、超阈值被平均值盖掉、旧口径补录。
              完整复现阈值导入 → 何工补看铭牌 → 单位换算更新的三步流程。
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">当前角色</div>
            <div className="text-sm font-bold text-[#5dade2]">
              {roleLabels[currentRole]}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-black/20 border border-[#2d5a87] rounded-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">安全阈值表</div>
                <div className="text-lg font-bold text-[#f39c12] font-mono">
                  {thresholdTable.version}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">最大允许速度</div>
                <div className="text-lg font-bold text-white font-mono">
                  {thresholdTable.maxAllowedSpeed} m/s
                </div>
              </div>
            </div>
          </div>

          <div className="bg-black/20 border border-[#2d5a87] rounded-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">设备数量</div>
                <div className="text-lg font-bold text-[#5dade2] font-mono">
                  {nameplateParams.length} 台
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">铭牌参数</div>
                <div className="text-sm text-white">
                  {nameplateParams[0]?.parameterVersion}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#27ae60]/10 border border-[#27ae60]/30 rounded-sm p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-6 h-6 text-[#27ae60]" />
              <div>
                <div className="text-xs text-gray-400 mb-1">正常记录</div>
                <div className="text-2xl font-bold text-[#27ae60]">{normalCount}</div>
              </div>
            </div>
          </div>

          <div
            className={`
              rounded-sm p-4
              ${pendingCount > 0
                ? 'bg-[#e67e22]/10 border border-[#e67e22]/30'
                : 'bg-black/20 border border-[#2d5a87]'
              }
            `}
          >
            <div className="flex items-center space-x-2">
              <AlertCircle
                className={`w-6 h-6 ${pendingCount > 0 ? 'text-[#e67e22] animate-pulse' : 'text-gray-500'}`}
              />
              <div>
                <div className="text-xs text-gray-400 mb-1">待维修师傅复核</div>
                <div
                  className={`text-2xl font-bold ${pendingCount > 0 ? 'text-[#e67e22]' : 'text-gray-500'}`}
                >
                  {pendingCount}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProcessTimeline />

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center">
            <span className="w-1 h-5 bg-[#27ae60] mr-3"></span>
            三类记录对比展示
          </h2>
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <Info className="w-4 h-4" />
            <span>点击卡片查看详细处理历史和计算说明</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {records.map((record, index) => (
            <RecordCard key={record.id} record={record} index={index} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SpeedChart />

        <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <span className="w-1 h-5 bg-[#5dade2] mr-3"></span>
            处理结果差异说明
          </h3>

          <div className="space-y-4">
            <div className="bg-[#27ae60]/10 border-l-4 border-[#27ae60] p-4 rounded-r-sm">
              <h4 className="text-sm font-bold text-[#27ae60] mb-2">
                🟢 顺利记录
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                测量值 4.2 m/s 在阈值范围 1.0-6.0 m/s 内，口径 0.5mm 与测量一致。
                无冲突，无需人工干预，直接标记为正常。
              </p>
            </div>

            <div className="bg-[#e67e22]/10 border-l-4 border-[#e67e22] p-4 rounded-r-sm">
              <h4 className="text-sm font-bold text-[#e67e22] mb-2">
                🟠 超阈值被平均值盖掉
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                原始测量值 7.8 m/s 超出阈值 6.0 m/s，但被平均值 4.5 m/s 覆盖。
                <span className="text-[#e67e22] font-bold">
                  {' '}
                  不归正常
                </span>
                ，挂起等待维修师傅复核。这是维修师傅追问的核心问题。
              </p>
            </div>

            <div className="bg-[#8e44ad]/10 border-l-4 border-[#8e44ad] p-4 rounded-r-sm">
              <h4 className="text-sm font-bold text-[#8e44ad] mb-2">
                🟣 旧口径补录（来自设备铭牌）
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                原始测量口径缺失，何工从设备铭牌 RDS-200 #EQ-2024-001 补录旧口径
                0.3mm。测量值 5.1 m/s 正常，参数版本和取舍理由已标注。
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#2d5a87]">
            <h4 className="text-sm font-bold text-[#f39c12] mb-2">⚠️ 待办事项</h4>
            <ul className="space-y-2 text-xs">
              {!processState.thresholdImported && (
                <li className="flex items-start space-x-2 text-gray-300">
                  <span className="text-[#f39c12]">•</span>
                  <span>
                    第一步：在上方「业务流程进度」区域，点击「确认阈值表导入完成」按钮，完成安全阈值表第一次导入
                  </span>
                </li>
              )}
              {processState.thresholdImported && !processState.nameplateReviewedByHe && (
                <li className="flex items-start space-x-2 text-gray-300">
                  <span className="text-[#e67e22]">•</span>
                  <span>
                    第二步：切换到「设备工程师（何工）」角色，前往「阈值冲突」页面处理阈值表与铭牌参数的冲突
                  </span>
                </li>
              )}
              {processState.thresholdImported && processState.nameplateReviewedByHe && pendingCount > 0 && (
                <li className="flex items-start space-x-2 text-gray-300">
                  <span className="text-[#e67e22]">•</span>
                  <span>
                    第三步：切换到「维修师傅」角色，前往「记录复核」页面复核超阈值被平均值盖掉的记录
                  </span>
                </li>
              )}
              {processState.thresholdImported &&
                processState.nameplateReviewedByHe &&
                !processState.conversionUpdated && (
                <li className="flex items-start space-x-2 text-gray-300">
                  <span className="text-[#f39c12]">•</span>
                  <span>
                    第四步：前往「单位换算」页面确认换算说明更新，完成整个流程
                  </span>
                </li>
              )}
              {processState.thresholdImported &&
                processState.nameplateReviewedByHe &&
                pendingCount === 0 &&
                processState.conversionUpdated && (
                <li className="flex items-start space-x-2 text-[#27ae60]">
                  <CheckCircle2 className="w-4 h-4 mt-0.5" />
                  <span>所有流程已完成！三种记录（顺利/超阈值被盖/旧口径补录）的明细、历史、单位换算说明均已同步。</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}