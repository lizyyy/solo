import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import DriftCurve from '@/components/DriftCurve';
import SegmentStats from '@/components/SegmentStats';
import Waveform from '@/components/Waveform';
import type { DriftAnalysis, DriftResult, AudioFile, AuditEntry, MatchedBeat, AnomalyRegion } from '../../shared/types';

type TabType = 'segments' | 'audit' | 'beats';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<DriftAnalysis | null>(null);
  const [result, setResult] = useState<DriftResult | null>(null);
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('segments');
  const [expandedAuditRows, setExpandedAuditRows] = useState<Set<number>>(new Set());
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [analysisRes, resultRes, waveformRes] = await Promise.all([
          fetch(`/api/analysis/${id}`).then((r) => r.json() as Promise<ApiResponse<DriftAnalysis>>),
          fetch(`/api/analysis/${id}/result`).then((r) => r.json() as Promise<ApiResponse<DriftResult>>),
          fetch(`/api/audio/${id}/waveform`).then((r) => r.json() as Promise<ApiResponse<{ waveform: number[]; audioFile: AudioFile }>>),
        ]);

        if (!analysisRes.success) throw new Error(analysisRes.error || 'Failed to fetch analysis');
        if (!resultRes.success) throw new Error(resultRes.error || 'Failed to fetch result');
        if (!waveformRes.success) throw new Error(waveformRes.error || 'Failed to fetch waveform');

        setAnalysis(analysisRes.data);
        setResult(resultRes.data);
        setWaveform(waveformRes.data.waveform);
        setAudioFile(waveformRes.data.audioFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const stats = useMemo(() => {
    if (!result) return null;

    const totalBeats = result.matchedBeats.length;
    const matchedCount = result.matchedBeats.filter((b) => b.matched).length;
    const matchRate = totalBeats > 0 ? (matchedCount / totalBeats) * 100 : 0;
    const maxDrift = Math.max(...result.driftCurve.map((d) => Math.abs(d.cumulativeDriftMs)));

    return {
      totalBeats,
      matchRate,
      anomalyCount: result.anomalyRegions.length,
      maxDrift,
    };
  }, [result]);

  const firstAnomaly = useMemo(() => {
    if (!result?.anomalyRegions?.length) return null;
    return [...result.anomalyRegions].sort((a, b) => a.startMs - b.startMs)[0];
  }, [result]);

  const toggleAuditRow = (index: number) => {
    setExpandedAuditRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleGenerateReport = async () => {
    if (!id) return;

    try {
      setGeneratingReport(true);
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysisId: id }),
      });

      const data = (await response.json()) as ApiResponse<unknown>;
      if (data.success) {
        navigate('/reports');
      } else {
        setError(data.error || 'Failed to generate report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleAnomalyClick = (region: AnomalyRegion) => {
    console.log('Jump to anomaly at:', region.startMs);
  };

  const getStatusBadge = (status: DriftAnalysis['status']) => {
    const styles = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      running: 'bg-blue-100 text-blue-800 border-blue-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
    };

    const labels = {
      completed: '已完成',
      running: '运行中',
      pending: '等待中',
      failed: '失败',
    };

    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', styles[status])}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A2E]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
          <p className="text-charcoal-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis || !result || !audioFile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A2E]">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">加载失败</h2>
          <p className="text-charcoal-400 mb-4">{error || '无法加载分析数据'}</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-white">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <nav className="flex items-center gap-2 text-sm mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            分析工作台
          </button>
          <span className="text-charcoal-500">/</span>
          <span className="text-charcoal-300">漂移分析</span>
        </nav>

        <div className="flex gap-6">
          <div className="w-80 flex-shrink-0 space-y-4">
            <div className="bg-charcoal-800 rounded-xl border border-charcoal-700 p-5">
              <h3 className="text-lg font-semibold mb-4 text-charcoal-100">分析概览</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-charcoal-400 uppercase tracking-wider block mb-1">
                    音频文件
                  </label>
                  <p className="text-sm font-medium text-charcoal-100 truncate" title={audioFile.filename}>
                    {audioFile.filename}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-charcoal-400 uppercase tracking-wider block mb-1">
                    分析状态
                  </label>
                  {getStatusBadge(analysis.status)}
                </div>

                <div className="pt-4 border-t border-charcoal-700">
                  <label className="text-xs text-charcoal-400 uppercase tracking-wider block mb-3">
                    配置参数
                  </label>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-charcoal-400">参考 BPM</span>
                      <span className="text-sm font-mono text-charcoal-100">{analysis.config.referenceBpm}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-charcoal-400">漂移阈值</span>
                      <span className="text-sm font-mono text-charcoal-100">{analysis.config.driftThreshold}ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-charcoal-400">置信度阈值</span>
                      <span className="text-sm font-mono text-charcoal-100">{analysis.config.confidenceThreshold}</span>
                    </div>
                  </div>
                </div>

                {stats && (
                  <div className="pt-4 border-t border-charcoal-700">
                    <label className="text-xs text-charcoal-400 uppercase tracking-wider block mb-3">
                      统计指标
                    </label>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-charcoal-400">总节拍数</span>
                        <span className="text-sm font-mono text-charcoal-100">{stats.totalBeats}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-charcoal-400">匹配率</span>
                        <span className={cn(
                          'text-sm font-mono',
                          stats.matchRate >= 90 ? 'text-green-400' : stats.matchRate >= 70 ? 'text-yellow-400' : 'text-red-400'
                        )}>
                          {stats.matchRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-charcoal-400">异常区域数</span>
                        <span className={cn(
                          'text-sm font-mono',
                          stats.anomalyCount === 0 ? 'text-green-400' : 'text-red-400'
                        )}>
                          {stats.anomalyCount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-charcoal-400">最大漂移</span>
                        <span className={cn(
                          'text-sm font-mono',
                          stats.maxDrift > analysis.config.driftThreshold ? 'text-red-400' : 'text-cyan-400'
                        )}>
                          {stats.maxDrift.toFixed(2)}ms
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-charcoal-800 rounded-xl border border-charcoal-700 p-5 space-y-3">
              <button
                onClick={() => navigate(`/errors/${id}`)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
              >
                <AlertTriangle className="w-4 h-4" />
                查看错因
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                {generatingReport ? '生成中...' : '生成报告'}
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-charcoal-700 text-charcoal-200 rounded-lg hover:bg-charcoal-600 transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                返回工作台
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-6">
            <div className="bg-charcoal-800 rounded-xl border border-charcoal-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-charcoal-100">漂移曲线</h3>
                {firstAnomaly && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                    <span className="text-red-400 font-medium">开始越拉越散</span>
                    <span className="text-charcoal-400 font-mono">
                      @ {(firstAnomaly.startMs / 1000).toFixed(2)}s
                    </span>
                  </div>
                )}
              </div>
              
              <div className="relative">
                <DriftCurve
                  driftCurve={result.driftCurve}
                  threshold={analysis.config.driftThreshold}
                  anomalyRegions={result.anomalyRegions}
                  height={350}
                />
                
                {firstAnomaly && (
                  <div
                    className="absolute z-20 cursor-pointer group"
                    style={{
                      left: `${Math.min(95, Math.max(5, (firstAnomaly.startMs / audioFile.duration / 10) * 100))}%`,
                      top: '40%',
                      transform: 'translateX(-50%)',
                    }}
                    onClick={() => handleAnomalyClick(firstAnomaly)}
                  >
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping">
                        <svg width="24" height="24" viewBox="0 0 24 24" className="text-red-500 opacity-50">
                          <polygon
                            points="12,2 22,12 12,22 2,12"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <svg width="24" height="24" viewBox="0 0 24 24" className="text-red-500 relative z-10">
                        <polygon
                          points="12,2 22,12 12,22 2,12"
                          fill="currentColor"
                          stroke="#fff"
                          strokeWidth="1"
                        />
                      </svg>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        开始越拉越散
                      </div>
                    </div>
                  </div>
                )}

                {result.anomalyRegions.map((region) => (
                  <div
                    key={region.id}
                    className="absolute z-10 cursor-pointer group"
                    style={{
                      left: `${Math.min(95, Math.max(5, (region.startMs / audioFile.duration / 10) * 100))}%`,
                      top: '10%',
                      transform: 'translateX(-50%)',
                    }}
                    onClick={() => handleAnomalyClick(region)}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 border border-white shadow-lg hover:scale-150 transition-transform" />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-charcoal-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-charcoal-600">
                      {region.tag} @ {(region.startMs / 1000).toFixed(2)}s
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-charcoal-800 rounded-xl border border-charcoal-700 p-5">
              <h3 className="text-lg font-semibold text-charcoal-100 mb-4">波形预览</h3>
              <Waveform
                waveform={waveform}
                duration={audioFile.duration}
                selectedAnomalies={result.anomalyRegions}
              />
            </div>

            <div className="bg-charcoal-800 rounded-xl border border-charcoal-700 overflow-hidden">
              <div className="flex border-b border-charcoal-700">
                <button
                  onClick={() => setActiveTab('segments')}
                  className={cn(
                    'px-6 py-3 text-sm font-medium transition-colors',
                    activeTab === 'segments'
                      ? 'bg-charcoal-700 text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-700/50'
                  )}
                >
                  分段统计
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={cn(
                    'px-6 py-3 text-sm font-medium transition-colors',
                    activeTab === 'audit'
                      ? 'bg-charcoal-700 text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-700/50'
                  )}
                >
                  计算审计
                </button>
                <button
                  onClick={() => setActiveTab('beats')}
                  className={cn(
                    'px-6 py-3 text-sm font-medium transition-colors',
                    activeTab === 'beats'
                      ? 'bg-charcoal-700 text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-700/50'
                  )}
                >
                  节拍匹配
                </button>
              </div>

              <div className="p-5">
                {activeTab === 'segments' && (
                  <SegmentStats
                    segments={result.segments}
                    threshold={analysis.config.driftThreshold}
                  />
                )}

                {activeTab === 'audit' && (
                  <div className="space-y-2">
                    {result.auditTrail.length === 0 ? (
                      <div className="text-center py-8 text-charcoal-500">
                        暂无审计数据
                      </div>
                    ) : (
                      result.auditTrail.map((entry: AuditEntry, index: number) => {
                        const isExpanded = expandedAuditRows.has(index);
                        return (
                          <div
                            key={index}
                            className="border border-charcoal-700 rounded-lg overflow-hidden"
                          >
                            <button
                              onClick={() => toggleAuditRow(index)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-charcoal-700/50 transition-colors text-left"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-charcoal-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-charcoal-400 flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium text-charcoal-200 flex-1">
                                {entry.step}
                              </span>
                              <span className="text-xs font-mono text-cyan-400">
                                = {entry.output}
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-0 border-t border-charcoal-700/50 bg-charcoal-800/50">
                                <div className="pt-3 space-y-3">
                                  <div>
                                    <label className="text-xs text-charcoal-500 uppercase tracking-wider block mb-1">
                                      公式
                                    </label>
                                    <code className="text-sm bg-charcoal-900 px-3 py-2 rounded block font-mono text-charcoal-300 break-all">
                                      {entry.formula}
                                    </code>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-xs text-charcoal-500 uppercase tracking-wider block mb-1">
                                        输入参数
                                      </label>
                                      <div className="bg-charcoal-900 rounded p-3">
                                        {Object.entries(entry.inputs).map(([key, value]) => (
                                          <div key={key} className="flex justify-between text-sm">
                                            <span className="text-charcoal-400">{key}</span>
                                            <span className="font-mono text-charcoal-200">{value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs text-charcoal-500 uppercase tracking-wider block mb-1">
                                        输出结果
                                      </label>
                                      <div className="bg-charcoal-900 rounded p-3">
                                        <div className="flex justify-between text-sm">
                                          <span className="text-charcoal-400">result</span>
                                          <span className="font-mono text-cyan-400">{entry.output}</span>
                                        </div>
                                        <div className="flex justify-between text-sm mt-1">
                                          <span className="text-charcoal-400">timestamp</span>
                                          <span className="font-mono text-charcoal-400 text-xs">
                                            {new Date(entry.timestamp).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {activeTab === 'beats' && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-charcoal-700">
                          <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                            检测时间
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                            参考时间
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                            偏移量
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                            置信度
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-400 uppercase tracking-wider">
                            是否匹配
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-charcoal-700">
                        {result.matchedBeats.map((beat: MatchedBeat, index: number) => (
                          <tr
                            key={index}
                            className={cn(
                              'hover:bg-charcoal-700/30 transition-colors',
                              !beat.matched && 'bg-red-900/20'
                            )}
                          >
                            <td className="px-4 py-3 text-sm font-mono text-charcoal-200">
                              {(beat.detectedTime / 1000).toFixed(3)}s
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-charcoal-400">
                              {(beat.referenceTime / 1000).toFixed(3)}s
                            </td>
                            <td className={cn(
                              'px-4 py-3 text-sm font-mono',
                              Math.abs(beat.offset) > analysis.config.driftThreshold
                                ? 'text-red-400'
                                : 'text-cyan-400'
                            )}>
                              {beat.offset > 0 ? '+' : ''}{beat.offset.toFixed(2)}ms
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-2 bg-charcoal-700 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      beat.confidence >= 0.8 ? 'confidence-high' :
                                      beat.confidence >= 0.6 ? 'confidence-medium' : 'confidence-low'
                                    )}
                                    style={{ width: `${beat.confidence * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm font-mono text-charcoal-300">
                                  {(beat.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {beat.matched ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-800">
                                  匹配
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-800">
                                  不匹配
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
