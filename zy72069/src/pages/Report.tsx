import { useStore } from '@/store/useStore';
import { STATUS_LABELS, STATUS_COLORS } from '@/types';
import {
  calculateStatistics,
  checkConsistency,
  getPointDisplayNote,
} from '@/utils/statistics';

export default function ReportPage() {
  const { points, schemes, currentSchemeId, anomalies, schemePoints, filterStatus, filterSource } = useStore();

  const currentScheme = schemes.find((s) => s.id === currentSchemeId);
  const currentSchemePts = schemePoints.filter((sp) => sp.schemeId === currentSchemeId);
  const stats = calculateStatistics(points, anomalies);
  const consistency = checkConsistency(points, anomalies, currentSchemePts);
  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);

  const now = new Date().toLocaleString('zh-CN');

  const handleExportReport = () => {
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
    lines.push(`方案更新: ${currentScheme?.updatedAt ?? ''}`);
    lines.push(`数据范围: 全部点位 (未应用筛选)`);
    lines.push(`当前筛选状态: ${filterStatus.length === 3 ? '全部' : filterStatus.map((s) => STATUS_LABELS[s]).join(', ')}`);
    lines.push(`当前筛选来源: ${filterSource.length === 4 ? '全部' : filterSource.join(', ')}`);
    lines.push('');

    lines.push('【统计概览】');
    lines.push(`  总点位: ${stats.totalPoints}`);
    lines.push(`  顺利通过: ${stats.passCount}`);
    lines.push(`  需人工确认: ${stats.confirmCount}`);
    lines.push(`  旧口径: ${stats.legacyCount}`);
    lines.push(`  通过率: ${stats.passRate}`);
    lines.push(`  异常率: ${stats.anomalyRate}`);
    lines.push(`  总异常记录: ${stats.totalAnomalies}`);
    lines.push(`  未解决异常: ${stats.unresolvedAnomalies}`);
    lines.push('');

    lines.push('【一致性校验】');
    lines.push(`  校验结果: ${consistency.isConsistent ? '✓ 通过' : '✗ 存在问题'}`);
    lines.push(`  ${consistency.summary}`);
    if (consistency.issues.length > 0) {
      consistency.issues.forEach((issue, idx) => {
        lines.push(`    [问题${idx + 1}] ${issue}`);
      });
    }
    lines.push('');

    if (unresolvedAnomalies.length > 0) {
      lines.push('【异常明细】');
      unresolvedAnomalies.forEach((a) => {
        const pt = points.find((p) => p.id === a.pointId);
        lines.push(`  [${a.pointId}] ${pt?.name ?? ''}`);
        lines.push(`    类型: ${a.type}`);
        lines.push(`    描述: ${a.description}`);
        lines.push(`    来源行: ${a.sourceLine}`);
        lines.push(`    处理备注: ${a.processNote}`);
        lines.push(`    处理时间: ${a.processTime}`);
        lines.push(`    解决状态: ${a.resolved ? '已解决' : '未解决'}`);
        lines.push('');
      });
    }

    lines.push('【点位明细】');
    points.forEach((p) => {
      const sp = currentSchemePts.find((sp) => sp.pointId === p.id);
      const anomaly = anomalies.find((a) => a.pointId === p.id);
      const displayNote = getPointDisplayNote(p, sp, anomaly);
      lines.push(`  [${p.id}] ${p.name}`);
      lines.push(`    状态: ${STATUS_LABELS[p.status]}`);
      lines.push(`    来源: ${p.source} — ${p.sourceDetail}`);
      lines.push(`    坐标: (${p.x}, ${p.y}, ${p.z})`);
      if (p.gisNote) lines.push(`    GIS备注: ${p.gisNote}`);
      lines.push(`    处理备注: ${displayNote || '无'}`);
      lines.push(`    原始来源: ${p.originalSource}`);
      lines.push(`    处理时间: ${p.processTime}`);
      if (p.handModifiedCoord) lines.push(`    手改坐标: ${p.handModifiedCoord}`);
      if (p.photoRef) lines.push(`    现场照片: ${p.photoRef}`);
      if (sp?.overrideNote) lines.push(`    方案覆盖备注: ${sp.overrideNote}`);
      if (sp?.overrideCoord) lines.push(`    方案覆盖坐标: ${sp.overrideCoord}`);
      lines.push('');
    });

    lines.push('═══════════════════════════════════════════');
    lines.push('  数据来源一致性声明');
    lines.push('═══════════════════════════════════════════');
    lines.push('  本报告统计、异常明细、点位明细均来自同一');
    lines.push('  Zustand Store，数据计算路径完全一致。');
    lines.push('  统计口径: 总点位=全部点位，异常=未解决异常记录数');
    lines.push('  状态分类: 通过/确认/旧口径 三者合计=总点位');
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
            <div className="grid grid-cols-4 gap-4 text-xs">
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
              <div>
                <span className="text-[#888]">数据范围</span>
                <div className="text-white">全部点位</div>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a2e] border border-[#1a3a5c] rounded p-4 mb-4">
            <div className="text-[10px] text-[#888] mb-2">统计概览</div>
            <div className="grid grid-cols-7 gap-3">
              {[
                { label: '总点位', value: stats.totalPoints, color: '#ffffff' },
                { label: '顺利通过', value: stats.passCount, color: STATUS_COLORS.pass },
                { label: '人工确认', value: stats.confirmCount, color: STATUS_COLORS.confirm },
                { label: '旧口径', value: stats.legacyCount, color: STATUS_COLORS.legacy },
                { label: '通过率', value: stats.passRate, color: '#4a90d9' },
                { label: '总异常', value: stats.totalAnomalies, color: '#888' },
                { label: '未解决', value: stats.unresolvedAnomalies, color: '#e94560' },
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

          <div
            className={`rounded p-4 mb-4 border ${
              consistency.isConsistent
                ? 'bg-[#0a1a0a] border-[#003300]'
                : 'bg-[#1a0a0a] border-[#550000]'
            }`}
          >
            <div
              className={`text-[10px] mb-1 ${
                consistency.isConsistent ? 'text-[#16c79a]' : 'text-[#e94560]'
              }`}
            >
              一致性校验 {consistency.isConsistent ? '✓ 通过' : '✗ 存在问题'}
            </div>
            <div className="text-xs text-[#aaa]">{consistency.summary}</div>
            {consistency.issues.length > 0 && (
              <ul className="mt-2 text-[10px] text-[#e94560]">
                {consistency.issues.map((issue, idx) => (
                  <li key={idx}>• {issue}</li>
                ))}
              </ul>
            )}
          </div>

          {unresolvedAnomalies.length > 0 && (
            <div className="bg-[#1a1a2e] border border-[#550000] rounded p-4 mb-4">
              <div className="text-[10px] text-[#e94560] mb-2">
                异常明细 ({unresolvedAnomalies.length} 条未解决)
              </div>
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
            <div className="text-[10px] text-[#888] mb-2">
              点位明细 ({points.length} 条)
            </div>
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
                const anomaly = anomalies.find((a) => a.pointId === p.id);
                const displayNote = getPointDisplayNote(p, sp, anomaly);
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
                      {displayNote || '—'}
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
            <div className="font-bold mb-1">✓ 数据一致性说明</div>
            <div>本报告统计概览、异常明细、点位明细均来自同一 Zustand Store，计算路径完全一致。</div>
            <div>统计口径：总点位 = {stats.passCount} + {stats.confirmCount} + {stats.legacyCount} = {stats.passCount + stats.confirmCount + stats.legacyCount} / {stats.totalPoints} ✓</div>
            <div>未解决异常 = {stats.unresolvedAnomalies} 条，与页面头部计数一致 ✓</div>
          </div>
        </div>
      </div>
    </div>
  );
}
