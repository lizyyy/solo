import { useState } from 'react';
import { Eye, Download, FilePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRecordStore } from '../store/useRecordStore';
import { StatusBadge } from './StatusBadge';
import { SourceBadge } from './SourceBadge';
import type { TrackCleanupRecord } from '../../shared/types';

interface RecordsTableProps {
  onExport: () => void;
}

export function RecordsTable({ onExport }: RecordsTableProps) {
  const navigate = useNavigate();
  const { records, loading, updateRecordNote, saveStatus } = useRecordStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  const handleStartEdit = (record: TrackCleanupRecord) => {
    setEditingId(record.id);
    setEditNote(record.currentNote);
  };

  const handleSaveNote = (id: string) => {
    updateRecordNote(id, editNote);
    setEditingId(null);
  };

  const getFlagTags = (record: TrackCleanupRecord) => {
    const tags: { label: string; color: string }[] = [];
    if (record.isOldMaster) tags.push({ label: '旧版母带', color: 'bg-gray-100 text-gray-600' });
    if (record.isDuplicate) tags.push({ label: '重复曲目', color: 'bg-red-100 text-red-600' });
    if (!record.hasAuthorization) tags.push({ label: '缺授权', color: 'bg-yellow-100 text-yellow-700' });
    if (record.isRenamed) tags.push({ label: '人工改名', color: 'bg-purple-100 text-purple-600' });
    return tags;
  };

  if (loading && records.length === 0) {
    return (
      <div className="card animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse-soft text-slate-500">加载中...</div>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="card animate-fade-in">
        <div className="text-center py-12 text-slate-500">
          <p className="text-lg font-display mb-2">暂无记录</p>
          <p className="text-sm">调整筛选条件或检查数据库</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card animate-fade-in-up delay-80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-slate-800">
          轨道清理记录 <span className="text-sm font-normal text-slate-500">({records.length} 条)</span>
        </h3>
        <button onClick={onExport} className="btn-amber flex items-center gap-2">
          <Download size={16} />
          导出当前筛选
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-warm-200">
              <th className="table-header">曲目名称</th>
              <th className="table-header">艺人/学生</th>
              <th className="table-header">状态</th>
              <th className="table-header">来源</th>
              <th className="table-header">标记</th>
              <th className="table-header">处理备注</th>
              <th className="table-header">处理人/时间</th>
              <th className="table-header no-print">操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => {
              const tags = getFlagTags(record);
              const isEditing = editingId === record.id;

              return (
                <tr
                  key={record.id}
                  className={`border-b border-warm-100 hover:bg-slate-50/50 transition-colors ${
                    index % 2 === 1 ? 'bg-warm-50/30' : ''
                  }`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="table-cell">
                    <div className="font-medium text-slate-800">{record.trackName}</div>
                  </td>
                  <td className="table-cell">{record.artistName}</td>
                  <td className="table-cell">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="table-cell">
                    <SourceBadge source={record.source} />
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {tags.length > 0 ? (
                        tags.map((tag, i) => (
                          <span
                            key={i}
                            className={`inline-flex px-1.5 py-0.5 rounded text-xs ${tag.color}`}
                          >
                            {tag.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="table-cell max-w-xs">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="input-field text-xs h-20"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveNote(record.id)}
                            className="text-xs px-2 py-1 bg-slate-800 text-white rounded hover:bg-slate-850"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                          >
                            取消
                          </button>
                          {saveStatus === 'saving' && (
                            <span className="text-xs text-amber-600 animate-pulse-soft">保存中...</span>
                          )}
                          {saveStatus === 'saved' && (
                            <span className="text-xs text-green-600">已保存</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleStartEdit(record)}
                        className="text-xs text-slate-600 line-clamp-2 cursor-pointer hover:text-slate-800 hover:underline decoration-dotted"
                        title="点击编辑备注"
                      >
                        {record.currentNote || '点击添加备注...'}
                      </div>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="text-xs">
                      <div className="font-medium">{record.latestHandler}</div>
                      <div className="text-slate-400">{record.latestHandleTime}</div>
                    </div>
                  </td>
                  <td className="table-cell no-print">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/record/${record.id}`)}
                        className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-warm-100 rounded transition-all"
                        title="查看详情"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => navigate(`/record/${record.id}/supplement`)}
                        className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-warm-100 rounded transition-all"
                        title="补充材料"
                      >
                        <FilePlus size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
