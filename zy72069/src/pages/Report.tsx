import { useStore } from '@/store/useStore';
import { STATUS_LABELS, STATUS_COLORS } from '@/types';
import type { PointStatus, PointLocation } from '@/types';

export default function ReportPage() {
  const { points, schemes, currentSchemeId, anomalies, schemePoints } = useStore();

  const currentScheme = schemes.find((s) => s.id === currentSchemeId);
  const currentSchemePts = schemePoints.filter((sp) => sp.schemeId === currentSchemeId);

  const passCount = points.filter((p) => p.status === 'pass').length;
  const confirmCount = points.filter((p) => p.status === 'confirm').length;
  const legacyCount = points.filter((p) => p.status === 'legacy').length;
  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);

  const now = new Date().toLocaleString('zh-CN');

  const handleExportReport = () => {
    const reportEl = document.getElementById('report-content');
    if (!reportEl) return;

    const text = generateTextReport();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.download = `电场线空间台报告_${now.replace(/[/: ]/g, '_')}.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const generateTextReport = () => {
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════');
    lines.push('        教学电场线空间台 — 报告');
    lines.push('═══════════════════════════════════════════');
    lines.push(`生成时间: ${now}`);
    lines.push(`当前方案: ${currentScheme?.name ?? '未选择'} (${currentScheme?.version ?? ''})`);
    lines.push('');

    lines.push('【统计概览】');
    lines.push(`  总点位: ${points.length}`);
    lines.push(`  顺利通过: ${passCount}`);
    lines.push(`  需人工确认: ${confirmCount}`);
    lines.push(`  旧口径: ${legacyCount}`);
    lines.push(`  未解决异常: ${unresolvedAnomalies.length}`);
    lines.push('');

    lines.push('【异常明细】');
    unresolvedAnomalies.forEach((a) => {
      const pt = points.find((p) => p.id === a.pointId);
      lines.push(`  [${a.pointId}] ${pt?.name ?? ''}`);
      lines.push(`    类型: ${a.type}`);
      lines.push(`    描述: ${a.description}`);
      lines.push(`    来源行: ${a.sourceLine}`);
      lines.push(`    处理备注: ${a.processNote}`);
      lines.push(`    处理时间: ${a.processTime}`);
      lines.push('');
    });

    lines.push('【点位明细】');
    points.forEach((p) => {
      const sp = currentSchemePts.find((sp) => sp.pointId === p.id);
      lines.push(`  [${p.id}] ${p.name}`);
      lines.push(`    状态: ${STATUS_LABELS[p.status]}`);
      lines.push(`    来源: ${p.source} — ${p.sourceDetail}`);
      lines.push(`    坐标: (${p.x}, ${p.y}, ${p.z})`);
      if (p.gisNote) lines.push(`    GIS备注: ${p.gisNote}`);
      lines.push(`    处理备注: ${p.processNote || '无'}`);
      lines.push(`    原始来源: ${p.originalSource}`);
      lines.push(`    处理时间: ${p.processTime}`);
      if (p.handModifiedCoord) lines.push(`    手改坐标: ${p.handModifiedCoord}`);
      if (sp?.overrideNote) lines.push(`    方案覆盖备注: ${sp.overrideNote}`);
      if (sp?.overrideCoord) lines.push(`    方案覆盖坐标: ${sp.overrideCoord}`);
      lines.push('');
    });

    lines.push('═══════════════════════════════════════════');
    lines.push('  报告与明细数据来源一致，未经二次计算');
    lines.push('═══════════════════════════════════════════');

    return lines.join('\n');
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold">教学电场线空间台 — 报告</h1>
          <div className="flex gap-2">
            <button
              onClick={handleExportReport}
              className="px-4 py-2 bg-[#0f3460] hover:bg-[#1a4a80] text-white text-xs rounded transition-colors"
            >
              导出报告
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-[#222] hover:bg-[#333] text-white text-xs rounded transition-colors"
            >
              返回空间台
            </a>
          </div>
        </div>

        <div id="report-content">
          <div className="bg-[#1a1a2e] border border-[#1a3a5c] rounded p-4 mb-4">
            <div className="text-[10px] text-[#888] mb-2">报告元信息</div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[#888]">生成时间</span>
                <div className="text-white">{now}</div>
              </div>
              <div>
                <span className="text-[#888]">当前方案</span>
                <div className="text-[#4a90d9]">{currentScheme?.name} ({currentScheme?.version})</div>
              </div>
              <div>
                <span className="text-[#888]">方案更新</span>
                <div className="text-white">{currentScheme?.updatedAt}</div>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a2e] border border-[#1a3a5c] rounded p-4 mb-4">
            <div className="text-[10px] text-[#888] mb-2">统计概览</div>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: '总点位', value: points.length, color: '#ffffff' },
                { label: '顺利通过', value: passCount, color: STATUS_COLORS.pass },
                { label: '人工确认', value: confirmCount, color: STATUS_COLORS.confirm },
                { label: '旧口径', value: legacyCount, color: STATUS_COLORS.legacy },
                { label: '未解决异常', value: unresolvedAnomalies.length, color: '#e94560' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-2xl font-bold" style={{ color: item.color }}>
                    {item.value}
                  </div>
                  <div className="text-[10px] text-[#888]">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {unresolvedAnomalies.length > 0 && (
            <div className="bg-[#1a1a2e] border border-[#550000] rounded p-4 mb-4">
              <div className="text-[10px] text-[#e94560] mb-2">异常明细</div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-[#888] text-[10px]">
                    <th className="text-left p-1.5 border-b border-[#333]">点位</th>
                    <th className="text-left p-1.5 border-b border-[#333]">类型</th>
                    <th className="text-left p-1.5 border-b border-[#333]">描述</th>
                    <th className="text-left p-1.5 border-b border-[#333]">来源行</th>
                    <th className="text-left p-1.5 border-b border-[#333]">处理备注</th>
                    <th className="text-left p-1.5 border-b border-[#333]">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {unresolvedAnomalies.map((a) => {
                    const pt = points.find((p) => p.id === a.pointId);
                    return (
                      <tr key={a.id}>
                        <td className="p-1.5 border-b border-[#111]">
                          <span className="text-[#4a90d9]">{a.pointId}</span>
                          <span className="text-[#666]"> {pt?.name}</span>
                        </td>
                        <td className="p-1.5 border-b border-[#111] text-[#e94560]">{a.type}</td>
                        <td className="p-1.5 border-b border-[#111] text-[#aaa]">{a.description}</td>
                        <td className="p-1.5 border-b border-[#111] text-[#4a90d9]">{a.sourceLine}</td>
                        <td className="p-1.5 border-b border-[#111] text-[#aaa]">{a.processNote}</td>
                        <td className="p-1.5 border-b border-[#111] text-[#666] font-mono">{a.processTime}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-[#1a1a2e] border border-[#1a3a5c] rounded p-4">
            <div className="text-[10px] text-[#888] mb-2">点位明细</div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-[#888] text-[10px]">
                  <th className="text-left p-1.5 border-b border-[#333]">ID</th>
                  <th className="text-left p-1.5 border-b border-[#333]">名称</th>
                  <th className="text-left p-1.5 border-b border-[#333]">状态</th>
                  <th className="text-left p-1.5 border-b border-[#333]">来源</th>
                  <th className="text-left p-1.5 border-b border-[#333]">GIS备注</th>
                  <th className="text-left p-1.5 border-b border-[#333]">处理备注</th>
                  <th className="text-left p-1.5 border-b border-[#333]">原始来源</th>
                  <th className="text-left p-1.5 border-b border-[#333]">处理时间</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => {
                  const sp = currentSchemePts.find((sp) => sp.pointId === p.id);
                  return (
                    <tr key={p.id}>
                      <td className="p-1.5 border-b border-[#111] text-[#4a90d9] font-mono">{p.id}</td>
                      <td className="p-1.5 border-b border-[#111] text-white">{p.name}</td>
                      <td className="p-1.5 border-b border-[#111]">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px]"
                          style={{
                            backgroundColor: STATUS_COLORS[p.status] + '22',
                            color: STATUS_COLORS[p.status],
                          }}
                        >
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="p-1.5 border-b border-[#111] text-[#aaa]">{p.source}</td>
                      <td className="p-1.5 border-b border-[#111] text-[#f5a623]">{p.gisNote || '—'}</td>
                      <td className="p-1.5 border-b border-[#111] text-[#aaa]">
                        {sp?.overrideNote || p.processNote || '—'}
                      </td>
                      <td className="p-1.5 border-b border-[#111] text-[#4a90d9]">{p.originalSource}</td>
                      <td className="p-1.5 border-b border-[#111] text-[#666] font-mono">{p.processTime}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-[#0a1a0a] border border-[#003300] rounded text-[10px] text-[#16c79a]">
            ✓ 本报告与空间台明细数据来源一致（同一 Zustand Store），未经二次计算。点位状态、异常记录、方案覆盖均直接引用原始数据。
          </div>
        </div>
      </div>
    </div>
  );
}
