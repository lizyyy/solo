import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { statusLabel } from '../utils/format';
import type { TabKey, SupplementRecord } from '../types';

interface Props { itemId?: string; onGo: (tab: TabKey, itemId?: string) => void }

export default function SupplementPage({ itemId, onGo }: Props) {
  const { items, addSupplement } = useStore();
  const current = items.find(i => i.id === itemId) ?? items[1]; // 默认 JD-002

  const [note, setNote] = useState(
    '【封账前补录-2026-06】经与设计院张工电话确认，最终以V2.2为准：桥架宽度600mm，\n风管交叉处局部降板已预留，BIM模型于6月10日同步更新版本号Rev-0610。'
  );
  const [operator] = useState('施工经理阿乔');
  const [done, setDone] = useState(false);

  // 实时计算补录带来的变化
  const hasNote = note.trim().length > 20;

  const exportDiff = hasNote
    ? [
        { field: 'BIM模型备注', before: current.bimNote.slice(0, 28) + '…', after: note.slice(0, 28) + '…' },
        { field: '图纸确认版本', before: '未确认（V2.1/V2.2分歧）', after: 'V2.2（已电话确认）' },
        { field: '可否施工', before: '否', after: '是' },
        { field: '冲突风险等级', before: '中风险', after: '低风险' }
      ]
    : [];

  const changedJudgements = hasNote
    ? [
        '解除"图纸版本分歧"判断：V2.2 为最终版',
        '由"待补备注→可施工"：状态流转为已确认',
        '冲突风险由中降为低：风管交叉处预留满足',
        'BIM模型锁定版本 Rev-0610，月底封账不再改'
      ]
    : [];

  function submit() {
    if (!hasNote) return;
    const rec: SupplementRecord = {
      id: 'sup-' + Date.now(),
      itemId: current.id,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      operator,
      beforeBimNote: current.bimNote,
      afterBimNote: note,
      exportDiff,
      changedJudgements
    };
    addSupplement(rec);
    setDone(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center text-sm text-muted">
        <button onClick={() => onGo('list')} className="hover:underline">← 返回清单</button>
        <span className="mx-2">·</span>
        <span>月底封账前 · 补录 BIM 备注</span>
      </div>

      {/* 条目卡片 */}
      <section className="border border-line rounded-lg p-4 grid grid-cols-4 gap-4 text-sm">
        <div><div className="text-muted">编号</div><div className="text-ink font-mono">{current.code}</div></div>
        <div><div className="text-muted">专业/系统</div><div className="text-ink">{current.major} · {current.system}</div></div>
        <div><div className="text-muted">部位</div><div className="text-ink">{current.location}</div></div>
        <div><div className="text-muted">状态</div><div className="text-ink">{statusLabel[current.status]}</div></div>
      </section>

      <div className="grid grid-cols-5 gap-6">
        {/* 左：输入 */}
        <section className="col-span-3 border border-line rounded-lg overflow-hidden">
          <header className="px-4 py-3 border-b border-line">
            <h3 className="font-semibold text-ink">补录 BIM 模型备注</h3>
            <p className="text-xs text-muted mt-0.5">月底封账前临时补，系统会自动记录对结论的影响</p>
          </header>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs text-muted block mb-1">操作人</label>
              <div className="text-sm text-ink border border-line rounded px-3 py-2 bg-slate-50">{operator}</div>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">当前 BIM 备注（作为"补录前"留痕）</label>
              <div className="text-sm text-muted border border-line rounded px-3 py-2 bg-slate-50 whitespace-pre-wrap">
                {current.bimNote}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">补录的 BIM 备注（月底封账临时补）</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={6}
                className="w-full text-sm text-ink border border-line rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => onGo('list')}
                className="px-4 py-2 text-sm text-muted border border-line rounded hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={submit}
                disabled={!hasNote || done}
                className="px-4 py-2 text-sm text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
              >
                {done ? '✓ 已补录' : '确认补录并生成变化说明'}
              </button>
            </div>
          </div>
        </section>

        {/* 右：实时预览变化 */}
        <section className="col-span-2 border border-line rounded-lg overflow-hidden">
          <header className="px-4 py-3 border-b border-line bg-amber-50/60">
            <h3 className="font-semibold text-ink">补录带来的变化（实时预览）</h3>
            <p className="text-xs text-muted mt-0.5">提交后这些变化会写入导出差异清单</p>
          </header>
          <div className="p-4 space-y-4 text-sm">
            <div>
              <div className="text-xs text-muted mb-1">改变了哪些判断</div>
              {changedJudgements.length === 0 && <div className="text-muted text-xs">— 请先填写备注 —</div>}
              <ul className="space-y-1 text-ink list-disc list-inside text-sm">
                {changedJudgements.map((j, i) => <li key={i}>{j}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">导出文件会变的字段</div>
              {exportDiff.length === 0 && <div className="text-muted text-xs">—</div>}
              <table className="w-full text-xs border border-line rounded overflow-hidden">
                <thead className="bg-slate-50 text-muted">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">字段</th>
                    <th className="text-left px-2 py-1 font-medium">原值</th>
                    <th className="text-left px-2 py-1 font-medium">新值</th>
                  </tr>
                </thead>
                <tbody>
                  {exportDiff.map((d, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-2 py-1 text-ink font-medium">{d.field}</td>
                      <td className="px-2 py-1 text-muted line-through">{d.before}</td>
                      <td className="px-2 py-1 text-ok">{d.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {done && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm">
                <div className="font-medium text-ok">✓ 补录完成</div>
                <div className="text-muted mt-1">
                  现在可以：
                  <button onClick={() => onGo('analysis', current.id)} className="ml-1 underline text-sky-700">
                    去分析页看完整影响链 →
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
