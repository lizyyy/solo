import type { JumpCause, Material, FittingResult } from '../types';

interface Props {
  causes: JumpCause[];
  materials: Material[];
  fittingResults: Record<string, FittingResult>;
}

const TYPE_STYLE: Record<JumpCause['type'], { bg: string; icon: string; title: string; desc: string }> = {
  threshold: {
    bg: 'bg-blue-50 border-blue-300',
    icon: '🎚️',
    title: '阈值 / 拟合参数变更',
    desc: '筛选口径中的参数设置前后不一致，可能导致拟合结果跳变',
  },
  unit: {
    bg: 'bg-amber-50 border-amber-300',
    icon: '⚖️',
    title: '单位不一致',
    desc: '材料单位存在历史变更或存疑，需确认统一后再比较',
  },
  name_mismatch: {
    bg: 'bg-purple-50 border-purple-300',
    icon: '🏷️',
    title: '材料名称写法不一致',
    desc: '同一条材料在历史中有多个名称，可能导致两次分析时匹配混乱',
  },
};

export default function JumpAnalysis({ causes, materials, fittingResults }: Props) {
  const materialAlerts = materials.filter(m => {
    const r = fittingResults[m.id];
    return m.nameHistory.length > 2 || r?.boundaryWarning || r?.unstableSort?.unstable || m.status === 'missing'
      || m.sortNote?.includes('⚠️') || m.sortNote?.includes('单位');
  });

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="font-semibold text-slate-800 text-lg">🔍 结果跳变分析</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              自动检测可能导致拟合结果前后跳变的三类原因：阈值参数、单位差异、名称不一致
            </p>
          </div>
          <div className={`tag ${causes.length === 0 ? 'tag-green' : causes.length <= 2 ? 'tag-yellow' : 'tag-red'}`}>
            {causes.length === 0 ? '无跳变风险' : `检测到 ${causes.length} 项跳变风险`}
          </div>
        </div>

        <div className="card-body">
          {causes.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-5xl mb-3">✅</div>
              <p>未检测到显著跳变因素</p>
              <p className="text-xs mt-1">当切换筛选口径、改名材料或修改参数时会自动重新检测</p>
            </div>
          ) : (
            <div className="space-y-3">
              {causes.map((c, i) => {
                const s = TYPE_STYLE[c.type];
                return (
                  <div key={i} className={`rounded-xl border-2 ${s.bg} p-4`}>
                    <div className="flex items-start gap-3">
                      <div className="text-3xl flex-shrink-0">{s.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-slate-800">{s.title}</h3>
                          {c.beforeValue !== undefined && c.afterValue !== undefined && (
                            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded-full border border-slate-200">
                              {c.beforeValue.toFixed(4)} → {c.afterValue.toFixed(4)}
                              <span className={c.afterValue > c.beforeValue ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                                ({c.afterValue > c.beforeValue ? '+' : ''}{(c.afterValue - c.beforeValue).toFixed(4)})
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mb-2">{s.desc}</p>
                        <div className="text-sm text-slate-700 bg-white rounded-lg p-3 border border-slate-200">
                          <strong className="text-slate-800">{c.description}</strong>
                          <div className="mt-1.5 text-slate-600">{c.detail}</div>
                          {c.affectedMaterials && c.affectedMaterials.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {c.affectedMaterials.map(name => (
                                <span key={name} className="tag tag-yellow">{name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="font-semibold text-slate-800">🔗 材料异常清单</h2>
            <p className="text-xs text-slate-500 mt-0.5">以下材料包含各类需要关注的异常项（交接时请逐条过一遍）</p>
          </div>
          <span className="tag tag-red">{materialAlerts.length} 条需关注</span>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="th">材料</th>
                  <th className="th">边界样本</th>
                  <th className="th">排序</th>
                  <th className="th">改名历史</th>
                  <th className="th">单位</th>
                  <th className="th">状态</th>
                  <th className="th">异常说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materialAlerts.map(m => {
                  const r = fittingResults[m.id];
                  const hasNameIssue = m.nameHistory.length > 2;
                  const hasBoundaryIssue = r?.boundaryWarning;
                  const hasSortIssue = r?.unstableSort?.unstable || m.sortNote?.includes('⚠️');
                  const hasUnitIssue = m.sortNote?.includes('单位');
                  const isMissing = m.status === 'missing';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="td">
                        <div className="font-medium text-slate-800">{m.currentName}</div>
                        <div className="text-xs text-slate-400">{m.id}</div>
                      </td>
                      <td className="td">
                        {hasBoundaryIssue
                          ? <span className="tag tag-red">⚠️ 不足({r?.boundarySampleCount})</span>
                          : <span className="tag tag-green">✓ 齐全</span>}
                      </td>
                      <td className="td">
                        {hasSortIssue
                          ? <span className="tag tag-yellow">⚠️ 不稳定</span>
                          : <span className="tag tag-green">✓ 正常</span>}
                      </td>
                      <td className="td">
                        {hasNameIssue
                          ? <span className="tag tag-yellow">{m.nameHistory.length} 次变更</span>
                          : <span className="tag tag-gray">{m.nameHistory.length}</span>}
                      </td>
                      <td className="td">
                        {hasUnitIssue
                          ? <span className="tag tag-amber" style={{ borderColor: '#f59e0b', backgroundColor: '#fffbeb', color: '#92400e' }}>⚠️ 存疑({m.unit})</span>
                          : <span className="tag tag-gray">{m.unit}</span>}
                      </td>
                      <td className="td">
                        {isMissing
                          ? <span className="tag tag-red">缺材料</span>
                          : <span className="tag tag-blue">{m.status}</span>}
                      </td>
                      <td className="td max-w-xs">
                        <div className="text-xs text-slate-600 whitespace-normal leading-relaxed">
                          {m.sortNote || m.draftOriginalText?.slice(0, 100)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
