import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import StepIndicator from '../components/StepIndicator';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, Camera, FileText, User, Clock, Edit, CheckCircle, XCircle } from 'lucide-react';

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentComplaint, fetchComplaintDetail, updatePhoto, updateOpinion, reviewComplaint, currentRole, loading } = useAppStore();
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [editingOpinion, setEditingOpinion] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [opinionSummary, setOpinionSummary] = useState('');
  const [opinionOriginal, setOpinionOriginal] = useState('');
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    if (id) {
      fetchComplaintDetail(id);
    }
  }, [id]);

  useEffect(() => {
    if (currentComplaint) {
      setPhotoUrl(currentComplaint.intersectionPhoto.photoUrl || '');
      setOpinionSummary(currentComplaint.residentOpinion.summary);
      setOpinionOriginal(currentComplaint.residentOpinion.originalText || '');
    }
  }, [currentComplaint]);

  const handleSavePhoto = async () => {
    if (id) {
      await updatePhoto(id, !!photoUrl, photoUrl || undefined);
      await fetchComplaintDetail(id);
      setEditingPhoto(false);
    }
  };

  const handleSaveOpinion = async () => {
    if (id) {
      await updateOpinion(id, opinionSummary, opinionOriginal);
      await fetchComplaintDetail(id);
      setEditingOpinion(false);
    }
  };

  const handleReview = async (approve: boolean) => {
    if (id && reviewComment) {
      await reviewComplaint(id, reviewComment, approve);
      await fetchComplaintDetail(id);
      setReviewComment('');
    }
  };

  if (!currentComplaint) {
    return <div className="text-slate-500">加载中...</div>;
  }

  const c = currentComplaint;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/complaints')}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        返回列表
      </button>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-800">{c.complaintNo}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <StatusBadge status={c.status} isDuplicate={c.isDuplicate} />
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                原始行号 #{c.originalRowNo}
              </span>
              <span className="text-sm text-slate-500">
                导入人：{c.importBy} · {new Date(c.importTime).toLocaleString('zh-CN')}
              </span>
              <span className="text-sm text-slate-500">
                来源：{c.source || '未标注'}
              </span>
            </div>
            {c.reportNote && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-1">报告说明（与页面展示/接口返回/导出同源）</p>
                <p className="text-sm text-blue-800">{c.reportNote}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-medium text-slate-700 mb-4">处理进度</h3>
          <StepIndicator currentStep={c.currentStep} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-medium text-slate-800 flex items-center gap-2">
              <Camera size={18} className="text-slate-500" />
              路口照片
            </h3>
            {currentRole === 'manager' && (
              <button
                onClick={() => setEditingPhoto(!editingPhoto)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Edit size={14} />
                {editingPhoto ? '取消' : '补录'}
              </button>
            )}
          </div>
          <div className="p-5">
            {editingPhoto ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  placeholder="输入照片URL（留空表示无照片）"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSavePhoto}
                  disabled={loading}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            ) : (
              <div>
                {c.intersectionPhoto.hasPhoto ? (
                  <div className="space-y-2">
                    <div className="w-full h-40 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                      <Camera size={32} />
                    </div>
                    <p className="text-xs text-slate-500">
                      补看人：{c.intersectionPhoto.reviewedBy} · {c.intersectionPhoto.reviewTime && new Date(c.intersectionPhoto.reviewTime).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Camera size={32} className="mx-auto mb-2" />
                    <p className="text-sm">暂无路口照片</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-medium text-slate-800 flex items-center gap-2">
              <FileText size={18} className="text-slate-500" />
              居民意见
            </h3>
            {currentRole === 'manager' && (
              <button
                onClick={() => setEditingOpinion(!editingOpinion)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Edit size={14} />
                {editingOpinion ? '取消' : '补录'}
              </button>
            )}
          </div>
          <div className="p-5">
            {editingOpinion ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">汇总</label>
                  <textarea
                    value={opinionSummary}
                    onChange={e => setOpinionSummary(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">原文（必填）</label>
                  <textarea
                    value={opinionOriginal}
                    onChange={e => setOpinionOriginal(e.target.value)}
                    rows={4}
                    placeholder="请输入居民意见原文..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleSaveOpinion}
                  disabled={loading}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">汇总</p>
                  <p className="text-sm text-slate-700">{c.residentOpinion.summary}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">
                    原文
                    {!c.residentOpinion.hasOriginal && (
                      <span className="text-red-500 ml-2">（缺失，只剩汇总）</span>
                    )}
                  </p>
                  {c.residentOpinion.hasOriginal ? (
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                      {c.residentOpinion.originalText}
                    </p>
                  ) : (
                    <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
                      卡点：第{c.currentStep}步 - 居民意见只剩汇总无原文，需社区书记复核
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {c.currentStep >= 2 && c.status === 'missing_opinion' && currentRole === 'secretary' && (
        <div className="bg-white rounded-lg border border-red-200 p-6">
          <h3 className="font-medium text-red-800 mb-4">社区书记复核</h3>
          <div className="space-y-3">
            <textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              placeholder="请输入复核意见..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleReview(true)}
                disabled={!reviewComment || loading}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} />
                确认处理通过
              </button>
              <button
                onClick={() => handleReview(false)}
                disabled={!reviewComment || loading}
                className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <XCircle size={16} />
                记录但不结案
              </button>
            </div>
          </div>
        </div>
      )}

      {c.reviewBy && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
            <User size={18} className="text-slate-500" />
            复核记录
          </h3>
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-sm text-slate-700">{c.reviewComment}</p>
            <p className="text-xs text-slate-500 mt-2">
              复核人：{c.reviewBy} · {c.reviewTime && new Date(c.reviewTime).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-medium text-slate-800 flex items-center gap-2">
            <Clock size={18} className="text-slate-500" />
            操作审计记录
          </h3>
        </div>
        <div className="p-5">
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-4">
              {c.auditLogs.map((log, idx) => (
                <div key={log.id} className="relative pl-8">
                  <div className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    log.operatorRole === 'secretary' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {idx === 0 ? '+' : idx + 1}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{log.action}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(log.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      操作人：{log.operator}（{log.operatorRole === 'manager' ? '城更经理' : '社区书记'}）
                    </p>
                    {log.beforeChange && Object.keys(log.beforeChange).length > 0 && (
                      <div className="mt-2 text-xs">
                        <p className="text-slate-500 mb-1">变更前：</p>
                        <pre className="bg-slate-100 p-2 rounded text-slate-600 overflow-x-auto">
                          {JSON.stringify(log.beforeChange, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.afterChange && Object.keys(log.afterChange).length > 0 && (
                      <div className="mt-2 text-xs">
                        <p className="text-slate-500 mb-1">变更后：</p>
                        <pre className="bg-green-50 p-2 rounded text-green-700 overflow-x-auto">
                          {JSON.stringify(log.afterChange, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
