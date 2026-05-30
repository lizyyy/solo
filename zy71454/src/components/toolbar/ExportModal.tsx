import { useState } from 'react';
import { X, FileText, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import usePianoStore from '../../store/usePianoStore';

interface ExportModalProps {
  onClose: () => void;
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const { getFilteredKeys, keys, filters, selectedKey } = usePianoStore();
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  const filteredKeys = getFilteredKeys();
  const isFiltered = filteredKeys.length !== keys.length;

  const handleExportExcel = () => {
    setExporting(true);
    
    setTimeout(() => {
      const exportData = filteredKeys.map(key => ({
        '键号': key.keyNumber,
        '音名': key.noteName,
        '类型': key.isBlack ? '黑键' : '白键',
        '下压力(g)': key.pressure,
        '回弹时间(ms)': key.reboundTime,
        '状态': key.status === 'normal' ? '正常' : key.status === 'warning' ? '警告' : '异常',
        '八度': key.octave,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '钢琴键盘数据');
      
      ws['!cols'] = [
        { wch: 8 }, { wch: 10 }, { wch: 8 },
        { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 8 }
      ];

      XLSX.writeFile(wb, `钢琴键盘力反馈数据_${new Date().toLocaleDateString('zh-CN')}.xlsx`);
      
      setExporting(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }, 500);
  };

  const handleExportCSV = () => {
    setExporting(true);
    
    setTimeout(() => {
      const headers = ['键号', '音名', '类型', '下压力(g)', '回弹时间(ms)', '状态', '八度'];
      const rows = filteredKeys.map(key => [
        key.keyNumber,
        key.noteName,
        key.isBlack ? '黑键' : '白键',
        key.pressure,
        key.reboundTime,
        key.status === 'normal' ? '正常' : key.status === 'warning' ? '警告' : '异常',
        key.octave,
      ]);

      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `钢琴键盘力反馈数据_${new Date().toLocaleDateString('zh-CN')}.csv`;
      link.click();
      
      setExporting(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-100">导出数据</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">导出范围</span>
              {isFiltered && (
                <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                  已筛选
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-zinc-100">
              {filteredKeys.length} <span className="text-sm font-normal text-zinc-500">/ {keys.length} 键</span>
            </div>
            {isFiltered && (
              <div className="mt-2 text-xs text-zinc-500">
                <div>键号: {filters.keyRange[0]} - {filters.keyRange[1]}</div>
                <div>压力: {filters.pressureRange[0]}g - {filters.pressureRange[1]}g</div>
                {filters.status.length > 0 && (
                  <div>状态: {filters.status.map(s => s === 'normal' ? '正常' : s === 'warning' ? '警告' : '异常').join(', ')}</div>
                )}
              </div>
            )}
          </div>

          {selectedKey && (
            <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <span className="text-orange-400 font-bold text-sm">#{selectedKey}</span>
              </div>
              <div>
                <div className="text-sm text-zinc-200">当前选中键</div>
                <div className="text-xs text-zinc-500">导出数据包含该键的完整信息</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-3 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all disabled:opacity-50 group"
            >
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                <FileSpreadsheet size={20} className="text-green-400" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-medium text-zinc-200">导出 Excel</div>
                <div className="text-xs text-zinc-500">包含完整格式和列宽设置</div>
              </div>
              {success && <CheckCircle2 size={20} className="text-green-400" />}
            </button>

            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-3 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all disabled:opacity-50 group"
            >
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                <FileText size={20} className="text-blue-400" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-medium text-zinc-200">导出 CSV</div>
                <div className="text-xs text-zinc-500">通用格式，可导入其他系统</div>
              </div>
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-zinc-700">
          <p className="text-xs text-zinc-500 text-center">
            导出范围与屏幕可见范围保持一致，确保数据连贯性
          </p>
        </div>
      </div>
    </div>
  );
}
