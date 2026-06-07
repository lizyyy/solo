import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import {
  FileBarChart,
  Download,
  Filter,
  MessageSquare,
  Plus,
  ChevronLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  History,
  ArrowDownUp,
  FileCheck,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { AnomalyType, DeviceStatus, Anomaly } from '../types';

const anomalyTypeLabels: Record<AnomalyType, string> = {
  coordinate_offset: '坐标偏移',
  duplicate_name: '重名设备',
  missing_photo: '缺少照片',
  cross_floor: '跨楼层异常',
  empty_value: '空值字段',
  boundary: '边界值',
};

const statusLabels: Record<DeviceStatus, string> = {
  normal: '正常',
  warning: '警告',
  error: '异常',
};

export default function ReportPage() {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const currentSolution = useAppStore((state) => state.currentSolution);
  const currentConfig = useAppStore((state) => state.currentConfig);
  const filterConditions = useAppStore((state) => state.filterConditions);
  const setFilterConditions = useAppStore((state) => state.setFilterConditions);
  const addRemark = useAppStore((state) => state.addRemark);
  const [newRemark, setNewRemark] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  if (!currentSolution) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <FileBarChart className="w-16 h-16 text-gray-300 mb-4" />
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

  const filteredDevices = currentSolution.devices.filter((device) => {
    if (filterConditions.status && device.status !== filterConditions.status) return false;
    if (filterConditions.floor && device.floor !== filterConditions.floor) return false;
    return true;
  });

  const filteredAnomalies = currentSolution.anomalies.filter((anomaly) => {
    if (filterConditions.anomalyType && anomaly.type !== filterConditions.anomalyType) return false;
    return true;
  });

  const floorStats = [1, 2, 3].map((floor) => {
    const floorDevices = filteredDevices.filter((d) => d.floor === floor);
    const totalEnergy = floorDevices.reduce((sum, d) => sum + d.energyConsumption, 0);
    const floorAnomalies = filteredAnomalies.filter((a) =>
      floorDevices.some((d) => d.id === a.deviceId)
    );
    return { floor, count: floorDevices.length, energy: totalEnergy, anomalies: floorAnomalies.length };
  });

  const totalEnergy = filteredDevices.reduce((sum, d) => sum + d.energyConsumption, 0);
  const unresolvedAnomalies = filteredAnomalies.filter((a) => !a.resolved).length;
  const resolvedAnomalies = filteredAnomalies.filter((a) => a.resolved).length;

  const anomalyResolutionStats = useMemo(() => {
    const stats: Record<string, { total: number; resolved: number; unresolved: number }> = {};
    filteredAnomalies.forEach((a) => {
      if (!stats[a.type]) {
        stats[a.type] = { total: 0, resolved: 0, unresolved: 0 };
      }
      stats[a.type].total++;
      if (a.resolved) {
        stats[a.type].resolved++;
      } else {
        stats[a.type].unresolved++;
      }
    });
    return stats;
  }, [filteredAnomalies]);

  const handleExport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `能耗报告_${currentSolution.name}_${timestamp}.png`;
      
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      console.log(`✅ 报告导出成功: ${fileName}`);
      console.log(`📊 导出内容验证: ${filteredDevices.length} 台设备, ${filteredAnomalies.length} 条异常, ${currentSolution.remarks.length} 条备注`);
      
    } catch (error) {
      console.error('❌ 导出失败:', error);
      alert('导出失败，请重试');
    }
    
    setIsExporting(false);
  };

  const handleAddRemark = () => {
    if (newRemark.trim()) {
      addRemark(newRemark.trim());
      setNewRemark('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/scene')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">报告生成</h1>
            <p className="text-gray-500 mt-1">方案: {currentSolution.name}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? '导出中...' : '导出报告截图'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-600" />
          筛选条件
        </h3>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">设备状态</label>
            <select
              value={filterConditions.status || ''}
              onChange={(e) => setFilterConditions({ status: (e.target.value as DeviceStatus) || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              <option value="normal">正常</option>
              <option value="warning">警告</option>
              <option value="error">异常</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">楼层</label>
            <select
              value={filterConditions.floor || ''}
              onChange={(e) => setFilterConditions({ floor: e.target.value ? Number(e.target.value) : undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              <option value="1">1F</option>
              <option value="2">2F</option>
              <option value="3">3F</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">异常类型</label>
            <select
              value={filterConditions.anomalyType || ''}
              onChange={(e) => setFilterConditions({ anomalyType: (e.target.value as AnomalyType) || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              {Object.entries(anomalyTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div ref={reportRef} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="border-b border-gray-200 pb-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">智慧园区能耗楼宇校验报告</h2>
              <p className="text-gray-500 mt-1">方案名称: {currentSolution.name}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p className="flex items-center justify-end gap-1">
                <Clock className="w-4 h-4" />
                生成时间: {new Date().toLocaleString('zh-CN')}
              </p>
              <p className="flex items-center justify-end gap-1 mt-1">
                <User className="w-4 h-4" />
                操作人: {currentSolution.operator}
              </p>
            </div>
          </div>
          
          {(filterConditions.status || filterConditions.floor || filterConditions.anomalyType) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>当前筛选条件:</strong>
                {filterConditions.status && ` 状态=${statusLabels[filterConditions.status]}`}
                {filterConditions.floor && ` 楼层=${filterConditions.floor}F`}
                {filterConditions.anomalyType && ` 异常类型=${anomalyTypeLabels[filterConditions.anomalyType]}`}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-5 gap-4 mb-8">
          <StatCard label="设备总数" value={filteredDevices.length} icon="📊" />
          <StatCard label="总能耗" value={`${totalEnergy}kWh`} icon="⚡" />
          <StatCard label="异常总数" value={filteredAnomalies.length} icon="⚠️" warning />
          <StatCard label="已处理" value={resolvedAnomalies} icon="✅" success />
          <StatCard label="待处理" value={unresolvedAnomalies} icon="🔴" error />
        </div>

        <div className="mb-8 p-5 bg-gray-50 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ArrowDownUp className="w-5 h-5 text-primary-600" />
            检测参数配置
          </h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">警告阈值</p>
              <p className="text-xl font-bold text-yellow-600">{currentConfig.energyThreshold.warning} kWh</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">错误阈值</p>
              <p className="text-xl font-bold text-red-600">{currentConfig.energyThreshold.error} kWh</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">坐标容差</p>
              <p className="text-xl font-bold text-gray-700">{currentConfig.coordinateTolerance} m</p>
            </div>
          </div>
        </div>

        {resolvedAnomalies > 0 && (
          <div className="mb-8 p-5 bg-green-50 rounded-xl border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              补录处理进度
            </h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">处理进度</span>
                <span className="font-medium text-green-700">
                  {resolvedAnomalies} / {filteredAnomalies.length} ({Math.round((resolvedAnomalies / filteredAnomalies.length) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-green-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(resolvedAnomalies / filteredAnomalies.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(anomalyResolutionStats).map(([type, stat]) => (
                <div key={type} className="bg-white rounded-lg p-3">
                  <p className="text-sm text-gray-600">{anomalyTypeLabels[type as AnomalyType]}</p>
                  <p className="text-lg font-bold">
                    <span className="text-green-600">{stat.resolved}</span>
                    <span className="text-gray-400"> / </span>
                    <span className="text-gray-700">{stat.total}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">各楼层统计</h3>
          <div className="space-y-3">
            {floorStats.map((stat) => (
              <div key={stat.floor} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-xl flex items-center justify-center font-bold text-lg">
                  {stat.floor}F
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{stat.count} 台设备</span>
                    <span className="text-sm text-gray-500">{stat.energy} kWh</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{ width: `${(stat.energy / totalEnergy) * 100}%` }}
                    />
                  </div>
                </div>
                {stat.anomalies > 0 ? (
                  <span className="flex items-center gap-1 text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full">
                    <AlertTriangle className="w-4 h-4" />
                    {stat.anomalies} 异常
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                    <CheckCircle className="w-4 h-4" />
                    正常
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-primary-600" />
            异常明细与处理记录
          </h3>
          {filteredAnomalies.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">设备</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">类型</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">异常描述</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">严重程度</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">处理备注</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnomalies.map((anomaly) => {
                    const device = currentSolution.devices.find((d) => d.id === anomaly.deviceId);
                    return (
                      <tr key={anomaly.id} className={`border-b border-gray-100 hover:bg-gray-50 ${
                        anomaly.resolved ? 'bg-green-50/30' : ''
                      }`}>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {device?.name || '未知设备'}
                          <span className="block text-xs text-gray-500">{device?.floor}F</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{anomalyTypeLabels[anomaly.type]}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs">{anomaly.description}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            anomaly.severity === 'high' ? 'bg-red-100 text-red-700' :
                            anomaly.severity === 'medium' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {anomaly.severity === 'high' ? '高' : anomaly.severity === 'medium' ? '中' : '低'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {anomaly.resolved ? (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <CheckCircle className="w-4 h-4" /> 已处理
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600 font-medium">
                              <AlertTriangle className="w-4 h-4" /> 待处理
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs">
                          {anomaly.remark ? (
                            <span className="text-sm">{anomaly.remark}</span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-gray-500">当前筛选条件下无异常记录</p>
            </div>
          )}
        </div>

        {currentSolution.remarks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">处理备注</h3>
            <div className="space-y-3">
              {currentSolution.remarks.map((remark, index) => (
                <div key={index} className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-gray-700">{remark}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-600" />
          添加处理备注
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newRemark}
            onChange={(e) => setNewRemark(e.target.value)}
            placeholder="输入备注内容，记录处理思路和决策理由..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500"
            onKeyPress={(e) => e.key === 'Enter' && handleAddRemark()}
          />
          <button
            onClick={handleAddRemark}
            disabled={!newRemark.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, warning, error, success }: any) {
  return (
    <div className={`p-4 rounded-xl ${
      error ? 'bg-red-50 border border-red-200' :
      warning ? 'bg-orange-50 border border-orange-200' :
      success ? 'bg-green-50 border border-green-200' :
      'bg-gray-50'
    }`}>
      <div className="text-2xl mb-1">{icon}</div>
      <p className={`text-2xl font-bold ${
        error ? 'text-red-700' : 
        warning ? 'text-orange-700' : 
        success ? 'text-green-700' : 
        'text-gray-800'
      }`}>
        {value}
      </p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
