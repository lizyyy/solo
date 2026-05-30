import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { formatVelocity, formatTemperature, formatDistance, formatTime, formatPercent, formatDateTime, formatRelativeTime } from '../utils/format';
import { downloadReport, downloadCSV, createExportPayload, downloadJSON } from '../utils/export';
import { 
  ArrowLeft, 
  FileText, 
  RotateCcw, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Thermometer,
  Ruler,
  Timer,
  Settings,
  Hash,
  Clock,
  Shield,
  Link2,
  ListOrdered,
  Zap,
  Eye,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { CompleteRecord, Anomaly, EvidenceItem, CalculationStep, AuditLogEntry } from '../types';
import { getSourceText, getCorroborationText } from '../engine/evidence';

const sourceIcons: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  distance: Ruler,
  time: Timer,
  device: Settings,
  system: Zap,
};

const sourceColors: Record<string, string> = {
  temperature: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
  distance: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
  time: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  device: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  system: 'text-slate-400 bg-slate-500/20 border-slate-500/30',
};

const severityColors: Record<string, string> = {
  error: 'text-red-400 bg-red-500/10 border-red-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

export default function ResultDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { records, loadRecord, recalculateRecord, viewState } = useAppStore();
  const [record, setRecord] = useState<CompleteRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateResult, setRecalculateResult] = useState<'match' | 'mismatch' | null>(null);
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(new Set());
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'calculation' | 'audit'>('overview');

  useEffect(() => {
    if (id) {
      loadRecord(id);
    }
  }, [id, loadRecord]);

  useEffect(() => {
    const found = records.find(r => r.id === id);
    if (found) {
      setRecord(found);
      setIsLoading(false);
    }
  }, [records, id]);

  const handleRecalculate = async () => {
    if (!record) return;
    setIsRecalculating(true);
    setRecalculateResult(null);
    try {
      await recalculateRecord(record.id);
      const updatedRecord = records.find(r => r.id === record.id);
      if (updatedRecord) {
        const hashMatch = updatedRecord.result.inputHash === record.result.inputHash;
        const valueMatch = Math.abs(updatedRecord.result.theoreticalValue - record.result.theoreticalValue) < 0.001 &&
                          Math.abs(updatedRecord.result.measuredValue - record.result.measuredValue) < 0.001;
        setRecalculateResult(hashMatch && valueMatch ? 'match' : 'mismatch');
      }
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleExportReport = () => {
    if (record) {
      downloadReport(record);
    }
  };

  const handleExportCSV = () => {
    if (record) {
      downloadCSV([record], viewState, `详情_${record.id.slice(0, 8)}`);
    }
  };

  const handleExportJSON = async () => {
    if (record) {
      const payload = await createExportPayload([record], viewState);
      downloadJSON(payload, `详情_${record.id.slice(0, 8)}`);
    }
  };

  const toggleExpand = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const newSet = new Set(set);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setter(newSet);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400">加载记录详情中...</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <div className="bg-slate-800/50 rounded-2xl p-12 text-center border border-slate-700">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h2 className="text-xl font-bold text-white mb-2">记录不存在</h2>
            <p className="text-slate-400">无法找到指定的记录ID，请检查链接是否正确</p>
          </div>
        </div>
      </div>
    );
  }

  const conclusionConfig = {
    consistent: { icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', label: '结果一致' },
    inconsistent: { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', label: '结论不一致' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', label: '存在异常' },
  };

  const corroborationConfig = {
    full: { icon: CheckCircle2, color: 'text-emerald-400', label: '完全印证' },
    partial: { icon: AlertTriangle, color: 'text-amber-400', label: '部分印证' },
    none: { icon: XCircle, color: 'text-red-400', label: '无印证' },
  };

  const config = conclusionConfig[record.result.conclusion];
  const ConclusionIcon = config.icon;
  const corrobConfig = corroborationConfig[record.evidenceChain.corroborationLevel];
  const CorrobIcon = corrobConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Eye className="w-8 h-8 text-blue-400" />
              记录详情
            </h1>
            <p className="text-slate-400">
              记录ID: <span className="font-mono text-slate-300">{record.id}</span>
              {' · '}
              创建于 {formatDateTime(record.createdAt)}
              {' · '}
              {formatRelativeTime(record.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all"
            >
              {isRecalculating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              复算验证
            </button>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all"
            >
              <FileText className="w-4 h-4" />
              导出报告
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
          </div>
        </div>

        {recalculateResult !== null && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
            recalculateResult === 'match' 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {recalculateResult === 'match' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <p className={recalculateResult === 'match' ? 'text-emerald-300' : 'text-red-300'}>
              {recalculateResult === 'match' 
                ? '✓ 复算验证通过：输入哈希一致，计算结果完全相同，可复算性验证成功' 
                : '✗ 复算验证失败：结果与原始记录不一致，请检查输入参数或算法版本'}
            </p>
          </div>
        )}

        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {[
            { id: 'overview', label: '概览', icon: Shield },
            { id: 'evidence', label: '证据链', icon: Link2 },
            { id: 'calculation', label: '计算步骤', icon: ListOrdered },
            { id: 'audit', label: '审计日志', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-400'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">计算结论</h2>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${config.bgColor} ${config.borderColor} border`}>
                  <ConclusionIcon className={`w-5 h-5 ${config.color}`} />
                  <span className={`font-medium ${config.color}`}>{config.label}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl p-4 border border-orange-500/20">
                  <div className="flex items-center gap-2 text-orange-400 text-sm mb-2">
                    <Thermometer className="w-4 h-4" />
                    理论值
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {formatVelocity(record.result.theoreticalValue)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">温度法计算</div>
                </div>

                <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-xl p-4 border border-cyan-500/20">
                  <div className="flex items-center gap-2 text-cyan-400 text-sm mb-2">
                    <Ruler className="w-4 h-4" />
                    测量值
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {Number.isNaN(record.result.measuredValue) ? '--' : formatVelocity(record.result.measuredValue)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">测距法计算</div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-4 border border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
                    <Settings className="w-4 h-4" />
                    校准后
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {Number.isNaN(record.result.calibratedValue) ? '--' : formatVelocity(record.result.calibratedValue)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">含设备偏差</div>
                </div>

                <div className={`rounded-xl p-4 border ${
                  Math.abs(record.result.deviationPercent) <= 5 
                    ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' 
                    : 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20'
                }`}>
                  <div className={`flex items-center gap-2 text-sm mb-2 ${
                    Math.abs(record.result.deviationPercent) <= 5 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                    偏差
                  </div>
                  <div className={`text-2xl font-bold font-mono ${
                    Math.abs(record.result.deviationPercent) <= 5 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {Number.isNaN(record.result.deviationPercent) ? '--' : formatPercent(record.result.deviationPercent)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    绝对偏差: {Number.isNaN(record.result.deviation) ? '--' : `${record.result.deviation.toFixed(2)} m/s`}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-3 text-slate-400">
                  <Hash className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">输入哈希</div>
                    <div className="font-mono text-xs">{record.result.inputHash}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">计算时间</div>
                    <div>{formatDateTime(record.result.calculatedAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <Settings className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">算法版本</div>
                    <div className="font-mono">v{record.result.algorithmVersion}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-4">输入参数快照</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-orange-400 text-sm mb-2">
                    <Thermometer className="w-4 h-4" />
                    温度
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {record.input.temperature !== null ? formatTemperature(record.input.temperature) : (
                      <span className="text-amber-400">缺失 (默认20℃)</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-cyan-400 text-sm mb-2">
                    <Ruler className="w-4 h-4" />
                    测距
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {record.input.distance !== null ? formatDistance(record.input.distance) : (
                      <span className="text-amber-400">缺失</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-purple-400 text-sm mb-2">
                    <Timer className="w-4 h-4" />
                    时间差
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {record.input.timeDiff !== null 
                      ? formatTime(record.input.timeDiff, record.input.timeUnit) 
                      : <span className="text-amber-400">缺失</span>
                    }
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    单位: {record.input.timeUnit === 's' ? '秒' : '毫秒'}
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
                    <Settings className="w-4 h-4" />
                    设备偏差
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {record.input.deviceDeviation !== null 
                      ? `${record.input.deviceDeviation} m/s` 
                      : <span className="text-amber-400">缺失 (默认±0.5m/s)</span>
                    }
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-4">
                  <div className="text-sm text-slate-400 mb-2">设备编号</div>
                  <div className="text-lg font-mono text-white">
                    {record.input.deviceId || '未提供'}
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-4">
                  <div className="text-sm text-slate-400 mb-2">操作人员</div>
                  <div className="text-lg text-white">
                    {record.input.operator || '未记录'}
                  </div>
                </div>
              </div>

              {record.input.notes && (
                <div className="mt-4 bg-slate-900/50 rounded-xl p-4">
                  <div className="text-sm text-slate-400 mb-2">备注</div>
                  <p className="text-white">{record.input.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                异常检测结果 ({record.anomalies.length})
              </h2>
              {record.anomalies.length === 0 ? (
                <div className="text-center py-8 text-emerald-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3" />
                  <p className="font-medium">无异常检测到</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {record.anomalies.map((anomaly: Anomaly) => {
                    const isExpanded = expandedAnomalies.has(anomaly.id);
                    const SourceIcon = sourceIcons[anomaly.type.includes('temperature') ? 'temperature' : 
                                            anomaly.type.includes('time') ? 'time' : 
                                            anomaly.type.includes('device') ? 'device' : 'system'];
                    return (
                      <div
                        key={anomaly.id}
                        className={`rounded-xl border ${severityColors[anomaly.severity]}`}
                      >
                        <div
                          onClick={() => toggleExpand(expandedAnomalies, anomaly.id, setExpandedAnomalies)}
                          className="p-4 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-mono text-slate-300">
                                #{anomaly.sequence}
                              </span>
                              <div className={`px-2 py-0.5 rounded-md text-xs flex items-center gap-1 ${sourceColors[anomaly.type.includes('temperature') ? 'temperature' : anomaly.type.includes('time') ? 'time' : anomaly.type.includes('device') ? 'device' : 'system']}`}>
                                <SourceIcon className="w-3 h-3" />
                                {getSourceText(anomaly.type.includes('temperature') ? 'temperature' : anomaly.type.includes('time') ? 'time' : anomaly.type.includes('device') ? 'device' : 'system')}
                              </div>
                              <span className={`font-medium ${severityColors[anomaly.severity].split(' ')[0]}`}>
                                {anomaly.explanation}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                anomaly.severity === 'error' ? 'bg-red-500/20 text-red-400' :
                                anomaly.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {anomaly.severity === 'error' ? '错误' : anomaly.severity === 'warning' ? '警告' : '提示'}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="text-slate-500 mb-1">影响</div>
                                  <p className="text-slate-300">{anomaly.impact}</p>
                                </div>
                                <div>
                                  <div className="text-slate-500 mb-1">修复建议</div>
                                  <p className="text-slate-300">{anomaly.suggestion}</p>
                                </div>
                              </div>
                              {anomaly.field && (
                                <div className="text-xs text-slate-500">
                                  相关字段: <span className="text-slate-300 font-mono">{anomaly.field}</span>
                                  {anomaly.value !== undefined && (
                                    <> = <span className="text-slate-300 font-mono">{String(anomaly.value)}</span></>
                                  )}
                                </div>
                              )}
                              <div className="text-xs text-slate-500">
                                检测时间: {formatDateTime(anomaly.detectedAt)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl p-6 border border-blue-500/20">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${corrobConfig.color.replace('text-', 'bg-').replace('400', '500/20')} flex items-center justify-center flex-shrink-0`}>
                  <CorrobIcon className={`w-6 h-6 ${corrobConfig.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">证据印证分析</h3>
                  <p className="text-slate-300 mb-3">{record.evidenceChain.overallConclusion}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">印证级别:</span>
                      <span className={`font-medium ${corrobConfig.color}`}>
                        {getCorroborationText(record.evidenceChain.corroborationLevel)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">置信度:</span>
                      <span className="text-white font-mono">{record.evidenceChain.confidence}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">证据项:</span>
                      <span className="text-white font-mono">{record.evidenceChain.items.length}</span>
                    </div>
                  </div>
                  {record.evidenceChain.contradictions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="text-sm text-red-400 font-medium mb-2">检测到矛盾点:</div>
                      {record.evidenceChain.contradictions.map((c, i) => (
                        <p key={i} className="text-sm text-red-300">• {c}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-400" />
              证据链明细
            </h2>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-slate-600 to-slate-700" />
              <div className="space-y-1">
                {record.evidenceChain.items.map((item: EvidenceItem, index: number) => {
                  const SourceIcon = sourceIcons[item.source] || Zap;
                  const isExpanded = expandedEvidence.has(item.id);
                  const isAnomaly = item.type === 'anomaly';
                  return (
                    <div key={item.id} className="relative pl-14 pb-4">
                      <div className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isAnomaly 
                          ? 'bg-red-500 border-red-400' 
                          : 'bg-blue-500 border-blue-400'
                      }`}>
                        {index === record.evidenceChain.items.length - 1 ? (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div
                        onClick={() => toggleExpand(expandedEvidence, item.id, setExpandedEvidence)}
                        className={`cursor-pointer rounded-xl border transition-all ${
                          isAnomaly
                            ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                            : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50'
                        }`}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-mono text-slate-300">
                                #{item.sequence}
                              </span>
                              <div className={`px-2 py-0.5 rounded-md text-xs flex items-center gap-1 ${sourceColors[item.source]}`}>
                                <SourceIcon className="w-3 h-3" />
                                {getSourceText(item.source)}
                              </div>
                              <span className={`text-sm font-medium ${isAnomaly ? 'text-red-300' : 'text-white'}`}>
                                {item.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.value !== undefined && (
                                <span className="text-sm font-mono text-slate-300">
                                  {item.value.toFixed(2)}{item.unit ? ` ${item.unit}` : ''}
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-600/50">
                              <p className="text-sm text-slate-300">{item.content}</p>
                              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDateTime(item.timestamp)}
                                </span>
                                <span>类型: {item.type}</span>
                                {item.supports && item.supports.length > 0 && (
                                  <span className="text-emerald-400">支持: {item.supports.join(', ')}</span>
                                )}
                                {item.contradicts && item.contradicts.length > 0 && (
                                  <span className="text-red-400">矛盾: {item.contradicts.join(', ')}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calculation' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-blue-400" />
              计算步骤溯源
            </h2>
            <div className="space-y-4">
              {record.result.calculationSteps.map((step: CalculationStep) => {
                const isExpanded = expandedSteps.has(step.id);
                return (
                  <div
                    key={step.id}
                    className="bg-slate-700/30 border border-slate-600/50 rounded-xl overflow-hidden"
                  >
                    <div
                      onClick={() => toggleExpand(expandedSteps, step.id, setExpandedSteps)}
                      className="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-mono text-blue-400">
                            {step.stepOrder}
                          </span>
                          <div>
                            <div className="font-medium text-white">{step.description}</div>
                            <div className="text-xs text-slate-500 font-mono mt-1">{step.formula}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-mono text-cyan-400">
                              {step.intermediateValue.toFixed(4)} {step.unit}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-600/50">
                          <div className="text-sm text-slate-400 mb-2">输入参数:</div>
                          <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                            {JSON.stringify(step.inputs, null, 2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              审计日志
            </h2>
            <div className="space-y-3">
              {record.auditLog.map((log: AuditLogEntry) => (
                <div
                  key={log.id}
                  className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-mono text-slate-300 mt-0.5">
                        #{log.sequence}
                      </span>
                      <div>
                        <div className="font-medium text-white">{log.action}</div>
                        <div className="text-xs text-slate-500 mt-1">{formatDateTime(log.timestamp)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 bg-slate-900/50 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
