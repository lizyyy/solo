import { useState, useRef } from 'react';
import { Upload, Trash2, Search, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { importFromFile, type ImportResult } from '@/services/ImportService';
import { showToast } from '@/utils/errorMessageUtils';

export default function BusTimeManagement() {
  const { busTimeSlots, addBusTimeSlots, deleteBusTimeSlot, currentUser } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const filteredSlots = busTimeSlots.filter(
    (slot) =>
      slot.routeName.includes(searchQuery) ||
      slot.date.includes(searchQuery) ||
      slot.startTime.includes(searchQuery)
  );

  const handleFileSelect = async (file: File) => {
    const result = await importFromFile(file, busTimeSlots);
    setImportResult(result);
    setShowPreview(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleConfirmImport = () => {
    if (importResult && importResult.data.length > 0) {
      addBusTimeSlots(importResult.data);
      showToast(`成功导入 ${importResult.newCount} 条数据`, 'success');
    }
    setShowPreview(false);
    setImportResult(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条时段记录吗？')) {
      deleteBusTimeSlot(id);
      showToast('删除成功', 'success');
    }
  };

  const handleDownloadTemplate = () => {
    const template = 'routeName,date,startTime,endTime,passengerCount\n1路,2026-06-08,06:00,06:30,50\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '公交刷卡时段模板.csv';
    link.click();
    showToast('模板下载成功', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-serif">公交刷卡时段管理</h2>
          <p className="text-slate-500 mt-1">导入和管理公交刷卡时段数据，自动去重不翻倍</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <FileSpreadsheet size={18} />
            下载模板
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Upload size={18} />
            导入数据
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-200 bg-white hover:border-blue-300'
        }`}
      >
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Upload size={32} className="text-blue-600" />
        </div>
        <p className="text-slate-700 font-medium">拖拽文件到此处，或点击上方导入按钮</p>
        <p className="text-slate-400 text-sm mt-2">支持 Excel (.xlsx, .xls) 和 CSV 格式</p>
        {importResult && importResult.duplicateCount > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm">
            <AlertCircle size={16} />
            上次导入跳过了 {importResult.duplicateCount} 条重复数据
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索线路、日期、时间..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg w-72 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <span className="text-sm text-slate-500">共 {filteredSlots.length} 条记录</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  线路名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  日期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  开始时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  结束时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  客流数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  关联点位
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSlots.map((slot) => (
                <tr key={slot.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-slate-800">{slot.routeName}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">{slot.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">{slot.startTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">{slot.endTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                      {slot.passengerCount} 人
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-sm">
                    {slot.relatedPointIds.length} 个
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {currentUser?.role !== 'staff' && (
                      <button
                        onClick={() => handleDelete(slot.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPreview && importResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">导入预览</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              {importResult.errors.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 font-medium mb-2">导入警告：</p>
                  <ul className="text-red-600 text-sm space-y-1">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mb-4 flex gap-4">
                <div className="flex-1 p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.newCount}</p>
                  <p className="text-green-700 text-sm">新增数据</p>
                </div>
                <div className="flex-1 p-4 bg-amber-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-600">{importResult.duplicateCount}</p>
                  <p className="text-amber-700 text-sm">跳过重复</p>
                </div>
              </div>
              {importResult.data.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">新增数据预览：</p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left">线路</th>
                          <th className="px-3 py-2 text-left">日期</th>
                          <th className="px-3 py-2 text-left">时段</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.data.slice(0, 5).map((slot, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-2">{slot.routeName}</td>
                            <td className="px-3 py-2">{slot.date}</td>
                            <td className="px-3 py-2">
                              {slot.startTime} - {slot.endTime}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importResult.newCount === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
