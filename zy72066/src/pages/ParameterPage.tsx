import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ChevronRight, Settings, Eye, Building2, FileBarChart, Zap } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { DeviceData, Anomaly } from '../types';

export default function ParameterPage() {
  const navigate = useNavigate();
  const currentSolution = useAppStore((state) => state.currentSolution);
  const currentConfig = useAppStore((state) => state.currentConfig);
  const updateConfig = useAppStore((state) => state.updateConfig);
  const updateSolution = useAppStore((state) => state.updateSolution);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [solutionName, setSolutionName] = useState(currentSolution?.name || '');

  if (!currentSolution) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Settings className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">请先导入数据</h2>
        <p className="text-gray-400 mb-6">返回导入页面上传或选择样例数据</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          前往导入
        </button>
      </div>
    );
  }

  const stats = useMemo(() => {
    const devices = currentSolution.devices;
    const anomalies = currentSolution.anomalies;
    const unresolved = anomalies.filter(a => !a.resolved);
    
    const normalDevices = devices.filter(d => {
      const hasHighAnomaly = anomalies.some(a => a.deviceId === d.id && !a.resolved && a.severity === 'high');
      return !hasHighAnomaly && d.energyConsumption < currentConfig.energyThreshold.warning;
    }).length;

    const warningDevices = devices.filter(d => 
      d.energyConsumption >= currentConfig.energyThreshold.warning && 
      d.energyConsumption < currentConfig.energyThreshold.error
    ).length;

    const errorDevices = devices.filter(d => 
      d.energyConsumption >= currentConfig.energyThreshold.error
    ).length;

    return {
      total: devices.length,
      normal: normalDevices,
      warning: warningDevices,
      error: errorDevices,
      anomalies: unresolved.length,
    };
  }, [currentSolution, currentConfig]);

  const handleSave = () => {
    if (currentSolution) {
      updateSolution(currentSolution.id, { name: solutionName });
      setShowSaveModal(false);
    }
  };

  const handleThresholdChange = (type: 'warning' | 'error', value: number) => {
    updateConfig({
      energyThreshold: {
        ...currentConfig.energyThreshold,
        [type]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">参数配置</h1>
          <p className="text-gray-500 mt-1">调整异常检测阈值，实时预览效果</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Save className="w-4 h-4" />
            保存方案
          </button>
          <button
            onClick={() => navigate('/scene')}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            查看场景
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-600" />
              检测参数
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  能耗警告阈值 (kWh)
                  <span className="float-right text-primary-600 font-bold">{currentConfig.energyThreshold.warning}</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={currentConfig.energyThreshold.warning}
                  onChange={(e) => handleThresholdChange('warning', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>50</span>
                  <span>200</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  能耗错误阈值 (kWh)
                  <span className="float-right text-accent-red font-bold">{currentConfig.energyThreshold.error}</span>
                </label>
                <input
                  type="range"
                  min="100"
                  max="300"
                  value={currentConfig.energyThreshold.error}
                  onChange={(e) => handleThresholdChange('error', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent-red"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>100</span>
                  <span>300</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  坐标容差 (米)
                  <span className="float-right text-gray-600 font-bold">{currentConfig.coordinateTolerance}m</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.1"
                  value={currentConfig.coordinateTolerance}
                  onChange={(e) => updateConfig({ coordinateTolerance: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0.5m</span>
                  <span>5m</span>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-800">
                <strong>💡 提示：</strong>调整参数后，右侧预览会实时更新。建议先微调警告阈值，再看异常数量变化。
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary-600" />
              实时联动预览
            </h2>

            <div className="grid grid-cols-4 gap-4 mb-8">
              <PreviewCard
                icon={Zap}
                title="正常设备"
                value={stats.normal}
                color="green"
                total={stats.total}
              />
              <PreviewCard
                icon={Zap}
                title="警告设备"
                value={stats.warning}
                color="yellow"
                total={stats.total}
              />
              <PreviewCard
                icon={Zap}
                title="异常设备"
                value={stats.error}
                color="red"
                total={stats.total}
              />
              <PreviewCard
                icon={Zap}
                title="待处理异常"
                value={stats.anomalies}
                color="orange"
                total={currentSolution.anomalies.length}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <LinkPreviewCard
                icon={Building2}
                title="场景视图"
                description="3D楼宇异常分布"
                onClick={() => navigate('/scene')}
                count={`${currentSolution.devices.length} 设备`}
              />
              <LinkPreviewCard
                icon={FileBarChart}
                title="数据明细"
                description="各楼层能耗对比"
                onClick={() => navigate('/report')}
                count={`${currentSolution.anomalies.length} 异常`}
              />
              <LinkPreviewCard
                icon={Save}
                title="生成报告"
                description="导出完整校验报告"
                onClick={() => navigate('/report')}
                count="含筛选条件"
              />
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">异常类型分布</h3>
              <div className="space-y-2">
                {getAnomalyTypeStats(currentSolution.anomalies).map((item) => (
                  <div key={item.type} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          item.severity === 'high' ? 'bg-accent-red' :
                          item.severity === 'medium' ? 'bg-accent-orange' : 'bg-gray-400'
                        }`}
                        style={{ width: `${(item.count / currentSolution.anomalies.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-8 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">保存方案</h3>
            <input
              type="text"
              value={solutionName}
              onChange={(e) => setSolutionName(e.target.value)}
              placeholder="输入方案名称"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewCard({ icon: Icon, title, value, color, total }: any) {
  const colors: Record<string, string> = {
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    red: 'text-red-600 bg-red-100',
    orange: 'text-orange-600 bg-orange-100',
  };

  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <div className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1">占比 {((value / total) * 100).toFixed(0)}%</p>
    </div>
  );
}

function LinkPreviewCard({ icon: Icon, title, description, onClick, count }: any) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-50 rounded-xl p-4 cursor-pointer hover:bg-gray-100 transition-colors group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium text-gray-800">{title}</p>
          <p className="text-xs text-gray-500">{count}</p>
        </div>
      </div>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function getAnomalyTypeStats(anomalies: Anomaly[]) {
  const typeMap: Record<string, { count: number; severity: string; label: string }> = {
    coordinate_offset: { count: 0, severity: 'medium', label: '坐标偏移' },
    duplicate_name: { count: 0, severity: 'high', label: '重名设备' },
    missing_photo: { count: 0, severity: 'low', label: '缺少照片' },
    cross_floor: { count: 0, severity: 'high', label: '跨楼层异常' },
    empty_value: { count: 0, severity: 'high', label: '空值字段' },
    boundary: { count: 0, severity: 'medium', label: '边界值' },
  };

  anomalies.forEach(a => {
    if (typeMap[a.type]) {
      typeMap[a.type].count++;
    }
  });

  return Object.entries(typeMap)
    .filter(([, v]) => v.count > 0)
    .map(([type, value]) => ({ type, ...value }))
    .sort((a, b) => b.count - a.count);
}
