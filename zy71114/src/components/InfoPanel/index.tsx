import { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, CheckCircle, FileText, MapPin, Ruler } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { RiskPoint } from '../../types';

export function InfoPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'risks' | 'report' | 'data'>('risks');

  const { riskPoints, currentReport, selectedGarage, selectedVehicle, simulation } = useAppStore();

  const dangerCount = riskPoints.filter((r) => r.level === 'danger').length;
  const warningCount = riskPoints.filter((r) => r.level === 'warning').length;

  const RiskCard = ({ risk }: { risk: RiskPoint }) => (
    <div
      className={`p-3 rounded-lg border ${
        risk.level === 'danger'
          ? 'bg-red-50 border-red-200'
          : 'bg-orange-50 border-orange-200'
      }`}
    >
      <div className="flex items-start gap-2">
        {risk.level === 'danger' ? (
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                risk.level === 'danger'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              {risk.level === 'danger' ? '危险' : '警告'}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-800 mt-1">{risk.location}</p>
          <p className="text-xs text-gray-600 mt-1">{risk.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-gray-500">
              净空: <strong className="text-gray-700">{risk.clearHeight.toFixed(2)}m</strong>
            </span>
            <span className="text-gray-500">
              车高: <strong className="text-gray-700">{risk.vehicleHeight.toFixed(2)}m</strong>
            </span>
            <span
              className={
                risk.delta < 0.3 ? 'text-red-600 font-medium' : 'text-orange-600 font-medium'
              }
            >
              间隙: {risk.delta.toFixed(2)}m
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`fixed right-0 top-0 h-full z-20 transition-all duration-300 ${
        isOpen ? 'w-80' : 'w-12'
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute left-0 top-4 -translate-x-full bg-white shadow-lg rounded-l-lg p-2 hover:bg-gray-50 transition-colors z-10"
      >
        {isOpen ? (
          <ChevronRight className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {isOpen && (
        <div className="h-full bg-white shadow-xl flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              检查信息
            </h2>
          </div>

          <div className="flex border-b border-gray-200">
            {(['risks', 'report', 'data'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'risks' && `风险 (${riskPoints.length})`}
                {tab === 'report' && '报告'}
                {tab === 'data' && '数据'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'risks' && (
              <div className="space-y-3">
                {riskPoints.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">暂无风险点</p>
                    <p className="text-gray-400 text-xs mt-1">点击"执行净高校验"开始检测</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-4">
                      <div className="flex-1 bg-red-50 rounded-lg p-2 text-center">
                        <div className="text-xl font-bold text-red-600">{dangerCount}</div>
                        <div className="text-xs text-red-500">危险</div>
                      </div>
                      <div className="flex-1 bg-orange-50 rounded-lg p-2 text-center">
                        <div className="text-xl font-bold text-orange-600">{warningCount}</div>
                        <div className="text-xs text-orange-500">警告</div>
                      </div>
                      <div className="flex-1 bg-green-50 rounded-lg p-2 text-center">
                        <div className="text-xl font-bold text-green-600">
                          {Math.max(0, 5 - riskPoints.length)}
                        </div>
                        <div className="text-xs text-green-500">安全</div>
                      </div>
                    </div>
                    {riskPoints.map((risk) => (
                      <RiskCard key={risk.id} risk={risk} />
                    ))}
                  </>
                )}
              </div>
            )}

            {activeTab === 'report' && (
              <div className="space-y-4">
                {currentReport ? (
                  <>
                    <div
                      className={`p-4 rounded-lg text-center ${
                        currentReport.overallResult === 'pass'
                          ? 'bg-green-50 border border-green-200'
                          : currentReport.overallResult === 'warning'
                          ? 'bg-orange-50 border border-orange-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div
                        className={`text-2xl font-bold ${
                          currentReport.overallResult === 'pass'
                            ? 'text-green-600'
                            : currentReport.overallResult === 'warning'
                            ? 'text-orange-600'
                            : 'text-red-600'
                        }`}
                      >
                        {currentReport.overallResult === 'pass'
                          ? '✓ 通过'
                          : currentReport.overallResult === 'warning'
                          ? '⚠ 警告'
                          : '✗ 不通过'}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">检查时间</span>
                        <span className="text-gray-800">
                          {currentReport.checkTime.toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">车库名称</span>
                        <span className="text-gray-800">{selectedGarage.name}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">车辆类型</span>
                        <span className="text-gray-800">{selectedVehicle.name}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">风险点数量</span>
                        <span className="text-gray-800">{currentReport.riskPoints.length} 个</span>
                      </div>
                      {currentReport.missingSigns.length > 0 && (
                        <div className="py-2">
                          <span className="text-gray-500 block mb-1">缺失标识入口</span>
                          <div className="flex flex-wrap gap-1">
                            {currentReport.missingSigns.map((s, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">暂无检查报告</p>
                    <p className="text-gray-400 text-xs mt-1">执行净高校验后生成报告</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4" />
                    当前位置
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white rounded p-2">
                      <div className="text-gray-400">X</div>
                      <div className="font-mono text-gray-700">
                        {simulation.currentPosition[0].toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white rounded p-2">
                      <div className="text-gray-400">Y</div>
                      <div className="font-mono text-gray-700">
                        {simulation.currentPosition[1].toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white rounded p-2">
                      <div className="text-gray-400">Z</div>
                      <div className="font-mono text-gray-700">
                        {simulation.currentPosition[2].toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <Ruler className="w-4 h-4" />
                    车辆参数
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">类型</span>
                      <span className="text-gray-800">{selectedVehicle.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">高度</span>
                      <span className="text-gray-800 font-mono">
                        {selectedVehicle.height} {selectedVehicle.unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">宽度</span>
                      <span className="text-gray-800 font-mono">
                        {selectedVehicle.width} {selectedVehicle.unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">长度</span>
                      <span className="text-gray-800 font-mono">
                        {selectedVehicle.length} {selectedVehicle.unit}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">入口信息</h4>
                  <div className="space-y-2">
                    {selectedGarage.entrances.map((entrance) => (
                      <div
                        key={entrance.id}
                        className="flex items-center justify-between bg-white rounded p-2"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-800">
                            {entrance.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            限高 {entrance.minHeight}m
                          </div>
                        </div>
                        {entrance.hasSign ? (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                            有标识
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                            无标识
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
