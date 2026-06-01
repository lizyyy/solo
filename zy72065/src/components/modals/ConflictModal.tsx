import { X, AlertTriangle, CheckCircle, ArrowRight, Camera, FileText } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useConflictForPoint } from '../../hooks/useFilteredPoints';

export function ConflictModal() {
  const showConflictModal = useStore((state) => state.showConflictModal);
  const conflictPointId = useStore((state) => state.conflictPointId);
  const setShowConflictModal = useStore((state) => state.setShowConflictModal);
  const points = useStore((state) => state.points);
  const conflict = useConflictForPoint(conflictPointId || '');

  if (!showConflictModal || !conflictPointId) return null;

  const point = points.find((p) => p.id === conflictPointId);

  if (!conflict || !point) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={20} />
            <h2 className="text-lg font-semibold text-white">数据冲突检测</h2>
          </div>
          <button
            onClick={() => setShowConflictModal(false)}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="text-yellow-400 font-medium mb-1">
              点位: {point.name}
            </div>
            <div className="text-yellow-300/70 text-sm">
              周会截图记录与最新导入数据存在不一致，请核实后再处理
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-700/50 border-b border-gray-700 flex items-center gap-2">
                <Camera size={14} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-300">周会截图记录</span>
              </div>
              <div className="p-3">
                <div className="aspect-video bg-gray-700/50 rounded mb-3 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <Camera size={32} className="mx-auto mb-2 opacity-50" />
                    <span className="text-xs">周会截图预览</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">记录日期</span>
                    <span className="text-gray-300">{conflict.meetingScreenshot.date}</span>
                  </div>
                  <div className="p-2 bg-gray-700/30 rounded text-sm text-gray-300">
                    {conflict.meetingScreenshot.claim}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-blue-600/20 border-b border-blue-500/30 flex items-center gap-2">
                <FileText size={14} className="text-blue-400" />
                <span className="text-sm font-medium text-blue-300">最新导入数据</span>
              </div>
              <div className="p-3">
                <div className="aspect-video bg-blue-900/20 rounded mb-3 flex items-center justify-center border border-blue-500/20">
                  <div className="text-center text-blue-400">
                    <div className="text-3xl font-bold">{conflict.importedData.value}</div>
                    <div className="text-xs mt-1">mm 位移量</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">数据日期</span>
                    <span className="text-gray-300">{conflict.importedData.date}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">来源文件</span>
                    <span className="text-gray-300 text-xs font-mono">{conflict.importedData.source}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center my-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-full">
              <span className="text-purple-400 text-sm">差异值</span>
              <ArrowRight size={16} className="text-purple-400" />
              <span className="text-purple-300 font-bold">
                {((conflict.importedData.value - 8.5) / 8.5 * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
              <CheckCircle size={14} />
              建议动作
            </h3>
            <div className="space-y-2">
              {conflict.suggestedActions.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-gray-800/30 rounded hover:bg-gray-800/50 transition-colors"
                >
                  <span className="w-5 h-5 flex-shrink-0 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-medium">
                    {idx + 1}
                  </span>
                  <span className="text-gray-300 text-sm">{action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
            <p className="text-xs text-gray-500">
              <span className="text-yellow-500">&#9888;&#65039;</span> 系统不自动替您做决定，
              请根据实际情况判断采用哪方数据。处理后请在"处理建议"中记录您的判断依据，
              以便后续同事接手时了解来龙去脉。
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={() => setShowConflictModal(false)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            我已知晓，稍后处理
          </button>
          <button
            onClick={() => setShowConflictModal(false)}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
          >
            标记为待核查
          </button>
        </div>
      </div>
    </div>
  );
}
