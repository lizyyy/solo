import React, { useEffect, useState } from 'react';
import { History as HistoryIcon, Filter, Search, Download, Music } from 'lucide-react';
import { useHistoryStore } from '@/store/historyStore';
import { useTrackStore } from '@/store/trackStore';
import EvidenceTimeline from '@/components/EvidenceTimeline';
import type { OperationType, EvidenceChainItem } from '@/types';

const operationTypeLabels: Record<OperationType, string> = {
  bpm: 'BPM调整',
  beat: '拍点编辑',
  segment: '段落标注',
  inpoint: '入点设置',
  outpoint: '出点设置',
  delete: '删除操作',
  import: '导入音频',
};

const History: React.FC = () => {
  const { logs, loadLogs, getEvidenceChain } = useHistoryStore();
  const { tracks, loadTracks } = useTrackStore();
  const [filterType, setFilterType] = useState<OperationType | ''>('');
  const [filterTrack, setFilterTrack] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [trackEvidence, setTrackEvidence] = useState<EvidenceChainItem[]>([]);

  useEffect(() => {
    loadTracks();
    loadLogs();
  }, [loadLogs, loadTracks]);

  useEffect(() => {
    if (selectedTrackId) {
      getEvidenceChain(selectedTrackId).then(setTrackEvidence);
    } else {
      setTrackEvidence([]);
    }
  }, [selectedTrackId, getEvidenceChain]);

  const filteredLogs = logs.filter(log => {
    if (filterType && log.operationType !== filterType) return false;
    if (filterTrack && log.trackId !== filterTrack) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return log.reason?.toLowerCase().includes(query) ||
             log.oldValue.toLowerCase().includes(query) ||
             log.newValue.toLowerCase().includes(query) ||
             log.operator.toLowerCase().includes(query);
    }
    return true;
  });

  const getTrackName = (trackId: string): string => {
    const track = tracks.find(t => t.id === trackId);
    return track?.name || '未知歌曲';
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">📋 操作历史</h1>
          <p className="text-text-secondary">查看所有操作记录，追踪每一次变更的完整证据链</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-text-secondary mb-2 flex items-center gap-2">
              <Search size={14} />
              搜索
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索原因、变更内容、操作人..."
              className="input-field w-full"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-sm text-text-secondary mb-2 flex items-center gap-2">
              <Filter size={14} />
              操作类型
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as OperationType | '')}
              className="input-field w-full"
            >
              <option value="">全部类型</option>
              {Object.entries(operationTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-sm text-text-secondary mb-2 flex items-center gap-2">
              <Music size={14} />
              筛选歌曲
            </label>
            <select
              value={filterTrack}
              onChange={(e) => setFilterTrack(e.target.value)}
              className="input-field w-full"
            >
              <option value="">全部歌曲</option>
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>{track.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              setFilterType('');
              setFilterTrack('');
              setSearchQuery('');
            }}
            className="btn-secondary"
          >
            重置筛选
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card max-h-[700px] overflow-auto">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HistoryIcon size={20} className="text-accent-cyan" />
            操作记录 ({filteredLogs.length} 条)
          </h3>

          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <HistoryIcon size={48} className="mx-auto mb-4 opacity-50" />
              <p>暂无符合条件的操作记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedTrackId(selectedTrackId === log.trackId ? null : log.trackId)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    selectedTrackId === log.trackId
                      ? 'bg-accent-cyan/10 border-accent-cyan/30'
                      : 'bg-bg-primary/50 border-bg-tertiary hover:bg-bg-tertiary/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded border ${
                          log.operationType === 'bpm' ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30' :
                          log.operationType === 'beat' ? 'bg-accent-green/20 text-accent-green border-accent-green/30' :
                          log.operationType === 'segment' ? 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30' :
                          log.operationType === 'delete' ? 'bg-accent-red/20 text-accent-red border-accent-red/30' :
                          'bg-bg-tertiary text-text-secondary border-bg-tertiary'
                        }`}>
                          {operationTypeLabels[log.operationType]}
                        </span>
                        <span className="text-sm font-medium text-accent-cyan">
                          {getTrackName(log.trackId)}
                        </span>
                      </div>
                      <div className="text-sm text-text-secondary mb-2">
                        <span className="text-text-muted">字段:</span> {log.fieldName}
                      </div>
                      {log.reason && (
                        <p className="text-sm text-text-secondary">
                          <span className="text-accent-cyan">原因:</span> {log.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-text-muted">
                      <div>{log.operator}</div>
                      <div>{new Date(log.timestamp).toLocaleString('zh-CN')}</div>
                    </div>
                  </div>
                  {selectedTrackId === log.trackId && (
                    <div className="mt-3 pt-3 border-t border-bg-tertiary grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-bg-primary/50 p-2 rounded">
                        <span className="text-text-muted block mb-1">变更前</span>
                        <span className="font-mono text-accent-red">{log.oldValue || '（空）'}</span>
                      </div>
                      <div className="bg-bg-primary/50 p-2 rounded">
                        <span className="text-text-muted block mb-1">变更后</span>
                        <span className="font-mono text-accent-green">{log.newValue || '（空）'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card max-h-[700px] overflow-auto">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HistoryIcon size={20} className="text-accent-yellow" />
            {selectedTrackId ? (
              <>「{getTrackName(selectedTrackId)}」的完整证据链</>
            ) : (
              <>点击左侧记录查看完整证据链</>
            )}
          </h3>

          {selectedTrackId ? (
            <EvidenceTimeline evidence={trackEvidence} />
          ) : (
            <div className="text-center py-12 text-text-muted">
              <HistoryIcon size={48} className="mx-auto mb-4 opacity-50" />
              <p>选择一条操作记录</p>
              <p className="text-sm mt-2">查看该歌曲的完整操作历史和数据链路</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-2xl font-bold text-accent-cyan">{logs.length}</div>
          <div className="text-sm text-text-muted">总操作次数</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-accent-green">
            {logs.filter(l => l.operationType === 'bpm').length}
          </div>
          <div className="text-sm text-text-muted">BPM调整次数</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-accent-yellow">
            {logs.filter(l => l.operationType === 'beat').length}
          </div>
          <div className="text-sm text-text-muted">拍点编辑次数</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-accent-magenta">
            {logs.filter(l => l.operationType === 'segment').length}
          </div>
          <div className="text-sm text-text-muted">段落标注次数</div>
        </div>
      </div>
    </div>
  );
};

export default History;
