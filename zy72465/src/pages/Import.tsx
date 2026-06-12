import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useAppStore } from '@/store/useAppStore';
import { NameConflictTag, StatusTag } from '@/components/StatusTag';
import { STATUS_LABELS } from '@/types';

interface ImportPreview {
  originalLineNumber: number;
  communityOldName?: string;
  communityNewName?: string;
  rampExists: boolean;
  rampLocation: string;
  rampCondition: string;
  hasConflict: boolean;
}

export default function ImportPage() {
  const navigate = useNavigate();
  const { importBatchRecords, currentUser, resetAllRecords } = useAppStore();
  
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<{ batchId: string; count: number; conflictCount: number; newRecordIds: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setImportResult(null);
    
    const reader = new FileReader();
    
    if (file.name.endsWith('.csv')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        Papa.parse(text, {
          header: true,
          complete: (results) => {
            processData(results.data as Record<string, string>[]);
          },
        });
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, string>[];
        processData(jsonData);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const processData = (data: Record<string, string>[]) => {
    const nameMap = new Map<string, number[]>();
    
    const previewData: ImportPreview[] = data.map((row, idx) => {
      const oldName = row['小区旧名称'] || row['old_name'] || '';
      const newName = row['小区新名称'] || row['new_name'] || row['小区名称'] || '';
      const address = row['地址'] || row['address'] || `${oldName}${newName}`;
      
      const lineNumber = idx + 2;
      
      if (address) {
        const existing = nameMap.get(address) || [];
        nameMap.set(address, [...existing, lineNumber]);
      }
      
      return {
        originalLineNumber: lineNumber,
        communityOldName: oldName || undefined,
        communityNewName: newName || undefined,
        rampExists: (row['有无障碍坡道'] || row['ramp_exists']) === '有' || (row['有无障碍坡道'] || row['ramp_exists']) === 'true',
        rampLocation: row['坡道位置'] || row['ramp_location'] || '',
        rampCondition: row['坡道状况'] || row['ramp_condition'] || '',
        hasConflict: false,
      };
    });
    
    const conflictLines = new Set<number>();
    nameMap.forEach((lines) => {
      if (lines.length >= 2) {
        lines.forEach(l => conflictLines.add(l));
      }
    });
    
    const previewWithConflict = previewData.map(item => ({
      ...item,
      hasConflict: conflictLines.has(item.originalLineNumber) || 
        (item.communityOldName && item.communityNewName && item.communityOldName !== item.communityNewName),
    }));
    
    setPreview(previewWithConflict);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    const result = importBatchRecords(preview);
    setImportResult({
      batchId: result.batchId,
      count: preview.length,
      conflictCount: result.conflictCount,
      newRecordIds: result.newRecordIds,
    });
  };

  const handleLoadDemoData = () => {
    resetAllRecords();
    const demoData: ImportPreview[] = [
      { originalLineNumber: 2, communityOldName: '翠园小区', communityNewName: '翠园社区', rampExists: true, rampLocation: '东门入口', rampCondition: '完好', hasConflict: true },
      { originalLineNumber: 3, communityNewName: '海棠花园', rampExists: true, rampLocation: '南门右侧', rampCondition: '轻微破损', hasConflict: false },
      { originalLineNumber: 4, communityOldName: '卫东村', communityNewName: '卫东花园', rampExists: false, rampLocation: '', rampCondition: '', hasConflict: true },
      { originalLineNumber: 5, communityNewName: '紫荆苑', rampExists: true, rampLocation: '正门口', rampCondition: '完好', hasConflict: false },
    ];
    setPreview(demoData);
    setFileName('【演示】无障碍坡道导入记录.xlsx');
    setImportResult(null);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: 'Source Han Serif SC, serif' }}
          >
            数据导入
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            第一步：导入无障碍坡道记录，系统自动检测同一小区新旧名称冲突，保留原始行号和完整链路
          </p>
        </div>
        <button
          onClick={handleLoadDemoData}
          className="px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          加载演示数据（含新旧名称冲突）
        </button>
      </div>

      {importResult ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-green-800 text-center">导入成功</h3>
          <div className="mt-4 space-y-2 text-sm text-green-700 bg-white rounded-lg p-4 border border-green-100">
            <div className="flex justify-between">
              <span>操作人：</span>
              <span className="font-medium">{currentUser.name}（{currentUser.role === 'aning' ? '城更项目经理' : '市政巡检员'}）</span>
            </div>
            <div className="flex justify-between">
              <span>导入批次号：</span>
              <span className="font-mono font-medium">{importResult.batchId}</span>
            </div>
            <div className="flex justify-between">
              <span>导入记录数：</span>
              <span className="font-medium">{importResult.count} 条</span>
            </div>
            <div className="flex justify-between">
              <span>新旧名称冲突：</span>
              <span className={`font-medium ${importResult.conflictCount > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                {importResult.conflictCount > 0 ? `${importResult.conflictCount} 条，已标记待巡检员复核，不急着归正常` : '0 条'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>初始状态：</span>
              <span className="font-medium">
                无冲突 → {STATUS_LABELS['imported']}，有冲突 → {STATUS_LABELS['pending_review']}
              </span>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setPreview([]);
                setFileName('');
                setImportResult(null);
              }}
              className="px-5 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              继续导入
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              去审批工作台，继续走第二步
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
              isDragging 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-lg font-medium text-gray-700">
              拖拽文件到这里，或点击选择
            </p>
            <p className="mt-2 text-sm text-gray-400">
              支持 CSV、Excel 格式，需包含：小区旧名称/新名称、有无障碍坡道、坡道位置、坡道状况
            </p>
          </div>

          {preview.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">{fileName}</h3>
                    <p className="text-xs text-gray-500">共 {preview.length} 条记录</p>
                  </div>
                </div>
                <button
                  onClick={handleImport}
                  className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors shadow-sm"
                >
                  确认导入（保留原始行号）
                </button>
              </div>

              <div className={`m-4 rounded-lg p-4 border ${
                preview.filter(p => p.hasConflict).length > 0
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                    preview.filter(p => p.hasConflict).length > 0 ? 'text-amber-500' : 'text-green-500'
                  }`} />
                  <div>
                    <p className={`text-sm font-medium ${
                      preview.filter(p => p.hasConflict).length > 0 ? 'text-amber-800' : 'text-green-800'
                    }`}>
                      连续状态链路预览
                    </p>
                    <p className={`text-xs mt-1 ${
                      preview.filter(p => p.hasConflict).length > 0 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      检测到 <span className="font-bold">{preview.filter(p => p.hasConflict).length}</span> 条同一小区新旧名称冲突。
                      导入后链路：<span className="font-mono bg-white px-1.5 py-0.5 rounded border">create（原始行号永久保留）</span>
                      → 冲突记录额外 <span className="font-mono bg-white px-1.5 py-0.5 rounded border">update_status → pending_review</span>
                      （留给巡检员复核）
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium whitespace-nowrap">原始行号</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium whitespace-nowrap">小区名称</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium whitespace-nowrap">无障碍坡道</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium whitespace-nowrap">导入后的初始状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((item) => (
                      <tr key={item.originalLineNumber}>
                        <td className="py-3 px-4">
                          <span className="font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded">#{item.originalLineNumber}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 font-medium">
                                {item.communityNewName || item.communityOldName}
                              </span>
                              <NameConflictTag hasConflict={item.hasConflict} />
                            </div>
                            {item.communityOldName && item.communityNewName && (
                              <p className="text-xs text-gray-400">
                                旧称: {item.communityOldName} → 新称: {item.communityNewName}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          <div>
                            {item.rampExists ? (
                              <span className="text-green-600 font-medium">有</span>
                            ) : (
                              <span className="text-red-500 font-medium">无</span>
                            )}
                            {item.rampLocation && <span className="ml-1 text-gray-400">（{item.rampLocation}）</span>}
                          </div>
                          {item.rampCondition && (
                            <p className="text-xs text-gray-400 mt-0.5">状况：{item.rampCondition}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <StatusTag status={item.hasConflict ? 'pending_review' : 'imported'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
