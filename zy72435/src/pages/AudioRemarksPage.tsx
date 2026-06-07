import React, { useState } from 'react';
import { Upload, Edit2, History, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import type { AudioFileRemark, HistoryEntry } from '../types';

export const AudioRemarksPage: React.FC = () => {
  const {
    audioRemarks,
    importAudioRemarks,
    updateAudioRemark,
    getAudioRemarkHistory,
    selectedAudioRemarkId,
    setSelectedAudioRemarkId,
    setCurrentPage,
  } = useAppStore();

  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingRemark, setEditingRemark] = useState<AudioFileRemark | null>(null);
  const [editForm, setEditForm] = useState({ remark: '', tags: '' });
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const [historyData, setHistoryData] = useState<HistoryEntry<AudioFileRemark>[]>([]);

  const selectedRemark = audioRemarks.find(r => r.id === selectedAudioRemarkId);

  const handleImport = () => {
    const mockImportData = [
      {
        fileName: '06_告白气球.mp3',
        songName: '告白气球',
        artist: '周杰伦',
        duration: 215,
        fileHash: 'hash_001_abc123',
        remark: '浪漫情歌，适合中场',
        tags: ['情歌', '浪漫'],
      },
      {
        fileName: '07_简单爱.mp3',
        songName: '简单爱',
        artist: '周杰伦',
        duration: 270,
        fileHash: 'hash_007_pqr678',
        remark: '青春回忆曲目',
        tags: ['青春', '经典'],
      },
      {
        fileName: '08_双截棍.mp3',
        songName: '双截棍',
        artist: '周杰伦',
        duration: 195,
        fileHash: 'hash_008_stu901',
        remark: '快歌，带动气氛',
        tags: ['快歌', '经典'],
      },
    ];
    const result = importAudioRemarks(mockImportData);
    setImportResult(result);
  };

  const handleEdit = (remark: AudioFileRemark) => {
    setEditingRemark(remark);
    setEditForm({ remark: remark.remark, tags: remark.tags.join(', ') });
  };

  const handleSaveEdit = () => {
    if (editingRemark) {
      updateAudioRemark(
        editingRemark.id,
        {
          remark: editForm.remark,
          tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        },
        '更新备注信息'
      );
      setEditingRemark(null);
    }
  };

  const handleViewHistory = (id: string) => {
    const history = getAudioRemarkHistory(id);
    setHistoryData(history);
    setShowHistoryModal(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">音频文件备注</h2>
          <p className="text-slate-500 mt-1">管理所有音频文件的备注信息，支持批量导入和变更追踪</p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Upload size={18} />
          批量导入备注
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">总音频数</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{audioRemarks.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">有备注</p>
          <p className="text-2xl font-bold text-success-600 mt-1">
            {audioRemarks.filter(r => r.remark.length > 5).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">今日更新</p>
          <p className="text-2xl font-bold text-primary-600 mt-1">
            {audioRemarks.filter(r => {
              const today = new Date().toDateString();
              return new Date(r.updatedAt).toDateString() === today;
            }).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">文件名</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">歌曲</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">时长</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">备注</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">标签</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">版本</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">更新时间</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {audioRemarks.map(remark => (
              <tr
                key={remark.id}
                className={`hover:bg-slate-50 cursor-pointer ${
                  selectedAudioRemarkId === remark.id ? 'bg-primary-50' : ''
                }`}
                onClick={() => setSelectedAudioRemarkId(remark.id)}
              >
                <td className="px-6 py-4 text-sm text-slate-800 font-mono">{remark.fileName}</td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-slate-800">{remark.songName}</p>
                  <p className="text-xs text-slate-500">{remark.artist}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{formatDuration(remark.duration)}</td>
                <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{remark.remark}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {remark.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">v{remark.version}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{formatDate(remark.updatedAt)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleEdit(remark);
                      }}
                      className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleViewHistory(remark.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-warning-600 hover:bg-warning-50 rounded"
                      title="查看历史"
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setCurrentPage('authorization');
                      }}
                      className="p-1.5 text-slate-400 hover:text-success-600 hover:bg-success-50 rounded"
                      title="查看授权"
                    >
                      <Clock size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRemark && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">选中: {selectedRemark.songName}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">文件名</p>
              <p className="text-sm font-mono text-slate-800">{selectedRemark.fileName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">文件哈希</p>
              <p className="text-sm font-mono text-slate-600">{selectedRemark.fileHash}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-slate-500">备注详情</p>
              <p className="text-sm text-slate-800 mt-1">{selectedRemark.remark}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">创建人</p>
              <p className="text-sm text-slate-800">阿梅</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">最后更新</p>
              <p className="text-sm text-slate-800">{formatDate(selectedRemark.updatedAt)}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setCurrentPage('compliance_check')}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
            >
              去做合规检查
            </button>
            <button
              onClick={() => setCurrentPage('authorization')}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
            >
              查看授权期限
            </button>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">批量导入音频备注</h3>

            {!importResult ? (
              <>
                <p className="text-sm text-slate-600 mb-4">
                  系统将根据文件哈希自动去重，重复的文件不会重复导入。
                </p>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center mb-4">
                  <Upload className="mx-auto text-slate-400 mb-2" size={32} />
                  <p className="text-sm text-slate-500">点击或拖拽上传备注文件</p>
                  <p className="text-xs text-slate-400 mt-1">支持 CSV、Excel 格式</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleImport}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                  >
                    模拟导入演示
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-8">
                  {importResult.added > 0 && (
                    <div className="flex items-center justify-center gap-2 text-success-600 mb-2">
                      <CheckCircle size={24} />
                      <span className="font-medium">成功导入 {importResult.added} 条</span>
                    </div>
                  )}
                  {importResult.skipped > 0 && (
                    <div className="flex items-center justify-center gap-2 text-warning-600">
                      <XCircle size={24} />
                      <span className="font-medium">跳过重复 {importResult.skipped} 条</span>
                    </div>
                  )}
                  <p className="text-sm text-slate-500 mt-4">
                    {importResult.added > 0 && importResult.skipped > 0
                      ? '系统自动检测到重复文件，未重复创建合规检查记录'
                      : importResult.skipped > 0
                      ? '文件已存在，未重复导入'
                      : '全部导入成功'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportResult(null);
                  }}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                >
                  完成
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {editingRemark && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">编辑备注</h3>
            <p className="text-sm text-slate-600 mb-4">
              正在编辑: <span className="font-medium">{editingRemark.songName}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                <textarea
                  value={editForm.remark}
                  onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingRemark(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">变更历史</h3>
            {historyData.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">暂无变更历史</p>
            ) : (
              <div className="space-y-4">
                {historyData.map(entry => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                      <User size={14} className="text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{entry.userName}</span>
                        <span className="text-xs text-slate-500">{formatDate(entry.timestamp)}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {entry.action === 'import' && '导入了此音频备注'}
                        {entry.action === 'update' && entry.field && (
                          <>
                            修改了 <span className="font-mono text-primary-600">{String(entry.field)}</span>
                            {entry.oldValue !== undefined && (
                              <>
                                {' '}从 <span className="text-danger-600">{String(entry.oldValue)}</span>
                                {' '}改为 <span className="text-success-600">{String(entry.newValue)}</span>
                              </>
                            )}
                          </>
                        )}
                      </p>
                      {entry.remark && (
                        <p className="text-xs text-slate-500 mt-1 bg-slate-50 px-2 py-1 rounded">
                          备注: {entry.remark}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowHistoryModal(false)}
              className="w-full mt-6 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
