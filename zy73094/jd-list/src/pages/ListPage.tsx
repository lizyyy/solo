import { useStore } from '../hooks/useStore';
import { statusLabel, statusTone, clashLabel, clashTone, progressOf, gapsOf } from '../utils/format';
import type { TabKey } from '../types';

interface Props { onGo: (tab: TabKey, itemId?: string) => void }

export default function ListPage({ onGo }: Props) {
  const { items } = useStore();
  const prog = progressOf(items);
  const gaps = gapsOf(items);

  return (
    <div className="space-y-6">
      {/* 顶部：进度 + 缺口 */}
      <section className="grid grid-cols-3 gap-4">
        <div className="border border-line rounded-lg p-4">
          <div className="text-sm text-muted">处理进度</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-ink">{prog.percent}</span>
            <span className="text-muted">%</span>
            <span className="ml-auto text-sm text-muted">
              {prog.done}/{prog.total} 条已确认
            </span>
          </div>
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-ok" style={{ width: `${prog.percent}%` }} />
          </div>
        </div>

        <div className="border border-line rounded-lg p-4">
          <div className="text-sm text-muted">待处理缺口</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-warn">{prog.pending}</span>
            <span className="text-muted">条</span>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {gaps.length === 0 && <li className="text-muted">— 当前无缺口</li>}
            {gaps.slice(0, 3).map(g => (
              <li key={g.code} className="flex justify-between">
                <span className="font-medium text-ink">{g.code}</span>
                <span className="text-warn">{g.gap}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-line rounded-lg p-4">
          <div className="text-sm text-muted">交接提示（项目经理按此走）</div>
          <ol className="mt-3 space-y-2 text-sm list-decimal list-inside">
            <li className="text-ink">看 <b>JD-001</b>：顺利记录，了解正常确认长什么样</li>
            <li className="text-ink">打开 <b>JD-002</b> → 点"补录BIM备注"走一遍补录流程</li>
            <li className="text-ink">打开 <b>JD-003</b> → 进入分析页看人工改判如何影响结论</li>
            <li className="text-muted">最后看右下角"导出变化"核对本次补录改了哪些字段</li>
          </ol>
        </div>
      </section>

      {/* 清单表格 */}
      <section className="border border-line rounded-lg overflow-hidden">
        <header className="px-4 py-3 border-b border-line flex items-center">
          <h2 className="font-semibold text-ink">机电管综交底清单</h2>
          <div className="ml-auto text-xs text-muted">共 {items.length} 条 · 处理人：阿乔</div>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-muted">
            <tr>
              <th className="text-left px-4 py-2 font-medium">编号</th>
              <th className="text-left px-4 py-2 font-medium">专业/系统</th>
              <th className="text-left px-4 py-2 font-medium">部位</th>
              <th className="text-left px-4 py-2 font-medium">图纸版本</th>
              <th className="text-left px-4 py-2 font-medium">BIM备注</th>
              <th className="text-left px-4 py-2 font-medium">冲突</th>
              <th className="text-left px-4 py-2 font-medium">状态</th>
              <th className="text-right px-4 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-t border-line align-top hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono text-ink">{it.code}</td>
                <td className="px-4 py-3">
                  <div className="text-ink font-medium">{it.major}</div>
                  <div className="text-xs text-muted">{it.system}</div>
                </td>
                <td className="px-4 py-3 text-ink">{it.location}</td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    {it.versions.map(v => (
                      <div key={v.version} className="text-xs">
                        <span className="font-mono text-ink">{v.version}</span>
                        <span className="text-muted ml-2">{v.date}</span>
                        {v.note && <div className="text-muted">{v.note}</div>}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-xs text-muted">{it.bimNote}</td>
                <td className={`px-4 py-3 ${clashTone(it.conclusion.clashRisk)}`}>
                  {clashLabel(it.conclusion.clashRisk)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs border ${statusTone[it.status]}`}>
                    {statusLabel[it.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {it.status === 'supplement_pending' && (
                    <button
                      onClick={() => onGo('supplement', it.id)}
                      className="text-xs text-amber-700 hover:underline"
                    >
                      补录备注
                    </button>
                  )}
                  <button
                    onClick={() => onGo('analysis', it.id)}
                    className="text-xs text-sky-700 hover:underline"
                  >
                    分析
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
