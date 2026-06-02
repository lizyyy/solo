import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Sample, ReviewDecision } from '../types';
import { sampleApi } from '../api/client';
import { formatDate, formatConfidence } from '../utils/format';
import StatusBadge from '../components/StatusBadge';
import IssueBadge from '../components/IssueBadge';
import EvidenceViewer from '../components/EvidenceViewer';
import ConflictPanel from '../components/ConflictPanel';
import ReviewHistory from '../components/ReviewHistory';
import ReviewForm from '../components/ReviewForm';

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sample, setSample] = useState<Sample | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'evidence' | 'history'>('evidence');
  const [error, setError] = useState<string | null>(null);

  const loadSample = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await sampleApi.getSampleById(id);
      setSample(data);
    } catch (err) {
      setError('样本不存在或已被删除');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  const handleReviewSubmit = async (data: {
    decision: ReviewDecision;
    evidence: string;
    comments?: string;
    reviewer: string;
  }) => {
    if (!sample) return;
    setSubmitting(true);
    try {
      const result = await sampleApi.reviewSample(sample.id, data);
      setSample(result.updatedSample);
      setShowReviewForm(false);
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveDuplicate = async (keepOriginal: boolean) => {
    if (!sample) return;
    try {
      await sampleApi.resolveDuplicate(sample.id, keepOriginal);
      if (keepOriginal) {
        navigate('/');
      } else {
        await loadSample();
      }
    } catch (err) {
      console.error('Failed to resolve duplicate:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !sample) {
    return (
      <div className="text-center py-20">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-600 mb-4">{error || '样本不存在'}</p>
        <Link to="/" className="btn-primary inline-block">
          返回列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">复核详情</h2>
            <p className="text-gray-500">样本ID: {sample.id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <StatusBadge status={sample.status} />
          <button
            onClick={() => setShowReviewForm(true)}
            className="btn-primary"
          >
            开始复核
          </button>
        </div>
      </div>

      {sample.isDuplicate && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="font-medium text-purple-900">此样本为重复样本</p>
                <p className="text-sm text-purple-700">
                  重复于: <Link to={`/sample/${sample.duplicateOf}`} className="underline">样本 {sample.duplicateOf}</Link>
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleResolveDuplicate(true)}
                className="btn-secondary text-sm"
              >
                保留原始，删除此条
              </button>
              <button
                onClick={() => handleResolveDuplicate(false)}
                className="btn-primary text-sm"
              >
                保留此条，合并历史
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">合同信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">合同编号</p>
                <p className="text-gray-900 font-medium">{sample.contractId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">合同名称</p>
                <p className="text-gray-900 font-medium">{sample.contractName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">条款类型</p>
                <p className="text-gray-900 font-medium">{sample.clauseType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">数据来源</p>
                <p className="text-gray-900 font-medium">
                  {sample.source === 'model' ? '模型输出' : 
                   sample.source === 'import' ? '导入数据' : '混合'}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-1">条款内容</p>
              <div className="p-4 bg-gray-50 rounded-lg text-gray-900">
                {sample.clauseContent}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-1">问题标记</p>
              <IssueBadge sample={sample} showAll />
            </div>
          </div>

          {sample.conflictInfo && (
            <ConflictPanel conflict={sample.conflictInfo} />
          )}

          <div className="card">
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('evidence')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 ${
                    activeTab === 'evidence'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  证据追溯
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 ${
                    activeTab === 'history'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  复核历史 ({sample.reviewHistory.length})
                </button>
              </nav>
            </div>
            <div className="p-6">
              {activeTab === 'evidence' ? (
                <EvidenceViewer
                  fullText={sample.fullContractText}
                  evidence={sample.modelEvidence}
                />
              ) : (
                <ReviewHistory history={sample.reviewHistory} />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">抽取结果对比</h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-700">模型输出</span>
                  {sample.modelLogId && (
                    <span className="text-xs text-blue-500">日志: {sample.modelLogId}</span>
                  )}
                </div>
                <p className="text-2xl font-mono font-bold text-blue-900">
                  {sample.modelExtraction ?? <span className="text-gray-400">空</span>}
                </p>
                <div className="mt-2 text-sm text-blue-700">
                  <div>置信度: {formatConfidence(sample.modelConfidence)}</div>
                  <div>阈值: {formatConfidence(sample.modelThreshold)}</div>
                  <div>版本: {sample.modelVersion || '-'}</div>
                </div>
              </div>

              <div className="flex justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-700">导入数据</span>
                  {sample.importedSource && (
                    <span className="text-xs text-green-500">来源: {sample.importedSource}</span>
                  )}
                </div>
                <p className="text-2xl font-mono font-bold text-green-900">
                  {sample.importedLabel ?? <span className="text-gray-400">空</span>}
                </p>
              </div>

              {sample.manualLabel && (
                <>
                  <div className="flex justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-red-700">人工改判</span>
                      {sample.manualLabeledBy && (
                        <span className="text-xs text-red-500">
                          {sample.manualLabeledBy} · {formatDate(sample.manualLabelTime!)}
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-mono font-bold text-red-900">
                      {sample.manualLabel}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">时间线</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">创建时间</span>
                <span className="text-gray-900">{formatDate(sample.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新时间</span>
                <span className="text-gray-900">{formatDate(sample.updatedAt)}</span>
              </div>
              {sample.reviewHistory.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">最后复核</span>
                  <span className="text-gray-900">{formatDate(sample.reviewHistory[0].timestamp)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showReviewForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">复核样本</h3>
              <button
                onClick={() => setShowReviewForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">条款内容</p>
              <p className="text-gray-900">{sample.clauseContent}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500">模型: </span>
                  <span className="font-mono font-medium text-blue-700">{sample.modelExtraction ?? '空'}</span>
                </div>
                <div>
                  <span className="text-gray-500">导入: </span>
                  <span className="font-mono font-medium text-green-700">{sample.importedLabel ?? '空'}</span>
                </div>
              </div>
            </div>

            <ReviewForm
              onSubmit={handleReviewSubmit}
              onCancel={() => setShowReviewForm(false)}
              isSubmitting={submitting}
            />
          </div>
        </div>
      )}
    </div>
  );
}
