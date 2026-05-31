import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Upload, ArrowRight, Filter } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import Layout from '@/components/Layout';
import type { AdjustmentRecord } from '@/types';

const fieldLabels: Record<string, string> = {
  startTime: '开始时间',
  endTime: '结束时间',
  text: '文本内容',
};

export default function Export() {
  const { id } = useParams<{ id: string }>();
  const currentProject = useProjectStore((s) => s.currentProject);
  const openProject = useProjectStore((s) => s.openProject);
  const tracks = useProjectStore((s) => s.tracks);
  const adjustments = useProjectStore((s) => s.adjustments);
  const exportData = useProjectStore((s) => s.exportData);
  const importSubtitles = useProjectStore((s) => s.importSubtitles);
  const entries = useProjectStore((s) => s.entries);

  useEffect(() => {
    if (id) {
      openProject(id);
    }
  }, [id, openProject]);

  const [tab, setTab] = useState<'export' | 'history'>('export');
  const [exportLang, setExportLang] = useState('');
  const [exportFormat, setExportFormat] = useState<'srt' | 'vtt'>('srt');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLang, setImportLang] = useState('');
  const [importFormat, setImportFormat] = useState<'srt' | 'vtt'>('srt');
  const [importMsg, setImportMsg] = useState('');
  const [histFilter, setHistFilter] = useState({ entry: '', field: '', operator: '' });

  const availableLangs = useMemo(
    () => [...new Set(tracks.filter((t) => t.projectId === currentProject?.id).map((t) => t.language))],
    [tracks, currentProject],
  );

  const preview = useMemo(() => {
    if (!currentProject || !exportLang) return '';
    return exportData(currentProject.id, exportLang, exportFormat);
  }, [currentProject, exportLang, exportFormat, exportData]);

  function handleDownload() {
    if (!preview) return;
    const ext = exportFormat === 'srt' ? '.srt' : '.vtt';
    const blob = new Blob([preview], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name ?? 'subtitles'}_${exportLang}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!importFile || !currentProject || !importLang) return;
    const text = await importFile.text();
    try {
      await importSubtitles(currentProject.id, importLang, text, importFormat);
      setImportMsg('导入成功');
      setImportFile(null);
    } catch {
      setImportMsg('导入失败，请检查文件格式');
    }
  }

  const filteredAdjustments = useMemo(() => {
    let list = adjustments;
    if (histFilter.entry) {
      list = list.filter((a) => a.entryId === histFilter.entry);
    }
    if (histFilter.field) {
      list = list.filter((a) => a.field === histFilter.field);
    }
    if (histFilter.operator) {
      list = list.filter((a) => a.operator === histFilter.operator);
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [adjustments, histFilter]);

  const uniqueEntries = useMemo(
    () => [...new Set(adjustments.map((a) => a.entryId))],
    [adjustments],
  );
  const uniqueFields = useMemo(
    () => [...new Set(adjustments.map((a) => a.field))],
    [adjustments],
  );
  const uniqueOperators = useMemo(
    () => [...new Set(adjustments.map((a) => a.operator))],
    [adjustments],
  );

  return (
    <Layout>
      <div className="h-full flex flex-col bg-[#1A1A2E] text-white">
        <div className="flex border-b border-[#0F3460]">
          <TabBtn active={tab === 'export'} onClick={() => setTab('export')}>导出</TabBtn>
          <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>校正历史</TabBtn>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'export' ? (
            <div className="max-w-2xl space-y-6">
              <section className="rounded-lg bg-[#16213E] border border-[#0F3460] p-5">
                <h3 className="text-sm font-semibold mb-4">导出字幕</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">语言</label>
                    <select
                      value={exportLang}
                      onChange={(e) => setExportLang(e.target.value)}
                      className="w-full bg-[#0F3460] text-white text-xs rounded px-3 py-2 outline-none focus:ring-1 focus:ring-[#2EC4B6]"
                    >
                      <option value="">选择语言</option>
                      {availableLangs.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">格式</label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as 'srt' | 'vtt')}
                      className="w-full bg-[#0F3460] text-white text-xs rounded px-3 py-2 outline-none focus:ring-1 focus:ring-[#2EC4B6]"
                    >
                      <option value="srt">SRT</option>
                      <option value="vtt">VTT</option>
                    </select>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={preview}
                  placeholder="选择语言和格式后预览..."
                  className="w-full h-48 bg-[#1A1A2E] text-gray-300 font-mono text-[11px] rounded p-3 border border-[#0F3460] outline-none resize-none"
                />
                <button
                  onClick={handleDownload}
                  disabled={!preview}
                  className="mt-3 flex items-center gap-2 px-4 py-2 rounded bg-[#FF6B35] text-white text-xs font-medium hover:bg-[#FF6B35]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> 下载文件
                </button>
              </section>

              <section className="rounded-lg bg-[#16213E] border border-[#0F3460] p-5">
                <h3 className="text-sm font-semibold mb-4">上传字幕</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">文件</label>
                    <input
                      type="file"
                      accept=".srt,.vtt"
                      onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                      className="w-full text-xs text-gray-300 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-[#0F3460] file:text-gray-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">语言</label>
                      <select
                        value={importLang}
                        onChange={(e) => setImportLang(e.target.value)}
                        className="w-full bg-[#0F3460] text-white text-xs rounded px-2 py-2 outline-none"
                      >
                        <option value="">选择</option>
                        {availableLangs.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">格式</label>
                      <select
                        value={importFormat}
                        onChange={(e) => setImportFormat(e.target.value as 'srt' | 'vtt')}
                        className="w-full bg-[#0F3460] text-white text-xs rounded px-2 py-2 outline-none"
                      >
                        <option value="srt">SRT</option>
                        <option value="vtt">VTT</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleImport}
                  disabled={!importFile || !importLang}
                  className="flex items-center gap-2 px-4 py-2 rounded bg-[#2EC4B6] text-white text-xs font-medium hover:bg-[#2EC4B6]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> 导入
                </button>
                {importMsg && (
                  <p className={`mt-2 text-xs ${importMsg.includes('成功') ? 'text-[#2EC4B6]' : 'text-[#E94560]'}`}>
                    {importMsg}
                  </p>
                )}
              </section>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={histFilter.entry}
                  onChange={(e) => setHistFilter((f) => ({ ...f, entry: e.target.value }))}
                  className="bg-[#0F3460] text-white text-[11px] rounded px-2 py-1 outline-none"
                >
                  <option value="">所有条目</option>
                  {uniqueEntries.map((id) => {
                    const entry = entries.find((e) => e.id === id);
                    return (
                      <option key={id} value={id}>
                        #{entry?.index ?? id.slice(0, 6)}
                      </option>
                    );
                  })}
                </select>
                <select
                  value={histFilter.field}
                  onChange={(e) => setHistFilter((f) => ({ ...f, field: e.target.value }))}
                  className="bg-[#0F3460] text-white text-[11px] rounded px-2 py-1 outline-none"
                >
                  <option value="">所有字段</option>
                  {uniqueFields.map((f) => (
                    <option key={f} value={f}>{fieldLabels[f] ?? f}</option>
                  ))}
                </select>
                <select
                  value={histFilter.operator}
                  onChange={(e) => setHistFilter((f) => ({ ...f, operator: e.target.value }))}
                  className="bg-[#0F3460] text-white text-[11px] rounded px-2 py-1 outline-none"
                >
                  <option value="">所有操作人</option>
                  {uniqueOperators.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {filteredAdjustments.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-10">暂无校正记录</div>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-[#0F3460]" />
                  <div className="space-y-4">
                    {filteredAdjustments.map((adj) => (
                      <TimelineRecord key={adj.id} record={adj} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-xs font-medium transition-colors ${
        active
          ? 'text-white border-b-2 border-[#FF6B35]'
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function TimelineRecord({ record }: { record: AdjustmentRecord }) {
  const date = new Date(record.timestamp);
  const timeStr = date.toLocaleString('zh-CN');
  const entryIdx = record.entryId.slice(0, 6);

  return (
    <div className="relative">
      <div className="absolute left-[-18px] top-2 w-2.5 h-2.5 rounded-full bg-[#2EC4B6] border-2 border-[#1A1A2E]" />
      <div className="rounded-lg bg-[#16213E] border border-[#0F3460] p-3">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[11px] text-gray-500 font-mono">{timeStr}</span>
          <span className="text-[11px] text-[#2EC4B6]">{record.operator}</span>
          <span className="text-[11px] text-gray-400">
            条目 #{entryIdx}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">{fieldLabels[record.field] ?? record.field}</span>
          <span className="px-2 py-0.5 rounded border border-dashed border-[#E94560] text-[#E94560] font-mono text-[11px]">
            {record.oldValue}
          </span>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <span className="px-2 py-0.5 rounded border border-solid border-[#2EC4B6] text-[#2EC4B6] font-mono text-[11px]">
            {record.newValue}
          </span>
        </div>
      </div>
    </div>
  );
}
