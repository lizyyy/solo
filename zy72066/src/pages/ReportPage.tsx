import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
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
  GitCompare,
  FileJson,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { AnomalyType, DeviceStatus, Anomaly, ANOMALY_TYPE_LABELS, DiffSnapshot } from '../types';
import { downloadStructuredReport } from '../utils/structuredExport';

const anomalyTypeLabels: Record<AnomalyType, string> = {
  coordinate_offset: '坐标偏移',
  duplicate_name: '重名设备',
  same_device_different_name: '异名同设备',
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
  const exportStructuredReport = useAppStore((state) => state.exportStructuredReport);
  const [newRemark, setNewRemark] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string>('');

  if (!currentSolution) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <FileBarChart className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">请先导入数据</h2>
        <p className="text-gray-400 mb-6">返回导入页面上传或选择样例数据</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
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
    if (filterConditions.showResolved === false && anomaly.resolved) return false;
    return true;
  });

  const floorStats = [1, 2, 3].map((floor) => {
    const floorDevices = filteredDevices.filter((d) => d.floor === floor);
    const totalEnergy = floorDevices.reduce((sum, d) => sum + d.energyConsumption, 0);
    const floorAnomalies = filteredAnomalies.filter((a) => floorDevices.some((d) => d.id === a.deviceId));
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
      if (a.resolved) stats[a.type].resolved++;
      else stats[a.type].unresolved++;
    });
    return stats;
  }, [filteredAnomalies]);

  const snapshots = currentSolution.snapshots || [];
  const firstSnapshot = snapshots[0];
  const lastSnapshot = snapshots[snapshots.length - 1];
  const snapshotsForDiff = snapshots.length >= 2 ? snapshots.slice(-2) : [];

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
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

      console.log(`✅ 报告截图导出成功: ${fileName}`);
      console.log(`📊 页面统计: ${filteredDevices.length} 台设备, ${filteredAnomalies.length} 条异常`);
      console.log(`✅ 已处理: ${resolvedAnomalies}, 待处理: ${unresolvedAnomalies}`);
      console.log(`📝 备注数: ${currentSolution.remarks.length}, 操作日志: ${(currentSolution.operationLogs || []).length}`);

      setExportSuccess(`截图已下载: ${fileName}`);
      setTimeout(() => setExportSuccess(''), 5000);
    } catch (error) {
      console.error('❌ 导出失败:', error);
      alert('导出失败，请重试');
    }
    setIsExporting(false);
  };

  const handleExportStructured = () => {
    const report = exportStructuredReport();
    if (!report) {
      alert('无数据可导出');
      return;
    }
    const baseName = `能耗结构化报告_${currentSolution.name.replace(/\s+/g, '_')}`;
    const { jsonFile, excelFile } = downloadStructuredReport(report, baseName);

    console.log(`✅ 结构化导出已触发:`);
    console.log(`   JSON 文件: ${jsonFile}`);
    console.log(`   Excel 文件: ${excelFile}`);
    console.log(`   设备明细行数: ${report.设备明细.length}`);
    console.log(`   异常明细行数: ${report.异常明细.length}`);
    console.log(`   差异对比行数: ${report.补录前后差异对比.length}`);
    console.log(`   操作历史行数: ${report.操作历史记录.length}`);
    console.log(`   异常类型统计:`, report.异常类型统计);
    console.log(`   汇总统计:`, report.汇总统计);

    setExportSuccess(`结构化数据已下载: ${jsonFile} / ${excelFile}`);
    setTimeout(() => setExportSuccess(''), 6000);
  };

  const handleAddRemark = () => {
    if (newRemark.trim()) {
      addRemark(newRemark.trim());
      setNewRemark('');
    }
  };

  const operationLogs = (currentSolution.operationLogs || []).slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const diffArrow = (diff: number) => {
    if (diff > 0) return <TrendingUp className="w-3.5 h-3.5 text-red-600 inline" />;
    if (diff < 0) return <TrendingDown className="w-3.5 h-3.5 text-green-600 inline" />;
    return <Minus className="w-3.5 h-3.5 text-gray-400 inline" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/scene')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">报告生成</h1>
            <p className="text-gray-500 mt-1">
              方案: {currentSolution.name} · 状态:
              {currentSolution.status === 'draft' ? ' 草稿' :
               currentSolution.status === 'reviewing' ? ' 审核中' :
               currentSolution.status === 'approved' ? ' 已批准' : ' 返工中'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-3 items-center">
            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              <Download className="w-4 h-4" />
              {isExporting ? '导出中...' : '导出报告截图'}
            </button>
            <button
              onClick={handleExportStructured}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              导出结构化数据
            </button>
          </div>
          {exportSuccess && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg animate-pulse text-sm">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">{exportSuccess}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-600" />
          筛选条件
        </h3>
        <div className="flex flex-wrap gap-4 items-end">
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
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">处理状态</label>
            <select
              value={filterConditions.showResolved === undefined ? '' : filterConditions.showResolved ? 'all' : 'unresolved'}
              onChange={(e) =>
                setFilterConditions({
                  showResolved: e.target.value === '' ? undefined : e.target.value === 'all',
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              <option value="unresolved">仅待处理</option>
              <option value="all">包含已处理</option>
            </select>
          </div>
          {(filterConditions.status || filterConditions.floor || filterConditions.anomalyType || filterConditions.showResolved === false) && (
            <button
              onClick={() =>
                setFilterConditions({ status: undefined, floor: undefined, anomalyType: undefined, showResolved: true })
              }
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              重置筛选
            </button>
          )}
        </div>
      </div>

      <div ref={reportRef} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
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
                <p className="flex items-center justify-end gap-1 mt-1">
                  <GitCompare className="w-4 h-4" />
                  快照数: {snapshots.length}
                </p>
              </div>
            </div>

            {(filterConditions.status || filterConditions.floor || filterConditions.anomalyType || filterConditions.showResolved === false) && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>当前筛选条件:</strong>
                  {filterConditions.status && ` 状态=${statusLabels[filterConditions.status]}`}
                  {filterConditions.floor && ` 楼层=${filterConditions.floor}F`}
                  {filterConditions.anomalyType && ` 异常类型=${anomalyTypeLabels[filterConditions.anomalyType]}`}
                  {filterConditions.showResolved === false && ` 仅待处理`}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-6 gap-3 mb-8">
            <StatCard label="设备总数" value={filteredDevices.length} icon="📊" />
            <StatCard label="总能耗" value={`${totalEnergy.toFixed(1)}kWh`} icon="⚡" />
            <StatCard label="异常总数" value={filteredAnomalies.length} icon="⚠️" warning />
            <StatCard label="已处理" value={resolvedAnomalies} icon="✅" success />
            <StatCard label="待处理" value={unresolvedAnomalies} icon="🔴" error />
            <StatCard label="合并记录" value={(currentSolution.mergedDevices || []).length} icon="🔗" />
          </div>

          <div className="mb-8 p-5 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ArrowDownUp className="w-5 h-5 text-primary-600" />
              检测参数配置
            </h3>
            <div className="grid grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-500">警告阈值</p>
                <p className="text-lg font-bold text-yellow-600">{currentConfig.energyThreshold.warning} kWh</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">错误阈值</p>
                <p className="text-lg font-bold text-red-600">{currentConfig.energyThreshold.error} kWh</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">坐标容差</p>
                <p className="text-lg font-bold text-gray-700">{currentConfig.coordinateTolerance} m</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">同设备位置容差</p>
                <p className="text-lg font-bold text-purple-600">{currentConfig.sameDevicePositionTolerance} m</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">同设备能耗容差</p>
                <p className="text-lg font-bold text-purple-600">
                  {(currentConfig.sameDeviceEnergyTolerance * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          {snapshotsForDiff.length === 2 && (
            <div className="mb-8 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl">
              <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                <GitCompare className="w-5 h-5" />
                补录前后差异对比（最近两次快照）
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(() => {
                  const [before, after] = snapshotsForDiff;
                  const items = [
                    { label: '设备数', before: before.deviceCount, after: after.deviceCount },
                    { label: '异常总数', before: before.anomalyCount, after: after.anomalyCount },
                    { label: '已处理', before: before.resolvedAnomalyCount, after: after.resolvedAnomalyCount },
                    { label: '待处理', before: before.unresolvedAnomalyCount, after: after.unresolvedAnomalyCount },
                  ];
                  return items.map((it, idx) => {
                    const diff = it.after - it.before;
                    return (
                      <div key={idx} className="bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs text-gray-500 mb-1">{it.label}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">{it.before}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-base font-bold text-gray-800">{it.after}</span>
                          {diffArrow(diff)}
                        </div>
                        <p className={`text-xs mt-1 ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {diff >= 0 ? '+' : ''}
                          {diff}
                        </p>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="mt-4 pt-4 border-t border-indigo-200">
                <p className="text-xs text-indigo-700 mb-2">异常类型变化明细:</p>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const [before, after] = snapshotsForDiff;
                    const allTypes = new Set([...Object.keys(before.anomaliesByType), ...Object.keys(after.anomaliesByType)]);
                    return [...allTypes].map((type) => {
                      const b = before.anomaliesByType[type] || 0;
                      const a = after.anomaliesByType[type] || 0;
                      const diff = a - b;
                      return (
                        <span
                          key={type}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                            diff > 0
                              ? 'bg-red-100 text-red-700'
                              : diff < 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {ANOMALY_TYPE_LABELS[type as AnomalyType] || type}: {b}→{a}
                          {diff !== 0 && (diff > 0 ? ` (+${diff})` : ` (${diff})`)}
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="mt-3 flex gap-4 text-xs text-indigo-500">
                <span>对比起始: {new Date(snapshotsForDiff[0].timestamp).toLocaleString()}</span>
                <span>对比结束: {new Date(snapshotsForDiff[1].timestamp).toLocaleString()}</span>
              </div>
            </div>
          )}

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
                    {resolvedAnomalies} / {filteredAnomalies.length} (
                    {Math.round((resolvedAnomalies / Math.max(filteredAnomalies.length, 1)) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${(resolvedAnomalies / Math.max(filteredAnomalies.length, 1)) * 100}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(anomalyResolutionStats).map(([type, stat]) => (
                  <div key={type} className="bg-white rounded-lg p-3">
                    <p className="text-sm text-gray-600">{anomalyTypeLabels[type as AnomalyType]}</p>
                    <p className="text-lg font-bold">
                      <span className="text-green-600">{stat.resolved}</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-gray-700">{stat.total}</span>
                    </p>
                    <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                      <div
                        className="bg-green-400 h-1 rounded-full"
                        style={{ width: `${(stat.resolved / Math.max(stat.total, 1)) * 100}%` }}
                      />
                    </div>
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
                      <span className="text-sm text-gray-500">{stat.energy.toFixed(1)} kWh</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${(stat.energy / Math.max(totalEnergy, 1)) * 100}%` }}
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
              <Users className="w-5 h-5 text-purple-600" />
              设备合并与异名记录
            </h3>
            {(currentSolution.mergedDevices || []).length === 0 && currentSolution.devices.filter((d) => d.aliasNames?.length).length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-400">暂无设备合并记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(currentSolution.mergedDevices || []).length > 0 && (
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <p className="text-sm text-purple-700 font-medium mb-2">本次补录合并操作:</p>
                    {(currentSolution.mergedDevices || []).map((m, idx) => {
                      const target = currentSolution.devices.find((d) => d.id === m.targetId);
                      return (
                        <div key={idx} className="text-xs text-purple-800 bg-white px-3 py-2 rounded-lg mb-1">
                          [{new Date(m.timestamp).toLocaleString()}] 设备ID {m.sourceId} 已并入{' '}
                          <strong>{target?.name || m.targetId}</strong>
                          {target?.aliasNames && target.aliasNames.length > 0 && (
                            <span className="text-purple-600"> (别名: {target.aliasNames.join('、')})</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {currentSolution.devices.filter((d) => d.aliasNames?.length).length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-4 py-2 font-medium text-gray-600">当前规范名</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">别名记录（历史曾用名）</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentSolution.devices
                          .filter((d) => d.aliasNames?.length)
                          .map((d) => (
                            <tr key={d.id} className="border-t border-gray-100">
                              <td className="px-4 py-2 font-medium text-gray-800">{d.name}</td>
                              <td className="px-4 py-2 text-purple-700">{d.aliasNames?.join('、')}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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
                      <th className="text-left px-4 py-3 font-medium text-gray-600">异常描述/原因说明</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">严重程度</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">处理备注</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">处理时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnomalies.map((anomaly) => {
                      const device = currentSolution.devices.find((d) => d.id === anomaly.deviceId);
                      const related = anomaly.relatedDeviceId
                        ? currentSolution.devices.find((d) => d.id === anomaly.relatedDeviceId)
                        : null;
                      return (
                        <tr
                          key={anomaly.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${anomaly.resolved ? 'bg-green-50/30' : ''}`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {device?.name || '未知设备'}
                            <span className="block text-xs text-gray-500">{device?.floor}F</span>
                            {related && (
                              <span className="block text-[11px] text-purple-600">
                                关联: {related.name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                anomaly.type === 'same_device_different_name'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {anomalyTypeLabels[anomaly.type]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs">{anomaly.description}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${
                                anomaly.severity === 'high'
                                  ? 'bg-red-100 text-red-700'
                                  : anomaly.severity === 'medium'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                            >
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
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {anomaly.resolvedAt ? new Date(anomaly.resolvedAt).toLocaleString() : '-'}
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

          {operationLogs.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-700" />
                操作历史时间线
              </h3>
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />
                {operationLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="relative">
                    <div
                      className={`absolute -left-[18px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        log.type === 'device_merged'
                          ? 'bg-purple-500'
                          : log.type === 'anomaly_resolved'
                            ? 'bg-green-500'
                            : log.type === 'remark_added'
                              ? 'bg-blue-500'
                              : log.type === 'config_updated'
                                ? 'bg-orange-500'
                                : 'bg-gray-400'
                      }`}
                    />
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            log.type === 'device_merged'
                              ? 'bg-purple-100 text-purple-700'
                              : log.type === 'anomaly_resolved'
                                ? 'bg-green-100 text-green-700'
                                : log.type === 'remark_added'
                                  ? 'bg-blue-100 text-blue-700'
                                  : log.type === 'config_updated'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {log.type === 'device_merged'
                            ? '设备合并'
                            : log.type === 'anomaly_resolved'
                              ? '异常处理'
                              : log.type === 'remark_added'
                                ? '添加备注'
                                : log.type === 'config_updated'
                                  ? '参数更新'
                                  : log.type}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{log.description}</p>
                      <p className="text-xs text-gray-500 mt-1">操作人: {log.operator}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentSolution.remarks.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">处理备注</h3>
              <div className="space-y-3">
                {currentSolution.remarks.map((remark, index) => (
                  <div key={index} className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-gray-700">
                      <span className="text-xs text-blue-500 mr-2">#{index + 1}</span>
                      {remark}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
            placeholder="输入备注内容，记录处理思路、原因说明和决策理由..."
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
    <div
      className={`p-3 rounded-xl ${
        error
          ? 'bg-red-50 border border-red-200'
          : warning
            ? 'bg-orange-50 border border-orange-200'
            : success
              ? 'bg-green-50 border border-green-200'
              : 'bg-gray-50'
      }`}
    >
      <div className="text-xl mb-1">{icon}</div>
      <p
        className={`text-xl font-bold ${
          error ? 'text-red-700' : warning ? 'text-orange-700' : success ? 'text-green-700' : 'text-gray-800'
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
