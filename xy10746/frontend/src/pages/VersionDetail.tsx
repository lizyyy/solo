import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { versionApi, reviewOpinionApi } from '../api';
import { PluginVersionStatus, ReviewResult, ApiResponseStatus, ReviewOpinion, SecurityScan, PermissionDeclaration, TimelineEvent } from '../types';
import { getStatusColor, getStatusLabel, formatDate, getSeverityColor, getSeverityLabel } from '../utils';
import Timeline from '../components/Timeline';
import ApiResponseAlert from '../components/ApiResponseAlert';
import { ArrowLeft, Play, RefreshCw, CheckCircle, XCircle, Upload, Download, Edit } from 'lucide-react';

const VersionDetail: React.FC = () => {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [securityScans, setSecurityScans] = useState<SecurityScan[]>([]);
  const [reviews, setReviews] = useState<ReviewOpinion[]>([]);
  const [alert, setAlert] = useState<{ status: ApiResponseStatus; message: string; retryAfter?: number } | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ReviewOpinion | null>(null);
  const [reviewForm, setReviewForm] = useState({ result: ReviewResult.APPROVED, comment: '' });
  const [correctionForm, setCorrectionForm] = useState({ revisedComment: '', justification: '' });
  const [permissions, setPermissions] = useState<PermissionDeclaration[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!versionId) return;
      
      try {
        const res = await versionApi.getById(versionId);
        if (res.data) {
          setVersion(res.data.version);
          setTimeline(res.data.timeline || []);
          setSecurityScans(res.data.securityScans || []);
          setReviews(res.data.reviewOpinions || []);
          setPermissions(res.data.version?.permissionDeclarations || []);
        }
      } catch (error) {
        setAlert({
          status: ApiResponseStatus.BLOCKED,
          message: '加载版本详情失败',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [versionId]);

  const handleSubmit = async () => {
    if (!versionId) return;
    try {
      const res = await versionApi.submit(versionId, 'admin');
      setAlert({ status: res.status, message: res.message });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setAlert({ status: ApiResponseStatus.BLOCKED, message: '提交失败' });
    }
  };

  const handleRetryScan = async () => {
    if (!versionId) return;
    try {
      const res = await versionApi.retryScan(versionId, 'admin');
      setAlert({ status: res.status, message: res.message, retryAfter: res.retryAfter });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setAlert({ status: ApiResponseStatus.BLOCKED, message: '重试扫描失败' });
    }
  };

  const handleReview = async () => {
    if (!versionId) return;
    try {
      const res = await versionApi.review(versionId, {
        reviewerId: 'reviewer_001',
        reviewerName: '审核员',
        ...reviewForm,
        actor: 'admin',
      });
      setAlert({ status: res.status, message: res.message });
      setShowReviewModal(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setAlert({ status: ApiResponseStatus.BLOCKED, message: '审核失败' });
    }
  };

  const handleRecheck = async () => {
    if (!versionId) return;
    try {
      const res = await versionApi.recheck(versionId, 'admin');
      setAlert({ status: res.status, message: res.message });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setAlert({ status: ApiResponseStatus.BLOCKED, message: '提交复核失败' });
    }
  };

  const handlePublish = async () => {
    if (!versionId) return;
    try {
      const res = await versionApi.publish(versionId, 'admin');
      setAlert({ status: res.status, message: res.message });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setAlert({ status: ApiResponseStatus.BLOCKED, message: '上架失败' });
    }
  };

  const handleUnpublish = async () => {
    if (!versionId) return;
    const reason = prompt('请输入下架原因：');
    if (!reason) return;
    
    try {
      const res = await versionApi.unpublish(versionId, 'admin', reason);
      setAlert({ status: res.status, message: res.message });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setAlert({ status: ApiResponseStatus.BLOCKED, message: '下架失败' });
    }
  };

  const handleCorrectReview = async () => {
    if (!selectedReview || !versionId) return;
    try {
      const res = await reviewOpinionApi.correct(selectedReview.id, {
        ...correctionForm,
        revisedBy: 'admin',
        versionId,
      });
      setAlert({ status: res.status, message: res.message });
      setShowCorrectionModal(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setAlert({ status: ApiResponseStatus.BLOCKED, message: '修正失败' });
    }
  };

  const handleUpdatePermissions = async () => {
    if (!versionId) return;
    try {
      const res = await versionApi.updatePermissions(versionId, permissions, 'admin');
      setAlert({ status: res.status, message: res.message });
      setShowPermissionModal(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setAlert({ status: ApiResponseStatus.BLOCKED, message: '更新权限失败' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-gray-500 mb-4">版本不存在</div>
        <button
          onClick={() => navigate('/versions')}
          className="text-blue-600 hover:text-blue-700"
        >
          返回版本列表
        </button>
      </div>
    );
  }

  const canSubmit = version.status === PluginVersionStatus.DRAFT;
  const canRetryScan = version.status === PluginVersionStatus.SECURITY_FAILED && version.retryCount < version.maxRetries;
  const canReview = version.status === PluginVersionStatus.PENDING_REVIEW;
  const canRecheck = version.status === PluginVersionStatus.REVIEW_APPROVED || version.status === PluginVersionStatus.REVIEW_REJECTED;
  const canPublish = version.status === PluginVersionStatus.REVIEW_APPROVED || version.status === PluginVersionStatus.PENDING_RECHECK;
  const canUnpublish = version.status === PluginVersionStatus.PUBLISHED;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/versions')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          返回版本列表
        </button>
      </div>

      {alert && (
        <ApiResponseAlert
          status={alert.status}
          message={alert.message}
          retryAfter={alert.retryAfter}
          onClose={() => setAlert(null)}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {version.pluginName || '未知插件'} <span className="font-mono text-gray-500">v{version.version}</span>
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              提交者: {version.submittedBy} · 提交时间: {formatDate(version.submittedAt)}
            </p>
          </div>
          <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${getStatusColor(version.status)}`}>
            {getStatusLabel(version.status)}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {canSubmit && (
            <button
              onClick={handleSubmit}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Play className="w-4 h-4 mr-2" />
              提交审核
            </button>
          )}
          {canRetryScan && (
            <button
              onClick={handleRetryScan}
              className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重试扫描 ({version.retryCount}/{version.maxRetries})
            </button>
          )}
          {canReview && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              审核处理
            </button>
          )}
          {canRecheck && (
            <button
              onClick={handleRecheck}
              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              提交复核
            </button>
          )}
          {canPublish && (
            <button
              onClick={handlePublish}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              上架
            </button>
          )}
          {canUnpublish && (
            <button
              onClick={handleUnpublish}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              下架
            </button>
          )}
          {canUnpublish && (
            <button
              onClick={() => setShowPermissionModal(true)}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Edit className="w-4 h-4 mr-2" />
              修改权限
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">权限声明</h3>
          {permissions.length === 0 ? (
            <p className="text-gray-500">暂无权限声明</p>
          ) : (
            <div className="space-y-3">
              {permissions.map((perm) => (
                <div key={perm.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{perm.name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${perm.required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {perm.required ? '必需' : '可选'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{perm.description}</p>
                  <p className="mt-1 text-xs text-gray-500">作用域: {perm.scope}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">安全扫描记录</h3>
          {securityScans.length === 0 ? (
            <p className="text-gray-500">暂无扫描记录</p>
          ) : (
            <div className="space-y-4">
              {securityScans.map((scan) => (
                <div key={scan.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      scan.status === 'passed' ? 'bg-green-100 text-green-700' :
                      scan.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {scan.status === 'passed' ? '通过' : scan.status === 'failed' ? '未通过' : '扫描中'}
                    </span>
                    <span className="text-xs text-gray-500">扫描器 v{scan.scannerVersion}</span>
                  </div>
                  {scan.findings.length > 0 && (
                    <div className="space-y-2">
                      {scan.findings.map((finding) => (
                        <div key={finding.id} className="p-2 bg-gray-50 rounded text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getSeverityColor(finding.severity)}`}>
                              {getSeverityLabel(finding.severity)}
                            </span>
                            <span className="font-medium text-gray-900">{finding.type}</span>
                          </div>
                          <p className="mt-1 text-gray-600">{finding.description}</p>
                          {finding.location && (
                            <p className="mt-1 text-xs text-gray-500 font-mono">{finding.location}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-gray-500">
                    扫描时间: {formatDate(scan.startedAt)}
                    {scan.completedAt && ` · 完成时间: ${formatDate(scan.completedAt)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">审核意见</h3>
          {reviews.length === 0 ? (
            <p className="text-gray-500">暂无审核意见</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        review.result === ReviewResult.APPROVED ? 'bg-green-100 text-green-700' :
                        review.result === ReviewResult.REJECTED ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {review.result === ReviewResult.APPROVED ? '通过' :
                         review.result === ReviewResult.REJECTED ? '驳回' : '需修改'}
                      </span>
                      <span className="font-medium text-gray-900">{review.reviewerName}</span>
                      <span className="text-sm text-gray-500">{formatDate(review.createdAt)}</span>
                    </div>
                    {review.result !== ReviewResult.APPROVED && !review.correctionPath && (
                      <button
                        onClick={() => {
                          setSelectedReview(review);
                          setShowCorrectionModal(true);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" />
                        修正意见
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-gray-700">{review.comment}</p>
                  {review.correctionPath && (
                    <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-800">已修正</span>
                        <span className="text-xs text-orange-600">
                          由 {review.correctionPath.revisedBy} 在 {formatDate(review.correctionPath.revisedAt)}
                        </span>
                      </div>
                      <p className="text-sm text-orange-700">
                        <strong>修正理由:</strong> {review.correctionPath.justification}
                      </p>
                      <p className="text-sm text-orange-700 mt-1">
                        <strong>修正后意见:</strong> {review.correctionPath.revisedComment}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <Timeline events={timeline} />
        </div>
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">审核处理</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">审核结果</label>
                <select
                  value={reviewForm.result}
                  onChange={(e) => setReviewForm({ ...reviewForm, result: e.target.value as ReviewResult })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={ReviewResult.APPROVED}>通过</option>
                  <option value={ReviewResult.REJECTED}>驳回</option>
                  <option value={ReviewResult.NEEDS_REVISION}>需修改</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">审核意见</label>
                <textarea
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="请输入审核意见..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReview}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                确认审核
              </button>
            </div>
          </div>
        </div>
      )}

      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">修正审核意见</h3>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">原审核意见:</p>
                <p className="text-gray-700 mt-1">{selectedReview?.comment}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">修正理由</label>
                <textarea
                  value={correctionForm.justification}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, justification: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="请说明修正理由..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">修正后意见</label>
                <textarea
                  value={correctionForm.revisedComment}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, revisedComment: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="请输入修正后的审核意见..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCorrectReview}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                确认修正
              </button>
            </div>
          </div>
        </div>
      )}

      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">修改权限声明</h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                修改权限后将自动进入复核流程，需要重新审核才能上架。
              </p>
              {permissions.map((perm, index) => (
                <div key={perm.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">权限名称</label>
                      <input
                        type="text"
                        value={perm.name}
                        onChange={(e) => {
                          const newPerms = [...permissions];
                          newPerms[index] = { ...perm, name: e.target.value };
                          setPermissions(newPerms);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">作用域</label>
                      <input
                        type="text"
                        value={perm.scope}
                        onChange={(e) => {
                          const newPerms = [...permissions];
                          newPerms[index] = { ...perm, scope: e.target.value };
                          setPermissions(newPerms);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <input
                      type="text"
                      value={perm.description}
                      onChange={(e) => {
                        const newPerms = [...permissions];
                        newPerms[index] = { ...perm, description: e.target.value };
                        setPermissions(newPerms);
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mt-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={perm.required}
                        onChange={(e) => {
                          const newPerms = [...permissions];
                          newPerms[index] = { ...perm, required: e.target.checked };
                          setPermissions(newPerms);
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">必需权限</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowPermissionModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUpdatePermissions}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionDetail;
