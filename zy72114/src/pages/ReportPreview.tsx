import { ArrowLeft, Printer, Download, FileText, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { getSafetyLevelLabel, SafetyLevel } from '../utils/physics';
import Navbar from '../components/Navbar';

export default function ReportPreview() {
  const navigate = useNavigate();

  const {
    currentProject,
    sensorRecords,
    deviceParams,
    fieldNotes,
    validationIssues,
    dataConflicts,
    calculationResult,
  } = useProjectStore();

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const rows = [
      ['校园投石机安全试算报告'],
      ['项目名称', currentProject?.name || ''],
      ['批次号', currentProject?.batchNumber || ''],
      ['生成时间', new Date().toLocaleString('zh-CN')],
      [''],
      ['计算结果'],
      ['射程 (m)', calculationResult?.range || ''],
      ['冲击能量 (J)', calculationResult?.impactEnergy || ''],
      ['最大高度 (m)', calculationResult?.maxHeight || ''],
      ['飞行时间 (s)', calculationResult?.flightTime || ''],
      ['安全等级', calculationResult?.safetyLevel || ''],
      [''],
      ['校验问题数', validationIssues.length],
      ['待解决冲突', dataConflicts.filter((c) => !c.userDecision).length],
    ];

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `投石机安全报告_${currentProject?.batchNumber || 'export'}.csv`;
    a.click();
  };

  const safetyLevelClass = (level?: string) => {
    switch (level) {
      case 'low':
        return 'bg-safe-500';
      case 'medium':
        return 'bg-warning-500';
      case 'high':
        return 'bg-danger-500';
      case 'danger':
        return 'bg-danger-700';
      default:
        return 'bg-ink-400';
    }
  };

  if (!currentProject) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-ink-600 mb-4">请先在工作台加载数据再查看报告</p>
            <button onClick={() => navigate('/')} className="eng-btn eng-btn-primary">
              前往工作台
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="no-print">
        <Navbar />
      </div>

      <div className="no-print p-4 flex items-center justify-between bg-white border-b border-ink-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="eng-btn eng-btn-sm flex items-center gap-1">
            <ArrowLeft size={16} /> 返回工作台
          </button>
          <h1 className="text-lg font-bold text-ink-800 flex items-center gap-2">
            <FileText size={20} /> 安全报告预览
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="eng-btn eng-btn-sm flex items-center gap-1">
            <Download size={16} /> 导出CSV
          </button>
          <button onClick={handlePrint} className="eng-btn eng-btn-primary eng-btn-sm flex items-center gap-1">
            <Printer size={16} /> 打印报告
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 md:p-8 print-area">
        <div className="max-w-3xl mx-auto bg-white shadow-engineering border border-ink-200 p-8 print:shadow-none print:border-none">
          <div className="text-center mb-8 pb-4 border-b-2 border-ink-800">
            <h1 className="text-2xl font-bold text-ink-900 mb-2">校园投石机安全试算报告</h1>
            <p className="text-ink-600 text-sm">CATAPULT SAFETY ASSESSMENT REPORT</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-ink-500">项目名称：</span>
              <span className="font-medium">{currentProject.name}</span>
            </div>
            <div>
              <span className="text-ink-500">批次号：</span>
              <span className="font-mono">{currentProject.batchNumber}</span>
            </div>
            <div>
              <span className="text-ink-500">生成时间：</span>
              <span>{new Date().toLocaleString('zh-CN')}</span>
            </div>
            <div>
              <span className="text-ink-500">报告状态：</span>
              <span className={calculationResult ? 'text-safe-600 font-medium' : 'text-warning-600'}>
                {calculationResult ? '已完成计算' : '草稿'}
              </span>
            </div>
          </div>

          {calculationResult && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-ink-800 mb-4 pb-2 border-b border-ink-300">
                一、安全评估结论
              </h2>

              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`w-20 h-20 ${safetyLevelClass(
                    calculationResult.safetyLevel
                  )} flex items-center justify-center`}
                >
                  <span className="text-white font-bold text-lg">
                    {getSafetyLevelLabel(calculationResult.safetyLevel as SafetyLevel)}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-ink-700 leading-relaxed">
                    {calculationResult.processingSuggestion}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-ink-50 p-4 text-center">
                  <div className="text-2xl font-bold font-mono text-blueprint-700">
                    {calculationResult.range.toFixed(2)}
                  </div>
                  <div className="text-xs text-ink-500">射程 (米)</div>
                </div>
                <div className="bg-ink-50 p-4 text-center">
                  <div className="text-2xl font-bold font-mono text-warning-700">
                    {calculationResult.impactEnergy.toFixed(2)}
                  </div>
                  <div className="text-xs text-ink-500">冲击能量 (焦耳)</div>
                </div>
                <div className="bg-ink-50 p-4 text-center">
                  <div className="text-2xl font-bold font-mono text-safe-700">
                    {calculationResult.maxHeight.toFixed(2)}
                  </div>
                  <div className="text-xs text-ink-500">最大高度 (米)</div>
                </div>
                <div className="bg-ink-50 p-4 text-center">
                  <div className="text-2xl font-bold font-mono text-ink-700">
                    {calculationResult.flightTime.toFixed(3)}
                  </div>
                  <div className="text-xs text-ink-500">飞行时间 (秒)</div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-lg font-bold text-ink-800 mb-4 pb-2 border-b border-ink-300">
              二、数据质量检查
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-safe-500" />
                <span className="text-sm">传感器记录: {sensorRecords.length} 条</span>
              </div>
              <div className="flex items-center gap-2">
                {validationIssues.length === 0 ? (
                  <CheckCircle size={18} className="text-safe-500" />
                ) : (
                  <AlertTriangle size={18} className="text-warning-500" />
                )}
                <span className="text-sm">校验问题: {validationIssues.length} 个</span>
              </div>
              <div className="flex items-center gap-2">
                {dataConflicts.filter((c) => !c.userDecision).length === 0 ? (
                  <CheckCircle size={18} className="text-safe-500" />
                ) : (
                  <XCircle size={18} className="text-danger-500" />
                )}
                <span className="text-sm">待解决冲突: {dataConflicts.filter((c) => !c.userDecision).length} 个</span>
              </div>
            </div>

            {validationIssues.length > 0 && (
              <div className="bg-warning-50 border border-warning-200 p-4 mb-4">
                <h3 className="font-medium text-warning-800 mb-2">校验问题清单：</h3>
                <ul className="text-sm space-y-1 text-warning-700">
                  {validationIssues.slice(0, 5).map((issue) => (
                    <li key={issue.id}>• [{issue.type}] {issue.message}</li>
                  ))}
                  {validationIssues.length > 5 && (
                    <li className="text-warning-500">...还有 {validationIssues.length - 5} 个问题</li>
                  )}
                </ul>
              </div>
            )}

            {dataConflicts.filter((c) => !c.userDecision).length > 0 && (
              <div className="bg-danger-50 border border-danger-200 p-4">
                <h3 className="font-medium text-danger-800 mb-2">未解决的数据冲突：</h3>
                <ul className="text-sm space-y-1 text-danger-700">
                  {dataConflicts
                    .filter((c) => !c.userDecision)
                    .slice(0, 3)
                    .map((c) => (
                      <li key={c.id}>• 【{c.field}】现场说法与导入数据不一致，请人工确认</li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-bold text-ink-800 mb-4 pb-2 border-b border-ink-300">
              三、设备参数明细
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-ink-100">
                  <th className="border border-ink-300 px-3 py-2 text-left">参数名称</th>
                  <th className="border border-ink-300 px-3 py-2 text-center">数值</th>
                  <th className="border border-ink-300 px-3 py-2 text-center">单位</th>
                  <th className="border border-ink-300 px-3 py-2 text-left">说明</th>
                </tr>
              </thead>
              <tbody>
                {deviceParams.map((param) => (
                  <tr key={param.id}>
                    <td className="border border-ink-300 px-3 py-2 font-medium">{param.paramName}</td>
                    <td className="border border-ink-300 px-3 py-2 text-center font-mono">
                      {param.value ?? '—'}
                    </td>
                    <td className="border border-ink-300 px-3 py-2 text-center">{param.unit}</td>
                    <td className="border border-ink-300 px-3 py-2 text-ink-500 text-xs">
                      {param.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-bold text-ink-800 mb-4 pb-2 border-b border-ink-300">
              四、现场备注（原始记录）
            </h2>
            <div className="space-y-4">
              {fieldNotes.map((note) => (
                <div key={note.id} className="bg-ink-50 border-l-4 border-blueprint-500 p-4">
                  <div className="flex items-center gap-2 mb-2 text-xs text-ink-500">
                    <Clock size={12} />
                    <span>{new Date(note.recordedAt).toLocaleString('zh-CN')}</span>
                    <span>|</span>
                    <span>{note.recorder}</span>
                    {note.isSupplementary && (
                      <span className="eng-badge eng-badge-info">补充备注</span>
                    )}
                  </div>
                  <pre className="font-mono text-sm whitespace-pre-wrap text-ink-700">
                    {note.content || '（空）'}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t-2 border-ink-800 text-xs text-ink-400 text-center">
            <p>本报告由「校园投石机安全试算系统」自动生成</p>
            <p className="mt-1">报告结论仅供参考，请结合现场实际情况做出判断</p>
          </div>
        </div>
      </main>
    </div>
  );
}
