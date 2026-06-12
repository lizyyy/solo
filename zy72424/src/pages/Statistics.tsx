import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Music,
  FileImage,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  BarChart3,
  Edit2,
  Save,
  X,
  Clock,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDate } from '../utils/boundaryRules';
import { RehearsalRecord } from '../types';
import { getMatchedKeywordsText } from '../utils/reworkDetector';

export default function Statistics() {
  const navigate = useNavigate();
  const records = useStore((state) => state.records);
  const trackAliases = useStore((state) => state.trackAliases);
  const contracts = useStore((state) => state.contracts);
  const currentUser = useStore((state) => state.currentUser);
  const getTrackById = useStore((state) => state.getTrackById);
  const getContractById = useStore((state) => state.getContractById);
  const getReviewTaskByRecordId = useStore((state) => state.getReviewTaskByRecordId);
  const updateRecord = useStore((state) => state.updateRecord);
  const processRecordWithReworkCheck = useStore((state) => state.processRecordWithReworkCheck);
  const detectReworkRules = useStore((state) => state.boundaryRules.reworkDetection);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'late' | 'rework' | 'normal'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RehearsalRecord>>({});
  const [editSuccess, setEditSuccess] = useState(false);

  const filteredRecords = records.filter((r) => {
    if (filter === 'late') return r.isLate;
    if (filter === 'rework') return r.hasReworkReason;
    if (filter === 'normal') return r.status === 'normal' && !r.hasReworkReason;
    return true;
  });

  const getStatusTag = (record: RehearsalRecord) => {
    if (record.hasReworkReason && record.status === 'pending_review') {
      return <span className="tag tag-pending">待复核</span>;
    }
    if (record.hasReworkReason && record.status === 'reviewed') {
      return <span className="tag tag-approved">已复核</span>;
    }
    if (record.isLate) {
      return <span className="tag tag-rejected">迟到 {record.lateMinutes} 分钟</span>;
    }
    return <span className="tag tag-normal">正常</span>;
  };

  const startEdit = (record: RehearsalRecord) => {
    setEditingId(record.id);
    setEditForm({
      trackRemark: record.trackRemark,
      personName: record.personName,
      lateMinutes: record.lateMinutes,
      isLate: record.isLate,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editingId) return;

    updateRecord(editingId, editForm, currentUser.name);
    processRecordWithReworkCheck(editingId);

    setEditSuccess(true);
    setTimeout(() => setEditSuccess(false), 2000);
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-800">
            排练迟到统计
          </h1>
          <p className="text-gray-600 mt-1">
            查看排练记录，点击可钻取追溯源材料，支持编辑轨道备注
          </p>
        </div>
        <div className="flex items-center gap-3">
          {editSuccess && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-success-50 text-success-700 rounded-lg border border-success-200 text-sm">
              保存成功
            </div>
          )}
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => navigate('/statistics/3d')}
          >
            <BarChart3 className="w-4 h-4" />
            3D 视图
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'all', label: '全部', count: records.length },
          { key: 'late', label: '迟到', count: records.filter((r) => r.isLate).length },
          { key: 'rework', label: '含返工原因', count: records.filter((r) => r.hasReworkReason).length },
          { key: 'normal', label: '正常', count: records.filter((r) => r.status === 'normal' && !r.hasReworkReason).length },
        ].map((item) => (
          <button
            key={item.key}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === item.key
                ? 'bg-primary-700 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
            onClick={() => setFilter(item.key as typeof filter)}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">返工原因检测规则</p>
          <p className="text-xs text-amber-700 mt-0.5">
            编辑轨道备注后，系统会自动检测返工关键词（返工、重录、补录、修正、重新）。
            检测到关键词后，记录将标记为「待复核」状态，由版权运营进行复核。
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left px-4 py-3 w-10"></th>
                <th className="text-left px-4 py-3 w-36">排练日期</th>
                <th className="text-left px-4 py-3 w-28">人员</th>
                <th className="text-left px-4 py-3 w-40">曲目</th>
                <th className="text-left px-4 py-3">轨道备注</th>
                <th className="text-left px-4 py-3 w-28">状态</th>
                <th className="text-center px-4 py-3 w-36">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const track = getTrackById(record.trackId);
                const contract = getContractById(record.contractId);
                const reviewTask = getReviewTaskByRecordId(record.id);
                const isExpanded = expandedId === record.id;
                const isEditing = editingId === record.id;

                const matchedKeywords = record.trackRemark
                  ? detectReworkRules.keywords.filter((k) =>
                      record.trackRemark.includes(k)
                    )
                  : [];

                return (
                  <>
                    <tr key={record.id} className="table-row align-top">
                      <td className="px-4 py-3">
                        <button
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDate(record.rehearsalDate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-primary-600" />
                          </div>
                          <span className="text-sm font-medium text-primary-800">
                            {record.personName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-primary-700">
                          <Music className="w-3.5 h-3.5 text-accent-500" />
                          {track?.aliasName || track?.trackName || '未知曲目'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              className="textarea-field text-sm"
                              value={editForm.trackRemark || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, trackRemark: e.target.value })
                              }
                              rows={3}
                              placeholder="请输入轨道备注..."
                            />
                            <div className="flex items-center gap-2 text-xs text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              <span>包含返工关键词会自动进入复核队列</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="remark-preserve text-sm text-gray-700 max-w-sm line-clamp-2">
                              {record.trackRemark}
                            </div>
                            {record.hasReworkReason && (
                              <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                                <AlertTriangle className="w-3 h-3" />
                                检测到返工关键词：{getMatchedKeywordsText(matchedKeywords)}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">{getStatusTag(record)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                className="p-1.5 hover:bg-success-50 rounded text-success-600 transition-colors"
                                title="保存"
                                onClick={saveEdit}
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                                title="取消"
                                onClick={cancelEdit}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="p-1.5 hover:bg-primary-50 rounded text-primary-600 transition-colors"
                                title="编辑轨道备注"
                                onClick={() => startEdit(record)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1.5 hover:bg-primary-50 rounded text-primary-600 transition-colors"
                                title="查看曲目别名表"
                                onClick={() => navigate('/aliases')}
                              >
                                <Music className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1.5 hover:bg-primary-50 rounded text-primary-600 transition-colors"
                                title="查看合同页截图"
                                onClick={() => navigate('/contracts')}
                              >
                                <FileImage className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${record.id}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="pl-10 space-y-4">
                            <div className="grid grid-cols-2 gap-6">
                              <div className="p-4 bg-white rounded-lg border border-gray-100">
                                <h4 className="text-sm font-medium text-primary-800 mb-2 flex items-center gap-2">
                                  <Music className="w-4 h-4 text-accent-500" />
                                  关联曲目信息
                                </h4>
                                {track ? (
                                  <div className="space-y-2">
                                    <p className="text-sm">
                                      <span className="text-gray-500">曲目名称：</span>
                                      {track.trackName}
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-gray-500">别名：</span>
                                      {track.aliasName}
                                    </p>
                                    <div>
                                      <span className="text-sm text-gray-500">备注：</span>
                                      <div className="remark-preserve text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded">
                                        {track.remark}
                                      </div>
                                    </div>
                                    <button
                                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-2"
                                      onClick={() => navigate('/aliases')}
                                    >
                                      跳转到曲目别名表
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400">无关联曲目</p>
                                )}
                              </div>

                              <div className="p-4 bg-white rounded-lg border border-gray-100">
                                <h4 className="text-sm font-medium text-primary-800 mb-2 flex items-center gap-2">
                                  <FileImage className="w-4 h-4 text-primary-500" />
                                  关联合同截图
                                </h4>
                                {contract ? (
                                  <div className="space-y-2">
                                    <p className="text-sm">
                                      <span className="text-gray-500">文件名：</span>
                                      {contract.fileName}
                                    </p>
                                    <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                                      <img
                                        src={contract.fileUrl}
                                        alt={contract.fileName}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <button
                                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                                      onClick={() => navigate('/contracts')}
                                    >
                                      跳转到合同页截图
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400">无关联合同</p>
                                )}
                              </div>
                            </div>

                            {reviewTask && (
                              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                                <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  复核任务信息
                                </h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <p>
                                    <span className="text-amber-700">返工原因：</span>
                                    {reviewTask.reworkReason}
                                  </p>
                                  <p>
                                    <span className="text-amber-700">状态：</span>
                                    {reviewTask.reviewStatus === 'pending' && '待复核'}
                                    {reviewTask.reviewStatus === 'approved' && '已通过'}
                                    {reviewTask.reviewStatus === 'rejected' && '已驳回'}
                                  </p>
                                  {reviewTask.reviewComment && (
                                    <p className="col-span-2">
                                      <span className="text-amber-700">复核意见：</span>
                                      {reviewTask.reviewComment}
                                    </p>
                                  )}
                                </div>
                                <button
                                  className="mt-3 text-xs text-amber-700 hover:text-amber-800 flex items-center gap-1"
                                  onClick={() => navigate('/review')}
                                >
                                  前往复核工作台
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                记录详情
                              </h4>
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <p>
                                  <span className="text-gray-500">创建时间：</span>
                                  {formatDate(record.createdAt)}
                                </p>
                                <p>
                                  <span className="text-gray-500">更新时间：</span>
                                  {formatDate(record.updatedAt)}
                                </p>
                                <p>
                                  <span className="text-gray-500">是否迟到：</span>
                                  {record.isLate ? '是' : '否'}
                                </p>
                                <p>
                                  <span className="text-gray-500">迟到分钟：</span>
                                  {record.lateMinutes} 分钟
                                </p>
                              </div>
                            </div>
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
    </div>
  );
}
