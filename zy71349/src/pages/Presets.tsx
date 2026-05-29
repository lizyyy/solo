import { useState } from 'react';
import { useMidiStore } from '@/store/useMidiStore';
import type { OperationHistory } from '@/types/midi';
import { Save, Upload, Trash2, RotateCcw, FileJson, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

const actionLabels: Record<OperationHistory['action'], string> = {
  create_mapping: '创建映射',
  delete_mapping: '删除映射',
  update_mapping: '更新映射',
  save_preset: '保存预设',
  load_preset: '加载预设',
  resolve_conflict: '解决冲突',
  supplement_material: '补传材料',
};

const actionColors: Record<OperationHistory['action'], string> = {
  create_mapping: 'bg-green-500/20 text-green-400',
  delete_mapping: 'bg-red-500/20 text-red-400',
  update_mapping: 'bg-blue-500/20 text-blue-400',
  save_preset: 'bg-emerald-500/20 text-emerald-400',
  load_preset: 'bg-cyan-500/20 text-cyan-400',
  resolve_conflict: 'bg-yellow-500/20 text-yellow-400',
  supplement_material: 'bg-purple-500/20 text-purple-400',
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Presets() {
  const [presetName, setPresetName] = useState('');
  const { presets, operationHistory, mappings, savePreset, loadPreset, deletePreset, rollbackToHistory, exportMappings, exportMappingsCSV } = useMidiStore();

  const activePresetId = useMidiStore((s) => {
    const last = [...s.operationHistory].reverse().find((h) => h.action === 'load_preset');
    return last?.payload.presetId as string | undefined;
  });

  const handleSave = () => {
    if (!presetName.trim()) return;
    savePreset(presetName.trim());
    setPresetName('');
  };

  const handleExportJSON = () => downloadFile(exportMappings(), 'mappings.json', 'application/json');
  const handleExportCSV = () => downloadFile(exportMappingsCSV(), 'mappings.csv', 'text/csv');

  const sortedHistory = [...operationHistory].reverse();

  return (
    <div className="min-h-screen p-6 space-y-8" style={{ background: '#0D1117' }}>
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white font-['Noto_Sans_SC']">预设管理</h2>
          <span className="text-sm text-zinc-500 font-['JetBrains_Mono']">{presets.length} 个预设</span>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="输入预设名称…"
            className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-green-500/50 transition font-['JetBrains_Mono']"
          />
          <button
            onClick={handleSave}
            disabled={!presetName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-['Noto_Sans_SC']"
          >
            <Save size={14} /> 保存
          </button>
        </div>

        {presets.length === 0 ? (
          <div className="text-center py-12 text-zinc-600 font-['Noto_Sans_SC']">暂无预设，输入名称保存当前映射</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'rounded-lg bg-zinc-900/50 border p-4 transition hover:border-green-500/50 group',
                  activePresetId === p.id ? 'border-green-500/70' : 'border-zinc-800',
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-medium font-['Noto_Sans_SC'] truncate">{p.name}</h3>
                  <span className="text-xs text-zinc-500 font-['JetBrains_Mono'] whitespace-nowrap ml-2">{p.mappingIds.length} 映射</span>
                </div>
                <div className="text-xs text-zinc-500 font-['JetBrains_Mono'] space-y-0.5">
                  <div>创建 {formatTime(p.createdAt)}</div>
                  <div>更新 {formatTime(p.updatedAt)}</div>
                </div>
                <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => loadPreset(p.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition font-['Noto_Sans_SC']"
                  >
                    <Upload size={12} /> 加载
                  </button>
                  <button
                    onClick={() => deletePreset(p.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition font-['Noto_Sans_SC']"
                  >
                    <Trash2 size={12} /> 删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-4 font-['Noto_Sans_SC']">导出映射</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-green-500/50 hover:text-green-400 transition text-sm font-['Noto_Sans_SC']"
          >
            <FileJson size={16} /> 导出 JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-green-500/50 hover:text-green-400 transition text-sm font-['Noto_Sans_SC']"
          >
            <FileSpreadsheet size={16} /> 导出 CSV
          </button>
          <span className="text-xs text-zinc-600 font-['JetBrains_Mono']">当前 {mappings.length} 条映射</span>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white font-['Noto_Sans_SC']">回滚历史</h2>
          <span className="text-sm text-zinc-500 font-['JetBrains_Mono']">{operationHistory.length} 条记录</span>
        </div>

        {sortedHistory.length === 0 ? (
          <div className="text-center py-12 text-zinc-600 font-['Noto_Sans_SC']">暂无操作历史</div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-800" />
            <div className="space-y-4">
              {sortedHistory.map((entry, i) => (
                <div key={entry.id} className="relative flex items-start gap-3">
                  <div
                    className={cn(
                      'absolute left-[-18px] top-1.5 w-3 h-3 rounded-full border-2 z-10',
                      i === 0 ? 'bg-green-500 border-green-400' : 'bg-zinc-900 border-zinc-700',
                    )}
                  />
                  <div className="flex-1 rounded-lg bg-zinc-900/50 border border-zinc-800 p-3 group hover:border-zinc-700 transition">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-["Noto_Sans_SC"]', actionColors[entry.action])}>
                        {actionLabels[entry.action]}
                      </span>
                      <span className="text-xs text-zinc-600 font-['JetBrains_Mono']">{formatTime(entry.timestamp)}</span>
                    </div>
                    <div className="text-xs text-zinc-500 font-['JetBrains_Mono'] truncate">
                      {entry.action === 'create_mapping' && `映射 ${entry.payload.mappingId}`}
                      {entry.action === 'delete_mapping' && `映射 ${entry.payload.mappingId}`}
                      {entry.action === 'update_mapping' && `映射 ${entry.payload.mappingId}`}
                      {entry.action === 'save_preset' && `预设「${entry.payload.name}」`}
                      {entry.action === 'load_preset' && `预设 ${entry.payload.presetId}`}
                      {entry.action === 'resolve_conflict' && `冲突 ${entry.payload.conflictId}`}
                      {entry.action === 'supplement_material' && `材料 ${entry.payload.materialId}`}
                    </div>
                    <button
                      onClick={() => rollbackToHistory(entry.id)}
                      className="mt-2 flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-800 text-zinc-400 hover:bg-yellow-500/20 hover:text-yellow-400 transition opacity-0 group-hover:opacity-100 font-['Noto_Sans_SC']"
                    >
                      <RotateCcw size={12} /> 回滚
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
