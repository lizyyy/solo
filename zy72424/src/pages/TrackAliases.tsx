import { useState } from 'react';
import {
  Edit2,
  Save,
  X,
  History as HistoryIcon,
  Music,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDate } from '../utils/boundaryRules';
import { TrackAlias } from '../types';
import { getFieldNameText } from '../utils/historyTracker';

export default function TrackAliases() {
  const trackAliases = useStore((state) => state.trackAliases);
  const updateTrackAlias = useStore((state) => state.updateTrackAlias);
  const currentUser = useStore((state) => state.currentUser);
  const getHistoryByRecordId = useStore((state) => state.getHistoryByRecordId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TrackAlias>>({});
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const startEdit = (alias: TrackAlias) => {
    setEditingId(alias.id);
    setEditForm({
      trackName: alias.trackName,
      aliasName: alias.aliasName,
      remark: alias.remark,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = (id: string) => {
    updateTrackAlias(id, editForm, currentUser.name);
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-primary-800">
          曲目别名表
        </h1>
        <p className="text-gray-600 mt-1">
          维护曲目别名和备注，备注保留原始格式，不做清洗
        </p>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">备注保留规则</p>
          <p className="text-xs text-amber-700 mt-0.5">
            备注字段会保留原始换行、空格和特殊字符，系统不会将其清洗为单行数据。
            修改备注时会记录完整的变更历史，可查看改前改后的差异。
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="text-left px-4 py-3 w-48">曲目名称</th>
              <th className="text-left px-4 py-3 w-32">别名</th>
              <th className="text-left px-4 py-3">备注</th>
              <th className="text-left px-4 py-3 w-32">更新人</th>
              <th className="text-left px-4 py-3 w-40">更新时间</th>
              <th className="text-center px-4 py-3 w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {trackAliases.map((alias) => {
              const isEditing = editingId === alias.id;
              const history = getHistoryByRecordId(alias.id);
              const isExpanded = expandedHistory === alias.id;

              return (
                <>
                  <tr key={alias.id} className="table-row align-top">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          className="input-field text-sm"
                          value={editForm.trackName || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, trackName: e.target.value })
                          }
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4 text-primary-500" />
                          <span className="font-medium text-primary-800">
                            {alias.trackName}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          className="input-field text-sm"
                          value={editForm.aliasName || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, aliasName: e.target.value })
                          }
                        />
                      ) : (
                        <span className="text-accent-600 font-medium">
                          {alias.aliasName}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <textarea
                          className="textarea-field text-sm"
                          rows={4}
                          value={editForm.remark || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, remark: e.target.value })
                          }
                          placeholder="输入备注，支持换行和空格"
                        />
                      ) : (
                        <div className="remark-preserve text-sm text-gray-700 max-w-md">
                          {alias.remark}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {alias.updatedBy}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(alias.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              className="p-1.5 hover:bg-success-50 rounded-lg text-success-600 transition-colors"
                              onClick={() => saveEdit(alias.id)}
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                              onClick={cancelEdit}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            className="p-1.5 hover:bg-primary-50 rounded-lg text-primary-600 transition-colors"
                            onClick={() => startEdit(alias)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {history.length > 0 && (
                          <button
                            className={`p-1.5 rounded-lg transition-colors ${
                              isExpanded
                                ? 'bg-primary-100 text-primary-700'
                                : 'hover:bg-gray-100 text-gray-500'
                            }`}
                            onClick={() =>
                              setExpandedHistory(isExpanded ? null : alias.id)
                            }
                          >
                            <HistoryIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && history.length > 0 && (
                    <tr key={`${alias.id}-history`} className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="pl-8 space-y-3">
                          <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                            <HistoryIcon className="w-3 h-3" />
                            变更历史（{history.length} 条）
                          </p>
                          {history.map((h) => (
                            <div
                              key={h.id}
                              className="p-3 bg-white rounded-lg border border-gray-100 text-sm"
                            >
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <span className="font-medium text-primary-700">
                                  {getFieldNameText(h.fieldName)}
                                </span>
                                <span>•</span>
                                <span>{h.changedBy}</span>
                                <span>•</span>
                                <span>{formatDate(h.changedAt)}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <span className="text-gray-400">修改前：</span>
                                  <div className="remark-preserve text-gray-600 mt-1 p-2 bg-gray-50 rounded">
                                    {h.oldValue || '（空）'}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-400">修改后：</span>
                                  <div className="remark-preserve text-gray-700 mt-1 p-2 bg-primary-50 rounded">
                                    {h.newValue || '（空）'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
