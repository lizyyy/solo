import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, RotateCcw, Trash2, User, Calendar, Camera, MapPin, Save, X } from 'lucide-react';
import { useCableStore } from '@/store/cableStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CablePathVisualizer } from '@/components/cable/CablePathVisualizer';
import { VersionTimeline } from '@/components/cable/VersionTimeline';
import { HumanMessageCard } from '@/components/common/HumanMessageCard';
import { CableRecord, CableStatus, STATUS_LABELS, CABLE_TYPES, ROOMS, CABINETS } from '@/types';
import { generateRollbackMessage } from '@/utils/humanMessageGenerator';
import { VersionHistory } from '@/types';

export const RecordDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { records, getRecordVersions, updateRecord, rollbackRecord, deleteRecord, getSourceById, getPersonById } = useCableStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CableRecord>>({});
  const [editReason, setEditReason] = useState('');
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<VersionHistory | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const record = useMemo(() => records.find(r => r.id === id), [records, id]);
  const versions = useMemo(() => id ? getRecordVersions(id) : [], [id, getRecordVersions]);
  const source = record ? getSourceById(record.sourceId) : undefined;
  const owner = record ? getPersonById(record.ownerId) : undefined;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const handleStartEdit = () => {
    if (!record) return;
    setEditForm({
      cableNo: record.cableNo,
      room: record.room,
      cabinet: record.cabinet,
      startPoint: { ...record.startPoint },
      endPoint: { ...record.endPoint },
      cableType: record.cableType,
      status: record.status,
      remark: record.remark,
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
    setEditReason('');
  };

  const handleSaveEdit = () => {
    if (!record || !editReason.trim()) {
      setNotification({ type: 'error', message: '请填写修改原因' });
      return;
    }
    updateRecord(record.id, editForm, '张伟', editReason);
    setIsEditing(false);
    setEditForm({});
    setEditReason('');
    setNotification({ type: 'success', message: '修改已保存' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRollback = (version: VersionHistory) => {
    if (!record) return;
    rollbackRecord(record.id, version.id, '张伟', `回滚到版本 ${version.version}：${version.reason}`);
    setShowRollbackConfirm(null);
    setNotification({ type: 'success', message: '已回滚到指定版本' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDelete = () => {
    if (!record) return;
    deleteRecord(record.id, '张伟', '人工删除');
    navigate('/');
  };

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">记录不存在</h2>
          <button
            onClick={() => navigate('/')}
            className="text-signal-blue hover:underline"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const rollbackMessage = showRollbackConfirm 
    ? generateRollbackMessage(record, showRollbackConfirm.version, showRollbackConfirm.operator, showRollbackConfirm.createdAt)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 font-mono">{record.cableNo}</h1>
                <p className="text-xs text-gray-500">
                  {record.room} · {record.cabinet} 机柜
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={record.status} />
              {!isEditing && (
                <>
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-signal-blue hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    编辑
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-signal-red hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {notification && (
          <div className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {notification.message}
          </div>
        )}

        {showRollbackConfirm && rollbackMessage && (
          <div className="mb-6">
            <HumanMessageCard
              message={rollbackMessage}
              onAction={(action) => {
                if (action === 'confirm_rollback' && showRollbackConfirm) {
                  handleRollback(showRollbackConfirm);
                } else {
                  setShowRollbackConfirm(null);
                }
              }}
            />
          </div>
        )}

        {showDeleteConfirm && (
          <div className="mb-6">
            <HumanMessageCard
              message={{
                level: 'error',
                title: '确认删除此记录？',
                description: `将删除 ${record.cableNo} 的所有数据和历史版本`,
                reason: '删除后无法恢复，但操作会被记录到日志中',
                nextSteps: [
                  { text: '确认删除', action: 'confirm_delete' },
                  { text: '取消', action: 'cancel' },
                ],
              }}
              onAction={(action) => {
                if (action === 'confirm_delete') {
                  handleDelete();
                } else {
                  setShowDeleteConfirm(false);
                }
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            {isEditing ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <h3 className="font-semibold text-gray-800 mb-4">编辑记录</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">线缆编号</label>
                    <input
                      type="text"
                      value={editForm.cableNo || ''}
                      onChange={(e) => setEditForm({ ...editForm, cableNo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">线缆类型</label>
                    <select
                      value={editForm.cableType || ''}
                      onChange={(e) => setEditForm({ ...editForm, cableType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue"
                    >
                      {CABLE_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">机房</label>
                    <select
                      value={editForm.room || ''}
                      onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue"
                    >
                      {ROOMS.map(room => (
                        <option key={room} value={room}>{room}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">机柜</label>
                    <select
                      value={editForm.cabinet || ''}
                      onChange={(e) => setEditForm({ ...editForm, cabinet: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue font-mono"
                    >
                      {CABINETS.map(cabinet => (
                        <option key={cabinet} value={cabinet}>{cabinet}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">起点 X</label>
                    <input
                      type="number"
                      value={editForm.startPoint?.x || 0}
                      onChange={(e) => setEditForm({ ...editForm, startPoint: { ...editForm.startPoint!, x: Number(e.target.value) } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">起点 Y</label>
                    <input
                      type="number"
                      value={editForm.startPoint?.y || 0}
                      onChange={(e) => setEditForm({ ...editForm, startPoint: { ...editForm.startPoint!, y: Number(e.target.value) } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">终点 X</label>
                    <input
                      type="number"
                      value={editForm.endPoint?.x || 0}
                      onChange={(e) => setEditForm({ ...editForm, endPoint: { ...editForm.endPoint!, x: Number(e.target.value) } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">终点 Y</label>
                    <input
                      type="number"
                      value={editForm.endPoint?.y || 0}
                      onChange={(e) => setEditForm({ ...editForm, endPoint: { ...editForm.endPoint!, y: Number(e.target.value) } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                    <select
                      value={editForm.status || 'pending'}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as CableStatus })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue"
                    >
                      {(Object.keys(STATUS_LABELS) as CableStatus[]).map(status => (
                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <textarea
                    value={editForm.remark || ''}
                    onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">修改原因 <span className="text-signal-red">*</span></label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="请详细说明修改原因，此记录将永久留存"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue"
                    rows={2}
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    取消
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-signal-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    保存修改
                  </button>
                </div>
              </div>
            ) : (
              <CablePathVisualizer
                startPoint={record.startPoint}
                endPoint={record.endPoint}
                cableNo={record.cableNo}
                cabinet={record.cabinet}
                isFlipped={record.coordinatesFlipped}
              />
            )}

            <VersionTimeline
              versions={versions}
              onRollback={(version) => setShowRollbackConfirm(version)}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">基本信息</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">线缆类型</span>
                  <span className="text-sm font-medium text-gray-800">{record.cableType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">机房</span>
                  <span className="text-sm font-medium text-gray-800">{record.room}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">机柜</span>
                  <span className="text-sm font-medium text-gray-800 font-mono">{record.cabinet}</span>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Calendar className="w-4 h-4" />
                    创建时间
                  </div>
                  <p className="text-sm text-gray-800">{formatDate(record.createdAt)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Calendar className="w-4 h-4" />
                    更新时间
                  </div>
                  <p className="text-sm text-gray-800">{formatDate(record.updatedAt)}</p>
                </div>
              </div>
            </div>

            {source && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">数据来源</h3>
                <div className="flex items-center gap-2 mb-3">
                  {source.type === 'inspection_photo' ? (
                    <Camera className="w-5 h-5 text-signal-blue" />
                  ) : source.type === 'walkthrough' ? (
                    <MapPin className="w-5 h-5 text-signal-orange" />
                  ) : (
                    <User className="w-5 h-5 text-gray-500" />
                  )}
                  <span className="text-sm font-medium text-gray-800">
                    {source.type === 'inspection_photo' ? '巡检照片' : source.type === 'walkthrough' ? '讲解路线' : '人工录入'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{source.name}</p>
                <p className="text-xs text-gray-500">
                  上传人：{source.uploader} · {formatDate(source.uploadDate)}
                </p>
                {source.description && (
                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded p-2">
                    {source.description}
                  </p>
                )}
              </div>
            )}

            {owner && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">负责人</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-industrial-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-industrial-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{owner.name}</p>
                    <p className="text-xs text-gray-500">{owner.role}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>📞 {owner.phone}</p>
                  <p>✉️ {owner.email}</p>
                </div>
              </div>
            )}

            {record.remark && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-3">备注</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{record.remark}</p>
              </div>
            )}

            {record.coordinatesFlipped && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <RotateCcw className="w-5 h-5 text-signal-orange flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">坐标已修正</p>
                    <p className="text-xs text-amber-600 mt-1">
                      此条记录的坐标曾被翻转，已人工修正。请查看历史版本了解详情。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
