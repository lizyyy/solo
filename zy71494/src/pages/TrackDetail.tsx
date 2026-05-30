import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download, Trash2, RefreshCw, Zap, GripVertical, Clock, History, BarChart3 } from 'lucide-react';
import WaveformViewer from '@/components/WaveformViewer';
import EvidenceTimeline from '@/components/EvidenceTimeline';
import ScoreDisplay from '@/components/ScoreDisplay';
import { useTrackStore } from '@/store/trackStore';
import { useBeatStore } from '@/store/beatStore';
import { useSegmentStore } from '@/store/segmentStore';
import { useHistoryStore } from '@/store/historyStore';
import { useScoreStore } from '@/store/scoreStore';
import { detectBPM } from '@/utils/audioAnalyzer';
import { exportToJSON, exportToCSV } from '@/utils/exportManager';
import type { SegmentType, EvidenceChainItem } from '@/types';
import { formatTime, generateId, SEGMENT_LABELS, SEGMENT_COLORS } from '@/types';

const TrackDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { tracks, currentTrack, audioUrl, selectTrack, loadAudio, updateTrack, deleteTrack } = useTrackStore();
  const { beats, loadBeats, addBeat, updateBeat, deleteBeat } = useBeatStore();
  const { segments, loadSegments, addSegment, updateSegment, deleteSegment } = useSegmentStore();
  const { bpmHistory, loadBPMHistory, addBPMHistory, getEvidenceChain } = useHistoryStore();
  const { scores, loadScores, calculateTransitionScore } = useScoreStore();
  
  const [evidence, setEvidence] = useState<EvidenceChainItem[]>([]);
  const [activeTab, setActiveTab] = useState<'bpm' | 'beats' | 'segments' | 'score' | 'evidence'>('bpm');
  const [editBPM, setEditBPM] = useState('');
  const [bpmReason, setBpmReason] = useState('');
  const [newSegmentType, setNewSegmentType] = useState<SegmentType>('intro');
  const [newSegmentStart, setNewSegmentStart] = useState('');
  const [newSegmentEnd, setNewSegmentEnd] = useState('');
  const [newSegmentLabel, setNewSegmentLabel] = useState('');
  const [matchTrackId, setMatchTrackId] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      selectTrack(id);
      loadBeats(id);
      loadSegments(id);
      loadBPMHistory(id);
      loadScores(id);
    }
  }, [id, selectTrack, loadBeats, loadSegments, loadBPMHistory, loadScores]);

  useEffect(() => {
    if (id) {
      loadAudio(id);
    }
  }, [id, loadAudio]);

  useEffect(() => {
    if (id) {
      getEvidenceChain(id).then(setEvidence);
    }
  }, [id, getEvidenceChain, beats.length, segments.length, bpmHistory.length]);

  useEffect(() => {
    if (currentTrack) {
      setEditBPM(String(currentTrack.currentBPM));
    }
  }, [currentTrack]);

  const handleReanalyzeBPM = async () => {
    if (!id || !audioUrl) return;
    
    setIsAnalyzing(true);
    try {
      const oldBPM = currentTrack?.currentBPM || 0;
      const { bpm, confidence, beats: newBeats } = await detectBPM(audioUrl);
      
      const bpmConfidence = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
      
      await updateTrack(id, {
        currentBPM: bpm,
        bpmConfidence,
      });

      await addBPMHistory(id, oldBPM, bpm, '重新检测BPM', oldBPM > 0 && bpm === oldBPM * 2, oldBPM > 0 && bpm === oldBPM / 2);

      for (const beatTime of newBeats) {
        const exists = beats.some(b => Math.abs(b.time - beatTime) < 0.05);
        if (!exists) {
          await addBeat(id, beatTime, false);
        }
      }
    } catch (error) {
      console.error('重新分析失败:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateBPM = async () => {
    if (!id || !currentTrack) return;
    
    const newBPM = parseInt(editBPM);
    if (isNaN(newBPM) || newBPM < 30 || newBPM > 300) return;
    
    const oldBPM = currentTrack.currentBPM;
    const reason = bpmReason || '手动调整BPM';
    const isHalfSpeed = oldBPM > 0 && newBPM === Math.round(oldBPM / 2);
    const isDoubleSpeed = oldBPM > 0 && newBPM === oldBPM * 2;

    await updateTrack(id, { currentBPM: newBPM });
    await addBPMHistory(id, oldBPM, newBPM, reason, isHalfSpeed, isDoubleSpeed);
    setBpmReason('');
  };

  const handleAddBeat = useCallback(async (time: number) => {
    if (!id) return;
    const roundedTime = Math.round(time * 100) / 100;
    await addBeat(id, roundedTime, true);
  }, [id, addBeat]);

  const handleSetInPoint = async (time: number) => {
    if (!id) return;
    await updateTrack(id, { bestInPoint: time });
  };

  const handleSetOutPoint = async (time: number) => {
    if (!id) return;
    await updateTrack(id, { bestOutPoint: time });
  };

  const handleAddSegment = async () => {
    if (!id) return;
    
    const start = parseFloat(newSegmentStart);
    const end = parseFloat(newSegmentEnd);
    
    if (isNaN(start) || isNaN(end) || start >= end) return;
    
    await addSegment(id, newSegmentType, start, end, newSegmentLabel || undefined);
    setNewSegmentStart('');
    setNewSegmentEnd('');
    setNewSegmentLabel('');
  };

  const handleCalculateScore = async () => {
    if (!id || !currentTrack || !matchTrackId) return;
    
    const toTrack = tracks.find(t => t.id === matchTrackId);
    if (!toTrack) return;

    const toBeats = await (async () => {
      const { useBeatStore } = await import('@/store/beatStore');
      const tempBeats = useBeatStore.getState().beats;
      if (tempBeats.length === 0 || tempBeats[0].trackId !== matchTrackId) {
        await useBeatStore.getState().loadBeats(matchTrackId);
        return useBeatStore.getState().beats;
      }
      return tempBeats;
    })();

    const toSegments = await (async () => {
      const { useSegmentStore } = await import('@/store/segmentStore');
      const tempSegments = useSegmentStore.getState().segments;
      if (tempSegments.length === 0 || tempSegments[0].trackId !== matchTrackId) {
        await useSegmentStore.getState().loadSegments(matchTrackId);
        return useSegmentStore.getState().segments;
      }
      return tempSegments;
    })();

    await calculateTransitionScore(currentTrack, toTrack, beats, toBeats, segments, toSegments);
  };

  const handleDelete = async () => {
    if (!id || !currentTrack) return;
    if (confirm(`确定要删除「${currentTrack.name}」吗？`)) {
      await deleteTrack(id);
      navigate('/');
    }
  };

  if (!currentTrack) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  const availableTracks = tracks.filter(t => t.id !== id);

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-bg-tertiary flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{currentTrack.name}</h1>
            <p className="text-sm text-text-muted">
              {currentTrack.fileName} • 时长 {formatTime(currentTrack.duration)}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => exportToJSON(currentTrack.id)}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={16} />
            导出 JSON
          </button>
          <button
            onClick={() => exportToCSV(currentTrack.id)}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={16} />
            导出 CSV
          </button>
          <button
            onClick={handleDelete}
            className="btn-danger flex items-center gap-2"
          >
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <WaveformViewer
            audioUrl={audioUrl}
            beats={beats}
            segments={segments}
            onAddBeat={handleAddBeat}
            bestInPoint={currentTrack.bestInPoint}
            bestOutPoint={currentTrack.bestOutPoint}
          />

          <div className="grid grid-cols-4 gap-4">
            <div className="card">
              <div className="text-sm text-text-muted mb-1">当前 BPM</div>
              <div className="text-3xl font-bold text-accent-cyan font-mono">
                {currentTrack.currentBPM || '-'}
              </div>
              <div className="text-xs text-text-muted mt-1">
                可信度: {currentTrack.bpmConfidence === 'high' ? '高' : currentTrack.bpmConfidence === 'medium' ? '中' : '低'}
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-text-muted mb-1">拍点数量</div>
              <div className="text-3xl font-bold text-accent-green font-mono">
                {beats.length}
              </div>
              <div className="text-xs text-text-muted mt-1">
                手动: {beats.filter(b => b.isManual).length} / 自动: {beats.filter(b => !b.isManual).length}
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-text-muted mb-1">段落标注</div>
              <div className="text-3xl font-bold text-accent-yellow font-mono">
                {segments.length}
              </div>
              <div className="text-xs text-text-muted mt-1">
                已标注 {Object.keys(segments.reduce((acc, s) => ({ ...acc, [s.type]: true }), {})).length} 种类型
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-text-muted mb-1">最佳出入点</div>
              <div className="text-xl font-bold font-mono">
                <span className="text-accent-green">
                  {currentTrack.bestInPoint !== undefined ? formatTime(currentTrack.bestInPoint) : '--:--'}
                </span>
                <span className="text-text-muted mx-2">→</span>
                <span className="text-accent-magenta">
                  {currentTrack.bestOutPoint !== undefined ? formatTime(currentTrack.bestOutPoint) : '--:--'}
                </span>
              </div>
              <div className="text-xs text-text-muted mt-1">
                {currentTrack.bestInPoint !== undefined && currentTrack.bestOutPoint !== undefined 
                  ? `过渡窗口: ${formatTime(currentTrack.bestOutPoint - currentTrack.bestInPoint)}`
                  : '请设置最佳出入点'
                }
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-b border-bg-tertiary">
            {[
              { id: 'bpm', label: 'BPM 检测', icon: Zap },
              { id: 'beats', label: '拍点标注', icon: Clock },
              { id: 'segments', label: '段落分析', icon: BarChart3 },
              { id: 'score', label: '过渡评分', icon: GripVertical },
              { id: 'evidence', label: '证据链', icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-accent-cyan text-accent-cyan'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'bpm' && (
            <div className="card space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Zap size={20} className="text-accent-cyan" />
                BPM 检测与调整
              </h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">检测到的 BPM</label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={editBPM}
                      onChange={(e) => setEditBPM(e.target.value)}
                      className="input-field flex-1 text-2xl font-mono font-bold text-center"
                      min="30"
                      max="300"
                    />
                    <button onClick={handleUpdateBPM} className="btn-primary">
                      应用
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-text-secondary mb-2">调整原因（记录到证据链）</label>
                  <input
                    type="text"
                    value={bpmReason}
                    onChange={(e) => setBpmReason(e.target.value)}
                    placeholder="如：修正半速误判 / 修正倍速误判 / 拍点漂移"
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReanalyzeBPM}
                  disabled={isAnalyzing || !audioUrl}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} />
                  {isAnalyzing ? '分析中...' : '重新检测 BPM'}
                </button>
                <button
                  onClick={() => {
                    setEditBPM(String(Math.round(currentTrack.currentBPM / 2)));
                    setBpmReason('修正半速误判');
                  }}
                  className="btn-secondary"
                  disabled={currentTrack.currentBPM < 60}
                >
                  ÷ 2 半速
                </button>
                <button
                  onClick={() => {
                    setEditBPM(String(currentTrack.currentBPM * 2));
                    setBpmReason('修正倍速误判');
                  }}
                  className="btn-secondary"
                  disabled={currentTrack.currentBPM > 150}
                >
                  × 2 倍速
                </button>
              </div>

              {bpmHistory.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">BPM 调整历史</h4>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {bpmHistory.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 bg-bg-primary/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-accent-red line-through">
                            {record.detectedBPM}
                          </span>
                          <ArrowRight size={16} className="text-text-muted" />
                          <span className="font-mono text-accent-green text-lg font-bold">
                            {record.adjustedBPM}
                          </span>
                          {record.isHalfSpeedFix && (
                            <span className="px-2 py-0.5 text-xs bg-accent-yellow/20 text-accent-yellow rounded">
                              半速修正
                            </span>
                          )}
                          {record.isDoubleSpeedFix && (
                            <span className="px-2 py-0.5 text-xs bg-accent-cyan/20 text-accent-cyan rounded">
                              倍速修正
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm">{record.reason}</div>
                          <div className="text-xs text-text-muted">
                            {new Date(record.createdAt).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'beats' && (
            <div className="card space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock size={20} className="text-accent-green" />
                拍点管理
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={() => {
                    const lastBeat = beats[beats.length - 1];
                    if (lastBeat && currentTrack) {
                      handleSetInPoint(lastBeat.time);
                    }
                  }}
                  disabled={beats.length === 0}
                  className="btn-secondary text-accent-green border-accent-green/30"
                >
                  设置最后拍点为最佳入点
                </button>
                <button
                  onClick={() => {
                    const firstBeat = beats[0];
                    if (firstBeat && currentTrack) {
                      handleSetOutPoint(firstBeat.time);
                    }
                  }}
                  disabled={beats.length === 0}
                  className="btn-secondary text-accent-magenta border-accent-magenta/30"
                >
                  设置最前拍点为最佳出点
                </button>
              </div>

              <div className="max-h-96 overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-bg-secondary">
                    <tr>
                      <th className="text-left py-2 px-3 text-text-secondary text-sm">序号</th>
                      <th className="text-left py-2 px-3 text-text-secondary text-sm">时间</th>
                      <th className="text-left py-2 px-3 text-text-secondary text-sm">类型</th>
                      <th className="text-left py-2 px-3 text-text-secondary text-sm">可信度</th>
                      <th className="text-left py-2 px-3 text-text-secondary text-sm">漂移备注</th>
                      <th className="text-right py-2 px-3 text-text-secondary text-sm">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beats.map((beat, index) => (
                      <tr
                        key={beat.id}
                        className={`border-t border-bg-tertiary/50 hover:bg-bg-tertiary/30 ${
                          selectedBeatId === beat.id ? 'bg-accent-cyan/10' : ''
                        }`}
                        onClick={() => setSelectedBeatId(beat.id)}
                      >
                        <td className="py-2 px-3 text-text-muted">{index + 1}</td>
                        <td className="py-2 px-3 font-mono">{formatTime(beat.time)}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            beat.isManual 
                              ? 'bg-accent-cyan/20 text-accent-cyan' 
                              : 'bg-bg-tertiary text-text-secondary'
                          }`}>
                            {beat.isManual ? '手动' : '自动'}
                          </span>
                        </td>
                        <td className="py-2 px-3">{(beat.confidence * 100).toFixed(0)}%</td>
                        <td className="py-2 px-3 text-sm text-text-secondary">
                          {beat.driftNote || '-'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetInPoint(beat.time);
                              }}
                              className="text-xs px-2 py-1 text-accent-green hover:bg-accent-green/20 rounded"
                            >
                              设为入点
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetOutPoint(beat.time);
                              }}
                              className="text-xs px-2 py-1 text-accent-magenta hover:bg-accent-magenta/20 rounded"
                            >
                              设为出点
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteBeat(beat.id);
                              }}
                              className="text-xs px-2 py-1 text-accent-red hover:bg-accent-red/20 rounded"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'segments' && (
            <div className="card space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 size={20} className="text-accent-yellow" />
                段落标注
              </h3>

              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">段落类型</label>
                  <select
                    value={newSegmentType}
                    onChange={(e) => setNewSegmentType(e.target.value as SegmentType)}
                    className="input-field w-full"
                  >
                    {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-2">开始时间 (秒)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSegmentStart}
                    onChange={(e) => setNewSegmentStart(e.target.value)}
                    placeholder="0.00"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-2">结束时间 (秒)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSegmentEnd}
                    onChange={(e) => setNewSegmentEnd(e.target.value)}
                    placeholder="30.00"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-2">标签 (可选)</label>
                  <input
                    type="text"
                    value={newSegmentLabel}
                    onChange={(e) => setNewSegmentLabel(e.target.value)}
                    placeholder="如：主Drop"
                    className="input-field w-full"
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={handleAddSegment} className="btn-primary w-full">
                    添加段落
                  </button>
                </div>
              </div>

              {segments.length > 0 && (
                <div className="space-y-3">
                  {segments.map((segment) => (
                    <div
                      key={segment.id}
                      className={`p-4 rounded-lg border transition-all ${
                        selectedSegmentId === segment.id
                          ? 'bg-accent-cyan/10 border-accent-cyan/30'
                          : 'bg-bg-primary/50 border-bg-tertiary'
                      }`}
                      onClick={() => setSelectedSegmentId(segment.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: SEGMENT_COLORS[segment.type] }}
                          />
                          <span
                            className="px-2 py-0.5 text-xs rounded font-medium"
                            style={{
                              backgroundColor: `${SEGMENT_COLORS[segment.type]}20`,
                              color: SEGMENT_COLORS[segment.type],
                            }}
                          >
                            {SEGMENT_LABELS[segment.type]}
                          </span>
                          <span className="font-mono text-text-secondary">
                            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                          </span>
                          <span className="text-text-muted text-sm">
                            (时长 {formatTime(segment.endTime - segment.startTime)})
                          </span>
                          {segment.label && (
                            <span className="text-text-primary">{segment.label}</span>
                          )}
                          <span className="text-xs text-text-muted">v{segment.version}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetInPoint(segment.startTime);
                            }}
                            className="text-xs px-2 py-1 text-accent-green hover:bg-accent-green/20 rounded"
                          >
                            设为入点
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetOutPoint(segment.endTime);
                            }}
                            className="text-xs px-2 py-1 text-accent-magenta hover:bg-accent-magenta/20 rounded"
                          >
                            设为出点
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSegment(segment.id);
                            }}
                            className="text-xs px-2 py-1 text-accent-red hover:bg-accent-red/20 rounded"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      {segment.previousValue && (
                        <div className="mt-2 text-xs text-text-muted bg-bg-secondary/50 p-2 rounded">
                          <span className="text-accent-yellow">历史版本 v{segment.version - 1}:</span>
                          {segment.previousValue}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'score' && (
            <div className="card space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <GripVertical size={20} className="text-accent-cyan" />
                过渡评分
              </h3>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm text-text-secondary mb-2">选择要匹配的歌曲</label>
                  <select
                    value={matchTrackId}
                    onChange={(e) => setMatchTrackId(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">请选择歌曲...</option>
                    {availableTracks.map((track) => (
                      <option key={track.id} value={track.id}>
                        {track.name} (BPM: {track.currentBPM})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCalculateScore}
                  disabled={!matchTrackId}
                  className="btn-primary"
                >
                  计算过渡评分
                </button>
              </div>

              {scores.length > 0 && (
                <div className="grid grid-cols-2 gap-6">
                  {scores.map((score) => {
                    const toTrack = tracks.find(t => t.id === score.toTrackId);
                    return (
                      <ScoreDisplay
                        key={score.id}
                        score={score}
                        trackName={toTrack?.name}
                      />
                    );
                  })}
                </div>
              )}

              {scores.length === 0 && (
                <div className="text-center py-12 text-text-muted">
                  <GripVertical size={48} className="mx-auto mb-4 opacity-50" />
                  <p>还没有过渡评分记录</p>
                  <p className="text-sm mt-2">选择一首歌曲并点击「计算过渡评分」</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="card">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                <History size={20} className="text-accent-yellow" />
                完整证据链
              </h3>
              
              <div className="text-sm text-text-secondary mb-4 p-3 bg-bg-primary/50 rounded-lg">
                💡 所有操作都会被完整记录，包括变更前后的值、操作人和时间戳。
                从摘要点击任意记录可以查看关联的详细数据，确保交接和复盘时数据链路完整。
              </div>

              <EvidenceTimeline evidence={evidence} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackDetail;
