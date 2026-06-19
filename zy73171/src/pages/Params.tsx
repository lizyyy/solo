import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Plus, Save, TriangleAlert } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

export default function Params() {
  const { paramTable, addParamChange, addParamRow } = useAppStore();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newRemark, setNewRemark] = useState('');

  const toggleRow = (id: string) =>
    setExpandedRows((s) => ({ ...s, [id]: !s[id] }));

  const startEdit = (id: string, val: string, unit: string | null) => {
    setEditingId(id);
    setEditValue(val ?? '');
    setEditUnit(unit ?? '');
  };

  const saveEdit = (id: string) => {
    addParamChange(id, editValue || '∅', editUnit || null, '数据分析-小孟');
    setEditingId(null);
  };

  const saveNew = () => {
    if (!newKey.trim()) return;
    addParamRow({
      key: newKey.trim(),
      value: newValue.trim() || null,
      unit: newUnit.trim() || null,
      sourceRemark: newRemark.trim() || `分批补录 ${new Date().toISOString().slice(0, 10)}`,
      version: paramTable.currentVersion,
      isEmptySet: !newValue.trim() || newValue.trim() === '∅',
      missingUnit: !newUnit.trim(),
      batchNo: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    });
    setNewKey(''); setNewValue(''); setNewUnit(''); setNewRemark('');
    setShowAdd(false);
  };

  const emptySetCount = paramTable.rows.filter((r) => r.isEmptySet).length;
  const missingUnitCount = paramTable.rows.filter((r) => r.missingUnit).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl text-navy-800 font-semibold">{paramTable.name}</h2>
          <p className="text-sm text-slate-500 mt-1">
            当前版本 <span className="font-mono-data text-navy-700">v{paramTable.currentVersion}</span>
            {' · '}共 {paramTable.rows.length} 条参数
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => setShowAdd((s) => !s)}>
          <Plus className="w-3.5 h-3.5" /> 补录一条
        </button>
      </div>

      <div className="flex gap-3">
        <div className={cn('card px-4 py-2 flex items-center gap-2', emptySetCount > 0 && 'border-amber-300 bg-amber-50')}>
          <TriangleAlert className={cn('w-4 h-4', emptySetCount > 0 ? 'text-amber-600' : 'text-slate-400')} />
          <span className="text-sm">
            空集合（∅）参数：<b className="font-mono-data">{emptySetCount}</b> 条
          </span>
        </div>
        <div className={cn('card px-4 py-2 flex items-center gap-2', missingUnitCount > 0 && 'border-amber-300 bg-amber-50')}>
          <AlertCircle className={cn('w-4 h-4', missingUnitCount > 0 ? 'text-amber-600' : 'text-slate-400')} />
          <span className="text-sm">
            单位缺失：<b className="font-mono-data">{missingUnitCount}</b> 条
          </span>
        </div>
      </div>

      {showAdd && (
        <div className="card p-4 space-y-3 border-navy-300">
          <p className="text-sm font-medium text-navy-800">补录新参数（批次 {new Date().toISOString().slice(0, 10)}）</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input className="border border-slate-300 px-2 py-1.5 text-sm" placeholder="参数名，如 weight.X→Y" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <input className="border border-slate-300 px-2 py-1.5 text-sm" placeholder="值（∅ 表示空集合）" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            <input className="border border-slate-300 px-2 py-1.5 text-sm" placeholder="单位（可留空）" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
            <input className="border border-slate-300 px-2 py-1.5 text-sm" placeholder="原始说法/来源" value={newRemark} onChange={(e) => setNewRemark(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm" onClick={() => setShowAdd(false)}>取消</button>
            <button className="btn btn-sm btn-primary" onClick={saveNew}><Save className="w-3.5 h-3.5" /> 保存到当前批次</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>参数名</th>
              <th>值</th>
              <th>单位</th>
              <th>批次</th>
              <th>原始说法 / 来源</th>
              <th style={{ width: 100 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {paramTable.rows.map((r) => (
              <>
                <tr key={r.id} className={cn(r.isEmptySet || r.missingUnit ? 'bg-amber-50/40' : '')}>
                  <td className="text-center">
                    <button onClick={() => toggleRow(r.id)} className="p-1">
                      {expandedRows[r.id]
                        ? <ChevronDown className="w-4 h-4 text-slate-500" />
                        : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </button>
                  </td>
                  <td className="font-mono-data text-navy-700">{r.key}</td>
                  <td>
                    {editingId === r.id ? (
                      <input className="border border-slate-300 px-2 py-0.5 w-24 text-sm font-mono-data" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                    ) : (
                      <span className={cn('font-mono-data', r.isEmptySet && 'text-amber-700 font-semibold')}>{r.value ?? '∅'}</span>
                    )}
                    {r.isEmptySet && !editingId && <span className="badge badge-amber ml-2">空集合</span>}
                  </td>
                  <td>
                    {editingId === r.id ? (
                      <input className="border border-slate-300 px-2 py-0.5 w-20 text-sm" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} placeholder="单位" />
                    ) : (
                      <>
                        <span className={cn(r.missingUnit && 'text-amber-700')}>
                          {r.unit ?? '— 缺失'}
                        </span>
                        {r.missingUnit && <span className="badge badge-amber ml-2">缺单位</span>}
                      </>
                    )}
                  </td>
                  <td className="font-mono-data text-xs text-slate-500">{r.batchNo}</td>
                  <td className="text-xs text-slate-600 max-w-xs">{r.sourceRemark}</td>
                  <td>
                    {editingId === r.id ? (
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-primary" onClick={() => saveEdit(r.id)}><Save className="w-3 h-3" /></button>
                        <button className="btn btn-sm" onClick={() => setEditingId(null)}>取消</button>
                      </div>
                    ) : (
                      <button className="btn btn-sm" onClick={() => startEdit(r.id, r.value ?? '', r.unit)}>修改</button>
                    )}
                  </td>
                </tr>
                {expandedRows[r.id] && r.changes.length > 0 && (
                  <tr key={`${r.id}-history`}>
                    <td></td>
                    <td colSpan={6}>
                      <div className="py-2 pl-6 border-l-2 border-navy-200 space-y-2">
                        <p className="text-xs text-slate-500 font-medium">变更历史（非覆盖，叠加追溯）：</p>
                        {r.changes.map((c) => (
                          <div key={c.id} className="text-xs bg-slate-50 p-2 border border-slate-200">
                            <div className="flex items-center gap-3">
                              <span className="font-mono-data text-slate-400">{c.changedAt}</span>
                              <span className="text-slate-700">{c.changedBy}</span>
                              <span className="badge badge-navy">{c.batchNo}</span>
                            </div>
                            <div className="mt-1 font-mono-data">
                              <span className="text-slate-500">{c.oldValue}</span>
                              <span className="mx-2 text-navy-600">→</span>
                              <span className="text-navy-800 font-semibold">{c.newValue}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <h3 className="font-display text-base text-navy-800 font-semibold mb-3">版本快照 · 分批录入追溯</h3>
        <div className="space-y-2">
          {paramTable.versions.slice().reverse().map((v) => (
            <div key={v.id} className="flex items-start gap-4 py-2 border-b border-slate-100 last:border-0">
              <span className="badge badge-navy mt-0.5">v{v.versionNo}</span>
              <div className="flex-1">
                <p className="text-sm text-slate-800">{v.remark}</p>
                <p className="text-xs text-slate-500 font-mono-data">{v.createdAt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
