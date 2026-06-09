import { useStore } from '../hooks/useStore';
import { clashLabel, clashTone, statusLabel } from '../utils/format';
import type { TabKey } from '../types';

interface Props { itemId?: string; onGo: (tab: TabKey, itemId?: string) => void }

export default function AnalysisPage({ itemId, onGo }: Props) {
  const { items } = useStore();
  const current = items.find(i => i.id === itemId) ?? items[2]; // 默认演示 JD-003

  return (
    <div className="space-y-6">
      {/* 顶部导航提示 */}
      <div className="flex items-center text-sm text-muted">
        <button onClick={() => onGo('list')} className="hover:underline">← 返回清单</button>
        <span className="mx-2">·</span>
        <span>分析页 · 朴素版</span>
        <select
          className="ml-auto px-2 py-1 border border-line rounded text-sm"
          value={current.id}
          onChange={e => onGo('analysis', e.target.value)}
        >
          {items.map(i => (
            <option key={i.id} value={i.id}>{i.code} · {i.system}</option>
          ))}
        </select>
      </div>

      {/* 条目基本信息 */}
      <section className="border border-line rounded-lg p-4 grid grid-cols-4 gap-4 text-sm">
        <div><div className="text-muted">编号</div><div className="text-ink font-mono">{current.code}</div></div>
        <div><div className="text-muted">专业/系统</div><div className="text-ink">{current.major} · {current.system}</div></div>
        <div><div className="text-muted">部位</div><div className="text-ink">{current.location}</div></div>
        <div><div className="text-muted">状态</div><div className="text-ink">{statusLabel[current.status]}</div></div>
      </section>

      {/* 关键：人工改判为什么影响结论 */}
      <section className="border border-line rounded-lg overflow-hidden">
        <header className="px-4 py-3 border-b border-line bg-rose-50/60">
          <h3 className="font-semibold text-ink">关键·人工改判影响说明</h3>
          <p className="text-xs text-muted mt-0.5">讲清"一条改判"改变了哪些判断、影响哪些范围</p>
        </header>

        {current.overrides.length === 0 && (
          <div className="p-6 text-sm text-muted text-center">该条暂无人工改判记录</div>
        )}

        {current.overrides.map(ov => (
          <div key={ov.id} className="divide-y divide-line">
            {/* 改判前后对比 */}
            <div className="grid grid-cols-2 gap-0">
              <div className="p-4 border-r border-line">
                <div className="text-xs text-muted mb-2">改判前 · 自动结论</div>
                <ul className="text-sm space-y-1">
                  <li>可施工：<b className="text-ok">{ov.before.canConstruct ? '是' : '否'}</b></li>
                  <li>冲突风险：<b className={clashTone(ov.before.clashRisk)}>{clashLabel(ov.before.clashRisk)}</b></li>
                  <li>需协调：<b>{ov.before.needCoordination ? '是' : '否'}</b></li>
                  <li className="text-muted">备注：{ov.before.remark}</li>
                </ul>
              </div>
              <div className="p-4">
                <div className="text-xs text-bad mb-2">改判后 · {ov.operator} · {ov.createdAt}</div>
                <ul className="text-sm space-y-1">
                  <li>可施工：<b className="text-bad">{ov.after.canConstruct ? '是' : '否'}</b></li>
                  <li>冲突风险：<b className={clashTone(ov.after.clashRisk)}>{clashLabel(ov.after.clashRisk)}</b></li>
                  <li>需协调：<b>{ov.after.needCoordination ? '是' : '否'}</b></li>
                  <li className="text-muted">备注：{ov.after.remark}</li>
                </ul>
              </div>
            </div>

            {/* 改判原因 */}
            <div className="p-4">
              <div className="text-xs text-muted mb-1">改判原因</div>
              <div className="text-sm text-ink bg-slate-50 p-3 rounded">{ov.reason}</div>
            </div>

            {/* 影响的结论点（逐条列出） */}
            <div className="p-4">
              <div className="text-xs text-muted mb-2">影响到的结论点（导出时逐条附在后面）</div>
              <ol className="text-sm text-ink list-decimal list-inside space-y-1">
                {ov.impactPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ol>
            </div>

            {/* 影响范围 */}
            <div className="p-4">
              <div className="text-xs text-muted mb-2">影响范围</div>
              <div className="flex flex-wrap gap-2">
                {ov.scope.map(s => (
                  <span key={s} className="text-xs border border-line bg-slate-50 px-2 py-0.5 rounded text-ink">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 变更单晚到追踪：留来源行和影响范围 */}
      <section className="border border-line rounded-lg overflow-hidden">
        <header className="px-4 py-3 border-b border-line bg-orange-50/60">
          <h3 className="font-semibold text-ink">变更单追踪</h3>
          <p className="text-xs text-muted mt-0.5">过去靠人眼扫，现在保留来源行 + 影响范围</p>
        </header>
        {current.changeTracks.length === 0 && (
          <div className="p-6 text-sm text-muted text-center">该条暂无变更单</div>
        )}
        {current.changeTracks.map(ct => (
          <div key={ct.id} className="p-4 space-y-3 text-sm divide-y divide-line">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted">变更单号</div>
                <div className="text-ink font-mono">{ct.changeNo}
                  {ct.receivedLate && <span className="ml-2 text-xs text-bad">· 晚到</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">来源行（对应原清单）</div>
                <div className="text-ink">{ct.sourceRow}</div>
              </div>
              <div>
                <div className="text-xs text-muted">影响范围</div>
                <div className="text-ink">{ct.scope}</div>
              </div>
            </div>
            <div className="pt-3">
              <div className="text-xs text-muted mb-1">影响的清单条目行</div>
              <div className="flex flex-wrap gap-2">
                {ct.impactRows.map(r => (
                  <span key={r} className="text-xs border border-orange-200 bg-orange-50 text-orange-800 px-2 py-0.5 rounded font-mono">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-3">
              <div className="text-xs text-muted mb-1">备注</div>
              <div className="text-ink bg-slate-50 p-2 rounded text-xs">{ct.note}</div>
            </div>
          </div>
        ))}
      </section>

      {/* 补录后导出变化说明 */}
      <section className="border border-line rounded-lg overflow-hidden">
        <header className="px-4 py-3 border-b border-line bg-amber-50/60">
          <h3 className="font-semibold text-ink">补录备注 → 导出变化追踪</h3>
          <p className="text-xs text-muted mt-0.5">月底前补的BIM备注，系统说明改了哪些字段</p>
        </header>
        {current.supplements.length === 0 && (
          <div className="p-6 text-sm text-muted text-center">
            该条暂无补录记录。{current.status === 'supplement_pending' && (
              <button onClick={() => onGo('supplement', current.id)} className="ml-2 text-amber-700 underline">
                立即去补录 →
              </button>
            )}
          </div>
        )}
        {current.supplements.map(s => (
          <div key={s.id} className="p-4 space-y-3 text-sm">
            <div className="flex items-center text-xs text-muted">
              <span>补录人：{s.operator}</span>
              <span className="mx-2">·</span>
              <span>{s.createdAt}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted mb-1">补录前 BIM 备注</div>
                <div className="text-ink bg-slate-50 p-2 rounded">{s.beforeBimNote || '— 空 —'}</div>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">补录后 BIM 备注</div>
                <div className="text-ink bg-emerald-50 p-2 rounded">{s.afterBimNote}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">这次补录改变了哪些判断</div>
              <ul className="text-sm text-ink list-disc list-inside space-y-0.5">
                {s.changedJudgements.map((j, i) => <li key={i}>{j}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">导出受影响的字段（导出文件中这些行会标黄）</div>
              <table className="w-full text-xs border border-line rounded overflow-hidden">
                <thead className="bg-slate-50 text-muted">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">字段</th>
                    <th className="text-left px-2 py-1 font-medium">导出原值</th>
                    <th className="text-left px-2 py-1 font-medium">导出新值</th>
                  </tr>
                </thead>
                <tbody>
                  {s.exportDiff.map((d, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-2 py-1 text-ink font-medium">{d.field}</td>
                      <td className="px-2 py-1 text-muted">{d.before}</td>
                      <td className="px-2 py-1 text-ok">{d.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
