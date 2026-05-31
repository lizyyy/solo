import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, CheckCircle, Trash2, RefreshCw, FileAudio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { useAppStore } from '../store';
import { AudioTrack, OperationLog, ConfirmRecord } from '../types';

export default function History() {
  const navigate = useNavigate();
  const { loadTrack, addMessage, currentTrack } = useAppStore();
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<AudioTrack | null>(null);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [confirmRecords, setConfirmRecords] = useState<ConfirmRecord[]>([]);

  useEffect(() => {
    loadAllTracks();
  }, []);

  useEffect(() => {
    if (currentTrack) {
      setSelectedTrack(currentTrack);
      loadTrackData(currentTrack.id);
    }
  }, [currentTrack?.id]);

  const loadAllTracks = async () => {
    const allTracks = await db.audioTracks.orderBy('createdAt').reverse().toArray();
    setTracks(allTracks);
  };

  const loadTrackData = async (trackId: string) => {
    const trackLogs = await db.getLogsByTrack(trackId);
    const records = await db.getConfirmRecordsByTrack(trackId);
    setLogs(trackLogs);
    setConfirmRecords(records);
  };

  const handleSelectTrack = async (track: AudioTrack) => {
    setSelectedTrack(track);
    await loadTrack(track.id);
    await loadTrackData(track.id);
    addMessage({
      type: 'info',
      title: '已加载音轨',
      message: track.name
    });
  };

  const actionIcons: Record<string, any> = {
    import: FileAudio,
    add_segment: RefreshCw,
    update_segment: RefreshCw,
    delete_segment: Trash2,
    confirm: CheckCircle,
    revert: RefreshCw,
    mark_pending: Clock
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">历史记录</h1>
              <p className="text-sm text-slate-500">所有操作和音轨版本</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-medium text-slate-700 text-sm">音轨列表</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {tracks.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  还没有导入过音轨
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {tracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => handleSelectTrack(track)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                        selectedTrack?.id === track.id ? 'bg-sky-50' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {track.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(track.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-medium text-slate-700 text-sm">
                {selectedTrack ? selectedTrack.name : '选择一个音轨查看详情'}
              </h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {!selectedTrack ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  点击左侧列表选择音轨
                </div>
              ) : logs.length === 0 && confirmRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  暂无操作记录
                </div>
              ) : (
                <div className="p-4">
                  {confirmRecords.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-medium text-slate-500 uppercase mb-3">确认记录</h4>
                      <div className="space-y-2">
                        {confirmRecords.map((record) => {
                          const Icon = actionIcons[record.action] || CheckCircle;
                          return (
                            <div
                              key={record.id}
                              className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg"
                            >
                              <Icon className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700">
                                  {record.action === 'confirm' && '标记为已确认'}
                                  {record.action === 'revert' && '撤回操作'}
                                  {record.action === 'mark_pending' && '标记为待确认'}
                                  {record.action === 'discard' && '标记为已废弃'}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {formatDate(record.timestamp)}
                                </p>
                                {record.remark && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    备注：{record.remark}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {logs.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 uppercase mb-3">操作日志</h4>
                      <div className="space-y-2">
                        {logs.map((log) => {
                          const Icon = actionIcons[log.actionType] || Clock;
                          return (
                            <div
                              key={log.id}
                              className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                            >
                              <Icon className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700">
                                  {log.actionType === 'import' && '导入音轨'}
                                  {log.actionType === 'add_segment' && '添加分段'}
                                  {log.actionType === 'update_segment' && '修改分段'}
                                  {log.actionType === 'delete_segment' && '删除分段'}
                                  {log.actionType === 'export' && '导出上线清单'}
                                  {!['import', 'add_segment', 'update_segment', 'delete_segment', 'export'].includes(log.actionType) && log.actionType}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {formatDate(log.timestamp)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
