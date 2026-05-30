import { useState, useRef, useCallback } from 'react';
import { Upload, Download, FileJson, FileSpreadsheet, Filter, CheckCircle, X } from 'lucide-react';
import { useStore } from '@/store';
import type { Preset, KeyboardModel, PedalMapping, ExportFormat } from '@/types';
import { exportData } from '@/utils/export';

interface ImportedItem {
  type: 'preset' | 'model' | 'mapping';
  data: Omit<Preset, 'id' | 'importedAt' | 'status'> | Omit<KeyboardModel, 'id' | 'addedAt'> | Omit<PedalMapping, 'id' | 'importedAt' | 'isActive'>;
  name: string;
  version: string;
}

const PAGE_SIZE = 10;

export default function ImportExport() {
  const {
    filters,
    setFilters,
    resetFilters,
    getFilteredPresets,
    getFilteredModels,
    getFilteredMappings,
    addPreset,
    addModel,
    addMapping,
  } = useStore();

  const [importedItems, setImportedItems] = useState<ImportedItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [previewPage, setPreviewPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPresets = getFilteredPresets();
  const filteredModels = getFilteredModels();
  const filteredMappings = getFilteredMappings();

  const previewRows = [
    ...filteredPresets.map((p) => ({ type: '预设' as const, name: p.name, version: p.version, source: p.source, status: p.isArchived ? '已归档' : p.status === 'overridden' ? '已覆盖' : '活跃' })),
    ...filteredModels.map((m) => ({ type: '型号' as const, name: `${m.brand} ${m.model}`, version: m.firmwareVersion, source: '-', status: '活跃' })),
    ...filteredMappings.map((mp) => ({ type: '映射' as const, name: mp.name, version: mp.version, source: mp.source, status: mp.isActive ? '活跃' : '停用' })),
  ];

  const totalPages = Math.ceil(previewRows.length / PAGE_SIZE);
  const pageRows = previewRows.slice(previewPage * PAGE_SIZE, (previewPage + 1) * PAGE_SIZE);

  const classifyJson = useCallback((obj: unknown): ImportedItem[] => {
    const items: ImportedItem[] = [];
    if (!obj || typeof obj !== 'object') return items;

    const record = obj as Record<string, unknown>;

    if (Array.isArray(record.presets)) {
      for (const p of record.presets as Preset[]) {
        items.push({
          type: 'preset',
          data: {
            name: p.name,
            version: p.version,
            source: p.source ?? '导入',
            params: p.params ?? {},
            isArchived: p.isArchived ?? false,
            archivedAt: p.archivedAt ?? null,
          },
          name: p.name,
          version: p.version,
        });
      }
    }
    if (Array.isArray(record.models)) {
      for (const m of record.models as KeyboardModel[]) {
        items.push({
          type: 'model',
          data: {
            brand: m.brand,
            model: m.model,
            firmwareVersion: m.firmwareVersion,
          },
          name: `${m.brand} ${m.model}`,
          version: m.firmwareVersion,
        });
      }
    }
    if (Array.isArray(record.mappings)) {
      for (const mp of record.mappings as PedalMapping[]) {
        items.push({
          type: 'mapping',
          data: {
            name: mp.name,
            version: mp.version,
            source: mp.source ?? '导入',
            polarity: mp.polarity ?? 'normal',
            ccMappings: mp.ccMappings ?? {},
          },
          name: mp.name,
          version: mp.version,
        });
      }
    }

    if (items.length === 0) {
      if ('name' in record && 'params' in record) {
        const p = record as unknown as Preset;
        items.push({
          type: 'preset',
          data: {
            name: p.name,
            version: p.version ?? '1.0',
            source: p.source ?? '导入',
            params: p.params ?? {},
            isArchived: p.isArchived ?? false,
            archivedAt: p.archivedAt ?? null,
          },
          name: p.name,
          version: p.version ?? '1.0',
        });
      } else if ('brand' in record && 'model' in record) {
        const m = record as unknown as KeyboardModel;
        items.push({
          type: 'model',
          data: {
            brand: m.brand,
            model: m.model,
            firmwareVersion: m.firmwareVersion ?? '1.0',
          },
          name: `${m.brand} ${m.model}`,
          version: m.firmwareVersion ?? '1.0',
        });
      } else if ('name' in record && 'ccMappings' in record) {
        const mp = record as unknown as PedalMapping;
        items.push({
          type: 'mapping',
          data: {
            name: mp.name,
            version: mp.version ?? '1.0',
            source: mp.source ?? '导入',
            polarity: mp.polarity ?? 'normal',
            ccMappings: mp.ccMappings ?? {},
          },
          name: mp.name,
          version: mp.version ?? '1.0',
        });
      }
    }

    return items;
  }, []);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setIsImporting(true);
    setImportProgress(0);
    setImportedItems([]);

    const allItems: ImportedItem[] = [];
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (file.name.endsWith('.json')) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const items = classifyJson(parsed);
          allItems.push(...items);
        } catch {
          // skip invalid files
        }
      }
      setImportProgress(Math.round(((i + 1) / fileArray.length) * 100));
    }

    setImportedItems(allItems);
    setIsImporting(false);
  }, [classifyJson]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  const handleConfirmImport = useCallback(() => {
    for (const item of importedItems) {
      if (item.type === 'preset') {
        addPreset(item.data as Omit<Preset, 'id' | 'importedAt' | 'status'>);
      } else if (item.type === 'model') {
        addModel(item.data as Omit<KeyboardModel, 'id' | 'addedAt'>);
      } else if (item.type === 'mapping') {
        addMapping(item.data as Omit<PedalMapping, 'id' | 'importedAt' | 'isActive'>);
      }
    }
    setImportedItems([]);
    setImportProgress(0);
  }, [importedItems, addPreset, addModel, addMapping]);

  const handleClearImport = useCallback(() => {
    setImportedItems([]);
    setImportProgress(0);
  }, []);

  const handleExport = useCallback(() => {
    exportData(
      { presets: filteredPresets, models: filteredModels, mappings: filteredMappings },
      filters,
      exportFormat
    );
  }, [filteredPresets, filteredModels, filteredMappings, filters, exportFormat]);

  const presetCount = importedItems.filter((i) => i.type === 'preset').length;
  const modelCount = importedItems.filter((i) => i.type === 'model').length;
  const mappingCount = importedItems.filter((i) => i.type === 'mapping').length;

  const typeBadge = (type: ImportedItem['type']) => {
    const map = {
      preset: { label: '预设', cls: 'bg-blue-500/20 text-blue-400' },
      model: { label: '型号', cls: 'bg-green-500/20 text-green-400' },
      mapping: { label: '映射', cls: 'bg-purple-500/20 text-purple-400' },
    };
    const info = map[type];
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${info.cls}`}>{info.label}</span>;
  };

  const hasActiveFilters = filters.search || filters.status || filters.issueType || filters.dateFrom || filters.dateTo;

  return (
    <div className="min-h-screen bg-[#0E0E1A] p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#FAF5EF]">导入导出</h1>

      <div className="bg-[#1A1A2E] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-[#FAF5EF] text-lg font-semibold">
          <Upload size={20} className="text-amber-500" />
          导入
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all
            ${isDragOver
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-amber-500/50 bg-amber-500/5 hover:border-amber-400 hover:bg-amber-500/10'
            }
          `}
        >
          <Upload size={40} className="text-amber-500 mb-3" />
          <p className="text-[#FAF5EF] text-base font-medium">拖拽文件到此处，或点击选择文件</p>
          <p className="text-[#8A8AA0] text-sm mt-1">支持 .json 格式，可同时上传多个文件</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {isImporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#8A8AA0]">正在解析文件...</span>
              <span className="text-amber-500">{importProgress}%</span>
            </div>
            <div className="w-full bg-[#0E0E1A] rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {importedItems.length > 0 && !isImporting && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-[#8A8AA0]">
                <span>识别到 <strong className="text-blue-400">{presetCount}</strong> 个预设</span>
                <span><strong className="text-green-400">{modelCount}</strong> 个型号</span>
                <span><strong className="text-purple-400">{mappingCount}</strong> 个映射</span>
              </div>
              <button
                onClick={handleClearImport}
                className="text-[#8A8AA0] hover:text-[#FAF5EF] text-sm flex items-center gap-1 transition-colors"
              >
                <X size={14} />
                清除
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {importedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-[#0E0E1A] rounded-lg px-4 py-2.5"
                >
                  {typeBadge(item.type)}
                  <span className="text-[#FAF5EF] text-sm font-medium">{item.name}</span>
                  <span className="text-[#8A8AA0] text-xs">v{item.version}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleConfirmImport}
              className="bg-amber-500 hover:bg-amber-600 text-[#0E0E1A] font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <CheckCircle size={18} />
              确认导入
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#1A1A2E] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-[#FAF5EF] text-lg font-semibold">
          <Download size={20} className="text-amber-500" />
          导出
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2.5">
            <Filter size={16} className="text-amber-500 shrink-0" />
            <span className="text-amber-400 text-sm">
              筛选条件已激活：
              {filters.status && ` 状态=${filters.status === 'active' ? '活跃' : filters.status === 'archived' ? '已归档' : filters.status}`}
              {filters.issueType && ` 问题=${filters.issueType === 'override' ? '覆盖' : filters.issueType === 'model_incompatible' ? '不兼容' : filters.issueType === 'polarity_reversed' ? '极性反转' : filters.issueType}`}
              {filters.search && ` 搜索="${filters.search}"`}
              {filters.dateFrom && ` 从${filters.dateFrom}`}
              {filters.dateTo && ` 至${filters.dateTo}`}
            </span>
            <button
              onClick={resetFilters}
              className="ml-auto text-amber-400 hover:text-amber-300 text-xs underline shrink-0"
            >
              重置
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[#8A8AA0] text-xs mb-1 block">状态</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value })}
              className="w-full bg-[#0E0E1A] text-[#FAF5EF] rounded-lg px-3 py-2 text-sm border border-[#2A2A3E] focus:border-amber-500 outline-none"
            >
              <option value="">全部</option>
              <option value="active">活跃</option>
              <option value="archived">已归档</option>
            </select>
          </div>
          <div>
            <label className="text-[#8A8AA0] text-xs mb-1 block">问题类型</label>
            <select
              value={filters.issueType}
              onChange={(e) => setFilters({ issueType: e.target.value })}
              className="w-full bg-[#0E0E1A] text-[#FAF5EF] rounded-lg px-3 py-2 text-sm border border-[#2A2A3E] focus:border-amber-500 outline-none"
            >
              <option value="">全部</option>
              <option value="override">覆盖</option>
              <option value="model_incompatible">不兼容</option>
              <option value="polarity_reversed">极性反转</option>
            </select>
          </div>
          <div>
            <label className="text-[#8A8AA0] text-xs mb-1 block">开始日期</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ dateFrom: e.target.value })}
              className="w-full bg-[#0E0E1A] text-[#FAF5EF] rounded-lg px-3 py-2 text-sm border border-[#2A2A3E] focus:border-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[#8A8AA0] text-xs mb-1 block">结束日期</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ dateTo: e.target.value })}
              className="w-full bg-[#0E0E1A] text-[#FAF5EF] rounded-lg px-3 py-2 text-sm border border-[#2A2A3E] focus:border-amber-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[#8A8AA0] text-xs mb-1 block">搜索</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="按名称或来源搜索..."
            className="w-full bg-[#0E0E1A] text-[#FAF5EF] rounded-lg px-3 py-2 text-sm border border-[#2A2A3E] focus:border-amber-500 outline-none placeholder:text-[#8A8AA0]/50"
          />
        </div>

        <div className="bg-[#0E0E1A] rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-[#8A8AA0] text-sm">
            当前筛选范围：
            <strong className="text-blue-400">{filteredPresets.length}</strong> 个预设，{' '}
            <strong className="text-green-400">{filteredModels.length}</strong> 个型号，{' '}
            <strong className="text-purple-400">{filteredMappings.length}</strong> 个映射
          </span>
          <span className="text-[#8A8AA0] text-xs">
            共 {previewRows.length} 条
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#8A8AA0] text-sm">导出格式：</span>
            <button
              onClick={() => setExportFormat('json')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                exportFormat === 'json'
                  ? 'bg-amber-500 text-[#0E0E1A]'
                  : 'bg-[#0E0E1A] text-[#8A8AA0] hover:text-[#FAF5EF]'
              }`}
            >
              <FileJson size={16} />
              JSON
            </button>
            <button
              onClick={() => setExportFormat('csv')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                exportFormat === 'csv'
                  ? 'bg-amber-500 text-[#0E0E1A]'
                  : 'bg-[#0E0E1A] text-[#8A8AA0] hover:text-[#FAF5EF]'
              }`}
            >
              <FileSpreadsheet size={16} />
              CSV
            </button>
          </div>
          <button
            onClick={handleExport}
            className="bg-amber-500 hover:bg-amber-600 text-[#0E0E1A] font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            导出
          </button>
        </div>
      </div>

      <div className="bg-[#1A1A2E] rounded-xl p-6 space-y-4">
        <div className="text-[#FAF5EF] text-lg font-semibold">导出预览</div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8A8AA0] border-b border-[#2A2A3E]">
                <th className="text-left py-2.5 px-3 font-medium">类型</th>
                <th className="text-left py-2.5 px-3 font-medium">名称</th>
                <th className="text-left py-2.5 px-3 font-medium">版本</th>
                <th className="text-left py-2.5 px-3 font-medium">来源</th>
                <th className="text-left py-2.5 px-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-[#8A8AA0]">暂无数据</td>
                </tr>
              )}
              {pageRows.map((row, idx) => (
                <tr key={idx} className="border-b border-[#2A2A3E]/50 hover:bg-[#0E0E1A]/50">
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        row.type === '预设'
                          ? 'bg-blue-500/20 text-blue-400'
                          : row.type === '型号'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#FAF5EF]">{row.name}</td>
                  <td className="py-2.5 px-3 text-[#8A8AA0]">{row.version}</td>
                  <td className="py-2.5 px-3 text-[#8A8AA0]">{row.source}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        row.status === '活跃'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : row.status === '已归档'
                          ? 'bg-gray-500/20 text-gray-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
              disabled={previewPage === 0}
              className="px-3 py-1.5 rounded-lg text-sm bg-[#0E0E1A] text-[#8A8AA0] hover:text-[#FAF5EF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            <span className="text-[#8A8AA0] text-sm">
              {previewPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPreviewPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={previewPage >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm bg-[#0E0E1A] text-[#8A8AA0] hover:text-[#FAF5EF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
