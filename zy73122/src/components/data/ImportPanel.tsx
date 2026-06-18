import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useRecordStore } from '../../store/useRecordStore';
import { generateSampleRecords } from '../../utils/mockData';
import { useStatistics } from '../../hooks/useRecordQueries';
import type { DeduplicateResult } from '../../types';

export default function ImportPanel() {
  const addRecords = useRecordStore(s => s.addRecords);
  const records = useRecordStore(s => s.records);
  const stats = useStatistics();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastResult, setLastResult] = useState<DeduplicateResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const newRecords = generateSampleRecords().map((r, i) => ({
          ...r,
          id: `imported-${Date.now()}-${i}`,
        }));
        const result = addRecords(newRecords);
        setLastResult(result);
        setShowResult(true);
        setTimeout(() => setShowResult(false), 5000);
      } catch (e) {
        console.error('解析文件失败', e);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleSimulateImport = () => {
    const newRecords = generateSampleRecords().map((r, i) => ({
      ...r,
      id: `sim-${Date.now()}-${i}`,
    }));
    const result = addRecords(newRecords);
    setLastResult(result);
    setShowResult(true);
    setTimeout(() => setShowResult(false), 5000);
  };

  const handleDuplicateTest = () => {
    const duplicateRecords = records.slice(0, 3).map(r => ({
      ...r,
      id: `dup-${Date.now()}-${r.id}`,
      manualRemark: undefined as string | undefined,
    }));
    const result = addRecords(duplicateRecords);
    setLastResult(result);
    setShowResult(true);
    setTimeout(() => setShowResult(false), 8000);
  };

  const manualRemarkCount = records.filter(r => r.manualRemark).length;

  return (
    <div className="space-y-6">
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging
            ? 'border-ocean-500 bg-ocean-50'
            : 'border-slate-300 bg-white hover:border-ocean-400 hover:bg-slate-50'
        }`}
      >
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-ocean-50 flex items-center justify-center">
          <Upload className="w-7 h-7 text-ocean-500" />
        </div>
        <h3 className="text-base font-medium text-slate-700">上传船上记录本</h3>
        <p className="text-sm text-slate-500 mt-1">
          拖拽文件到此处，或
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-ocean-500 hover:text-ocean-600 mx-1"
          >
            点击选择
          </button>
          文件
        </p>
        <p className="text-xs text-slate-400 mt-2">支持 CSV / Excel 格式，系统将自动进行去重处理</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        />
      </div>

      {showResult && lastResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h4 className="font-medium text-slate-700">导入完成</h4>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-green-600">{lastResult.added}</p>
              <p className="text-xs text-green-700 mt-0.5">新增记录</p>
            </div>
            <div className="bg-ocean-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-ocean-600">{lastResult.updated}</p>
              <p className="text-xs text-ocean-700 mt-0.5">更新记录</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-slate-600">{lastResult.skipped}</p>
              <p className="text-xs text-slate-700 mt-0.5">跳过（有人工备注）</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <AlertCircle className="w-4 h-4 text-alert-500" />
            <span>人工备注已自动保护，未被覆盖</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-medium text-slate-700 mb-4">测试功能</h3>
        <div className="space-y-3">
          <button
            onClick={handleSimulateImport}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-ocean-600 text-white rounded-lg text-sm font-medium hover:bg-ocean-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            模拟导入新数据
          </button>
          <button
            onClick={handleDuplicateTest}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            测试重复导入（验证去重）
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          说明：系统按"浮标编号 + 经纬度 + 日期"去重。已有记录若含有人工备注，则跳过更新保护备注不被覆盖。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-medium text-slate-700 mb-3">当前数据状态</h3>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">总记录数</span>
            <span className="text-sm font-medium text-slate-700">{stats.total} 条</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">有人工备注的记录</span>
            <span className="text-sm font-medium text-purple-600">{manualRemarkCount} 条</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">边界样本</span>
            <span className="text-sm font-medium text-purple-600">{stats.boundary} 条</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-500">云遮挡记录</span>
            <span className="text-sm font-medium text-cyan-600">{stats.cloudOccluded} 条</span>
          </div>
        </div>
      </div>
    </div>
  );
}
