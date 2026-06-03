import React, { useState, useEffect } from 'react';
import { Scale, CheckCircle, Clock, User, AlertCircle, Info } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { weightApi } from '../api/weightApi';
import type { ScoreWeight } from '../../shared/types';
import dayjs from 'dayjs';

export const WeightsPage: React.FC = () => {
  const {
    currentUser,
    weights,
    setWeights,
    weightReviewInfo,
    setWeightReviewInfo,
    isWeightReviewed,
    setIsWeightReviewed,
    setLoading,
    setError,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<number>(0);
  const [remark, setRemark] = useState('');

  useEffect(() => {
    loadWeights();
  }, []);

  const loadWeights = async () => {
    try {
      setLoading(true);
      const res = await weightApi.getWeights();
      setWeights(res.data.weights);
      setWeightReviewInfo(res.data.reviewInfo);
      setIsWeightReviewed(res.data.isAllReviewed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (weight: ScoreWeight) => {
    if (isWeightReviewed) {
      alert('评分权重表已由吴老师补看完成，如需修改请联系教研组');
      return;
    }
    setEditingId(weight.id);
    setEditWeight(weight.weight);
  };

  const handleSaveWeight = async (id: string) => {
    try {
      setLoading(true);
      await weightApi.updateWeight(id, editWeight);
      setEditingId(null);
      await loadWeights();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsReviewed = async () => {
    if (!confirm('确认已补看完评分权重表？此操作将标记为已完成，后续不可修改权重值。')) {
      return;
    }
    try {
      setLoading(true);
      const res = await weightApi.markAsReviewed({
        operator: currentUser,
        remark: remark || undefined,
      });
      setWeights(res.data.weights);
      setWeightReviewInfo(res.data.reviewInfo);
      setIsWeightReviewed(res.data.isAllReviewed);
      alert('已标记为补看完成');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const totalIs100 = totalWeight === 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">评分权重表</h2>
          <p className="mt-1 text-sm text-gray-500">
            第二步：吴老师补看评分权重表，确认无误后标记为已补看
          </p>
        </div>
      </div>

      {isWeightReviewed && weightReviewInfo && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-green-800">评分权重表已补看完成</h4>
              <div className="mt-2 text-sm text-green-700 space-y-1">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  补看人：{weightReviewInfo.reviewedBy}
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  补看时间：{dayjs(weightReviewInfo.reviewedAt).format('YYYY年MM月DD日 HH:mm:ss')}
                </div>
                {weightReviewInfo.remark && (
                  <div className="flex items-start">
                    <Info className="w-4 h-4 mr-2 mt-0.5" />
                    备注：{weightReviewInfo.remark}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isWeightReviewed && (
        <div className="bg-warning-50 border-2 border-warning-400 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-warning-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-warning-800">待吴老师补看</h4>
              <p className="mt-1 text-sm text-warning-700">
                请核对各评分维度的权重值是否正确。权重总和应为100，核对无误后点击"已补看"按钮。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Scale className="w-5 h-5 text-gray-500 mr-2" />
              <h3 className="font-serif text-lg font-bold text-gray-900">评分维度权重配置</h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">权重总计：</span>
              <span className={`text-lg font-bold ${totalIs100 ? 'text-green-600' : 'text-red-600'}`}>
                {totalWeight}
              </span>
              {!totalIs100 && (
                <span className="text-xs text-red-600 ml-1">(应为100)</span>
              )}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {weights.map((weight) => (
            <div key={weight.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">{weight.dimension}</h4>
                    <div className="w-48 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${weight.weight}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{weight.description}</p>
                </div>
                <div className="flex items-center space-x-4">
                  {editingId === weight.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editWeight}
                        onChange={(e) => setEditWeight(parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-1 border border-gray-300 text-center focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      />
                      <span className="text-gray-500">%</span>
                      <button
                        onClick={() => handleSaveWeight(weight.id)}
                        className="px-3 py-1 bg-primary-500 text-white text-sm hover:bg-primary-600 transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <span className="text-2xl font-bold text-gray-900">{weight.weight}</span>
                      <span className="text-gray-500">%</span>
                      {!isWeightReviewed && (
                        <button
                          onClick={() => handleEdit(weight)}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          修改
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isWeightReviewed && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="font-serif text-lg font-bold text-gray-900 mb-4">补看确认</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                补看备注（可选）
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                placeholder="请输入补看备注，如：权重配置合理，符合教学要求..."
                className="w-full px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleMarkAsReviewed}
                disabled={!totalIs100}
                className={`inline-flex items-center px-6 py-2 font-medium transition-colors ${
                  !totalIs100
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-warning-500 text-white hover:bg-warning-600'
                }`}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                已补看，确认无误
              </button>
            </div>
            {!totalIs100 && (
              <p className="text-sm text-red-600 text-right">
                请先调整权重值，使总和等于100
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">评分权重说明</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>拣货距离：路径总长度，权重越高表示越优先选择短距离路径</li>
              <li>拣货时间：预计完成时间，权重越高表示越优先处理快单</li>
              <li>订单优先级：紧急订单优先处理，权重越高表示紧急订单越重要</li>
              <li>货区集中度：同一货区订单合并处理，权重越高表示越重视路径优化</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
