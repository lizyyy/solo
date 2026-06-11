import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { StatusBadge } from '@/components/StatusBadge';
import { ChangeTimeline } from '@/components/ChangeTimeline';
import { EvidencePanel } from '@/components/EvidencePanel';
import { canUserConfirm } from '@/utils/boundaryRules';
import {
  ArrowLeft,
  Music,
  Hash,
  CheckCircle,
  Eye,
  AlertTriangle,
  Edit3,
  Save,
  X
} from 'lucide-react';

export function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const allRecords = useStore(state => state.records);
  const allLogs = useStore(state => state.changeLogs);
  const updateRecord = useStore(state => state.updateRecord);
  const updateRecordStatus = useStore(state => state.updateRecordStatus);
  const currentUser = useStore(state => state.currentUser);

  const record = useMemo(() => allRecords.find(r => r.id === id), [allRecords, id]);
  const logs = useMemo(() => {
    return allLogs
      .filter(l => l.recordId === id)
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  }, [allLogs, id]);

  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState(record?.currentNote || '');
  const [editQuantity, setEditQuantity] = useState(record?.shortageQuantity || 0);

  if (!record) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500 mb-4">记录不存在</p>
        <Link to="/" className="text-amber-600 hover:text-amber-700 text-sm">
          返回列表
        </Link>
      </div>
    );
  }

  const canConfirm = canUserConfirm(record.status, currentUser.role);

  const handleSave = () => {
    updateRecord(
      record.id,
      { currentNote: editNote, shortageQuantity: editQuantity },
      currentUser.name,
      '人工修改记录'
    );
    setEditing(false);
  };

  const handleConfirm = () => {
    if (record.status === 'review_needed') {
      updateRecordStatus(record.id, 'reviewed', currentUser.name, '巡演统筹复核通过');
    } else {
      updateRecordStatus(record.id, 'confirmed', currentUser.name, '音乐老师确认');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-3">
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 mb-1">
              {record.standardTrackName || record.trackName}
            </h1>
            <p className="text-stone-500 text-sm">记录详情 - 原始行号: {record.originalLineNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={record.status} />
            {record.isBoundaryCase && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                <AlertTriangle className="w-3 h-3" />
                边界场景
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-stone-800">基本信息</h3>
              {!editing ? (
                <button
                  onClick={() => {
                    setEditNote(record.currentNote);
                    setEditQuantity(record.shortageQuantity);
                    setEditing(true);
                  }}
                  className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  编辑
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    保存
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    取消
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-stone-500 block mb-1">曲目名</label>
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-amber-600" />
                  <span className="text-stone-800">{record.trackName}</span>
                  {record.standardTrackName && record.standardTrackName !== record.trackName && (
                    <span className="text-sm text-stone-500">
                      → {record.standardTrackName}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-500 block mb-1">缺货数量</label>
                {editing ? (
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                ) : (
                  <p className="text-stone-800 font-medium text-lg">{record.shortageQuantity} 张</p>
                )}
              </div>

              <div>
                <label className="text-xs text-stone-500 block mb-1">备注</label>
                {editing ? (
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                ) : (
                  <p className="text-stone-700 text-sm">
                    {record.currentNote || <span className="text-stone-400">暂无备注</span>}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-stone-100">
              {canConfirm && (
                <button
                  onClick={handleConfirm}
                  className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    record.status === 'review_needed'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {record.status === 'review_needed' ? (
                    <><Eye className="w-4 h-4" /> 巡演统筹复核通过</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> 确认此记录</>
                  )}
                </button>
              )}
              {record.status === 'review_needed' && currentUser.role === 'music_teacher' && (
                <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1.5" />
                  此为边界场景，需由巡演统筹复核，音乐老师不可直接确认
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
            <h3 className="font-medium text-stone-800 mb-4 flex items-center gap-2">
              <Hash className="w-4 h-4 text-amber-600" />
              三步流程状态
            </h3>
            <div className="space-y-3">
              <StepItem
                label="合同页截图导入"
                status="done"
                description="原始行号、内容已保留"
              />
              <StepItem
                label="补看曲目别名表"
                status={record.standardTrackName ? 'done' : 'pending'}
                description={record.standardTrackName ? `已映射到: ${record.standardTrackName}` : '等待音乐老师匹配'}
              />
              <StepItem
                label="曲目核对表更新"
                status={
                  record.status === 'confirmed' || record.status === 'reviewed'
                    ? 'done'
                    : record.status === 'review_needed'
                      ? 'warning'
                      : 'pending'
                }
                description={
                  record.status === 'reviewed'
                    ? '巡演统筹已复核'
                    : record.status === 'confirmed'
                      ? '音乐老师已确认'
                      : record.status === 'review_needed'
                        ? '待巡演统筹复核（边界场景）'
                        : '等待确认'
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
            <h3 className="font-medium text-stone-800 mb-4">证据链</h3>
            <EvidencePanel record={record} logs={logs.slice(0, 3)} showRollback />
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-stone-800">完整变更历史</h3>
              <span className="text-xs text-stone-500">
                非最新节点可回滚，回滚操作本身也会被记录
              </span>
            </div>
            <ChangeTimeline logs={logs} recordId={record.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepItem({ label, status, description }: { label: string; status: 'done' | 'pending' | 'warning'; description: string }) {
  const statusConfig = {
    done: { bg: 'bg-green-500', text: 'text-green-700', bgLight: 'bg-green-50' },
    pending: { bg: 'bg-stone-300', text: 'text-stone-500', bgLight: 'bg-stone-50' },
    warning: { bg: 'bg-amber-500', text: 'text-amber-700', bgLight: 'bg-amber-50' }
  };
  const config = statusConfig[status];

  return (
    <div className="flex items-start gap-3">
      <div className={`w-3 h-3 rounded-full ${config.bg} mt-1.5 flex-shrink-0`} />
      <div>
        <p className={`text-sm font-medium ${config.text}`}>{label}</p>
        <p className="text-xs text-stone-500">{description}</p>
      </div>
    </div>
  );
}
