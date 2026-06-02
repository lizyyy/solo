import { useState, useMemo } from 'react';
import { Download, Eye, FileSpreadsheet, FileText, Clock, CheckCircle, Filter, ChevronDown, X, Calendar, MapPin, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { PointStatus, ExportConfig, exportColumnOptions, pointStatusLabels, sourceTypeLabels, GarbagePoint } from '@/types';
import { exportToExcel, exportToPDF, downloadBlob } from '@/utils/importExport';
import { formatDateTime, formatDate } from '@/utils/stringUtils';
import { cn } from '@/utils/cn';
import StatusBadge from '@/components/StatusBadge';

interface ExportRecord {
  id: string;
  timestamp: Date;
  operator: string;
  format: 'xlsx' | 'pdf';
  count: number;
  filters: string;
}

const statusOptions = [
  { value: PointStatus.CONFIRMED, label: '已确认' },
  { value: PointStatus.PENDING, label: '待处理' },
  { value: PointStatus.CONFLICT, label: '有冲突' },
];

export default function ExportPage() {
  const {
    points,
    getStreets,
    addLog,
    operator,
    loading,
  } = useAppStore();

  const [selectedStreets, setSelectedStreets] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<PointStatus[]>([]);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    exportColumnOptions.map(o => o.value)
  );
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [watermark, setWatermark] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportRecords, setExportRecords] = useState<ExportRecord[]>([]);
  const [showStreetDropdown, setShowStreetDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  const streets = getStreets();

  const filteredPoints = useMemo(() => {
    return points.filter(point => {
      if (selectedStreets.length > 0 && !selectedStreets.includes(point.street)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(point.status)) return false;
      if (dateFrom && new Date(point.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(point.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [points, selectedStreets, selectedStatuses, dateFrom, dateTo]);

  const toggleStreet = (street: string) => {
    setSelectedStreets(prev =>
      prev.includes(street) ? prev.filter(s => s !== street) : [...prev, street]
    );
  };

  const toggleStatus = (status: PointStatus) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
    );
  };

  const clearStreets = () => setSelectedStreets([]);
  const clearStatuses = () => setSelectedStatuses([]);
  const clearColumns = () => setSelectedColumns([]);

  const selectAllColumns = () => {
    setSelectedColumns(exportColumnOptions.map(o => o.value));
  };

  const getDisplayValue = (selected: string[], allOptions: { label: string; value: string }[], placeholder: string) => {
    if (selected.length === 0) return placeholder;
    if (selected.length === allOptions.length) return '全部';
    if (selected.length <= 3) {
      return selected.map(s => allOptions.find(o => o.value === s)?.label || s).join('、');
    }
    return `已选 ${selected.length} 项`;
  };

  const getPreviewValue = (point: GarbagePoint, col: string) => {
    switch (col) {
      case 'canonicalName': return point.canonicalName;
      case 'address': return point.address;
      case 'street': return point.street;
      case 'lat': return point.lat.toFixed(6);
      case 'lng': return point.lng.toFixed(6);
      case 'status': return <StatusBadge status={point.status} />;
      case 'sourceCount': return point.sources.length;
      case 'sourceTypes':
        return [...new Set(point.sources.map(s => sourceTypeLabels[s.sourceType]))].join('、');
      case 'mergeReason': return point.mergeReason || '-';
      case 'createdAt': return formatDateTime(point.createdAt);
      case 'updatedAt': return formatDateTime(point.updatedAt);
      default: return '';
    }
  };

  const getColumnLabel = (col: string) => {
    return exportColumnOptions.find(o => o.value === col)?.label || col;
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const handleExport = async () => {
    if (filteredPoints.length === 0) {
      alert('没有符合条件的数据可导出');
      return;
    }
    if (selectedColumns.length === 0) {
      alert('请至少选择一个导出字段');
      return;
    }

    setExporting(true);

    try {
      const config: ExportConfig = {
        format: exportFormat,
        columns: selectedColumns,
        filters: {
          streets: selectedStreets.length > 0 ? selectedStreets : undefined,
          statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
          dateFrom: dateFrom ? new Date(dateFrom) : undefined,
          dateTo: dateTo ? new Date(dateTo) : undefined,
        },
        watermark,
      };

      let blob: Blob;
      let filename: string;
      const timestamp = formatDate(new Date()).replace(/-/g, '');

      if (exportFormat === 'xlsx') {
        blob = await exportToExcel(filteredPoints, config);
        filename = `垃圾分类投放点位_${timestamp}.xlsx`;
      } else {
        blob = await exportToPDF(filteredPoints, config);
        filename = `垃圾分类投放点位_${timestamp}.pdf`;
      }

      downloadBlob(blob, filename);

      const filterDesc = [
        selectedStreets.length > 0 ? `街道: ${selectedStreets.length}个` : '',
        selectedStatuses.length > 0 ? `状态: ${selectedStatuses.map(s => pointStatusLabels[s]).join('、')}` : '',
        dateFrom || dateTo ? `日期: ${dateFrom || '不限'} ~ ${dateTo || '不限'}` : '',
      ].filter(Boolean).join(' | ');

      const record: ExportRecord = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date(),
        operator,
        format: exportFormat,
        count: filteredPoints.length,
        filters: filterDesc || '无筛选条件',
      };

      setExportRecords(prev => [record, ...prev].slice(0, 10));

      addLog({
        pointId: '',
        action: 'export',
        operator,
        detail: `导出 ${filteredPoints.length} 条点位数据，格式: ${exportFormat.toUpperCase()}`,
        evidence: filterDesc || '无筛选条件',
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-neutral-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800 mb-1">数据公示导出</h1>
        <p className="text-sm text-neutral-500">配置筛选条件，导出垃圾分类投放点位数据</p>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={18} className="text-primary-500" />
              <h2 className="text-lg font-semibold text-neutral-800">筛选条件</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  <MapPin size={14} className="inline mr-1" />
                  所属街道（多选）
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStreetDropdown(!showStreetDropdown)}
                    className="select w-full text-left flex items-center justify-between"
                  >
                    <span className={cn(selectedStreets.length === 0 && 'text-neutral-400')}>
                      {getDisplayValue(selectedStreets, streets.map(s => ({ label: s, value: s })), '请选择街道')}
                    </span>
                    <ChevronDown size={16} className="text-neutral-400" />
                  </button>
                  {showStreetDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-sm shadow-lg max-h-60 overflow-auto">
                      <div className="p-2 border-b border-neutral-100 flex justify-between items-center">
                        <span className="text-xs text-neutral-500">共 {streets.length} 个街道</span>
                        <button
                          type="button"
                          onClick={clearStreets}
                          className="text-xs text-primary-500 hover:text-primary-600"
                        >
                          清空
                        </button>
                      </div>
                      {streets.map(street => (
                        <label
                          key={street}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStreets.includes(street)}
                            onChange={() => toggleStreet(street)}
                            className="w-4 h-4 text-primary-500 rounded border-neutral-300 focus:ring-primary-500"
                          />
                          <span className="text-sm">{street}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {selectedStreets.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedStreets.slice(0, 5).map(street => (
                      <span
                        key={street}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-sm border border-primary-100"
                      >
                        {street}
                        <button
                          type="button"
                          onClick={() => toggleStreet(street)}
                          className="hover:text-primary-900"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {selectedStreets.length > 5 && (
                      <span className="text-xs text-neutral-500">+{selectedStreets.length - 5} 更多</span>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  <AlertCircle size={14} className="inline mr-1" />
                  状态（多选）
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="select w-full text-left flex items-center justify-between"
                  >
                    <span className={cn(selectedStatuses.length === 0 && 'text-neutral-400')}>
                      {getDisplayValue(selectedStatuses, statusOptions.map(s => ({ label: s.label, value: s.value })), '请选择状态')}
                    </span>
                    <ChevronDown size={16} className="text-neutral-400" />
                  </button>
                  {showStatusDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-sm shadow-lg">
                      <div className="p-2 border-b border-neutral-100 flex justify-between items-center">
                        <span className="text-xs text-neutral-500">共 {statusOptions.length} 个状态</span>
                        <button
                          type="button"
                          onClick={clearStatuses}
                          className="text-xs text-primary-500 hover:text-primary-600"
                        >
                          清空
                        </button>
                      </div>
                      {statusOptions.map(option => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStatuses.includes(option.value)}
                            onChange={() => toggleStatus(option.value)}
                            className="w-4 h-4 text-primary-500 rounded border-neutral-300 focus:ring-primary-500"
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {selectedStatuses.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedStatuses.map(status => (
                      <span
                        key={status}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-sm border',
                          status === PointStatus.CONFIRMED && 'bg-success-50 text-success-700 border-success-100',
                          status === PointStatus.PENDING && 'bg-warning-50 text-warning-700 border-warning-100',
                          status === PointStatus.CONFLICT && 'bg-danger-50 text-danger-700 border-danger-100'
                        )}
                      >
                        {pointStatusLabels[status]}
                        <button
                          type="button"
                          onClick={() => toggleStatus(status)}
                          className="hover:opacity-80"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  <Calendar size={14} className="inline mr-1" />
                  开始日期
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  <Calendar size={14} className="inline mr-1" />
                  结束日期
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">
                  符合条件的数据：<span className="font-semibold text-primary-600">{filteredPoints.length}</span> 条
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearStreets();
                      clearStatuses();
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="btn btn-default text-sm"
                  >
                    重置筛选
                  </button>
                  <button
                    type="button"
                    onClick={handlePreview}
                    className="btn btn-secondary text-sm"
                  >
                    <Eye size={14} className="inline mr-1" />
                    预览数据
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Download size={18} className="text-primary-500" />
              <h2 className="text-lg font-semibold text-neutral-800">导出配置</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  导出字段（多选）
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                    className="select w-full text-left flex items-center justify-between"
                  >
                    <span className={cn(selectedColumns.length === 0 && 'text-neutral-400')}>
                      {getDisplayValue(selectedColumns, exportColumnOptions, '请选择导出字段')}
                    </span>
                    <ChevronDown size={16} className="text-neutral-400" />
                  </button>
                  {showColumnDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-sm shadow-lg max-h-60 overflow-auto">
                      <div className="p-2 border-b border-neutral-100 flex justify-between items-center">
                        <span className="text-xs text-neutral-500">共 {exportColumnOptions.length} 个字段</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={clearColumns}
                            className="text-xs text-neutral-500 hover:text-neutral-700"
                          >
                            清空
                          </button>
                          <button
                            type="button"
                            onClick={selectAllColumns}
                            className="text-xs text-primary-500 hover:text-primary-600"
                          >
                            全选
                          </button>
                        </div>
                      </div>
                      {exportColumnOptions.map(option => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedColumns.includes(option.value)}
                            onChange={() => toggleColumn(option.value)}
                            className="w-4 h-4 text-primary-500 rounded border-neutral-300 focus:ring-primary-500"
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  导出格式
                </label>
                <div className="flex gap-3">
                  <label className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-sm cursor-pointer transition-all',
                    exportFormat === 'xlsx'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  )}>
                    <input
                      type="radio"
                      name="format"
                      value="xlsx"
                      checked={exportFormat === 'xlsx'}
                      onChange={() => setExportFormat('xlsx')}
                      className="sr-only"
                    />
                    <FileSpreadsheet size={18} />
                    <span className="text-sm font-medium">Excel (.xlsx)</span>
                  </label>
                  <label className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-sm cursor-pointer transition-all',
                    exportFormat === 'pdf'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  )}>
                    <input
                      type="radio"
                      name="format"
                      value="pdf"
                      checked={exportFormat === 'pdf'}
                      onChange={() => setExportFormat('pdf')}
                      className="sr-only"
                    />
                    <FileText size={18} />
                    <span className="text-sm font-medium">PDF</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={watermark}
                  onChange={(e) => setWatermark(e.target.checked)}
                  className="w-4 h-4 text-primary-500 rounded border-neutral-300 focus:ring-primary-500"
                />
                <span className="text-sm text-neutral-700">添加"内部资料"水印（仅PDF有效）</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handlePreview}
                className="btn btn-default"
              >
                <Eye size={16} className="inline mr-1" />
                预览
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || filteredPoints.length === 0 || selectedColumns.length === 0}
                className={cn(
                  'btn btn-primary',
                  (exporting || filteredPoints.length === 0 || selectedColumns.length === 0) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline mr-2" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download size={16} className="inline mr-1" />
                    导出数据
                  </>
                )}
              </button>
            </div>
          </div>

          {showPreview && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye size={18} className="text-primary-500" />
                  <h2 className="text-lg font-semibold text-neutral-800">数据预览</h2>
                  <span className="text-sm text-neutral-500">（共 {filteredPoints.length} 条）</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <X size={20} />
                </button>
              </div>

              {filteredPoints.length > 0 ? (
                <div className="overflow-auto max-h-96 border border-neutral-200 rounded-sm">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr>
                        {selectedColumns.map(col => (
                          <th key={col} className="table-header whitespace-nowrap">
                            {getColumnLabel(col)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPoints.slice(0, 100).map((point, idx) => (
                        <tr
                          key={point.id}
                          className={cn(
                            idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'
                          )}
                        >
                          {selectedColumns.map(col => (
                            <td key={col} className="table-cell text-sm">
                              {getPreviewValue(point, col)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPoints.length > 100 && (
                    <div className="text-center py-3 text-sm text-neutral-500 bg-neutral-50 border-t border-neutral-200">
                      仅显示前 100 条数据，完整数据将在导出时包含
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-500">
                  <Filter size={40} className="mx-auto mb-3 text-neutral-300" />
                  <p>暂无符合筛选条件的数据</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-80">
          <div className="card p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-primary-500" />
              <h2 className="text-lg font-semibold text-neutral-800">导出记录</h2>
            </div>

            {exportRecords.length > 0 ? (
              <div className="relative">
                <div className="absolute left-3 top-1 bottom-1 w-px bg-neutral-200" />
                <div className="space-y-4">
                  {exportRecords.map((record, idx) => (
                    <div key={record.id} className="relative pl-8">
                      <div className={cn(
                        'absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white',
                        idx === 0 ? 'bg-primary-500' : 'bg-neutral-400'
                      )} />
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          {record.format === 'xlsx' ? (
                            <FileSpreadsheet size={14} className="text-success-600" />
                          ) : (
                            <FileText size={14} className="text-primary-600" />
                          )}
                          <span className="font-medium text-neutral-800">
                            {record.format.toUpperCase()} 导出
                          </span>
                          {idx === 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-success-600">
                              <CheckCircle size={12} />
                              最新
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 mb-1">
                          {formatDateTime(record.timestamp)}
                        </div>
                        <div className="text-xs text-neutral-600 mb-1">
                          操作人：{record.operator}
                        </div>
                        <div className="text-xs text-neutral-600 mb-1">
                          导出数量：<span className="font-medium text-primary-600">{record.count}</span> 条
                        </div>
                        <div className="text-xs text-neutral-500 bg-neutral-50 px-2 py-1 rounded-sm">
                          {record.filters}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-500">
                <Clock size={32} className="mx-auto mb-2 text-neutral-300" />
                <p className="text-sm">暂无导出记录</p>
                <p className="text-xs text-neutral-400 mt-1">导出数据后将在此显示</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {(showStreetDropdown || showStatusDropdown || showColumnDropdown) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setShowStreetDropdown(false);
            setShowStatusDropdown(false);
            setShowColumnDropdown(false);
          }}
        />
      )}
    </div>
  );
}
