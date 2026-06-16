import { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Share2,
  CheckCircle,
  AlertTriangle,
  FileWarning,
  Info,
  ChevronDown,
  ChevronUp,
  Printer,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { reportGenerator } from '@/services/ReportGenerator';

export function Report() {
  const { getCurrentBatch, getCurrentRecords, getCurrentSamples, remarks, paramVersions } = useAppStore();
  const batch = getCurrentBatch();
  const records = getCurrentRecords();
  const samples = getCurrentSamples();
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2]));

  const currentParamVersion = useMemo(() => {
    if (!batch) return undefined;
    return paramVersions.find((p) => p.id === batch.paramVersionId);
  }, [batch, paramVersions]);

  const report = useMemo(() => {
    if (!batch) return null;
    return reportGenerator.generateReport(batch, records, samples, remarks, currentParamVersion);
  }, [batch, records, samples, remarks, currentParamVersion]);

  const toggleSection = (index: number) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedSections(newSet);
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'summary':
        return <Info className="w-5 h-5 text-cyan-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'advice':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'detail':
        return <FileWarning className="w-5 h-5 text-slate-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const handleExport = () => {
    if (!report || !batch) return;
    const lines: string[] = [];
    lines.push('========================================');
    lines.push('  图神经网络社区解释 - 交接报告');
    lines.push('========================================');
    lines.push('');
    lines.push('批次: ' + batch.name);
    lines.push('生成时间: ' + new Date().toLocaleString('zh-CN'));
    lines.push('');
    lines.push('--- 报告摘要 ---');
    lines.push(report.summary);
    lines.push('');
    if (report.actionItems.length > 0) {
      lines.push('--- 待处理事项 ---');
      report.actionItems.forEach((item, i) => {
        lines.push((i + 1) + '. ' + item);
      });
      lines.push('');
    }
    report.sections.forEach((section) => {
      lines.push('--- ' + section.title + ' ---');
      lines.push(section.content);
      lines.push('');
    });
    lines.push('--- 计算明细 ---');
    records.forEach((record) => {
      lines.push(record.sampleName + ' | ' + (record.type === 'success' ? '顺利' : record.type === 'pending' ? '待确认' : '旧口径') + ' | 模块度: ' + record.outputData.modularity);
      if (record.processingAdvice) {
        lines.push('  建议: ' + record.processingAdvice);
      }
    });
    lines.push('');
    lines.push('========================================');
    lines.push('本报告由图神经网络社区解释交接管理系统自动生成');
    lines.push('========================================');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '交接报告-' + batch.name + '-' + new Date().toISOString().slice(0, 10) + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!batch || !report) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100 text-center">
        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">暂无数据，无法生成报告</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">交接报告</h1>
          <p className="text-slate-500 mt-1">图神经网络社区解释计算结果报告</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
            <Printer className="w-4 h-4" />
            打印
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
            <Share2 className="w-4 h-4" />
            分享
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors" onClick={handleExport}>
            <Download className="w-4 h-4" />
            导出报告
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">{batch.name}</h2>
            <p className="text-cyan-100 text-sm mb-4">
              生成时间：{new Date().toLocaleString('zh-CN')}
            </p>
            <div className="flex gap-6">
              <div>
                <p className="text-cyan-200 text-sm">总样本</p>
                <p className="text-3xl font-bold">{batch.totalSamples}</p>
              </div>
              <div>
                <p className="text-cyan-200 text-sm">顺利完成</p>
                <p className="text-3xl font-bold text-emerald-300">{batch.successCount}</p>
              </div>
              <div>
                <p className="text-cyan-200 text-sm">待确认</p>
                <p className="text-3xl font-bold text-amber-300">{batch.pendingCount}</p>
              </div>
              <div>
                <p className="text-cyan-200 text-sm">异常</p>
                <p className="text-3xl font-bold text-red-300">{batch.errorCount}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-cyan-200 text-sm">报告摘要</p>
            <p className="text-sm mt-2 max-w-xs leading-relaxed">{report.summary}</p>
          </div>
        </div>
      </div>

      {report.actionItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-amber-800 mb-3">待处理事项</h3>
              <ul className="space-y-2">
                {report.actionItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-amber-700">
                    <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold text-amber-800 flex-shrink-0">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {report.sections.map((section, index) => {
          const isExpanded = expandedSections.has(index);
          return (
            <div
              key={index}
              className={`bg-white rounded-2xl border transition-all ${
                section.highlight ? 'border-amber-300 shadow-md' : 'border-slate-100 shadow-sm'
              }`}
            >
              <div
                className="flex items-center justify-between p-6 cursor-pointer"
                onClick={() => toggleSection(index)}
              >
                <div className="flex items-center gap-3">
                  {getSectionIcon(section.type)}
                  <h3 className="font-bold text-slate-800">{section.title}</h3>
                  {section.highlight && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                      重要
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>

              {isExpanded && (
                <div className="px-6 pb-6">
                  <div
                    className={`p-4 rounded-xl whitespace-pre-line ${
                      section.type === 'warning'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : section.type === 'advice'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    {section.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">计算明细概览</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-600">样本名称</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">状态</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">模块度</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">处理建议</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-slate-100">
                  <td className="py-3 px-4 font-medium text-slate-800">{record.sampleName}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.type === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : record.type === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {record.type === 'success'
                        ? '顺利'
                        : record.type === 'pending'
                        ? '待确认'
                        : '旧口径'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{record.outputData.modularity}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                    {record.processingAdvice}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200">
        <div className="flex items-start gap-4">
          <CheckCircle className="w-8 h-8 text-emerald-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-emerald-800 mb-2">交接完成确认</h4>
            <p className="text-sm text-emerald-700 leading-relaxed">
              本报告包含图神经网络社区解释算法的完整计算过程、参数版本、异常样本和图表导出。
              所有记录均可追溯，异常样本未自动过滤。交接后新接手人员可通过本系统查看所有历史记录和计算细节。
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">计算过程可复查</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">异常记录有原因</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">图表可追溯明细</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">补录备注可对比</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-slate-400 text-sm py-4">
        <p>本报告由图神经网络社区解释交接管理系统自动生成</p>
        <p className="mt-1">生成时间：{new Date().toLocaleString('zh-CN')}</p>
      </div>
    </div>
  );
}
