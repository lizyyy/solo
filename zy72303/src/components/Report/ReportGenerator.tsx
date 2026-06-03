import { useState } from 'react';
import { useAppContext } from '../../store/AppContext';
import { useWorkflow } from '../../hooks/useWorkflow';
import {
  getStakeholderName,
  formatPathDescription,
  generateClassroomNote,
} from '../../utils/dataUtils';
import {
  FileText,
  Download,
  Users,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Clock,
  Settings,
  MessageSquare,
  Copy,
  Check,
} from 'lucide-react';

export function ReportGenerator() {
  const { state } = useAppContext();
  const { updateClassroomNote, markDemoUpdated } = useWorkflow();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateFullReport = () => {
    const lines: string[] = [];
    lines.push('='.repeat(60));
    lines.push('图最短路绕行比较报告');
    lines.push('='.repeat(60));
    lines.push(`生成时间：${new Date().toLocaleString()}`);
    lines.push(`参数版本：${state.currentParameterVersion}`);
    lines.push(`记录总数：${state.parameterRecords.length} 条`);
    lines.push(`比较结果：${state.comparisonResults.length} 条`);
    lines.push('');

    const zeroDenomCount = state.parameterRecords.filter(
      r => r.status === 'zero_denominator'
    ).length;
    const significantCount = state.comparisonResults.filter(
      r => r.isSignificantDetour
    ).length;

    lines.push('📊 统计概览');
    lines.push('-'.repeat(40));
    lines.push(`• 分母为0的记录：${zeroDenomCount} 条`);
    lines.push(`• 显著绕行记录：${significantCount} 条`);
    lines.push(`• 已提供手算反例：${state.parameterRecords.filter(r => r.manualCounterexample).length} 条`);
    lines.push(`• 已通过复核：${state.parameterRecords.filter(r => r.reviewStatus === 'approved').length} 条`);
    lines.push('');

    lines.push('📋 详细报告');
    lines.push('-'.repeat(40));
    lines.push('');

    state.comparisonResults.forEach((result, idx) => {
      const record = state.parameterRecords.find(
        r => r.id === result.parameterRecordId
      );
      if (!record) return;

      lines.push(`【第 ${idx + 1} 条】${record.sourceNode} → ${record.targetNode}`);
      lines.push('—'.repeat(40));

      if (result.status === 'zero_denominator') {
        lines.push('⚠️  状态：分母为0（显示为空字符串）');
        lines.push(`   原始备注：${record.remark}`);
        if (record.manualCounterexample) {
          lines.push(`   手算反例：${record.manualCounterexample}`);
          lines.push(`   反例提供人：${getStakeholderName(record.counterexampleProvider as any)}`);
        }
      }

      lines.push(`📏 最短路：${formatPathDescription(state.graph.nodes, result.shortestPath)}`);
      lines.push(`   长度：${result.shortestPath.totalWeight.toFixed(2)}`);
      lines.push(`🔀 备选路径：${formatPathDescription(state.graph.nodes, result.alternativePath)}`);
      lines.push(`   长度：${result.alternativePath.totalWeight.toFixed(2)}`);
      lines.push(`📐 绕行比例：${result.detourRatio !== null ? result.detourRatio.toFixed(2) + ' 倍' : '无法计算'}`);
      lines.push(`   阈值：${result.thresholdUsed} 倍`);

      if (result.isSignificantDetour) {
        lines.push('🚨 判断：显著绕行');
      } else if (result.detourRatio !== null) {
        lines.push('✅ 判断：可接受范围');
      }

      lines.push('');
      lines.push('💡 为什么被留下：');
      lines.push(`   ${result.explanation.whyKept}`);

      if (result.explanation.missingMaterials.length > 0) {
        lines.push('');
        lines.push('📭 还缺什么材料：');
        result.explanation.missingMaterials.forEach(mat => {
          lines.push(`   • ${mat}`);
        });
      }

      lines.push('');
      lines.push('👤 下一步：');
      lines.push(`   ${result.explanation.nextAction}`);
      lines.push(`   负责人：${getStakeholderName(result.explanation.nextStakeholder)}`);

      lines.push('');
      lines.push(`⚙️  参数版本：v${result.parameterVersion.version}`);
      lines.push(`   公式：${result.parameterVersion.parameters.edgeWeightFormula}`);
      lines.push(`   取舍理由：${result.parameterVersion.reasoning}`);

      if (result.classroomNote) {
        lines.push('');
        lines.push('📝 课堂演示说明：');
        lines.push(result.classroomNote.split('\n').map(l => '   ' + l).join('\n'));
      }

      lines.push('');
    });

    lines.push('='.repeat(60));
    lines.push('报告结束');
    lines.push('='.repeat(60));

    return lines.join('\n');
  };

  const reportText = generateFullReport();

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-cyan-500 to-teal-600 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">人性化报告</h2>
          <p className="text-cyan-100 text-sm mt-1">
            不是冷冰冰的系统日志，而是可解释的分析报告
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => copyToClipboard(reportText, 'full')}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
          >
            {copiedId === 'full' ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copiedId === 'full' ? '已复制' : '复制全文'}
          </button>
          <button
            onClick={() => {
              const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `绕行比较报告_${new Date().toISOString().slice(0, 10)}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-cyan-600 rounded-lg hover:bg-cyan-50 transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            下载报告
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-indigo-50 rounded-xl p-4 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-indigo-500" />
            <p className="text-2xl font-bold text-indigo-700">
              {state.parameterRecords.length}
            </p>
            <p className="text-xs text-indigo-600">参数记录</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold text-emerald-700">
              {state.comparisonResults.length}
            </p>
            <p className="text-xs text-emerald-600">比较结果</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold text-amber-700">
              {state.parameterRecords.filter(r => r.status === 'zero_denominator').length}
            </p>
            <p className="text-xs text-amber-600">分母为0</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <p className="text-2xl font-bold text-rose-700">
              {state.comparisonResults.filter(r => r.isSignificantDetour).length}
            </p>
            <p className="text-xs text-rose-600">显著绕行</p>
          </div>
        </div>

        {state.comparisonResults.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>请先运行绕行比较以生成报告</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {state.comparisonResults.map((result, idx) => {
              const record = state.parameterRecords.find(
                r => r.id === result.parameterRecordId
              );
              if (!record) return null;

              return (
                <div
                  key={result.id}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-teal-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          {record.sourceNode} → {record.targetNode}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Settings className="w-3 h-3" />
                            参数 v{result.parameterVersion.version}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(result.calculationTimestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const singleReport = `【${record.sourceNode} → ${record.targetNode}】\n${result.classroomNote || generateClassroomNote(result, record)}`;
                          copyToClipboard(singleReport, result.id);
                        }}
                        className="p-2 text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                        title="复制演示说明"
                      >
                        {copiedId === result.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 mb-1">为什么被留下</p>
                        <p className="text-sm text-gray-700">{result.explanation.whyKept}</p>
                      </div>
                    </div>

                    {result.explanation.missingMaterials.length > 0 && (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-700 mb-1">还缺什么材料</p>
                          <ul className="text-sm text-gray-700 list-disc list-inside">
                            {result.explanation.missingMaterials.map((mat, midx) => (
                              <li key={midx}>{mat}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <Users className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 mb-1">下一步该找谁</p>
                        <p className="text-sm text-gray-700">{result.explanation.nextAction}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          👉 {getStakeholderName(result.explanation.nextStakeholder)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-1">
                          <Settings className="w-3 h-3" />
                          参数版本 & 取舍理由
                        </p>
                        <p className="text-xs text-gray-600 mb-1 font-mono">
                          {result.parameterVersion.parameters.edgeWeightFormula}
                        </p>
                        <p className="text-xs text-gray-500">
                          {result.parameterVersion.reasoning}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        课堂演示说明
                      </p>
                      <textarea
                        value={result.classroomNote || ''}
                        onChange={e =>
                          updateClassroomNote(result.id, e.target.value)
                        }
                        placeholder="在此输入课堂演示说明，或点击上方自动生成..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                        rows={3}
                      />
                      <div className="flex justify-end mt-2 gap-2">
                        <button
                          onClick={() => {
                            const note = generateClassroomNote(result, record);
                            updateClassroomNote(result.id, note);
                          }}
                          className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          自动生成
                        </button>
                        {!result.demoUpdated && (
                          <button
                            onClick={() => markDemoUpdated(result.id)}
                            className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                          >
                            标记为已更新
                          </button>
                        )}
                        {result.demoUpdated && (
                          <span className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            已更新演示
                          </span>
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
  );
}
