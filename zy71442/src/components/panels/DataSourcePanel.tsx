import { useRef, useState } from 'react';
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  Database,
  Search,
  Filter,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { MaterialCard } from '../ui/MaterialCard';
import { Toggle } from '../ui/Toggle';
import type { DataMaterial } from '../../types/surface';

interface DataSourcePanelProps {
  materials: DataMaterial[];
  selectedMaterialId?: string;
  visibleMaterialIds?: string[];
  onSelectMaterial?: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onExportMaterial?: (material: DataMaterial) => void;
  onDeleteMaterial?: (id: string) => void;
  onImportJson?: (data: any) => void;
  onImportCsv?: (data: any) => void;
  className?: string;
}

export function DataSourcePanel({
  materials,
  selectedMaterialId,
  visibleMaterialIds = [],
  onSelectMaterial,
  onToggleVisibility,
  onExportMaterial,
  onDeleteMaterial,
  onImportJson,
  onImportCsv,
  className,
}: DataSourcePanelProps) {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'raw' | 'processed'>('all');
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        onImportJson?.(data);
      } catch (error) {
        console.error('JSON parse error:', error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onImportCsv?.(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredMaterials = materials.filter((material) => {
    const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || material.status === filterStatus;
    const matchesVisible = !showOnlyVisible || visibleMaterialIds.includes(material.id);
    return matchesSearch && matchesStatus && matchesVisible;
  });

  const rawCount = materials.filter((m) => m.status === 'raw').length;
  const processedCount = materials.filter((m) => m.status === 'processed').length;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-slate-900/95 backdrop-blur border-r border-slate-700',
        className
      )}
    >
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-100">数据来源</h3>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
              {rawCount} 原始
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              {processedCount} 处理
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            onClick={() => jsonInputRef.current?.click()}
          >
            <FileJson className="w-3.5 h-3.5" />
            导入 JSON
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            onClick={() => csvInputRef.current?.click()}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            导入 CSV
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleJsonUpload}
          />
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvUpload}
          />
        </div>
      </div>

      <div className="p-3 border-b border-slate-700 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="搜索材料..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-xs bg-slate-800 border border-slate-600 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'raw' | 'processed')}
              className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="raw">原始</option>
              <option value="processed">处理</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">仅显示可见</span>
            <Toggle
              checked={showOnlyVisible}
              onCheckedChange={setShowOnlyVisible}
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filteredMaterials.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Plus className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">暂无材料数据</p>
            <p className="text-xs mt-1">点击上方按钮导入数据</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMaterials.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                selected={material.id === selectedMaterialId}
                visible={visibleMaterialIds.includes(material.id)}
                onSelect={onSelectMaterial}
                onToggleVisibility={onToggleVisibility}
                onExport={onExportMaterial}
                onDelete={onDeleteMaterial}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-700">
        <button
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          刷新数据
        </button>
      </div>
    </div>
  );
}
