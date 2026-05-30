import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Music, Trash2, Download, Play, Clock, Zap, ArrowRight, Import } from 'lucide-react';
import { useTrackStore } from '@/store/trackStore';
import { useBeatStore } from '@/store/beatStore';
import { useSegmentStore } from '@/store/segmentStore';
import { detectBPM } from '@/utils/audioAnalyzer';
import { exportAllToJSON, importFromJSON } from '@/utils/exportManager';
import { formatTime, generateId } from '@/types';
import type { Beat } from '@/types';

const TrackList: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { tracks, loading, error, loadTracks, addTrack, updateTrack, deleteTrack, loadAudio } = useTrackStore();
  const { addBeat, clearBeats } = useBeatStore();
  const { clearSegments } = useSegmentStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processingTrack, setProcessingTrack] = useState<string | null>(null);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        try {
          const track = await addTrack(file);
          setProcessingTrack(track.id);
          
          const audioUrl = await loadAudio(track.id);
          if (audioUrl) {
            const { bpm, confidence, beats } = await detectBPM(audioUrl);
            
            const bpmConfidence = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
            
            await updateTrack(track.id, {
              currentBPM: bpm,
              bpmConfidence,
            });

            await clearBeats(track.id);
            for (const beatTime of beats) {
              await addBeat(track.id, beatTime, false);
            }
          }
        } catch (error) {
          console.error('处理音频失败:', error);
        }
      }
    }
    setProcessingTrack(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importFromJSON(file);
      await loadTracks();
    } catch (error) {
      console.error('导入失败:', error);
    }

    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === tracks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tracks.map(t => t.id)));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 首歌曲吗？`)) return;

    for (const id of selectedIds) {
      await deleteTrack(id);
    }
    setSelectedIds(new Set());
  };

  const getBPMColor = (bpm: number): string => {
    if (bpm >= 120 && bpm <= 140) return 'text-accent-green';
    if (bpm >= 100 && bpm <= 160) return 'text-accent-cyan';
    return 'text-accent-yellow';
  };

  const getConfidenceColor = (confidence: string): string => {
    if (confidence === 'high') return 'bg-accent-green/20 text-accent-green';
    if (confidence === 'medium') return 'bg-accent-yellow/20 text-accent-yellow';
    return 'bg-accent-red/20 text-accent-red';
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">🎵 歌单总览</h1>
          <p className="text-text-secondary">管理和分析你的演出歌单，找到最佳过渡拍点</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => importInputRef.current?.click()}
            className="btn-secondary flex items-center gap-2"
          >
            <Import size={18} />
            导入数据
          </button>
          <button
            onClick={exportAllToJSON}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={18} />
            导出全部
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary flex items-center gap-2"
          >
            <Upload size={18} />
            导入音频
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="card mb-6 flex items-center justify-between bg-accent-cyan/10 border-accent-cyan/30">
          <div className="flex items-center gap-3">
            <span className="text-accent-cyan font-medium">
              已选择 {selectedIds.size} 首歌曲
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDeleteSelected}
              className="btn-danger flex items-center gap-2"
            >
              <Trash2 size={16} />
              删除选中
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-accent-red/20 border border-accent-red/30 text-accent-red px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {tracks.length === 0 && !loading ? (
        <div className="text-center py-20">
          <div className="w-24 h-24 mx-auto mb-6 bg-bg-secondary rounded-full flex items-center justify-center">
            <Music size={48} className="text-text-muted" />
          </div>
          <h3 className="text-xl font-semibold mb-2">还没有导入任何音频</h3>
          <p className="text-text-secondary mb-6 max-w-md mx-auto">
            点击右上角的「导入音频」按钮，开始整理你的演出歌单。
            系统会自动检测BPM和拍点，帮助你找到最佳过渡位置。
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Upload size={18} />
            导入第一首歌
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-bg-tertiary">
                <th className="text-left py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === tracks.length && tracks.length > 0}
                    onChange={handleSelectAll}
                    className="mr-2"
                  />
                </th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">歌曲名称</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">时长</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">BPM</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">可信度</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">最佳入点</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">最佳出点</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr
                  key={track.id}
                  className={`border-b border-bg-tertiary/50 hover:bg-bg-secondary/50 transition-colors group ${
                    processingTrack === track.id ? 'animate-pulse' : ''
                  }`}
                >
                  <td className="py-4 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(track.id)}
                      onChange={() => handleSelect(track.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td
                    className="py-4 px-4 cursor-pointer"
                    onClick={() => navigate(`/track/${track.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent-cyan/20 rounded-lg flex items-center justify-center">
                        <Music size={20} className="text-accent-cyan" />
                      </div>
                      <div>
                        <div className="font-medium">{track.name}</div>
                        <div className="text-xs text-text-muted">{track.fileName}</div>
                      </div>
                      {processingTrack === track.id && (
                        <span className="text-xs text-accent-cyan ml-2">处理中...</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-mono text-text-secondary">
                      {formatTime(track.duration)}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    {track.currentBPM > 0 ? (
                      <span className={`font-mono font-bold text-lg ${getBPMColor(track.currentBPM)}`}>
                        {track.currentBPM}
                      </span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {track.currentBPM > 0 ? (
                      <span className={`px-2 py-1 rounded text-xs ${getConfidenceColor(track.bpmConfidence)}`}>
                        {track.bpmConfidence === 'high' ? '高' : track.bpmConfidence === 'medium' ? '中' : '低'}
                      </span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {track.bestInPoint !== undefined ? (
                      <span className="font-mono text-accent-green">{formatTime(track.bestInPoint)}</span>
                    ) : (
                      <span className="text-text-muted">未设置</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {track.bestOutPoint !== undefined ? (
                      <span className="font-mono text-accent-magenta">{formatTime(track.bestOutPoint)}</span>
                    ) : (
                      <span className="text-text-muted">未设置</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/track/${track.id}`);
                        }}
                        className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-accent-cyan"
                        title="查看详情"
                      >
                        <ArrowRight size={16} />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`确定要删除「${track.name}」吗？`)) {
                            await deleteTrack(track.id);
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              next.delete(track.id);
                              return next;
                            });
                          }
                        }}
                        className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-accent-red"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-accent-cyan/20 rounded-xl flex items-center justify-center">
              <Music size={24} className="text-accent-cyan" />
            </div>
            <div>
              <div className="text-2xl font-bold">{tracks.length}</div>
              <div className="text-sm text-text-muted">首歌曲</div>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            已导入到歌单的音频文件总数
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-accent-green/20 rounded-xl flex items-center justify-center">
              <Zap size={24} className="text-accent-green" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {tracks.filter(t => t.bestInPoint !== undefined && t.bestOutPoint !== undefined).length}
              </div>
              <div className="text-sm text-text-muted">首已完成</div>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            已标记最佳出入点的歌曲数量
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-accent-yellow/20 rounded-xl flex items-center justify-center">
              <Clock size={24} className="text-accent-yellow" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {tracks.length > 0 ? formatTime(tracks.reduce((sum, t) => sum + t.duration, 0)) : '00:00'}
              </div>
              <div className="text-sm text-text-muted">总时长</div>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            歌单所有歌曲的累计播放时长
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrackList;
