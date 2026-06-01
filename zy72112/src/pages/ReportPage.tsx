import { useParams, useNavigate } from 'react-router-dom';
import { useBatchStore } from '../store/useBatchStore';
import {
  FlaskConical,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  FileText,
  User,
} from 'lucide-react';

export default function ReportPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const batches = useBatchStore(s => s.batches);
  const getComparison = useBatchStore(s => s.getComparison);

  const batch = batches.find(b => b.id === batchId);
  const comparison = batchId ? getComparison(batchId) : null;

  if (!batch) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <FlaskConical className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono">批次数据未找到</p>
          <button onClick={() => navigate('/tuning')} className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-mono text-sm">
            返回调参
          </button>
        </div>
      </div>
    );
  }

  const smoothCount = batch.records.filter(r => r.recordType === 'smooth').length;
  const pendingCount = batch.records.filter(r => r.recordType === 'pending').length;
  const oldCaliberCount = batch.records.filter(r => r.recordType === 'old_caliber').length;
  const autoPassCount = batch.records.filter(r => r.status === 'auto_pass').length;
  const confirmedCount = batch.records.filter(r => r.status === 'confirmed').length;
  const pendingStatusCount = batch.records.filter(r => r.status === 'pending').length;

  const handleExport = () => {
    const reportEl = document.getElementById('report-content');
    if (!reportEl) return;

    import('html2pdf.js').then(module => {
      const html2pdf = module.default;
      html2pdf().set({
        margin: 10,
        filename: `磁悬浮小车轨道调参报告_${batch.name}_${new Date().toLocaleDateString('zh-CN')}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(reportEl).save();
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-blue-500" />
            <h1 className="text-lg font-mono font-bold tracking-tight">磁悬浮小车轨道调参系统</h1>
          </div>
          <nav className="flex items-center gap-2 text-sm font-mono">
            <button onClick={() => navigate('/')} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">数据导入</button>
            <button onClick={() => navigate('/tuning')} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">调参主流程</button>
            {comparison && (
              <button onClick={() => navigate(`/compare/${batchId}`)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">历史对比</button>
            )}
            <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">交接报告</span>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/tuning')}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回调参
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-mono font-bold mb-1">交接报告</h2>
            <p className="text-zinc-500 text-sm font-mono">{batch.name}</p>
          </div>
          <button
            onClick={handleExport}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded font-mono text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            导出PDF
          </button>
        </div>

        <div id="report-content" className="space-y-8">
          <section className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30">
            <h3 className="font-mono font-bold mb-5 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              报告摘要
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-zinc-900/50 rounded border border-zinc-800">
                <div className="text-3xl font-mono font-bold text-zinc-100">{batch.records.length}</div>
                <div className="text-xs text-zinc-500 font-mono mt-1">总记录数</div>
              </div>
              <div className="text-center p-4 bg-green-500/5 rounded border border-green-500/20">
                <div className="text-3xl font-mono font-bold text-green-400">{smoothCount}</div>
                <div className="text-xs text-zinc-500 font-mono mt-1">顺利记录</div>
              </div>
              <div className="text-center p-4 bg-orange-500/5 rounded border border-orange-500/20">
                <div className="text-3xl font-mono font-bold text-orange-400">{pendingCount}</div>
                <div className="text-xs text-zinc-500 font-mono mt-1">待确认记录</div>
              </div>
              <div className="text-center p-4 bg-zinc-500/5 rounded border border-zinc-500/20">
                <div className="text-3xl font-mono font-bold text-zinc-400">{oldCaliberCount}</div>
                <div className="text-xs text-zinc-500 font-mono mt-1">旧口径记录</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-green-500/5 rounded border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <div className="text-lg font-mono font-bold text-green-400">{autoPassCount}</div>
                  <div className="text-xs text-zinc-500 font-mono">自动通过</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-500/5 rounded border border-blue-500/20">
                <CheckCircle2 className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-lg font-mono font-bold text-blue-400">{confirmedCount}</div>
                  <div className="text-xs text-zinc-500 font-mono">人工确认</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-500/5 rounded border border-orange-500/20">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                <div>
                  <div className="text-lg font-mono font-bold text-orange-400">{pendingStatusCount}</div>
                  <div className="text-xs text-zinc-500 font-mono">待处理</div>
                </div>
              </div>
            </div>
          </section>

          <section className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30">
            <h3 className="font-mono font-bold mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              交接信息
            </h3>
            <div className="space-y-3 text-sm font-mono">
              <div className="flex">
                <span className="text-zinc-500 w-28">批次名称</span>
                <span className="text-zinc-300">{batch.name}</span>
              </div>
              <div className="flex">
                <span className="text-zinc-500 w-28">创建时间</span>
                <span className="text-zinc-300">{batch.createdAt}</span>
              </div>
              <div className="flex">
                <span className="text-zinc-500 w-28">更新时间</span>
                <span className="text-zinc-300">{batch.updatedAt}</span>
              </div>
              <div className="flex">
                <span className="text-zinc-500 w-28">数据来源</span>
                <span className="text-zinc-300">{batch.source}</span>
              </div>
              <div className="flex">
                <span className="text-zinc-500 w-28">操作人</span>
                <span className="text-zinc-300">实验老师 林老师</span>
              </div>
              {batch.parentBatchId && (
                <div className="flex">
                  <span className="text-zinc-500 w-28">原始批次</span>
                  <span className="text-blue-400">{batch.parentBatchId}</span>
                </div>
              )}
            </div>
          </section>

          <section className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30">
            <h3 className="font-mono font-bold mb-4">各记录处理结果</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 px-3 text-zinc-500 font-normal">序号</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-normal">类型</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-normal">间隙(mm)</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-normal">高度(mm)</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-normal">电流(A)</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-normal">方向</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-normal">状态</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-normal">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.records.map(rec => (
                    <tr key={rec.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="py-2 px-3 text-zinc-300">{rec.sequence}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs ${rec.recordType === 'smooth' ? 'text-green-400' : rec.recordType === 'pending' ? 'text-orange-400' : 'text-zinc-400'}`}>
                          {rec.recordType === 'smooth' ? '顺利' : rec.recordType === 'pending' ? '待确认' : '旧口径'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-300">{rec.gap.calculated.toFixed(2)}</td>
                      <td className="py-2 px-3 text-zinc-300">{rec.height.calculated.toFixed(2)}</td>
                      <td className="py-2 px-3 text-zinc-300">{rec.current.calculated.toFixed(2)}</td>
                      <td className="py-2 px-3 text-zinc-300">
                        X{rec.direction.x > 0 ? '+' : ''}{rec.direction.x.toFixed(1)}
                        /Y{rec.direction.y > 0 ? '+' : ''}{rec.direction.y.toFixed(1)}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs ${rec.status === 'auto_pass' ? 'text-green-400' : rec.status === 'confirmed' ? 'text-blue-400' : rec.status === 'rejected' ? 'text-red-400' : 'text-orange-400'}`}>
                          {rec.status === 'auto_pass' ? '自动通过' : rec.status === 'confirmed' ? '已确认' : rec.status === 'rejected' ? '已驳回' : '待确认'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-500 text-xs max-w-[200px] truncate">
                        {rec.notes.map(n => n.content).join('；') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {batch.records.some(r => r.checkSteps.some(s => s.judgment !== 'pass' && s.suggestion)) && (
            <section className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30">
              <h3 className="font-mono font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                校验提醒汇总
              </h3>
              <div className="space-y-4">
                {batch.records.map(rec => {
                  const warnings = rec.checkSteps.filter(s => s.judgment !== 'pass' && s.suggestion);
                  if (warnings.length === 0) return null;
                  return (
                    <div key={rec.id} className="border-l-2 border-orange-500/50 pl-4">
                      <div className="text-sm font-mono font-bold text-zinc-400 mb-2">
                        记录 #{rec.sequence}
                      </div>
                      {warnings.map(w => (
                        <div key={w.id} className="mb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-mono ${w.judgment === 'error' ? 'text-red-400' : 'text-orange-400'}`}>
                              [{w.title}]
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 font-mono leading-relaxed pl-4">
                            {w.suggestion}
                          </p>
                          <div className="text-xs text-zinc-600 font-mono pl-4 mt-1">
                            原值: {w.originalValue} → 计算值: {w.calculatedValue} | 依据: {w.basis}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {batch.records.some(r => r.notes.some(n => n.isSupplementary)) && (
            <section className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30">
              <h3 className="font-mono font-bold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                补录差异说明
              </h3>
              <div className="space-y-3">
                {batch.records.map(rec => {
                  const suppNotes = rec.notes.filter(n => n.isSupplementary);
                  if (suppNotes.length === 0) return null;
                  return (
                    <div key={rec.id} className="border border-zinc-800 rounded p-4 bg-zinc-900/50">
                      <div className="text-sm font-mono font-bold text-zinc-400 mb-2">记录 #{rec.sequence}</div>
                      {suppNotes.map(note => (
                        <div key={note.id} className="mb-2">
                          <p className="text-sm text-zinc-300 font-mono">补录内容：{note.content}</p>
                          {note.diff && (
                            <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs font-mono">
                              <div className="text-zinc-600 mb-1">补录前后差异：</div>
                              <div className="text-red-400/70 line-through">{note.diff.oldValue}</div>
                              <div className="text-green-400">{note.diff.newValue}</div>
                            </div>
                          )}
                          <p className="text-xs text-zinc-600 mt-1 font-mono">
                            补录人：{note.author} | 时间：{new Date(note.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {comparison && (
            <section className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30">
              <h3 className="font-mono font-bold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                重跑差异说明
              </h3>
              <p className="text-xs text-zinc-500 font-mono mb-4">
                原批次：{comparison.oldBatch.name}({comparison.oldBatch.createdAt})
                → 新批次：{comparison.newBatch.name}({comparison.newBatch.createdAt})
              </p>
              <div className="space-y-3">
                {comparison.diffs.map((recDiffs, idx) => {
                  if (recDiffs.length === 0) return null;
                  return (
                    <div key={idx} className="border border-zinc-800 rounded p-4 bg-zinc-900/50">
                      <div className="text-sm font-mono font-bold text-zinc-400 mb-2">记录 #{idx + 1}</div>
                      <div className="space-y-1">
                        {recDiffs.map(diff => (
                          <div key={diff.field} className="flex items-center gap-3 text-xs font-mono">
                            <span className="text-zinc-500 w-20">{diff.fieldLabel}</span>
                            <span className="text-red-400/70 line-through">{diff.oldValue.toFixed(3)}</span>
                            <span className="text-zinc-600">→</span>
                            <span className="text-green-400">{diff.newValue.toFixed(3)}</span>
                            <span className={`${diff.changePercent > 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {diff.changePercent > 0 ? '+' : ''}{diff.changePercent.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {comparison.diffs.every(d => d.length === 0) && (
                  <p className="text-sm text-zinc-500 font-mono">重跑结果与原批次一致，无显著差异。</p>
                )}
              </div>
            </section>
          )}

          <section className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30">
            <h3 className="font-mono font-bold mb-3">判断过程留存</h3>
            <p className="text-xs text-zinc-500 font-mono leading-relaxed">
              本报告所有判断过程均已留存于系统中。每条记录的校验步骤包括：单位换算校验、方向符号校验、时间间隔校验。
              校验通过的项目标记为"通过"，存在问题的项目标记为"警告"或"错误"，并附带处理建议。
              人工确认/驳回操作及补录备注均记录操作人和操作时间，可追溯、可交接。
            </p>
          </section>

          <section className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30">
            <h3 className="font-mono font-bold mb-3">交接签收</h3>
            <div className="grid grid-cols-2 gap-8 text-sm font-mono">
              <div>
                <span className="text-zinc-500 block mb-2">移交人</span>
                <div className="border-b border-zinc-700 pb-1 text-zinc-300">实验老师 林老师</div>
              </div>
              <div>
                <span className="text-zinc-500 block mb-2">接收人</span>
                <div className="border-b border-zinc-700 pb-1 text-zinc-600">（待签收）</div>
              </div>
              <div>
                <span className="text-zinc-500 block mb-2">移交日期</span>
                <div className="border-b border-zinc-700 pb-1 text-zinc-300">{new Date().toLocaleDateString('zh-CN')}</div>
              </div>
              <div>
                <span className="text-zinc-500 block mb-2">签收日期</span>
                <div className="border-b border-zinc-700 pb-1 text-zinc-600">（待签收）</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
