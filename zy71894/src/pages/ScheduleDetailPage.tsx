import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useScheduleStore } from '@/store/useScheduleStore';
import TraceTimeline from '@/components/TraceTimeline';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import SeverityBadge from '@/components/SeverityBadge';
import type { TraceLink, TeamRecord, ConditionLog, ThresholdTable } from '@/types';
import {
  ArrowLeft,
  FileText,
  RefreshCw,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Users,
  BarChart3,
  ClipboardList,
  History,
  Download,
  Play,
} from 'lucide-react';

export default function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getScheduleById,
    getMaterialBatchInfo,
    getTeamRecordsByBatch,
    getConditionLogsByTeamRecord,
    getThresholdsByMaterialType,
    exportReport,
    runScheduling,
    isScheduling,
    schedulingProgress,
  } = useScheduleStore();
  const [selectedTraceLink, setSelectedTraceLink] = useState<TraceLink | null>(null);
  const [activeTab, setActiveTab] = useState<'trace' | 'warnings' | 'team' | 'conditions' | 'thresholds'>('trace');

  const schedule = id ? getScheduleById(id) : undefined;
  const batchInfo = schedule ? getMaterialBatchInfo(schedule.materialBatchId) : undefined;

  const [teamRecords, setTeamRecords] = useState<TeamRecord[]>([]);
  const [conditionLogs, setConditionLogs] = useState<ConditionLog[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdTable[]>([]);

  useEffect(() => {
    if (schedule) {
      const tr = getTeamRecordsByBatch(schedule.materialBatchId);
      setTeamRecords(tr);
      const cl: ConditionLog[] = [];
      tr.forEach((record) => {
        cl.push(...getConditionLogsByTeamRecord(record.id));
      });
      setConditionLogs(cl);
      setThresholds(getThresholdsByMaterialType(schedule.materialType));
    }
  }, [schedule, getTeamRecordsByBatch, getConditionLogsByTeamRecord, getThresholdsByMaterialType]);

  if (!schedule) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-industrial-600 mb-4">排程记录不存在</p>
          <button
            onClick={() => navigate('/schedule')}
            className="px-4 py-2 bg-primary-700 text-white text-sm hover:bg-primary-800"
          >
            返回排程总表
          </button>
        </div>
      </div>
    );
  }

  const handleReRun = async () => {
    try {
      await runScheduling(schedule.materialBatchId);
    } catch (e) {
      console.error('Re-run failed:', e);
    }
  };

  const handleExportReport = () => {
    const report = exportReport(schedule.id);
    navigate(`/report/${schedule.id}`);
  };

  const handleTraceLinkClick = (link: TraceLink) => {
    setSelectedTraceLink(link);
  };

  const getScoreFromConclusion = () => {
    const match = schedule.conclusion.match(/综合评分: (\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const score = getScoreFromConclusion();

  const warningTypeLabels: Record<string, string> = {
    missing_team_record: '班组记录缺失',
    missing_condition_log: '工况日志缺失',
    duplicate_threshold: '阈值表重复',
    boundary_condition: '边界情况',
    parameter_out_of_range: '参数超出范围',
  };

  const tabs = [
    { id: 'trace', label: '追溯链路', Icon: History },
    { id: 'warnings', label: `警告 (${schedule.warnings.length})`, Icon: AlertTriangle },
    { id: 'team', label: `班组记录 (${teamRecords.length})`, Icon: Users },
    { id: 'conditions', label: `工况日志 (${conditionLogs.length})`, Icon: BarChart3 },
    { id: 'thresholds', label: `阈值表 (${thresholds.filter(t => !t.isDuplicate).length})`, Icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/schedule')}
            className="flex items-center gap-2 text-industrial-600 hover:text-primary-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回总表
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 bg-white border border-industrial-200 p-6 shadow-industrial">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-xl font-mono font-bold text-industrial-900">
                    {schedule.materialBatchId}
                  </h1>
                  <StatusBadge status={schedule.status} />
                  <PriorityBadge priority={schedule.priority} />
                  {schedule.isReRun && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-700">
                      <RefreshCw className="w-3 h-3" />
                      重复排程
                    </span>
                  )}
                </div>
                {batchInfo && (
                  <p className="text-industrial-500 text-sm">{batchInfo.name}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReRun}
                  disabled={isScheduling}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-700 hover:bg-primary-800 disabled:bg-industrial-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isScheduling ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      排程中... {schedulingProgress}%
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      重新排程
                    </>
                  )}
                </button>
                <button
                  onClick={handleExportReport}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-industrial-300 bg-white hover:bg-industrial-50 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  导出报告
                </button>
              </div>
            </div>

            <div className="bg-industrial-50 border border-industrial-200 p-4 mb-4">
              <p className="text-sm font-medium text-industrial-700 mb-2">排程结论</p>
              <p className="text-industrial-900">{schedule.conclusion}</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="border border-industrial-200 p-3">
                <div className="flex items-center gap-2 text-xs text-industrial-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  排程时间
                </div>
                <p className="text-sm font-medium text-industrial-900">
                  {new Date(schedule.scheduleTime).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="border border-industrial-200 p-3">
                <div className="flex items-center gap-2 text-xs text-industrial-500 mb-1">
                  <Clock className="w-4 h-4" />
                  推荐窗口
                </div>
                <p className="text-sm font-medium text-industrial-900">
                  {schedule.recommendedStartTime
                    ? `${new Date(schedule.recommendedStartTime).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })} - ${new Date(
                        schedule.recommendedEndTime!
                      ).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
                    : '未确定'}
                </p>
              </div>
              <div className="border border-industrial-200 p-3">
                <div className="flex items-center gap-2 text-xs text-industrial-500 mb-1">
                  <RefreshCw className="w-4 h-4" />
                  运行次数
                </div>
                <p className="text-sm font-medium text-industrial-900">
                  第 {schedule.runCount} 次
                </p>
              </div>
              <div className="border border-industrial-200 p-3">
                <div className="flex items-center gap-2 text-xs text-industrial-500 mb-1">
                  <Info className="w-4 h-4" />
                  综合评分
                </div>
                <p
                  className={`text-lg font-mono font-bold ${
                    score && score >= 80
                      ? 'text-green-600'
                      : score && score >= 60
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  {score !== null ? `${score}/100` : '未评分'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-industrial-200 p-6 shadow-industrial">
            <h2 className="text-sm font-semibold text-industrial-900 mb-4">依据来源统计</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800">班组记录</span>
                </div>
                <span className="text-lg font-mono font-bold text-blue-700">
                  {teamRecords.length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800">工况日志</span>
                </div>
                <span className="text-lg font-mono font-bold text-green-700">
                  {conditionLogs.length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-purple-800">阈值表</span>
                </div>
                <span className="text-lg font-mono font-bold text-purple-700">
                  {thresholds.filter((t) => !t.isDuplicate).length}
                </span>
              </div>
              <div className="border-t border-industrial-200 pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-industrial-600">追溯链路总数</span>
                  <span className="text-lg font-mono font-bold text-industrial-900">
                    {schedule.traceLinks.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-industrial-200 shadow-industrial">
          <div className="border-b border-industrial-200">
            <nav className="flex">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as typeof activeTab)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === id
                      ? 'border-primary-600 text-primary-700 bg-primary-50'
                      : 'border-transparent text-industrial-500 hover:text-industrial-700 hover:bg-industrial-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'trace' && (
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2">
                  <h3 className="text-sm font-semibold text-industrial-900 mb-4">
                    追溯时间线 - 点击节点查看详情
                  </h3>
                  <TraceTimeline
                    traceLinks={schedule.traceLinks}
                    onLinkClick={handleTraceLinkClick}
                    selectedLinkId={selectedTraceLink?.id}
                  />
                </div>
                <div className="border-l border-industrial-200 pl-6">
                  <h3 className="text-sm font-semibold text-industrial-900 mb-4">节点详情</h3>
                  {selectedTraceLink ? (
                    <div className="bg-industrial-50 border border-industrial-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        {selectedTraceLink.sourceType === 'team_record' && (
                          <Users className="w-5 h-5 text-blue-600" />
                        )}
                        {selectedTraceLink.sourceType === 'condition_log' && (
                          <BarChart3 className="w-5 h-5 text-green-600" />
                        )}
                        {selectedTraceLink.sourceType === 'threshold' && (
                          <ClipboardList className="w-5 h-5 text-purple-600" />
                        )}
                        <span className="font-medium text-industrial-900">
                          {selectedTraceLink.sourceName}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-industrial-500">类型: </span>
                          <span className="text-industrial-700">
                            {selectedTraceLink.sourceType === 'team_record' && '班组记录'}
                            {selectedTraceLink.sourceType === 'condition_log' && '工况日志'}
                            {selectedTraceLink.sourceType === 'threshold' && '阈值表'}
                          </span>
                        </div>
                        <div>
                          <span className="text-industrial-500">序号: </span>
                          <span className="text-industrial-700">#{selectedTraceLink.sequence}</span>
                        </div>
                        <div>
                          <span className="text-industrial-500">影响: </span>
                          <span
                            className={`${
                              selectedTraceLink.impact === 'positive'
                                ? 'text-green-600'
                                : selectedTraceLink.impact === 'negative'
                                ? 'text-red-600'
                                : 'text-industrial-600'
                            }`}
                          >
                            {selectedTraceLink.impact === 'positive' && '正面影响'}
                            {selectedTraceLink.impact === 'negative' && '负面影响'}
                            {selectedTraceLink.impact === 'neutral' && '中性'}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-industrial-200">
                          <p className="text-industrial-500 mb-1">内容:</p>
                          <p className="text-industrial-900 bg-white p-3 border border-industrial-200 font-mono text-xs">
                            {selectedTraceLink.sourceContent}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-industrial-400">
                      <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>点击左侧节点查看详情</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'warnings' && (
              <div>
                <h3 className="text-sm font-semibold text-industrial-900 mb-4">警告列表</h3>
                {schedule.warnings.length === 0 ? (
                  <div className="text-center py-8 text-industrial-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p>无警告</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedule.warnings.map((warning) => (
                      <div
                        key={warning.id}
                        className={`flex items-start gap-4 p-4 border ${
                          warning.severity === 'high'
                            ? 'bg-red-50 border-red-200'
                            : warning.severity === 'medium'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="mt-0.5">
                          {warning.severity === 'high' && (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          {warning.severity === 'medium' && (
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                          )}
                          {warning.severity === 'low' && (
                            <Info className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-industrial-900">
                              {warningTypeLabels[warning.type] || warning.type}
                            </span>
                            <SeverityBadge severity={warning.severity} />
                          </div>
                          <p className="text-sm text-industrial-700">{warning.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <div>
                <h3 className="text-sm font-semibold text-industrial-900 mb-4">班组记录列表</h3>
                <div className="space-y-4">
                  {teamRecords.map((tr) => (
                    <div
                      key={tr.id}
                      className={`border p-4 ${
                        tr.isMissing
                          ? 'bg-red-50 border-red-200'
                          : tr.status === 'warning'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-white border-industrial-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-industrial-900">
                              {tr.teamId} - {tr.operator}
                            </p>
                            <p className="text-xs text-industrial-500">
                              记录时间: {new Date(tr.recordTime).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                        {tr.isMissing && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700">
                            内容缺失
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-industrial-700 mb-3">
                        {tr.content || '【内容缺失】'}
                      </p>
                      {tr.modificationHistory.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-industrial-200">
                          <p className="text-xs text-industrial-500 mb-2">修改历史:</p>
                          <div className="space-y-2">
                            {tr.modificationHistory.map((ml) => (
                              <div
                                key={ml.id}
                                className="bg-industrial-50 p-3 text-xs"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-industrial-700">
                                    {ml.modifiedBy}
                                  </span>
                                  <span className="text-industrial-400">
                                    {new Date(ml.modifiedAt).toLocaleString('zh-CN')}
                                  </span>
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700">
                                    {ml.reason}
                                  </span>
                                </div>
                                <div className="font-mono text-industrial-600">
                                  <span className="text-red-600">"- {ml.oldContent}"</span>
                                  <span className="mx-2">→</span>
                                  <span className="text-green-600">"+ {ml.newContent}"</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'conditions' && (
              <div>
                <h3 className="text-sm font-semibold text-industrial-900 mb-4">工况日志列表</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-industrial-50 border-b border-industrial-200">
                        <th className="text-left px-4 py-3 font-semibold text-industrial-600">
                          工况类型
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-industrial-600">
                          温度 (°C)
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-industrial-600">
                          压力 (kPa)
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-industrial-600">
                          流速 (m/s)
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-industrial-600">
                          操作员
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-industrial-600">
                          记录时间
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-industrial-600">
                          状态
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-industrial-200">
                      {conditionLogs.map((cl) => (
                        <tr
                          key={cl.id}
                          className={
                            cl.isMissing
                              ? 'bg-red-50'
                              : cl.status === 'abnormal'
                              ? 'bg-amber-50'
                              : 'hover:bg-industrial-50'
                          }
                        >
                          <td className="px-4 py-3 font-medium text-industrial-900">
                            {cl.conditionType || '【缺失】'}
                          </td>
                          <td className="px-4 py-3 font-mono text-industrial-700">
                            {cl.isMissing ? '-' : cl.temperature}
                          </td>
                          <td className="px-4 py-3 font-mono text-industrial-700">
                            {cl.isMissing ? '-' : cl.pressure}
                          </td>
                          <td className="px-4 py-3 font-mono text-industrial-700">
                            {cl.isMissing ? '-' : cl.velocity}
                          </td>
                          <td className="px-4 py-3 text-industrial-600">
                            {cl.operator || '-'}
                          </td>
                          <td className="px-4 py-3 text-industrial-600">
                            {new Date(cl.logTime).toLocaleString('zh-CN')}
                          </td>
                          <td className="px-4 py-3">
                            {cl.isMissing ? (
                              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700">
                                缺失
                              </span>
                            ) : cl.status === 'abnormal' ? (
                              <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700">
                                异常
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700">
                                正常
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'thresholds' && (
              <div>
                <h3 className="text-sm font-semibold text-industrial-900 mb-4">阈值表</h3>
                {thresholds.some((t) => t.isDuplicate) && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                      检测到重复阈值表条目，已自动去重。重复条目已标记显示。
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  {thresholds.map((th) => (
                    <div
                      key={th.id}
                      className={`border p-4 ${
                        th.isDuplicate
                          ? 'bg-amber-50 border-amber-200 opacity-60'
                          : 'bg-white border-industrial-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-purple-600" />
                          <span className="font-medium text-industrial-900">{th.parameter}</span>
                        </div>
                        {th.isDuplicate && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700">
                            重复 (v{th.version})
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-lg font-bold text-industrial-900 mb-1">
                        [{th.minValue}, {th.maxValue}] {th.unit}
                      </div>
                      <p className="text-xs text-industrial-500">
                        {th.materialType} · 版本 v{th.version}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
