import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  X,
  Play,
  Trash2,
  RefreshCw,
  Layers,
  PlusCircle,
  FileJson,
  ArrowRight,
} from 'lucide-react';
import { useRecordsStore, DuplicateImportOption, EnhancedImportResult } from '@/store/useRecordsStore';
import { CanopyRecord, RecordStatus, ImportPreviewItem } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';

type DuplicateItemKind = 'new' | 'duplicate' | 'reuse_coverable';

interface ExtendedPreviewItem extends ImportPreviewItem {
  kind: DuplicateItemKind;
  existingRecord?: CanopyRecord;
  diffFields?: string[];
}

export default function ImportPage() {
  const navigate = useNavigate();
  const { addRecords, records, clearAllData, importMockData, setCurrentStep, findDuplicateRecords } = useRecordsStore();
  const [previewItems, setPreviewItems] = useState<ExtendedPreviewItem[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importResult, setImportResult] = useState<EnhancedImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateImportOption['mode']>('skip');

  const processFile = (file: File) => {
    setFileName(file.name);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const preview: ExtendedPreviewItem[] = data.map((row, idx) => {
          const communityName = row['小区名称'] || row['communityName'] || '';
          const stationName = row['轨交站'] || row['stationName'] || '';
          const photoDescription = row['照片描述'] || row['photoDescription'] || '';
          const originalRowNumber = idx + 2;

          const existing = findDuplicateRecords(communityName, stationName, originalRowNumber);

          let kind: DuplicateItemKind = 'new';
          let diffFields: string[] = [];

          if (existing) {
            kind = 'reuse_coverable';
            if (existing.photoDescription && existing.photoDescription !== photoDescription) {
              diffFields.push('照片描述');
            }
          }

          return {
            originalRowNumber,
            communityName,
            stationName,
            photoDescription,
            isDuplicate: !!existing,
            existingRecord: existing,
            kind,
            diffFields,
          };
        });
        setPreviewItems(preview);
      },
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [records]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    const newRecords: CanopyRecord[] = previewItems.map((item) => ({
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

    const result = addRecords(newRecords, { mode: duplicateMode });
    setImportResult(result);
  };

  const handleLoadMock = () => {
    clearAllData();
    importMockData();
    setImportResult({
      totalCount: 6,
      newCount: 6,
      duplicateCount: 0,
      reusedCount: 0,
      overwrittenCount: 0,
      reusedRecordIds: [],
      overwrittenRecordIds: [],
      skippedCount: 0,
      batchId: 'mock',
      records: [],
    });
  };

  const simulateReimport = () => {
    if (records.length === 0) {
      alert('请先导入一批数据再测试重复导入');
      return;
    }
    const batchId = Date.now();
    const simulateRecords: CanopyRecord[] = records.slice(0, 4).map((r, idx) => ({
      ...r,
      id: '',
      originalRowNumber: r.originalRowNumber,
      photoDescription: idx === 0
        ? r.photoDescription + '（补拍，细节更清晰）'
        : r.photoDescription,
      importBatchId: '',
      createdAt: '',
      updatedAt: '',
      importFileName: `2024-06-路口照片-补传-${batchId}.csv`,
    }));

    const extraNew: CanopyRecord[] = [
      {
        id: '',
        originalRowNumber: 99,
        communityName: `新增小区-${batchId}`,
        stationName: '世纪大道站',
        photoDescription: '全新路口照片',
        status: RecordStatus.PENDING,
        isSuspectedDuplicateName: false,
        createdAt: '',
        updatedAt: '',
        importBatchId: '',
        importFileName: `2024-06-路口照片-补传-${batchId}.csv`,
      },
      {
        id: '',
        originalRowNumber: 100,
        communityName: `锦绣二期`,
        stationName: '徐家汇站',
        photoDescription: '疑似锦绣家园二期',
        status: RecordStatus.PENDING,
        isSuspectedDuplicateName: false,
        createdAt: '',
        updatedAt: '',
        importBatchId: '',
        importFileName: `2024-06-路口照片-补传-${batchId}.csv`,
      },
    ];

    const allRecords = [...simulateRecords, ...extraNew];

    const extendedPreview: ExtendedPreviewItem[] = allRecords.map((item) => {
      const existing = findDuplicateRecords(
        item.communityName,
        item.stationName,
        item.originalRowNumber
      );
      let kind: DuplicateItemKind = 'new';
      let diffFields: string[] = [];
      if (existing) {
        kind = 'reuse_coverable';
        if (existing.photoDescription !== item.photoDescription) {
          diffFields.push('照片描述');
        }
      }
      return {
        originalRowNumber: item.originalRowNumber,
        communityName: item.communityName,
        stationName: item.stationName,
        photoDescription: item.photoDescription,
        isDuplicate: !!existing,
        existingRecord: existing,
        kind,
        diffFields,
      };
    });

    setFileName(`2024-06-路口照片-补传-${batchId}.csv（模拟）`);
    setPreviewItems(extendedPreview);
    setImportResult(null);
  };

  const counts = {
    total: previewItems.length,
    new: previewItems.filter((i) => i.kind === 'new').length,
    reuse: previewItems.filter((i) => i.kind === 'reuse_coverable').length,
    changed: previewItems.filter((i) => i.diffFields && i.diffFields.length > 0).length,
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">第一步：导入路口照片</h2>
        <p className="text-slate-600">
          系统将自动区分「真新增」与「复用记录」，保留备注原话和历史变更链
        </p>
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
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                选择 CSV 文件
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              <button
                onClick={simulateReimport}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                模拟重复导入同一批（测试用）
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              CSV 列：小区名称、轨交站、照片描述（或英文列名）
            </p>
          </div>

          {previewItems.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
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

              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  重复导入处理模式
                </p>
                <div className="flex gap-3 flex-wrap">
                  <label className="flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors bg-white hover:bg-slate-50 border-slate-200">
                    <input
                      type="radio"
                      name="mode"
                      checked={duplicateMode === 'skip'}
                      onChange={() => setDuplicateMode('skip')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-800">
                        模式一：完全跳过重复（推荐）
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        复用原记录，备注、状态、历史全部保留，不动任何字段
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors bg-white hover:bg-slate-50 border-amber-200">
                    <input
                      type="radio"
                      name="mode"
                      checked={duplicateMode === 'overwrite_keep_history'}
                      onChange={() => setDuplicateMode('overwrite_keep_history')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-medium text-amber-800">
                        模式二：覆盖照片但保留备注
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        只更新照片描述，原话（备注/状态/公交刷卡）不动，历史自动记录覆盖原因
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors bg-white hover:bg-slate-50 border-red-200">
                    <input
                      type="radio"
                      name="mode"
                      checked={duplicateMode === 'overwrite_all'}
                      onChange={() => setDuplicateMode('overwrite_all')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-medium text-red-800">模式三：全部覆盖（慎用）</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        连公交刷卡时段一起覆盖，但备注和状态始终保留并记录历史
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 w-16">
                        行号
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                        小区名称
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                        轨交站
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                        判定结果
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item) => (
                      <tr
                        key={item.originalRowNumber + item.communityName}
                        className={`border-t border-slate-100 ${
                          item.kind === 'new' ? 'bg-green-50/30' : ''
                        } ${
                          item.kind === 'reuse_coverable' &&
                          item.diffFields &&
                          item.diffFields.length > 0
                            ? 'bg-amber-50/40'
                            : ''
                        }`}
                      >
                        <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                          {item.originalRowNumber}
                        </td>
                        <td className="px-4 py-2 text-slate-800">{item.communityName}</td>
                        <td className="px-4 py-2 text-slate-600">{item.stationName}</td>
                        <td className="px-4 py-2">
                          {item.kind === 'new' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
                              <PlusCircle className="w-3 h-3" />
                              真新增
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded">
                                <Layers className="w-3 h-3" />
                                复用记录
                              </span>
                              {item.diffFields && item.diffFields.length > 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                  有差异：{item.diffFields.join('、')}
                                  {duplicateMode !== 'skip' && (
                                    <span className="text-slate-400 ml-1">
                                      → 将按当前模式更新并记历史
                                    </span>
                                  )}
                                </p>
                              )}
                              {item.existingRecord && item.existingRecord.plannerRemark && (
                                <p className="text-xs text-slate-500 mt-1">
                                  已附规划员备注：保留原话，不覆盖
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <span className="text-slate-600">
                    共 <span className="font-bold text-slate-800">{counts.total}</span> 条
                  </span>
                  <span className="text-green-700 flex items-center gap-1">
                    <PlusCircle className="w-3.5 h-3.5" />
                    真新增 <span className="font-bold">{counts.new}</span> 条
                  </span>
                  <span className="text-blue-700 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    复用记录 <span className="font-bold">{counts.reuse}</span> 条
                  </span>
                  {counts.changed > 0 && (
                    <span className="text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      有差异待更新 <span className="font-bold">{counts.changed}</span> 条
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
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-800 text-lg">导入成功</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div className="bg-white/80 rounded-lg p-3 border border-green-100">
                      <p className="text-xs text-slate-500">处理总数</p>
                      <p className="text-xl font-bold text-slate-800">{importResult.totalCount}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <PlusCircle className="w-3 h-3" /> 真新增
                      </p>
                      <p className="text-xl font-bold text-green-700">{importResult.newCount}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> 复用记录
                      </p>
                      <p className="text-xl font-bold text-blue-700">{importResult.reusedCount}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> 覆盖更新
                      </p>
                      <p className="text-xl font-bold text-amber-700">
                        {importResult.overwrittenCount}
                      </p>
                    </div>
                  </div>
                  {importResult.overwrittenCount > 0 && (
                    <p className="mt-3 text-xs text-amber-700 bg-amber-50/60 p-2 rounded border border-amber-200">
                      ⚠️ {importResult.overwrittenCount} 条记录的照片描述已按所选模式更新，
                      <span className="font-semibold">备注/状态/公交刷卡均保留原话</span>，
                      变更原因「重复导入覆盖」已写入历史，可在详情页或历史溯源页回滚。
                    </p>
                  )}
                  {importResult.reusedCount > 0 && importResult.overwrittenCount === 0 && (
                    <p className="mt-3 text-xs text-blue-700 bg-blue-50/60 p-2 rounded border border-blue-200">
                      ℹ️ {importResult.reusedCount} 条复用记录的{' '}
                      <span className="font-semibold">规划员备注、状态、公交刷卡时段已全部保留</span>，
                      总数不会翻倍。可在工作区打开记录查看历史变化。
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setCurrentStep('bus_check' as any);
                  navigate('/workspace');
                }}
                className="mt-5 w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                进入下一步：补看公交刷卡时段
                <ArrowRight className="w-4 h-4" />
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
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">有历史变更</span>
                <span className="font-semibold text-blue-600">
                  {
                    new Set(
                      useRecordsStore.getState().history.map((h) => h.recordId)
                    ).size
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
            <h3 className="font-semibold text-blue-800 mb-2">边界规则说明</h3>
            <ul className="text-xs text-blue-700 space-y-1.5">
              <li>
                • <span className="font-semibold">同一小区新旧名</span>：自动检测并标「待复核」，
                <span className="underline">绝不自动归正常</span>
              </li>
              <li>
                • <span className="font-semibold">重复导入</span>：按(小区+轨交站+行号)三元组识别复用，
                总数不翻倍
              </li>
              <li>
                • <span className="font-semibold">备注保护</span>：任何模式都不覆盖规划员/巡检员原话，
                覆盖时自动记历史
              </li>
              <li>
                • <span className="font-semibold">回滚闭环</span>：每次回滚本身也记录历史，
                从哪来回哪去全程可解释
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
