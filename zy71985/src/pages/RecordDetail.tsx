import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Shield,
  Clock,
  User,
  FileCode,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { StatusBadge, SourceBadge } from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import PermissionDiff from '@/components/PermissionDiff';
import Modal from '@/components/Modal';
import { formatDateTime } from '@/utils';
import type { RecordStatus, InventoryRecord } from '@/types';

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getRecordById = useAppStore(state => state.getRecordById);
  const getLogsByRecordId = useAppStore(state => state.getLogsByRecordId);
  const getPermissionChangesByRecordId = useAppStore(state => state.getPermissionChangesByRecordId);
  const updateRecord = useAppStore(state => state.updateRecord);
  const updateRecordStatus = useAppStore(state => state.updateRecordStatus);
  const changePermission = useAppStore(state => state.changePermission);
  const currentUser = useAppStore(state => state.currentUser);

  const record = getRecordById(id || '');
  const logs = getLogsByRecordId(id || '');
  const permissionChanges = getPermissionChangesByRecordId(id || '');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'permission'>('info');
  const [editForm, setEditForm] = useState<Partial<InventoryRecord>>({});
  const [editReason, setEditReason] = useState('');
  const [beforePerm, setBeforePerm] = useState('');
  const [afterPerm, setAfterPerm] = useState('');
  const [permReason, setPermReason] = useState('');

  const handleOpenEdit = () => {
    if (record) {
      setEditForm({
        interfaceName: record.interfaceName,
        stockCode: record.stockCode,
        preOccupyQty: record.preOccupyQty,
        releaseQty: record.releaseQty,
        pendingReason: record.pendingReason,
        status: record.status,
      });
      setEditReason('');
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = () => {
    if (!id || !editReason.trim()) {
      alert('请填写修改原因');
      return;
    }
    const result = updateRecord(id, editForm, editReason);
    if (result.success) {
      setShowEditModal(false);
    } else {
      alert(result.errors?.join('\n'));
    }
  };

  const handleStatusChange = (status: RecordStatus, reason: string) => {
    if (id) {
      updateRecordStatus(id, status, reason);
    }
  };

  const handleSavePermission = () => {
    if (!id || !permReason.trim()) {
      alert('请填写变更原因');
      return;
    }
    try {
      const before = JSON.parse(beforePerm);
      const after = JSON.parse(afterPerm);
      changePermission(id, before, after, permReason);
      setShowPermissionModal(false);
      setBeforePerm('');
      setAfterPerm('');
      setPermReason('');
    } catch {
      alert('JSON 格式错误');
    }
  };

  if (!record) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">记录不存在</p>
        <button
          onClick={() => navigate('/records')}
          className="mt-4 px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/records')}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">记录详情</h1>
            <p className="mt-1 text-slate-400 text-sm">
              {record.stockCode} · {record.interfaceName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPermissionModal(true)}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition-colors flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            变更权限
          </button>
          <button
            onClick={handleOpenEdit}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            编辑记录
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-800/30 border border-slate-700/50 rounded-lg p-1 w-fit">
        {(['info', 'history', 'permission'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'info' && '基本信息'}
            {tab === 'history' && `操作历史 (${logs.length})`}
            {tab === 'permission' && `权限变更 (${permissionChanges.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <StatusBadge status={record.status} />
                <SourceBadge source={record.source} />
                {record.idempotentValid ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    幂等键有效
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                    <XCircle className="w-3 h-3" />
                    幂等键失效
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <FileCode className="w-3 h-3" />
                    库存编码
                  </label>
                  <p className="text-white font-mono text-lg">{record.stockCode}</p>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <FileCode className="w-3 h-3" />
                    接口名称
                  </label>
                  <p className="text-white font-mono text-lg">{record.interfaceName}</p>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <User className="w-3 h-3" />
                    操作人
                  </label>
                  <p className="text-white">{record.operator}</p>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <KeyRound className="w-3 h-3" />
                    幂等键
                  </label>
                  <p className={`font-mono text-sm ${record.idempotentValid ? 'text-emerald-400' : 'text-red-400'}`}>
                    {record.idempotentKey}
                  </p>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    预占数量
                  </label>
                  <p className="text-white text-2xl font-bold font-mono">{record.preOccupyQty}</p>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    已释放数量
                  </label>
                  <p className="text-white text-2xl font-bold font-mono">{record.releaseQty}</p>
                </div>
              </div>

              {!record.idempotentValid && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 font-medium text-sm">幂等键失效信息</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">失效原因：</span>
                      <span className="text-white">{record.idempotentInvalidReason || '未知'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">重试次数：</span>
                      <span className="text-white">{record.idempotentRetryCount || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {record.pendingReason && (
                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400 font-medium text-sm">待处理原因</span>
                  </div>
                  <p className="text-amber-300">{record.pendingReason}</p>
                </div>
              )}

              <div className="mt-6">
                <label className="text-slate-500 text-xs mb-2 block">原始数据</label>
                <pre className="text-xs text-slate-300 bg-slate-900 p-4 rounded-lg overflow-x-auto font-mono">
                  {JSON.stringify(record.rawData, null, 2)}
                </pre>
              </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">快速状态变更</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['pending', 'processing', 'completed', 'error'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status, `状态变更为${status === 'pending' ? '待处理' : status === 'processing' ? '处理中' : status === 'completed' ? '已完成' : '异常'}`)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      record.status === status
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <StatusBadge status={status} size="sm" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">时间信息</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-500 text-xs">创建时间</label>
                  <p className="text-white text-sm font-mono">{formatDateTime(record.createdAt)}</p>
                </div>
                <div>
                  <label className="text-slate-500 text-xs">更新时间</label>
                  <p className="text-white text-sm font-mono">{formatDateTime(record.updatedAt)}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">释放进度</h3>
              <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${record.preOccupyQty > 0 ? (record.releaseQty / record.preOccupyQty) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-slate-400">已释放 {record.releaseQty}</span>
                <span className="text-white font-mono">
                  {record.preOccupyQty > 0 ? Math.round((record.releaseQty / record.preOccupyQty) * 100) : 0}%
                </span>
                <span className="text-slate-400">预占 {record.preOccupyQty}</span>
              </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">记录ID</h3>
              <p className="text-slate-400 text-xs font-mono break-all">{record.id}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
          <Timeline logs={logs} />
        </div>
      )}

      {activeTab === 'permission' && (
        <div>
          <PermissionDiff changes={permissionChanges} />
        </div>
      )}

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="编辑记录"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">接口名称</label>
              <input
                type="text"
                value={editForm.interfaceName || ''}
                onChange={e => setEditForm({ ...editForm, interfaceName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">库存编码</label>
              <input
                type="text"
                value={editForm.stockCode || ''}
                onChange={e => setEditForm({ ...editForm, stockCode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">预占数量</label>
              <input
                type="number"
                min="0"
                value={editForm.preOccupyQty || 0}
                onChange={e => setEditForm({ ...editForm, preOccupyQty: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">已释放数量</label>
              <input
                type="number"
                min="0"
                value={editForm.releaseQty || 0}
                onChange={e => setEditForm({ ...editForm, releaseQty: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">状态</label>
              <select
                value={editForm.status || 'pending'}
                onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="pending">待处理</option>
                <option value="processing">处理中</option>
                <option value="completed">已完成</option>
                <option value="error">异常</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">待处理原因</label>
            <input
              type="text"
              value={editForm.pendingReason || ''}
              onChange={e => setEditForm({ ...editForm, pendingReason: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">修改原因 *</label>
            <textarea
              value={editReason}
              onChange={e => setEditReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              placeholder="请说明修改原因"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg text-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors"
            >
              保存修改
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="权限变更"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">变更前权限 (JSON)</label>
              <textarea
                value={beforePerm}
                onChange={e => setBeforePerm(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500 h-40"
                placeholder='{"canPreOccupy": true, "warehouse": ["WH-01"]}'
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">变更后权限 (JSON)</label>
              <textarea
                value={afterPerm}
                onChange={e => setAfterPerm(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500 h-40"
                placeholder='{"canPreOccupy": true, "warehouse": ["WH-01", "WH-02"]}'
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">变更原因 *</label>
            <textarea
              value={permReason}
              onChange={e => setPermReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              placeholder="请说明权限变更的原因"
              rows={3}
            />
          </div>
          <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
            <p className="text-slate-400 text-xs">
              <span className="text-cyan-400">提示：</span>
              系统会自动对比前后差异并生成快照，所有变更都会记录到操作日志中。
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowPermissionModal(false)}
              className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg text-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSavePermission}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors"
            >
              确认变更
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
