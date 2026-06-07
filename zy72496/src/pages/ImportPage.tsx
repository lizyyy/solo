import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, Play, Trash2 } from 'lucide-react';
import { useRecordsStore } from '@/store/useRecordsStore';
import { CanopyRecord, RecordStatus, ImportPreviewItem } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';

export default function ImportPage() {
  const navigate = useNavigate();
  const { addRecords, records, clearAllData, importMockData, setCurrentStep } = useRecordsStore();
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importResult, setImportResult] = useState<{
    totalCount: number;
    newCount: number;
    duplicateCount: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [records]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const preview: ImportPreviewItem[] = data.map((row, idx) => {
          const communityName = row['小区名称'] || row['communityName'] || '';
          const stationName = row['轨交站'] || row['stationName'] || '';
          const photoDescription = row['照片描述'] || row['photoDescription'] || '';

          const isDuplicate = records.some(
            (r) =>
              r.communityName === communityName &&
              r.stationName === stationName &&
              r.originalRowNumber === idx + 2
          );

          return {
            originalRowNumber: idx + 2,
            communityName,
            stationName,
            photoDescription,
            isDuplicate,
          };
        });
        setPreviewItems(preview);
      },
    });
  };

  const handleImport = () => {
    const newRecords: CanopyRecord[] = previewItems
      .filter((item) => !item.isDuplicate)
      .map((item) => ({
        id: '',
        originalRowNumber: item.originalRowNumber,
        communityName: item.communityName,
        stationName: item.stationName,
        photoDescription: item.photoDescription,
        status: RecordStatus.PENDING,
        isSuspectedDuplicateName: false,
        createdAt: '',
        updatedAt: '',
        importBatchId: '',
        importFileName: fileName,
      }));

    const result = addRecords(newRecords);
    setImportResult({
      totalCount: result.totalCount,
      newCount: result.newCount,
      duplicateCount: result.duplicateCount,
    });
  };

  const handleLoadMock = () => {
    importMockData();
    setImportResult({
      totalCount: 6,
      newCount: 6,
      duplicateCount: 0,
    });
  };

  const duplicateCount = previewItems.filter((i) => i.isDuplicate).length;
  const newCount = previewItems.length - duplicateCount;

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">第一步：导入路口照片</h2>
        <p className="text-slate-600">上传 CSV 文件，系统将自动去重并检测疑似同名小区</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
                : 'border-slate-300 bg-white hover:border-slate-400'
            }`}
          >
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-700 font-medium mb-2">拖拽 CSV 文件到此处</p>
            <p className="text-slate-500 text-sm mb-4">或点击下方按钮选择文件</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
              <FileSpreadsheet className="w-4 h-4" />
              选择文件
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            <p className="text-xs text-slate-400 mt-4">
              CSV 需包含列：小区名称、轨交站、照片描述（或英文列名）
            </p>
          </div>

          {fileName && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-700">{fileName}</span>
                </div>
                <button
                  onClick={() => {
                    setPreviewItems([]);
                    setFileName('');
                    setImportResult(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">行号</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">小区名称</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">轨交站</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item) => (
                      <tr key={item.originalRowNumber} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                          {item.originalRowNumber}
                        </td>
                        <td className="px-4 py-2 text-slate-800">{item.communityName}</td>
                        <td className="px-4 py-2 text-slate-600">{item.stationName}</td>
                        <td className="px-4 py-2">
                          {item.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              重复，将跳过
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="w-3 h-3" />
                              新增
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-600">
                    共 <span className="font-bold text-slate-800">{previewItems.length}</span> 条
                  </span>
                  <span className="text-green-600">
                    新增 <span className="font-bold">{newCount}</span> 条
                  </span>
                  {duplicateCount > 0 && (
                    <span className="text-amber-600">
                      重复 <span className="font-bold">{duplicateCount}</span> 条
                    </span>
                  )}
                </div>
                <button
                  onClick={handleImport}
                  disabled={previewItems.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Play className="w-4 h-4" />
                  确认导入
                </button>
              </div>
            </div>
          )}

          {importResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">导入成功</p>
                  <p className="text-sm text-green-700">
                    共处理 {importResult.totalCount} 条，新增 {importResult.newCount} 条，跳过重复{' '}
                    {importResult.duplicateCount} 条
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCurrentStep('bus_check' as any);
                  navigate('/workspace');
                }}
                className="mt-4 w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                进入下一步：补看公交刷卡时段
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">快捷操作</h3>
            <button
              onClick={handleLoadMock}
              className="w-full py-2.5 mb-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              加载示例数据（演示用）
            </button>
            <button
              onClick={clearAllData}
              className="w-full py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              清空所有数据
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">当前数据统计</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">总记录数</span>
                <span className="font-semibold text-slate-800">{records.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">待复核</span>
                <span className="font-semibold text-amber-600">
                  {records.filter((r) => r.status === 'reviewing').length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">疑似同名</span>
                <span className="font-semibold text-amber-600">
                  {records.filter((r) => r.isSuspectedDuplicateName).length}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
            <h3 className="font-semibold text-blue-800 mb-2">边界规则说明</h3>
            <ul className="text-xs text-blue-700 space-y-1.5">
              <li>• 同一小区新旧名称自动检测，标记为"待复核"</li>
              <li>• 重复导入自动去重，不会增加总数</li>
              <li>• 疑似同名不自动归为正常，需巡检员复核</li>
              <li>• 所有字段修改都保留历史，支持回滚</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
