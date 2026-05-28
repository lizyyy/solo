import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../store/appStore';
import { ANOMALY_LABELS, FIELD_LABELS } from '../data/mockData';
import { ReportExportOptions, FieldType } from '../types';
import { formatSensitiveLog } from '../utils/permission';

export default function ExportPanel() {
  const {
    getFilteredData,
    getRouteById,
    getAircraftById,
    permission,
    permissionManager,
    filters,
  } = useAppStore();

  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const filteredData = getFilteredData();

  const getExportData = () => {
    const pm = permissionManager;
    
    return filteredData.map(flight => {
      const route = getRouteById(flight.routeId);
      const aircraft = getAircraftById(flight.aircraftId);
      
      const row: Record<string, unknown> = {
        '日期': flight.date,
        '航线': route ? `${route.origin} - ${route.destination}` : flight.routeId,
        '航线距离(km)': route?.distance,
        '航线状态': route?.status === 'confirmed' ? '已确认' : '临时',
        '机型': aircraft?.model,
        '注册号': pm.maskValue('registration', aircraft?.registration || ''),
        '座位数': aircraft?.seatCount,
        '机型状态': aircraft?.status === 'confirmed' ? '已确认' : '临时',
        '载客率(%)': flight.loadFactor,
        '载客率状态': flight.fieldStatuses.loadFactor === 'confirmed' ? '已确认' : '临时',
        '旅客人数': pm.maskValue('passengerCount', flight.passengerCount),
        '燃油消耗(kg)': pm.maskValue('fuelConsumption', flight.fuelConsumption),
        '燃油状态': flight.fieldStatuses.fuelConsumption === 'confirmed' ? '已确认' : '临时',
        '碳排因子': flight.carbonFactor,
        '碳排因子状态': flight.fieldStatuses.carbonFactor === 'confirmed' ? '已确认' : '临时',
        '碳排放量(kgCO₂)': flight.carbonEmission,
        '数据状态': flight.status === 'confirmed' ? '已确认' : '临时',
        '异常类型': flight.anomalies.map(a => ANOMALY_LABELS[a]).join('; '),
        '运营报告状态': flight.fieldStatuses.operationReport === 'confirmed' ? '已确认' : '临时',
        '备注': flight.remarks || '',
      };

      if (includeSensitive && permission.canViewSensitive) {
        row['注册号(原始)'] = aircraft?.registration;
        row['旅客人数(原始)'] = flight.passengerCount;
        row['燃油消耗(原始)'] = flight.fuelConsumption;
      }

      return row;
    });
  };

  const getSummaryData = () => {
    const totalEmission = filteredData.reduce((sum, f) => sum + f.carbonEmission, 0);
    const totalFuel = filteredData.reduce((sum, f) => sum + f.fuelConsumption, 0);
    const avgLoadFactor = filteredData.filter(f => f.loadFactor !== null).reduce((sum, f) => sum + (f.loadFactor || 0), 0) / 
      Math.max(1, filteredData.filter(f => f.loadFactor !== null).length);
    const confirmedCount = filteredData.filter(f => f.status === 'confirmed').length;
    const tentativeCount = filteredData.filter(f => f.status === 'tentative').length;

    const anomalySummary = filteredData.reduce((acc, f) => {
      f.anomalies.forEach(a => {
        acc[ANOMALY_LABELS[a]] = (acc[ANOMALY_LABELS[a]] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    return [
      { '指标': '筛选日期范围', '值': `${filters.dateRange.start} 至 ${filters.dateRange.end}` },
      { '指标': '数据条数', '值': filteredData.length },
      { '指标': '已确认数据', '值': confirmedCount },
      { '指标': '临时备注数据', '值': tentativeCount },
      { '指标': '总碳排放量(tCO₂)', '值': (totalEmission / 1000).toFixed(2) },
      { '指标': '总燃油消耗(t)', '值': (totalFuel / 1000).toFixed(2) },
      { '指标': '平均载客率(%)', '值': avgLoadFactor.toFixed(1) },
      { '指标': '平均碳排因子', '值': '3.16 kgCO₂/kg' },
      ...Object.entries(anomalySummary).map(([k, v]) => ({ '指标': `异常-${k}`, '值': v })),
    ];
  };

  const getFieldStatusSummary = () => {
    const fields: FieldType[] = ['route', 'aircraftType', 'loadFactor', 'fuelConsumption', 'carbonFactor', 'operationReport'];
    
    return fields.map(field => {
      const confirmed = filteredData.filter(f => f.fieldStatuses[field] === 'confirmed').length;
      const tentative = filteredData.filter(f => f.fieldStatuses[field] === 'tentative').length;
      return {
        '字段': FIELD_LABELS[field],
        '已确认': confirmed,
        '临时备注': tentative,
        '确认率(%)': ((confirmed / filteredData.length) * 100).toFixed(1),
      };
    });
  };

  const handleExport = async () => {
    if (!permission.canExport) {
      alert('权限不足：无法导出数据');
      return;
    }

    if (includeSensitive && !permission.canViewSensitive) {
      alert('权限不足：无法导出敏感字段');
      return;
    }

    setIsExporting(true);

    try {
      const exportOptions: ReportExportOptions = {
        format,
        includeSensitive,
        includeCharts: false,
        timeRange: filters.dateRange,
      };

      permissionManager.logAction('export_report', {
        field: 'export',
        oldValue: formatSensitiveLog('export', null, format, permission.canViewSensitive).oldValue,
        newValue: formatSensitiveLog('export', null, JSON.stringify(exportOptions), permission.canViewSensitive).newValue,
      });

      const detailData = getExportData();
      const summaryData = getSummaryData();
      const fieldStatusData = getFieldStatusSummary();

      const wb = XLSX.utils.book_new();
      
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, '汇总');
      
      const fieldStatusWs = XLSX.utils.json_to_sheet(fieldStatusData);
      XLSX.utils.book_append_sheet(wb, fieldStatusWs, '字段状态');
      
      const detailWs = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(wb, detailWs, '明细数据');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `航线碳排报告_${timestamp}.${format}`;

      if (format === 'xlsx') {
        XLSX.writeFile(wb, fileName);
      } else {
        const detailCsv = XLSX.utils.sheet_to_csv(detailWs);
        const blob = new Blob(['\ufeff' + detailCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }

      alert(`报告已导出：${fileName}\n共 ${filteredData.length} 条数据`);
    } catch (error) {
      console.error('Export failed:', error);
      const msg = error instanceof Error ? error.message : '未知错误';
      permissionManager.logAction('export_error', { field: 'error', newValue: msg });
      alert(`导出失败：${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewAuditLog = () => {
    const logs = permissionManager.getAuditLog();
    const logText = logs.map(log => 
      `[${log.timestamp}] ${log.action} - user:${log.userId}` +
      (log.flightId ? ` flight:${log.flightId}` : '') +
      (log.field ? ` field:${log.field}` : '') +
      (log.oldValue !== undefined ? ` ${log.oldValue} → ${log.newValue}` : '')
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `审计日志_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 text-white space-y-4">
      <h2 className="text-lg font-semibold">运营报告导出</h2>
      
      <div className="space-y-3">
        <div>
          <label className="text-sm text-slate-300 block mb-1">导出格式</label>
          <div className="flex gap-2">
            {(['xlsx', 'csv'] as const).map(f => (
              <label key={f} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="bg-slate-700 border-slate-600"
                />
                <span className="text-sm">{f.toUpperCase()}</span>
              </label>
            ))}
          </div>
        </div>

        {permission.canViewSensitive && (
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSensitive}
                onChange={(e) => setIncludeSensitive(e.target.checked)}
                className="bg-slate-700 border-slate-600"
              />
              <span className="text-sm">包含敏感字段（注册号、旅客人数等）</span>
            </label>
            <p className="text-xs text-slate-500 mt-1 ml-6">
              敏感字段在展示、导出、日志中按同一权限口径处理
            </p>
          </div>
        )}

        <div className="p-3 bg-slate-700/50 rounded space-y-1">
          <p className="text-sm text-slate-300">
            即将导出 <span className="text-white font-bold">{filteredData.length}</span> 条数据
          </p>
          <p className="text-xs text-slate-400">
            包含：汇总表、字段状态表、明细表
          </p>
          {!permission.canViewSensitive && includeSensitive && (
            <p className="text-xs text-red-400">警告：您无权导出敏感字段</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting || !permission.canExport}
            className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
              permission.canExport && !isExporting
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isExporting ? '导出中...' : '📥 导出报告'}
          </button>
          
          <button
            onClick={handleViewAuditLog}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
            title="查看审计日志"
          >
            📋 日志
          </button>
        </div>

        {!permission.canExport && (
          <p className="text-xs text-red-400 text-center">当前角色无导出权限</p>
        )}
      </div>

      <div className="pt-3 border-t border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-2">回归测试样例</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            <span className="text-amber-300">载客率缺失</span>
            <span className="text-slate-500">- 确认修改后不会重新漏掉</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            <span className="text-red-300">机型映射错误</span>
            <span className="text-slate-500">- 确认修改后不会重新漏掉</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            <span className="text-purple-300">极端航线遮挡</span>
            <span className="text-slate-500">- 确认修改后不会重新漏掉</span>
          </div>
        </div>
      </div>
    </div>
  );
}
