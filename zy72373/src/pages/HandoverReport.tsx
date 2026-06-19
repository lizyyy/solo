import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  CheckCircle, 
  User, 
  Clock,
  ArrowLeft,
  List,
  MessageSquare,
  History,
  AlertCircle,
  GitCompareArrows,
  ThermometerSun,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Download,
  Check
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { useDiagnosisStore } from '../store/useDiagnosisStore';
import { StepProgress } from '../components/StepProgress';
import { formatNextAction } from '../services/reportService';
import type { StepInfo, ReportVersion } from '../types';

export function HandoverReport() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { getCurrentTask, setCurrentTask } = useDiagnosisStore();
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set([1]));
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const task = getCurrentTask();
  const report = task?.report;

  const steps: StepInfo[] = [
    { step: 1, title: '数据导入', description: '导入传感器数据', status: 'completed' },
    { step: 2, title: '照片补录', description: '补录工况照片', status: 'completed' },
    { step: 3, title: '生成报告', description: '生成交接报告', status: 'completed' },
  ];

  const toggleVersion = (v: number) => {
    const next = new Set(expandedVersions);
    if (next.has(v)) {
      next.delete(v);
    } else {
      next.add(v);
    }
    setExpandedVersions(next);
  };

  const handleBack = () => {
    if (taskId) {
      navigate(`/diagnosis/${taskId}/review`);
    }
  };

  const handleReplay = () => {
    if (taskId) {
      setCurrentTask(taskId);
      navigate(`/diagnosis/${taskId}/replay`);
    }
  };

  const handleExportReport = () => {
    if (!task || !report) return;
    setExporting(true);
    
    const reportContent = `
风扇叶片平衡诊断 - 交接报告 v${report.version}
=====================================
任务: ${task.title}
任务ID: ${task.id}
创建人: ${task.createdBy}
生成时间: ${new Date(report.updatedAt).toLocaleString('zh-CN')}

【问题说明】
${report.problemStatement}

【缺失材料】
${report.missingMaterials.length > 0 ? report.missingMaterials.join('\n') : '无（全部齐全）'}

【缺失材料触发源追溯】
${report.missingMaterialTriggers.map(t => `- ${t.material} (${t.sourceType}):\n${t.sourceDescriptions.map(d => `  * ${d}`).join('\n')}`).join('\n') || '无'}

【下一步对接人】
${report.nextHandler} (${formatNextAction(report.nextAction)})

【温度单位人工复核确认记录】
${task.corrections.length > 0 
  ? task.corrections.map(c => `- ${c.sensorNo}: ${c.oldValue} → ${c.newValue}\n  修正人: ${c.correctedBy}\n  时间: ${new Date(c.correctedAt).toLocaleString('zh-CN')}\n  原因: ${c.reason}`).join('\n\n')
  : '无修正记录'}

【当前传感器数据】
${task.sensorData.map(s => `- ${s.sensorNo} (${s.position}): ${s.temperature}${s.temperatureUnit === 'K' ? 'K' : '°C'}${s.needsReview ? ' (待复核)' : ''}`).join('\n')}

【工况照片】
${task.photos.length > 0
  ? task.photos.map(p => `- ${p.filename}\n  上传人: ${p.uploadBy}\n  描述: ${p.description}\n  时间: ${new Date(p.uploadTime).toLocaleString('zh-CN')}`).join('\n\n')
  : '无照片'}

【版本历史追溯】
${report.versionHistory.map(v => `v${v.version} (${new Date(v.updatedAt).toLocaleString('zh-CN')})\n  触发: ${v.triggeredBy}\n  变更: ${v.changes.join('; ')}\n  缺失材料: ${v.snapshot.missingMaterials.join(', ') || '无'}\n  对接人: ${v.snapshot.nextHandler}`).join('\n\n')}

---
报告由 fan-diagnosis 系统自动生成
CLI 复现命令: fan-diagnosis report --task-id ${task.id} --version ${report.version} --output 交接报告_v${report.version}.txt
`.trim();

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `交接报告_${task.id}_v${report.version}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setTimeout(() => {
      setExporting(false);
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    }, 500);
  };

  const buildDiffWithPrev = (versions: ReportVersion[], idx: number) => {
    if (idx === 0) return null;
    const curr = versions[idx];
    const prev = versions[idx - 1];
    return {
      prevMissing: prev.snapshot.missingMaterials,
      currMissing: curr.snapshot.missingMaterials,
      addedMissing: curr.snapshot.missingMaterials.filter(m => !prev.snapshot.missingMaterials.includes(m)),
      removedMissing: prev.snapshot.missingMaterials.filter(m => !curr.snapshot.missingMaterials.includes(m)),
      prevStatement: prev.snapshot.problemStatement,
      currStatement: curr.snapshot.problemStatement,
      prevHandler: prev.snapshot.nextHandler,
      currHandler: curr.snapshot.nextHandler,
      sensorChanges: curr.snapshot.sensorDataSnapshots
        .map(snap => {
          const prevSnap = prev.snapshot.sensorDataSnapshots.find(p => p.sensorNo === snap.sensorNo);
          if (!prevSnap) return null;
          const tempChanged = prevSnap.temperature !== snap.temperature || prevSnap.temperatureUnit !== snap.temperatureUnit;
          const reviewChanged = prevSnap.needsReview !== snap.needsReview;
          if (!tempChanged && !reviewChanged) return null;
          return {
            sensorNo: snap.sensorNo,
            prev: `${prevSnap.temperature}${prevSnap.temperatureUnit === 'K' ? 'K' : '°C'}${prevSnap.needsReview ? ' 待复核' : ''}`,
            curr: `${snap.temperature}${snap.temperatureUnit === 'K' ? 'K' : '°C'}${snap.needsReview ? ' 待复核' : ''}`,
          };
        })
        .filter(Boolean),
    };
  };

  if (!report) {
    return (
      <div className="space-y-8">
        <div className="card">
          <StepProgress steps={steps} />
        </div>
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 mx-auto mb-4 text-industrial-300" />
          <p className="text-industrial-500">报告尚未生成</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="card">
        <StepProgress steps={steps} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-industrial-100 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-industrial-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-industrial-900">交接报告</h2>
              <p className="text-sm text-industrial-500">
                版本 v{report.version} · 更新于 {format(new Date(report.updatedAt), 'yyyy-MM-dd HH:mm')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportReport}
              disabled={exporting}
              className="btn-secondary flex items-center gap-2"
            >
              {exported ? (
                <>
                  <Check className="w-4 h-4" />
                  已导出
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  导出报告
                </>
              )}
            </button>
            <button
              onClick={handleReplay}
              className="btn-secondary flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              流程复盘
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border-l-4 border-alert-orange bg-orange-50 p-4 rounded-r-lg">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-alert-orange mt-0.5" />
              <div>
                <h3 className="font-semibold text-industrial-900 mb-2">
                  为什么留下这条？
                </h3>
                <p className="text-industrial-700 leading-relaxed">
                  {report.problemStatement}
                </p>
              </div>
            </div>
          </div>

          <div className="border border-industrial-200 rounded-lg overflow-hidden">
            <div className="bg-industrial-50 px-4 py-3 border-b border-industrial-200">
              <div className="flex items-start gap-3">
                <List className="w-5 h-5 text-industrial-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-industrial-900">
                    还缺什么材料？
                    {report.missingMaterialTriggers && report.missingMaterialTriggers.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-industrial-500">
                        可追溯触发源
                      </span>
                    )}
                  </h3>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {report.missingMaterials.length > 0 ? (
                report.missingMaterials.map((material) => {
                  const trigger = report.missingMaterialTriggers?.find(t => t.material === material);
                  return (
                    <div
                      key={material}
                      className="border border-industrial-100 rounded-lg p-3 bg-white"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <span className="w-2 h-2 mt-2 bg-warning-400 rounded-full flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-industrial-800">{material}</span>
                            {trigger && (
                              <span className="badge badge-pending">
                                {trigger.sourceType === 'sensor' ? '传感器触发' : '照片触发'}
                              </span>
                            )}
                          </div>
                          {trigger && trigger.sourceDescriptions.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-industrial-500 mb-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                原始触发材料来源：
                              </p>
                              <ul className="text-xs text-industrial-600 space-y-1 bg-industrial-50 rounded p-2 font-mono">
                                {trigger.sourceDescriptions.map((desc, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-industrial-400">•</span>
                                    <span>{desc}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg text-emerald-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">材料齐全，无缺失</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-industrial-50 border border-industrial-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-industrial-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-industrial-900 mb-2">
                  下一步该找谁？
                </h3>
                <div className="flex items-center gap-4">
                  <div className="bg-white px-4 py-2 rounded-lg border border-industrial-200">
                    <span className="text-sm text-industrial-500">对接人：</span>
                    <span className="font-medium text-industrial-900 ml-1">
                      {report.nextHandler}
                    </span>
                  </div>
                  <div className="bg-alert-orange/10 px-4 py-2 rounded-lg">
                    <span className="text-sm text-alert-orange">
                      {formatNextAction(report.nextAction)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {task && task.corrections.length > 0 && (
            <div className="border border-alert-orange/30 rounded-lg overflow-hidden">
              <div className="bg-orange-50 px-4 py-3 border-b border-alert-orange/30">
                <h3 className="font-semibold text-industrial-900 flex items-center gap-2">
                  <GitCompareArrows className="w-5 h-5 text-alert-orange" />
                  温度单位人工复核确认记录
                  <span className="text-xs font-normal text-industrial-500">
                    可反查改前/改后内容
                  </span>
                </h3>
              </div>
              <div className="divide-y divide-industrial-100">
                {task.corrections.map((c) => (
                  <div key={c.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm bg-industrial-100 px-2 py-0.5 rounded text-industrial-700">
                          {c.sensorNo}
                        </span>
                        <span className="text-xs text-industrial-500">
                          {c.field} 修正
                        </span>
                      </div>
                      <div className="text-xs text-industrial-400 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {c.correctedBy}
                        <Clock className="w-3 h-3 ml-2" />
                        {format(new Date(c.correctedAt), 'MM-dd HH:mm')}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center mt-3">
                      <div className="bg-warning-50 border border-warning-200 rounded-lg p-3">
                        <p className="text-xs text-warning-600 mb-1">改前（原始值）</p>
                        <p className="font-mono font-semibold text-warning-800">
                          {c.oldValue}
                        </p>
                      </div>
                      <div className="flex justify-center">
                        <ArrowLeft className="w-5 h-5 text-industrial-300 rotate-180" />
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-xs text-emerald-600 mb-1">改后（修正值）</p>
                        <p className="font-mono font-semibold text-emerald-800">
                          {c.newValue}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-industrial-500 mt-2 bg-industrial-50 rounded p-2">
                      修正原因：{c.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-industrial-100 pt-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-industrial-500">
                <Clock className="w-4 h-4" />
                <span>生成时间：{format(new Date(report.generatedAt), 'yyyy-MM-dd HH:mm')}</span>
              </div>
              <div className="flex items-center gap-2 text-industrial-500">
                <History className="w-4 h-4" />
                <span>版本历史：{report.versionHistory.length} 次更新</span>
              </div>
            </div>
          </div>

          {report.versionHistory.length > 1 && (
            <div className="mt-2">
              <h4 className="text-sm font-medium text-industrial-700 mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                版本追溯 · 交接报告变化全记录（改前 / 改后）
              </h4>
              <div className="space-y-3">
                {report.versionHistory.slice().reverse().map((version) => {
                  const realIdx = report.versionHistory.findIndex(v => v.version === version.version);
                  const diff = buildDiffWithPrev(report.versionHistory, realIdx);
                  const isExpanded = expandedVersions.has(version.version);
                  return (
                    <div
                      key={version.version}
                      className="border border-industrial-200 rounded-lg overflow-hidden"
                    >
                      <div
                        className="flex items-start justify-between p-3 bg-industrial-50 cursor-pointer hover:bg-industrial-100 transition-colors"
                        onClick={() => toggleVersion(version.version)}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <span className="bg-industrial-200 text-industrial-700 px-2 py-0.5 rounded text-xs font-mono flex-shrink-0">
                            v{version.version}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-industrial-500">
                                {format(new Date(version.updatedAt), 'yyyy-MM-dd HH:mm')}
                              </span>
                              <span className="badge badge-pending text-xs">
                                触发：{version.triggeredBy}
                              </span>
                              <span className="text-xs text-industrial-400 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                对接人：{version.snapshot.nextHandler}
                              </span>
                            </div>
                            <ul className="text-sm text-industrial-700 space-y-0.5 mt-1.5">
                              {version.changes.slice(0, isExpanded ? version.changes.length : 1).map((change, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                  <span className="truncate">{change}</span>
                                </li>
                              ))}
                              {!isExpanded && version.changes.length > 1 && (
                                <li className="text-xs text-industrial-400">
                                  还有 {version.changes.length - 1} 条变更...
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-industrial-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-industrial-400 flex-shrink-0" />
                        )}
                      </div>

                      {isExpanded && (
                        <div className="p-4 space-y-4 border-t border-industrial-100 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                              <p className="text-xs text-industrial-500 mb-1">当时问题说明：</p>
                              <p className="text-industrial-700 bg-industrial-50 rounded p-2 leading-relaxed">
                                {version.snapshot.problemStatement}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-industrial-500 mb-1">当时缺失材料：</p>
                              {version.snapshot.missingMaterials.length > 0 ? (
                                <div className="space-y-1">
                                  {version.snapshot.missingMaterials.map((m, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-warning-50 rounded px-2 py-1">
                                      <AlertCircle className="w-3 h-3 text-warning-600" />
                                      <span className="text-warning-700">{m}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 bg-emerald-50 rounded px-2 py-1 text-emerald-700">
                                  <CheckCircle className="w-3 h-3" />
                                  材料齐全
                                </div>
                              )}
                            </div>
                          </div>

                          {diff && (
                            <div className="border-t border-industrial-100 pt-4">
                              <p className="text-xs font-medium text-industrial-600 mb-3 flex items-center gap-1">
                                <GitCompareArrows className="w-4 h-4" />
                                与上一版本(v{report.versionHistory[realIdx - 1].version})对比变化：
                              </p>
                              <div className="space-y-3 text-xs">
                                {(diff.removedMissing.length > 0 || diff.addedMissing.length > 0) && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {diff.removedMissing.length > 0 && (
                                      <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
                                        <p className="text-emerald-700 font-medium mb-1 flex items-center gap-1">
                                          <CheckCircle className="w-3 h-3" />
                                          材料补齐：
                                        </p>
                                        <p className="text-emerald-800">
                                          {diff.removedMissing.join('、')}
                                        </p>
                                      </div>
                                    )}
                                    {diff.addedMissing.length > 0 && (
                                      <div className="bg-warning-50 border border-warning-200 rounded p-3">
                                        <p className="text-warning-700 font-medium mb-1 flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3" />
                                          新增待补：
                                        </p>
                                        <p className="text-warning-800">
                                          {diff.addedMissing.join('、')}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(diff.prevHandler !== diff.currHandler) && (
                                  <div className="bg-industrial-50 rounded p-3">
                                    <p className="text-industrial-600">
                                      对接人变更：
                                      <span className="font-mono text-industrial-800">
                                        {' '}{diff.prevHandler} → {diff.currHandler}
                                      </span>
                                    </p>
                                  </div>
                                )}

                                {diff.sensorChanges && diff.sensorChanges.length > 0 && (
                                  <div>
                                    <p className="text-industrial-600 mb-2 flex items-center gap-1">
                                      <ThermometerSun className="w-3 h-3" />
                                      传感器数据变化：
                                    </p>
                                    <div className="space-y-1.5">
                                      {diff.sensorChanges.map((sc) => sc && (
                                        <div key={sc.sensorNo} className="flex items-center gap-2 font-mono bg-white border border-industrial-100 rounded p-2">
                                          <span className="bg-industrial-100 px-1.5 py-0.5 rounded text-industrial-700 text-xs">
                                            {sc.sensorNo}
                                          </span>
                                          <span className="text-warning-700">{sc.prev}</span>
                                          <ArrowLeft className="w-3 h-3 text-industrial-300 rotate-180" />
                                          <span className="text-emerald-700">{sc.curr}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="border-t border-industrial-100 pt-3">
                            <p className="text-xs text-industrial-500 mb-2 flex items-center gap-1">
                              <ThermometerSun className="w-3 h-3" />
                              本版本各传感器快照（可与任一版本对比）：
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-industrial-50">
                                    <th className="px-2 py-1 text-left text-industrial-500 font-normal">
                                      传感器编号
                                    </th>
                                    <th className="px-2 py-1 text-left text-industrial-500 font-normal">
                                      温度
                                    </th>
                                    <th className="px-2 py-1 text-left text-industrial-500 font-normal">
                                      状态
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {version.snapshot.sensorDataSnapshots.map((s) => (
                                    <tr key={s.sensorNo} className="border-t border-industrial-50">
                                      <td className="px-2 py-1 font-mono text-industrial-700">
                                        {s.sensorNo}
                                      </td>
                                      <td className={`px-2 py-1 font-mono ${s.temperatureUnit === 'K' ? 'text-warning-700 font-semibold' : 'text-industrial-700'}`}>
                                        {s.temperature}{s.temperatureUnit === 'K' ? 'K' : '°C'}
                                      </td>
                                      <td className="px-2 py-1">
                                        {s.needsReview ? (
                                          <span className="badge badge-pending">待复核</span>
                                        ) : (
                                          <span className="badge badge-success">已通过</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {task && task.photos.length > 0 && (
                            <div className="border-t border-industrial-100 pt-3">
                              <p className="text-xs text-industrial-500 mb-2 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                工况照片（v{version.version}时共{version.snapshot.photoCount}张）：
                              </p>
                              <div className="grid grid-cols-4 gap-2">
                                {task.photos.slice(0, version.snapshot.photoCount).map((ph) => (
                                  <div key={ph.id} className="relative group">
                                    <img
                                      src={ph.thumbnail}
                                      alt={ph.filename}
                                      className="w-full h-16 object-cover rounded border border-industrial-200"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center text-white text-xs p-1 text-center">
                                      {ph.filename}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-6 mt-6 border-t border-industrial-100">
          <button onClick={handleBack} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回复核
          </button>
          <div className="text-right">
            <p className="text-sm text-industrial-500">报告签发</p>
            <p className="font-medium text-industrial-900">训练教练老唐</p>
          </div>
        </div>
      </div>
    </div>
  );
}
