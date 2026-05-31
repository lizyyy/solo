import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, X, Trash2, Copy } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { useAppStore } from '../store';
import { ImportedFile, PlayerFeedback } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export default function ImportPage() {
  const { importedFiles, addImportedFile, updateImportedFile, feedbacks, addFeedback, markDuplicate, deleteFeedback } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ImportedFile | null>(null);

  const processFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: reject,
        });
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(firstSheet));
        };
        reader.readAsArrayBuffer(file);
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (fileName.endsWith('.json')) {
            resolve(JSON.parse(text));
          } else {
            resolve([{ content: text, fileName: file.name }]);
          }
        };
        reader.readAsText(file);
      } else {
        resolve([{ fileName: file.name, note: '二进制文件已记录，内容需手动解析' }]);
      }
    });
  };

  const detectDuplicates = (newData: any[]): { data: any[]; duplicates: any[] } => {
    const existingContents = feedbacks.map(f => f.content.toLowerCase());
    const data: any[] = [];
    const duplicates: any[] = [];
    const seenInBatch = new Set<string>();

    newData.forEach((item, index) => {
      const content = item.content || item.feedback || item.message || JSON.stringify(item);
      const contentKey = content.toLowerCase().trim();
      
      if (seenInBatch.has(contentKey) || existingContents.includes(contentKey)) {
        duplicates.push({ ...item, _index: index, _reason: '内容重复' });
      } else {
        seenInBatch.add(contentKey);
        data.push({ ...item, _index: index });
      }
    });

    return { data, duplicates };
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    
    for (const file of files) {
      const fileId = generateId();
      const importedFile: ImportedFile = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadTime: new Date().toISOString(),
        status: 'processing',
      };
      
      addImportedFile(importedFile);

      try {
        const data = await processFile(file);
        const { data: uniqueData, duplicates } = detectDuplicates(data);
        
        updateImportedFile(fileId, {
          status: 'completed',
          data: uniqueData,
          errors: duplicates.length > 0 
            ? [`检测到 ${duplicates.length} 条重复数据已自动过滤`] 
            : undefined,
        });

        uniqueData.forEach((item: any) => {
          const feedback: Omit<PlayerFeedback, 'id'> = {
            playerId: item.playerId || item.id || item.userId || '未知',
            playerName: item.playerName || item.name || item.player || '未知玩家',
            content: item.content || item.feedback || item.message || JSON.stringify(item),
            timestamp: item.timestamp || item.time || item.date || new Date().toISOString(),
            source: 'file',
            status: 'pending',
          };
          addFeedback(feedback);
        });
      } catch (error) {
        updateImportedFile(fileId, {
          status: 'error',
          errors: [`解析失败: ${(error as Error).message}`],
        });
      }
    }
  }, [addImportedFile, updateImportedFile, feedbacks, addFeedback]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const viewPreview = (file: ImportedFile) => {
    setSelectedFile(file);
    setPreviewData(file.data || []);
    setShowPreview(true);
  };

  const pendingCount = feedbacks.filter(f => f.status === 'pending').length;
  const duplicateCount = feedbacks.filter(f => f.isDuplicate).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">数据导入</h1>
          <p className="text-slate-400 text-sm mt-1">上传玩家反馈、掉落配置、活动记录等材料</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle size={16} />
            <span>待确认: {pendingCount}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Copy size={16} />
            <span>重复项: {duplicateCount}</span>
          </div>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
          isDragging
            ? 'border-orange-500 bg-orange-500/10'
            : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="mx-auto mb-4 text-slate-400" size={48} />
        <p className="text-lg text-slate-200 font-medium">拖拽文件到此处或点击上传</p>
        <p className="text-sm text-slate-500 mt-2">支持 Excel、CSV、TXT、JSON、截图文件</p>
        <p className="text-xs text-slate-600 mt-1">系统自动去重、识别晚到附件、标记人工更正</p>
      </div>

      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-medium text-slate-300">已上传文件</h2>
        </div>
        <div className="divide-y divide-slate-700">
          {importedFiles.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <FileText size={32} className="mx-auto mb-2 opacity-50" />
              <p>暂无上传记录</p>
            </div>
          ) : (
            importedFiles.map((file) => (
              <div key={file.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-700/50">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-200">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(file.uploadTime).toLocaleString()} · {(file.size / 1024).toFixed(1)}KB
                    </p>
                    {file.errors && file.errors.length > 0 && (
                      <p className="text-xs text-amber-400 mt-1">{file.errors[0]}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {file.status === 'completed' && (
                    <CheckCircle size={16} className="text-emerald-400" />
                  )}
                  {file.status === 'processing' && (
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {file.status === 'error' && (
                    <X size={16} className="text-red-400" />
                  )}
                  {file.data && file.data.length > 0 && (
                    <button
                      onClick={() => viewPreview(file)}
                      className="text-xs text-orange-400 hover:text-orange-300"
                    >
                      预览 {file.data.length} 条
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-slate-200">数据预览 - {selectedFile?.name}</h3>
              <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    {previewData[0] && Object.keys(previewData[0]).filter(k => !k.startsWith('_')).map((key) => (
                      <th key={key} className="text-left py-2 px-3 text-slate-400 font-medium">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      {Object.entries(row).filter(([k]) => !k.startsWith('_')).map(([_, value], j) => (
                        <td key={j} className="py-2 px-3 text-slate-300 truncate max-w-xs">
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 50 && (
                <p className="text-center text-slate-500 text-sm mt-4">仅显示前50条，共 {previewData.length} 条</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
