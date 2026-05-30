import { useState, useRef, useCallback } from 'react';
import {
  Search,
  Plus,
  Archive,
  Music,
  Tag,
  Clock,
  Database,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { useStore } from '@/store';
import type { Preset } from '@/types';

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 30) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
}

function truncateJson(obj: Record<string, unknown>, maxLen = 60): string {
  const str = JSON.stringify(obj, null, 0);
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

function StatusBadge({ status }: { status: Preset['status'] }) {
  const map = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    overridden: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };
  const label = { active: '活跃', archived: '已归档', overridden: '已覆盖' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      <Tag size={10} />
      {label[status]}
    </span>
  );
}

export default function Presets() {
  const presets = useStore((s) => s.getFilteredPresets());
  const presetOverrides = useStore((s) => s.presetOverrides);
  const compatibilityResults = useStore((s) => s.compatibilityResults);
  const models = useStore((s) => s.models);
  const mappings = useStore((s) => s.mappings);
  const filters = useStore((s) => s.filters);
  const selectedPresetId = useStore((s) => s.selectedPresetId);
  const addPreset = useStore((s) => s.addPreset);
  const archivePreset = useStore((s) => s.archivePreset);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);
  const setSelectedPreset = useStore((s) => s.setSelectedPreset);

  const [importOpen, setImportOpen] = useState(false);
  const [importProgress, setImportProgress] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const overriddenIds = new Set(presetOverrides.map((o) => o.olderPresetId));

  const handleFileImport = useCallback(
    (file: File) => {
      setImportProgress(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = { rawText: text };
          }
          addPreset({
            name: file.name.replace(/\.[^/.]+$/, ''),
            version: '1.0',
            source: '文件导入',
            params: parsed,
            isArchived: false,
            archivedAt: null,
          });
        } catch {
          addPreset({
            name: file.name.replace(/\.[^/.]+$/, ''),
            version: '1.0',
            source: '文件导入',
            params: { error: '解析失败' },
            isArchived: false,
            archivedAt: null,
          });
        }
        setImportProgress(false);
      };
      reader.readAsText(file);
    },
    [addPreset]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileImport(file);
    },
    [handleFileImport]
  );

  const handleArchive = (id: string) => {
    archivePreset(id);
    setConfirmArchiveId(null);
    if (selectedPresetId === id) setSelectedPreset(null);
  };

  const selectedPreset = presets.find((p) => p.id === selectedPresetId) ?? null;
  const selectedCompat = selectedPreset
    ? compatibilityResults.filter((r) => r.presetId === selectedPreset.id)
    : [];
  const selectedOverride = selectedPreset
    ? presetOverrides.find(
        (o) => o.olderPresetId === selectedPreset.id || o.newerPresetId === selectedPreset.id
      )
    : null;
  const selectedAffectedModels = selectedOverride
    ? models.filter((m) => selectedOverride.affectedModelIds.includes(m.id))
    : [];
  const selectedAffectedMappings = selectedOverride
    ? mappings.filter((m) => selectedOverride.affectedMappingIds.includes(m.id))
    : [];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#0E0E1A' }}>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: '#FAF5EF' }}>
            预设管理
          </h1>
          <button
            onClick={() => setImportOpen(!importOpen)}
            className="flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/30"
          >
            <Plus size={16} />
            导入预设
            {importOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl p-4" style={{ backgroundColor: '#1A1A2E' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8A8AA0' }} />
            <input
              type="text"
              placeholder="搜索预设名称或来源…"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-amber-500/50"
              style={{ color: '#FAF5EF' }}
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-500/50"
            style={{ color: '#FAF5EF' }}
          >
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="archived">已归档</option>
          </select>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ dateFrom: e.target.value })}
            placeholder="起始日期"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-500/50"
            style={{ color: '#FAF5EF' }}
          />
          <span className="text-sm" style={{ color: '#8A8AA0' }}>至</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ dateTo: e.target.value })}
            placeholder="结束日期"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-500/50"
            style={{ color: '#FAF5EF' }}
          />
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm transition-colors hover:border-amber-500/50"
            style={{ color: '#8A8AA0' }}
          >
            <X size={14} />
            重置
          </button>
        </div>

        {importOpen && (
          <div
            className={`mb-6 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? 'border-amber-500 bg-amber-500/10' : 'border-white/20'
            }`}
            style={{ backgroundColor: '#1A1A2E' }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Database size={40} className="mx-auto mb-3" style={{ color: '#8A8AA0' }} />
            <p className="mb-2 text-sm" style={{ color: '#FAF5EF' }}>
              {dragOver ? '释放文件以导入' : '拖拽 JSON / 文本文件到此处'}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/30"
            >
              选择文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileImport(file);
                e.target.value = '';
              }}
            />
            {importProgress && (
              <div className="mt-4">
                <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full animate-pulse rounded-full bg-amber-500" style={{ width: '60%' }} />
                </div>
                <p className="mt-2 text-xs" style={{ color: '#8A8AA0' }}>正在导入…</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 max-2xl:grid-cols-2">
          {presets.map((preset) => {
            const isOverridden = overriddenIds.has(preset.id);
            const isSelected = selectedPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => setSelectedPreset(isSelected ? null : preset.id)}
                className={`group cursor-pointer rounded-xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/5 ${
                  isSelected ? 'ring-2 ring-amber-500/60' : ''
                }`}
                style={{ backgroundColor: '#1A1A2E' }}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Music size={18} style={{ color: '#8A8AA0' }} />
                    <h3 className="text-base font-bold" style={{ color: '#FAF5EF' }}>
                      {preset.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOverridden && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                        <AlertTriangle size={10} />
                        已覆盖
                      </span>
                    )}
                    <StatusBadge status={preset.status} />
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-3 text-xs" style={{ color: '#8A8AA0' }}>
                  <span className="flex items-center gap-1">
                    <Tag size={12} />
                    v{preset.version}
                  </span>
                  <span>{preset.source}</span>
                </div>

                <div className="mb-3 flex items-center gap-1 text-xs" style={{ color: '#8A8AA0' }}>
                  <Clock size={12} />
                  <span>{formatRelativeTime(preset.importedAt)}</span>
                </div>

                <p className="mb-3 truncate rounded-lg bg-white/5 px-3 py-2 font-mono text-xs" style={{ color: '#8A8AA0' }}>
                  {truncateJson(preset.params)}
                </p>

                {!preset.isArchived && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmArchiveId(preset.id);
                    }}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs transition-colors hover:border-red-500/50 hover:text-red-400"
                    style={{ color: '#8A8AA0' }}
                  >
                    <Archive size={12} />
                    归档
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {presets.length === 0 && (
          <div className="py-20 text-center">
            <Music size={48} className="mx-auto mb-4" style={{ color: '#8A8AA0' }} />
            <p style={{ color: '#8A8AA0' }}>暂无匹配的预设</p>
          </div>
        )}
      </div>

      {selectedPreset && (
        <div
          className="w-[420px] shrink-0 overflow-y-auto border-l border-white/10 p-6 transition-all duration-300"
          style={{ backgroundColor: '#1A1A2E' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: '#FAF5EF' }}>
              预设详情
            </h2>
            <button
              onClick={() => setSelectedPreset(null)}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
              style={{ color: '#8A8AA0' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-3">
              <Music size={20} style={{ color: '#8A8AA0' }} />
              <h3 className="text-xl font-bold" style={{ color: '#FAF5EF' }}>
                {selectedPreset.name}
              </h3>
              <StatusBadge status={selectedPreset.status} />
            </div>
            <p className="mt-1 text-sm" style={{ color: '#8A8AA0' }}>
              v{selectedPreset.version} · {selectedPreset.source}
            </p>
            <p className="mt-1 text-xs" style={{ color: '#8A8AA0' }}>
              导入于 {formatRelativeTime(selectedPreset.importedAt)}
            </p>
          </div>

          <div className="mb-4">
            <h4 className="mb-2 text-sm font-semibold" style={{ color: '#FAF5EF' }}>参数 (JSON)</h4>
            <pre
              className="overflow-x-auto rounded-lg bg-black/30 p-4 font-mono text-xs leading-relaxed"
              style={{ color: '#8A8AA0' }}
            >
              {JSON.stringify(selectedPreset.params, null, 2)}
            </pre>
          </div>

          {selectedCompat.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold" style={{ color: '#FAF5EF' }}>兼容性检测结果</h4>
              <div className="space-y-2">
                {selectedCompat.map((cr) => (
                  <div
                    key={cr.id}
                    className="rounded-lg border border-white/10 p-3 text-xs"
                    style={{ color: '#8A8AA0' }}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {cr.status === 'incompatible' && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-400">不兼容</span>
                      )}
                      {cr.status === 'polarity_warning' && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-400">极性警告</span>
                      )}
                      {cr.status === 'override_pending' && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-400">覆盖待处理</span>
                      )}
                      {cr.status === 'compatible' && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-400">兼容</span>
                      )}
                      <span className="text-xs" style={{ color: '#8A8AA0' }}>
                        {cr.issueType ?? '—'}
                      </span>
                    </div>
                    <p>{cr.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedOverride && (
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold" style={{ color: '#FAF5EF' }}>覆盖信息</h4>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs" style={{ color: '#8A8AA0' }}>
                <p className="mb-1">{selectedOverride.description}</p>
                <p className="text-xs" style={{ color: '#8A8AA0' }}>
                  检测于 {formatRelativeTime(selectedOverride.detectedAt)}
                </p>
              </div>
            </div>
          )}

          {selectedAffectedModels.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold" style={{ color: '#FAF5EF' }}>受影响型号</h4>
              <div className="space-y-1">
                {selectedAffectedModels.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs"
                    style={{ color: '#8A8AA0' }}
                  >
                    {m.brand} {m.model} (固件 {m.firmwareVersion})
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedAffectedMappings.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold" style={{ color: '#FAF5EF' }}>受影响映射</h4>
              <div className="space-y-1">
                {selectedAffectedMappings.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs"
                    style={{ color: '#8A8AA0' }}
                  >
                    {m.name} v{m.version} ({m.polarity === 'normal' ? '正极性' : '反极性'})
                  </div>
                ))}
              </div>
            </div>
          )}

          {!selectedPreset.isArchived && (
            <button
              onClick={() => setConfirmArchiveId(selectedPreset.id)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              <Archive size={16} />
              归档此预设
            </button>
          )}
        </div>
      )}

      {confirmArchiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[360px] rounded-xl p-6" style={{ backgroundColor: '#1A1A2E' }}>
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-400" />
              <h3 className="text-base font-bold" style={{ color: '#FAF5EF' }}>确认归档</h3>
            </div>
            <p className="mb-6 text-sm" style={{ color: '#8A8AA0' }}>
              归档后该预设将不再参与兼容性检测，此操作不可撤销。确认归档？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmArchiveId(null)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/10"
                style={{ color: '#8A8AA0' }}
              >
                取消
              </button>
              <button
                onClick={() => handleArchive(confirmArchiveId)}
                className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
              >
                确认归档
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
