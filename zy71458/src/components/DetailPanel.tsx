import { X, AlertTriangle, CheckCircle, Clock, Target, TrendingUp, FileText } from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';

export const DetailPanel = () => {
  const {
    config,
    results,
    conclusion,
    selectedTimePoint,
    isDetailPanelOpen,
    toggleDetailPanel,
    selectTimePoint,
  } = useSimulationStore();

  const { drug } = config;

  if (!isDetailPanelOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-600" />
          <h3 className="font-bold text-gray-900">模拟详情</h3>
        </div>
        <button
          onClick={() => {
            toggleDetailPanel(false);
            selectTimePoint(null);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedTimePoint && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-amber-600" />
              <h4 className="font-semibold text-amber-800">选中时间点</h4>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-amber-600">时间:</span>
                <span className="ml-1 font-medium">{selectedTimePoint.time.toFixed(1)} h</span>
              </div>
              <div>
                <span className="text-amber-600">浓度:</span>
                <span className="ml-1 font-medium">
                  {selectedTimePoint.concentration.toFixed(3)} {drug.unit}
                </span>
              </div>
              <div>
                <span className="text-amber-600">给药点:</span>
                <span className="ml-1 font-medium">{selectedTimePoint.isDosingPoint ? '是' : '否'}</span>
              </div>
              <div>
                <span className="text-amber-600">状态:</span>
                <span className={`ml-1 font-medium ${
                  selectedTimePoint.isAboveMax ? 'text-red-600' :
                  selectedTimePoint.isBelowMin ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {selectedTimePoint.isAboveMax ? '超上限' :
                   selectedTimePoint.isBelowMin ? '低于下限' : '正常'}
                </span>
              </div>
            </div>
          </div>
        )}

        {conclusion && (
          <>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <h4 className="font-semibold text-gray-800">模拟结论</h4>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">稳态浓度</span>
                  <span className="font-semibold text-gray-900">
                    {conclusion.steadyStateConcentration.toFixed(3)} {drug.unit}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">达稳时间</span>
                  <span className="font-semibold text-gray-900">
                    {conclusion.timeToReachSteadyState.toFixed(1)} h
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">峰浓度</span>
                  <span className="font-semibold text-gray-900">
                    {conclusion.peakConcentration.toFixed(3)} {drug.unit}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">谷浓度</span>
                  <span className="font-semibold text-gray-900">
                    {conclusion.troughConcentration.toFixed(3)} {drug.unit}
                  </span>
                </div>
              </div>
            </div>

            <div className={`rounded-xl p-4 ${
              conclusion.hasConcentrationIssue
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-emerald-50 border border-emerald-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {conclusion.hasConcentrationIssue ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                )}
                <h4 className={`font-semibold ${
                  conclusion.hasConcentrationIssue ? 'text-amber-800' : 'text-emerald-800'
                }`}>
                  {conclusion.hasConcentrationIssue ? '存在问题' : '参数合理'}
                </h4>
              </div>
              <p className="text-sm text-gray-700">{conclusion.issueDescription}</p>
            </div>

            {!conclusion.doseHalfLifeConsistent && (
              <div className="bg-rose-50 rounded-xl p-4 border border-rose-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-rose-600" />
                  <h4 className="font-semibold text-rose-800">间隔补充证据</h4>
                </div>
                <p className="text-sm text-rose-700">
                  给药间隔作为剂量-半衰期结论不一致的补充证据已记录。
                </p>
              </div>
            )}

            {conclusion.evidence.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 mb-3">事件时间线</h4>
                <div className="space-y-2">
                  {conclusion.evidence.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 bg-white rounded-lg text-sm"
                    >
                      <span className="flex-shrink-0 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.type === 'interval'
                              ? 'bg-rose-100 text-rose-700'
                              : item.type === 'threshold_cross'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.type === 'interval' ? '间隔' :
                             item.type === 'threshold_cross' ? '阈值' : '单位'}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {item.timestamp.toFixed(1)}h
                          </span>
                        </div>
                        <p className="text-gray-700 mt-1">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-gray-800 mb-3">参数对比验证</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span className="text-gray-600">治疗窗下限</span>
                  <span className={`font-medium ${
                    conclusion.troughConcentration >= drug.therapeuticMin
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    {drug.therapeuticMin} {drug.unit}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span className="text-gray-600">计算谷浓度</span>
                  <span className={`font-medium ${
                    conclusion.troughConcentration >= drug.therapeuticMin
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    {conclusion.troughConcentration.toFixed(3)} {drug.unit}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span className="text-gray-600">治疗窗上限</span>
                  <span className={`font-medium ${
                    conclusion.peakConcentration <= drug.therapeuticMax
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    {drug.therapeuticMax} {drug.unit}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span className="text-gray-600">计算峰浓度</span>
                  <span className={`font-medium ${
                    conclusion.peakConcentration <= drug.therapeuticMax
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    {conclusion.peakConcentration.toFixed(3)} {drug.unit}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {results.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-800 mb-3">数据摘要</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-white rounded-lg">
                <div className="text-gray-500">数据点数</div>
                <div className="font-bold text-gray-900">{results.length}</div>
              </div>
              <div className="p-2 bg-white rounded-lg">
                <div className="text-gray-500">给药次数</div>
                <div className="font-bold text-gray-900">
                  {results.filter((r) => r.isDosingPoint).length}
                </div>
              </div>
              <div className="p-2 bg-white rounded-lg">
                <div className="text-gray-500">超上限次数</div>
                <div className="font-bold text-rose-600">
                  {results.filter((r) => r.isAboveMax).length}
                </div>
              </div>
              <div className="p-2 bg-white rounded-lg">
                <div className="text-gray-500">低于下限次数</div>
                <div className="font-bold text-amber-600">
                  {results.filter((r) => r.isBelowMin).length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
