import { useState, useEffect } from 'react';
import { Undo2 } from 'lucide-react';
import useStore from '../store/useStore';
import type { DuplicateEntry } from '../types';

const ImportPage = () => {
  const { importData, resolveDuplicate, fetchCorrections, revertCorrection } = useStore();
  const [sourceType, setSourceType] = useState<'insurance' | 'lighting' | 'artwork_list'>('artwork_list');
  const [sourceTitle, setSourceTitle] = useState('');
  const [csvText, setCsvText] = useState('');
  const [imported, setImported] = useState<number | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([]);
  const [duplicateReasons, setDuplicateReasons] = useState<Record<string, string>>({});
  const [corrections, setCorrections] = useState<any[]>([]);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState('');

  useEffect(() => {
    loadCorrections();
  }, []);

  const loadCorrections = async () => {
    const data = await fetchCorrections();
    setCorrections(data || []);
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i]?.trim() || '';
      });
      return obj;
    });
  };

  const handleImport = async () => {
    if (!sourceTitle || !csvText) return;
    const data = parseCSV(csvText);
    if (data.length === 0) return;
    const result = await importData({ source_type: sourceType, source_title: sourceTitle, data });
    setImported(result.imported);
    setDuplicates(result.duplicates || []);
  };

  const handleResolve = async (dup: DuplicateEntry, action: string) => {
    await resolveDuplicate({ duplicate_id: dup.id, action, reason: duplicateReasons[dup.id] });
    setDuplicates(ds => ds.filter(d => d.id !== dup.id));
  };

  const handleRevert = async (cid: string) => {
    if (!revertReason) return;
    await revertCorrection(cid, revertReason);
    setRevertingId(null);
    setRevertReason('');
    loadCorrections();
  };

  const fieldLabels: Record<string, string> = { title: '作品名', artist: '艺术家', dimensions: '尺寸', dimension_unit: '单位', medium: '材质', year: '年份', status: '状态' };

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">导入与撤回</h1>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">数据导入</h2>
        <div className="bg-gallery-surface border border-gallery-border rounded p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gallery-muted mb-2">来源类型</label>
              <div className="flex gap-2">
                {([
                  { k: 'artwork_list', l: '作品清单' },
                  { k: 'insurance', l: '保险单' },
                  { k: 'lighting', l: '灯光记录' },
                ] as const).map(({ k, l }) => (
                  <button
                    key={k}
                    onClick={() => setSourceType(k)}
                    className={`px-4 py-2 rounded text-sm ${sourceType === k ? 'bg-gallery-amber text-white' : 'border border-gallery-border hover:bg-gallery-bg'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gallery-muted mb-2">来源标题</label>
              <input
                className="w-full px-3 py-2 rounded text-sm"
                placeholder="例如：2024年保险续保清单"
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gallery-muted mb-2">CSV 数据（列：title,artist,dimensions,dimension_unit,medium,year）</label>
            <textarea
              className="w-full px-3 py-2 rounded text-sm font-mono"
              rows={8}
              placeholder="title,artist,dimensions,dimension_unit,medium,year&#10;山水之间,张大千,68×136,cm,纸本水墨,1973"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>

          <button
            onClick={handleImport}
            disabled={!sourceTitle || !csvText}
            className="px-6 py-2 bg-gallery-amber text-white rounded text-sm disabled:opacity-50"
          >
            导入数据
          </button>

          {imported !== null && (
            <div className="mt-4 text-sm text-gallery-sage">成功导入 {imported} 条</div>
          )}

          {duplicates.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gallery-amber mb-2">发现 {duplicates.length} 条重复</div>
              <div className="space-y-3">
                {duplicates.map(dup => (
                  <div key={dup.id} className="border border-gallery-amber/50 bg-gallery-amber/10 rounded p-4">
                    <div className="text-sm mb-2">
                      <span className="text-gallery-amber font-medium">{dup.incoming_title}</span> 与现有
                      <span className="text-gallery-amber font-medium"> {dup.existing_title}</span> 重复
                    </div>
                    <div className="text-xs text-gallery-muted mb-3">匹配字段: {dup.match_fields.join(', ')}</div>
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => handleResolve(dup, 'merge')}
                        className="px-3 py-1 text-xs border border-gallery-border rounded hover:bg-gallery-bg"
                      >
                        合并（仅添加来源）
                      </button>
                      <button
                        onClick={() => handleResolve(dup, 'overwrite')}
                        className="px-3 py-1 text-xs border border-gallery-amber text-gallery-amber rounded hover:bg-gallery-amber hover:text-white"
                      >
                        覆盖（更新信息）
                      </button>
                      <button
                        onClick={() => handleResolve(dup, 'skip')}
                        className="px-3 py-1 text-xs border border-gallery-border rounded hover:bg-gallery-bg"
                      >
                        跳过
                      </button>
                    </div>
                    <input
                      className="w-full px-3 py-2 rounded text-xs"
                      placeholder="可选：处理原因"
                      value={duplicateReasons[dup.id] || ''}
                      onChange={(e) => setDuplicateReasons(rs => ({ ...rs, [dup.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">修正撤回</h2>
        <div className="bg-gallery-surface border border-gallery-border rounded divide-y divide-gallery-border">
          {corrections.length === 0 ? (
            <div className="p-8 text-center text-gallery-muted text-sm">暂无修正记录</div>
          ) : (
            corrections.map((corr) => (
              <div key={corr.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium mb-1">{corr.artwork_title || corr.artwork_id}</div>
                    <div className="font-mono text-sm mb-1">
                      {fieldLabels[corr.field] || corr.field}:
                      <span className="line-through text-gallery-muted ml-2">{corr.old_value}</span>
                      <span className="mx-2">→</span>
                      <span className="text-gallery-amber">{corr.new_value}</span>
                    </div>
                    <div className="text-xs text-gallery-muted">原因: {corr.reason}</div>
                    {corr.reverted && <div className="text-xs text-gallery-muted mt-1">已撤回: {corr.revert_reason}</div>}
                    <div className="text-xs text-gallery-muted mt-1">{new Date(corr.created_at).toLocaleString()}</div>
                  </div>
                  {!corr.reverted && (
                    <button
                      onClick={() => setRevertingId(corr.id)}
                      className="text-xs text-gallery-amber hover:underline"
                    >
                      <Undo2 className="w-3 h-3 inline mr-1" />撤回
                    </button>
                  )}
                </div>
                {revertingId === corr.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="flex-1 px-3 py-2 rounded text-sm"
                      placeholder="撤回原因"
                      value={revertReason}
                      onChange={(e) => setRevertReason(e.target.value)}
                    />
                    <button
                      onClick={() => handleRevert(corr.id)}
                      className="px-4 py-2 bg-gallery-amber text-white rounded text-sm"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => { setRevertingId(null); setRevertReason(''); }}
                      className="px-4 py-2 border border-gallery-border rounded text-sm"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportPage;
