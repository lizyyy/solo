import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, Image, AlertTriangle, CheckCircle, Clock, XCircle, FileX, ChevronRight, Package } from 'lucide-react';
import { useAppStore } from '@/store';
import type { BaseRecord, ImportResult } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import SourceLabel from '@/components/SourceLabel';
import { formatDate } from '@/utils/helpers';

export default function ImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importPackage, confirmImport, isImporting, lastImportResult } = useAppStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      try {
        const result = await importPackage(files);
        const ids = result.records.map(r => r.id);
        setSelectedRecords(new Set(ids));
      } catch (error) {
        console.error('导入失败:', error);
      }
    }
  }, [importPackage]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        const result = await importPackage(files);
        const ids = result.records.map(r => r.id);
        setSelectedRecords(new Set(ids));
      } catch (error) {
        console.error('导入失败:', error);
      }
    }
  };

  const toggleRecordSelection = (id: string) => {
    setSelectedRecords(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmImport = () => {
    if (lastImportResult) {
      const recordsToImport = lastImportResult.records.filter(r => selectedRecords.has(r.id));
      confirmImport(recordsToImport);
      setSelectedRecords(new Set());
    }
  };

  const getIconForFile = (fileName: string) => {
    if (fileName.match(/\.(xlsx|xls|csv)$/i)) {
      return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    }
    if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return <Image className="w-5 h-5 text-blue-600" />;
    }
    if (fileName.endsWith('.zip')) {
      return <Package className="w-5 h-5 text-purple-600" />;
    }
    return <FileX className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">材料包导入</h1>
        <p className="text-slate-500">
          拖拽或点击上传材料包，系统将自动解析并标注异常（晚到/重复/待处理）。
          <span className="ml-2 text-primary-600">支持格式：</span>
          .zip .xlsx .xls .csv .jpg .png
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer
              ${isDragging 
                ? 'border-primary-500 bg-primary-50 scale-[1.02]' 
                : 'border-slate-300 bg-gradient-to-br from-slate-50 to-white hover:border-primary-400 hover:bg-primary-50/30'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".zip,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.gif"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
              <Upload className={`w-10 h-10 text-primary-600 transition-transform ${isDragging ? 'scale-110' : ''}`} />
            </div>
            
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              {isDragging ? '松开以上传文件' : '拖拽文件到此处'}
            </h3>
            <p className="text-slate-500 mb-4">
              或点击选择文件，支持批量上传和压缩包
            </p>
            
            <div className="flex items-center justify-center space-x-4 text-sm text-slate-400">
              <span className="flex items-center">
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                表格文件
              </span>
              <span className="flex items-center">
                <Image className="w-4 h-4 mr-1" />
                巡检照片
              </span>
              <span className="flex items-center">
                <Package className="w-4 h-4 mr-1" />
                压缩包
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h4 className="font-semibold text-slate-800 mb-4">快速指南</h4>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span><strong>放置模型清单：</strong>将车型、VIN、颜色、位置等信息整理到Excel中，列名使用中文或英文均可</span>
              </li>
              <li className="flex items-start">
                <AlertTriangle className="w-4 h-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                <span><strong>晚到附件：</strong>系统自动检测上传时间超过12小时的照片并标注</span>
              </li>
              <li className="flex items-start">
                <XCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                <span><strong>重复项：</strong>基于车型+VIN后6位自动识别重复记录</span>
              </li>
              <li className="flex items-start">
                <Clock className="w-4 h-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <span><strong>待处理：</strong>缺少VIN或位置信息的记录会进入待处理队列</span>
              </li>
            </ul>
          </div>

          {lastImportResult && (
            <div className="card p-5 bg-primary-50 border-primary-200">
              <h4 className="font-semibold text-primary-800 mb-3">本次解析结果</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-white/60 rounded p-2 text-center">
                  <div className="text-xl font-bold text-slate-800">{lastImportResult.totalRecords}</div>
                  <div className="text-slate-500">总记录</div>
                </div>
                <div className="bg-green-50 rounded p-2 text-center">
                  <div className="text-xl font-bold text-green-600">{lastImportResult.normalRecords}</div>
                  <div className="text-green-700">正常</div>
                </div>
                <div className="bg-orange-50 rounded p-2 text-center">
                  <div className="text-xl font-bold text-orange-600">{lastImportResult.lateRecords}</div>
                  <div className="text-orange-700">晚到</div>
                </div>
                <div className="bg-red-50 rounded p-2 text-center">
                  <div className="text-xl font-bold text-red-600">{lastImportResult.duplicateRecords}</div>
                  <div className="text-red-700">重复</div>
                </div>
              </div>
              {lastImportResult.pendingRecords > 0 && (
                <div className="mt-2 bg-yellow-50 rounded p-2 text-center">
                  <div className="text-xl font-bold text-yellow-600">{lastImportResult.pendingRecords}</div>
                  <div className="text-yellow-700 text-sm">待处理</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isImporting && (
        <div className="card p-12 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
          <p className="text-slate-600">正在解析材料包...</p>
        </div>
      )}

      {lastImportResult && !isImporting && (
        <div className="card">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">解析预览</h3>
              {lastImportResult.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {lastImportResult.warnings.map((warning, i) => (
                    <p key={i} className="text-sm text-orange-600 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1.5" />
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-slate-500">
                已选择 {selectedRecords.size} / {lastImportResult.totalRecords} 条
              </span>
              <button
                className="btn btn-secondary text-sm"
                onClick={() => setSelectedRecords(new Set(lastImportResult.records.map(r => r.id)))}
              >
                全选
              </button>
              <button
                className="btn btn-primary text-sm"
                onClick={handleConfirmImport}
                disabled={selectedRecords.size === 0}
              >
                确认导入
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto scrollbar-thin">
            {lastImportResult.records.map((record: BaseRecord, index: number) => (
              <div
                key={record.id}
                className={`p-4 flex items-center space-x-4 hover:bg-slate-50 transition-colors cursor-pointer animate-fade-in-up ${
                  selectedRecords.has(record.id) ? 'bg-primary-50' : ''
                }`}
                style={{ '--stagger-index': index } as React.CSSProperties}
                onClick={() => toggleRecordSelection(record.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedRecords.has(record.id)}
                  onChange={() => toggleRecordSelection(record.id)}
                  className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                />
                
                <div className={`w-1 h-12 rounded-full transition-all ${
                  record.status === 'normal' ? 'bg-green-500' :
                  record.status === 'late' ? 'bg-orange-500' :
                  record.status === 'duplicate' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-1">
                    <h4 className="font-medium text-slate-800">
                      {record.content.carModel || '未命名记录'}
                    </h4>
                    <StatusBadge status={record.status} />
                    <SourceLabel source={record.source} />
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-slate-500">
                    {record.content.vin && (
                      <span className="font-mono">VIN: {record.content.vin.slice(-8)}</span>
                    )}
                    {record.content.position && (
                      <span>展位: {record.content.position}</span>
                    )}
                    <span>{formatDate(record.createdAt)}</span>
                  </div>
                  {record.pendingReason && (
                    <p className="mt-1 text-sm text-yellow-700">
                      ⚠️ {record.pendingReason}
                    </p>
                  )}
                </div>

                {record.attachments.length > 0 && (
                  <div className="flex -space-x-2">
                    {record.attachments.slice(0, 3).map(att => (
                      <div key={att.id} className="relative">
                        {getIconForFile(att.fileName)}
                        {att.isLate && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                    ))}
                    {record.attachments.length > 3 && (
                      <span className="text-xs text-slate-500 ml-1">
                        +{record.attachments.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
