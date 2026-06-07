import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { ArrowLeft, Edit, History, ClipboardList, FileWarning } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DateDisplay from '../components/DateDisplay';
import { useState } from 'react';

export default function RedlineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { redlineRemarks, getVersionsForRemark, inspections, complaints, updateRedlineRemark } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editRemark, setEditRemark] = useState('');
  const [editReason, setEditReason] = useState('');

  const remark = redlineRemarks.find((r) => r.id === id);
  const versions = remark ? getVersionsForRemark(remark.id) : [];
  const relatedInspection = inspections.find((i) => i.id === remark?.inspectionId);
  const relatedComplaints = complaints.filter((c) => c.redlineRemarkId === id);

  if (!remark) {
    return <div className="text-center py-20 text-gray-500">红线图备注不存在</div>;
  }

  const handleSave = () => {
    if (!editRemark.trim() || !editReason.trim()) return;
    updateRedlineRemark(remark.id, { remark: editRemark }, editReason);
    setIsEditing(false);
    setEditRemark('');
    setEditReason('');
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
    pending_review: { label: '待审核', color: 'bg-yellow-100 text-yellow-700' },
    approved: { label: '已通过', color: 'bg-green-100 text-green-700' },
    rejected: { label: '已驳回', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate('/redline')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回红线图备注列表
      </button>

      <PageHeader
        title={remark.areaName}
        subtitle={`${remark.code} · ${remark.location}`}
        action={
          <div className="flex items-center gap-3">
            <span className={`badge ${statusConfig[remark.status].color}`}>
              {statusConfig[remark.status].label}
            </span>
            <span className="text-sm text-gray-500">v{remark.currentVersion}</span>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">备注详情</h3>
              <button
                onClick={() => {
                  setEditRemark(remark.remark);
                  setIsEditing(true);
                }}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Edit className="w-4 h-4" />
                修改备注
              </button>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  className="input h-24"
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  placeholder="输入新的备注内容..."
                />
                <input
                  type="text"
                  className="input"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="修改原因（必填，将记录在版本历史中）"
                />
                <div className="flex gap-3">
                  <button onClick={() => setIsEditing(false)} className="btn-secondary">
                    取消
                  </button>
                  <button onClick={handleSave} className="btn-primary">
                    保存修改（生成新版本）
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{remark.remark}</p>
            )}

            <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-100">
              <div>
                <p className="text-sm text-gray-500">是否有宠物活动区</p>
                <p className="font-medium text-gray-900 mt-1">{remark.hasPetArea ? '是' : '否'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">坡道数量</p>
                <p className="font-medium text-gray-900 mt-1">{remark.rampCount} 个</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">导入人</p>
                <p className="font-medium text-gray-900 mt-1">{remark.importedBy}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">导入时间</p>
                <p className="font-medium text-gray-900 mt-1">
                  <DateDisplay date={remark.importedAt} />
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-primary-600" />
              版本历史
            </h3>
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div key={version.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      index === 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      v{version.version}
                    </div>
                    {index < versions.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 my-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{version.changeReason}</p>
                      {index === 0 && (
                        <span className="badge bg-green-100 text-green-700">当前版本</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {version.changedBy} · <DateDisplay date={version.changedAt} />
                    </p>
                    {version.data.remark && (
                      <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        "{version.data.remark}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {relatedInspection && (
            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                关联巡查表
              </h3>
              <Link
                to={`/inspection/${relatedInspection.id}`}
                className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <p className="font-medium text-gray-900">{relatedInspection.areaName}</p>
                <p className="text-sm text-gray-500 mt-1">
                  巡查人：{relatedInspection.inspector}
                </p>
              </Link>
            </div>
          )}

          <div className="card p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <FileWarning className="w-4 h-4" />
              相关投诉 ({relatedComplaints.length})
            </h3>
            {relatedComplaints.length > 0 ? (
              <div className="space-y-2">
                {relatedComplaints.map((c) => (
                  <Link
                    key={c.id}
                    to={`/complaints/${c.id}`}
                    className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{c.code}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">暂无相关投诉</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
