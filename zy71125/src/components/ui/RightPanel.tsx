import {
  Target,
  Box,
  Layers,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { getContainerById } from '../../utils/accessibility';

export function RightPanel() {
  const {
    containers,
    selectedContainerId,
    currentTask,
    clearTask,
    timeline,
  } = useStore();

  const [showMoveDetails, setShowMoveDetails] = useState(true);

  const selectedContainer = selectedContainerId
    ? getContainerById(containers, selectedContainerId)
    : null;

  return (
    <div className="w-80 bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-green-400" />
          取箱分析
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedContainer ? (
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-400" />
              目标集装箱
            </h3>
            <div
              className="text-2xl font-bold mb-3"
              style={{ color: selectedContainer.color }}
            >
              {selectedContainer.id}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs">箱区</div>
                <div className="text-white font-medium">
                  {selectedContainer.bay + 1}区
                </div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs">行</div>
                <div className="text-white font-medium">
                  {selectedContainer.row + 1}行
                </div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs">层</div>
                <div className="text-white font-medium">
                  {selectedContainer.tier + 1}层
                </div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs">尺寸</div>
                <div className="text-white font-medium">
                  {selectedContainer.size}
                </div>
              </div>
              <div className="bg-gray-700/50 rounded p-2 col-span-2">
                <div className="text-gray-400 text-xs">重量</div>
                <div className="text-white font-medium">
                  {selectedContainer.weight} 吨
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <Box className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              点击3D场景中的集装箱
              <br />
              或从左侧列表选择
            </p>
          </div>
        )}

        {currentTask ? (
          <>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-400" />
                可达性分析
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">遮挡层数</span>
                  <span
                    className={`font-bold ${
                      currentTask.totalRelocations > 0
                        ? 'text-orange-400'
                        : 'text-green-400'
                    }`}
                  >
                    {currentTask.totalRelocations} 层
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">最优取箱侧</span>
                  <span className="text-blue-400 font-bold">
                    {currentTask.optimalSide === 'left' ? '左侧' : '右侧'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">总操作步数</span>
                  <span className="text-white font-bold">
                    {currentTask.moves.length} 步
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">当前进度</span>
                  <span className="text-white font-bold">
                    {timeline.currentStep + 1} / {currentTask.moves.length}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-700">
                <div className="flex items-center gap-2">
                  {currentTask.totalRelocations === 0 ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-green-400 text-sm">
                        目标箱可直接取箱，无需倒箱
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-orange-400" />
                      <span className="text-orange-400 text-sm">
                        需要先倒箱 {currentTask.totalRelocations} 个
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowMoveDetails(!showMoveDetails)}
                className="w-full p-3 flex items-center justify-between text-white hover:bg-gray-700/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-400" />
                  作业步骤详情
                </span>
                {showMoveDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showMoveDetails && (
                <div className="px-3 pb-3">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {currentTask.moves.map((move, index) => (
                      <div
                        key={move.step}
                        className={`p-3 rounded-lg border-l-2 transition-all ${
                          index === timeline.currentStep
                            ? 'bg-blue-900/50 border-blue-500'
                            : index < timeline.currentStep
                            ? 'bg-gray-700/30 border-green-500'
                            : 'bg-gray-700/50 border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              move.type === 'retrieval'
                                ? 'bg-green-900/50 text-green-400'
                                : 'bg-orange-900/50 text-orange-400'
                            }`}
                          >
                            {move.type === 'retrieval' ? '取箱' : '倒箱'}
                          </span>
                          <span className="text-gray-400 text-xs">
                            步骤 {move.step}
                          </span>
                        </div>
                        <div className="text-white text-sm mt-2 font-medium">
                          {move.containerId}
                        </div>
                        <div className="text-gray-400 text-xs mt-1">
                          {move.from.bay + 1}区{move.from.row + 1}行
                          {move.from.tier + 1}层{' '}
                          <ArrowRight className="w-3 h-3 inline mx-1" />{' '}
                          {move.to
                            ? `${move.to.bay + 1}区${move.to.row + 1}行${move.to.tier + 1}层`
                            : '移出堆场'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={clearTask}
              className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清除分析结果
            </button>
          </>
        ) : (
          selectedContainer && (
            <div className="bg-gray-800/50 rounded-lg p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                点击"分析可达性"
                <br />
                查看取箱方案
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
