import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useAppStore } from '@/store/useAppStore';
import { NameConflictTag } from '@/components/StatusTag';
import type { ApprovalRecord } from '@/types';

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
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setImportSuccess(false);
    
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
    const { records: existingRecords } = useAppStore.getState();
    const maxId = existingRecords.reduce((max, r) => {
      const num = parseInt(r.id.replace('rec-', ''));
      return num > max ? num : max;
    }, 0);
    
    const newRecords: ApprovalRecord[] = preview.map((item, idx) => ({
      id: `rec-${String(maxId + idx + 1).padStart(3, '0')}`,
      originalLineNumber: item.originalLineNumber,
      communityOldName: item.communityOldName,
      communityNewName: item.communityNewName,
      hasNameConflict: item.hasConflict,
      rampRecord: {
        exists: item.rampExists,
        location: item.rampLocation,
        condition: item.rampCondition,
        source: 'import' as const,
      },
      status: item.hasConflict ? 'pending_review' : 'imported',
      currentStep: 1,
      assignee: item.hasConflict ? 'inspector' : 'aning',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    useAppStore.setState(state => ({
      records: [...state.records, ...newRecords],
    }));
    
    setImportSuccess(true);
    setTimeout(() => {
      setPreview([]);
      setFileName('');
    }, 2000);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: 'Source Han Serif SC, serif' }}
        >
          数据导入
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          第一步：导入无障碍坡道记录，系统自动检测新旧名称冲突
        </p>
      </div>

      {importSuccess ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-green-800">导入成功</h3>
          <p className="mt-2 text-sm text-green-600">
            共导入 {preview.length} 条记录，已添加到审批工作台
          </p>
        </div>
      ) : (
        <>
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
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
              支持 CSV、Excel 格式，需包含小区名称、坡道信息等字段
            </p>
          </div>

          {preview.length > 0 && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
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
                    确认导入
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">冲突检测结果</p>
                      <p className="text-xs text-amber-600 mt-1">
                        检测到 {preview.filter(p => p.hasConflict).length} 条记录存在新旧名称冲突，导入后将自动标记为「待巡检员复核」，不自动合并
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">原始行号</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">小区名称</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">无障碍坡道</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.slice(0, 10).map((item) => (
                        <tr key={item.originalLineNumber}>
                          <td className="py-3 px-4 font-mono text-gray-500">#{item.originalLineNumber}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900">
                                {item.communityNewName || item.communityOldName}
                              </span>
                              {item.hasConflict && <NameConflictTag hasConflict={true} />}
                            </div>
                            {item.communityOldName && item.communityNewName && (
                              <p className="text-xs text-gray-400 mt-1">
                                旧称: {item.communityOldName}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {item.rampExists ? '有' : '无'}
                            {item.rampLocation && ` (${item.rampLocation})`}
                          </td>
                          <td className="py-3 px-4">
                            {item.hasConflict ? (
                              <span className="text-amber-600 text-xs">待复核</span>
                            ) : (
                              <span className="text-green-600 text-xs">正常</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 10 && (
                    <p className="text-xs text-gray-400 text-center py-3">
                      仅显示前 10 条，共 {preview.length} 条
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
