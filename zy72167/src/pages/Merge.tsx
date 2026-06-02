import { useState } from 'react';
import { useCarbonStore } from '@/store/carbonStore';
import {
  Merge,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Scissors,
  RefreshCw,
  MapPin,
  Target,
  Hash,
  Globe,
} from 'lucide-react';
import SourceBadge from '@/components/common/SourceBadge';
import StatusBadge from '@/components/common/StatusBadge';

export default function MergePage() {
  const { mergeGroups, getGroupRecords, confirmGroup, rejectGroup, splitGroup, runMerge } = useCarbonStore();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const toggleExpand = (groupId: string) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  const handleConfirm = (groupId: string) => {
    confirmGroup(groupId);
  };

  const handleReject = (groupId: string) => {
    if (rejectReason.trim()) {
      rejectGroup(groupId, rejectReason);
      setRejectReason('');
      setShowRejectModal(null);
    } else {
      alert('请填写驳回原因');
    }
  };

  const handleSplit = (groupId: string) => {
    if (window.confirm('确定要拆分此归并组吗？拆分后各记录将作为独立点位处理。')) {
      splitGroup(groupId);
    }
  };

  const handleRunMerge = () => {
    setMerging(true);
    setTimeout(() => {
      runMerge();
      setMerging(false);
    }, 800);
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: '待确认', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    confirmed: { label: '已确认', color: 'bg-green-100 text-green-700 border-green-200' },
    needs_review: { label: '需人工确认', color: 'bg-warn-100 text-warn-700 border-warn-200' },
    rejected: { label: '已驳回', color: 'bg-red-100 text-red-700 border-red-200' },
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 70) return 'bg-warn-500';
    return 'bg-orange-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg font-semibold text-gray-800 mb-1">点位归并管理</h3>
          <p className="text-sm text-gray-500">
            系统自动识别同点异名记录，您可以确认、驳回或拆分归并结果
          </p>
        </div>
        <button
          onClick={handleRunMerge}
          disabled={merging}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${merging ? 'animate-spin' : ''}`} />
          {merging ? '重新归并中...' : '重新执行归并'}
        </button>
      </div>

      {mergeGroups.length === 0 ? (
        <div className="card p-12 text-center">
          <Merge className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h4 className="text-lg font-medium text-gray-600 mb-2">暂无归并组</h4>
          <p className="text-gray-500">导入数据后系统会自动执行点位归并匹配</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mergeGroups.map((group, groupIndex) => {
            const groupRecords = getGroupRecords(group.id);
            const isExpanded = expandedGroup === group.id;
            const status = statusLabels[group.status];
            
            return (
              <div
                key={group.id}
                className="card overflow-hidden animate-scale-in"
                style={{ animationDelay: `${groupIndex * 80}ms` }}
              >
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(group.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-gray-800 text-lg">
                          {group.canonicalName}
                        </h4>
                        <span className={`status-badge ${status.color}`}>
                          {status.label}
                        </span>
                        {group.mergedRecordIds.length > 2 && (
                          <span className="status-badge bg-gray-100 text-gray-600 border-gray-200">
                            {group.mergedRecordIds.length} 条记录
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{group.standardAddress}</p>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">总碳排放量</span>
                          <span className="font-semibold text-primary-600">
                            {group.totalCarbon.toFixed(1)} kgCO2e
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">匹配度</span>
                          <div className="w-32 progress-bar">
                            <div
                              className={`progress-fill ${getScoreColor(group.confidenceScore)}`}
                              style={{ width: `${group.confidenceScore}%` }}
                            />
                          </div>
                          <span className={`font-semibold ${
                            group.confidenceScore >= 85 ? 'text-green-600' :
                            group.confidenceScore >= 70 ? 'text-warn-600' : 'text-orange-600'
                          }`}>
                            {group.confidenceScore}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {group.status !== 'confirmed' && group.status !== 'rejected' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleConfirm(group.id); }}
                            className="btn-primary flex items-center gap-1 text-sm py-1.5 px-3"
                          >
                            <Check className="w-4 h-4" />
                            确认
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowRejectModal(group.id); }}
                            className="btn-danger flex items-center gap-1 text-sm py-1.5 px-3"
                          >
                            <X className="w-4 h-4" />
                            驳回
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSplit(group.id); }}
                            className="btn-secondary flex items-center gap-1 text-sm py-1.5 px-3"
                          >
                            <Scissors className="w-4 h-4" />
                            拆分
                          </button>
                        </>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-5">
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">归并判断依据</h5>
                      <div className="bg-white rounded-md border border-gray-200 p-4">
                        <p className="text-sm text-gray-700">{group.mergeReason}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-gray-700">归并记录明细</h5>
                      {group.matchDetails.map((detail, idx) => (
                        <div key={idx} className="bg-white rounded-md border border-gray-200 p-4">
                          <div className="grid grid-cols-2 gap-6 mb-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">记录 A</p>
                              <p className="font-medium text-gray-800">{detail.nameA}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">记录 B</p>
                              <p className="font-medium text-gray-800">{detail.nameB}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4">
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                                <Hash className="w-3 h-3" />
                                编辑距离
                              </div>
                              <div className="progress-bar mb-1">
                                <div
                                  className="progress-fill bg-blue-500"
                                  style={{ width: `${detail.editDistanceScore}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{detail.editDistanceScore}%</span>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                                <Globe className="w-3 h-3" />
                                拼音相似度
                              </div>
                              <div className="progress-bar mb-1">
                                <div
                                  className="progress-fill bg-purple-500"
                                  style={{ width: `${detail.pinyinScore}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{detail.pinyinScore}%</span>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                                <Target className="w-3 h-3" />
                                关键词匹配
                              </div>
                              <div className="progress-bar mb-1">
                                <div
                                  className="progress-fill bg-green-500"
                                  style={{ width: `${detail.keywordScore}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{detail.keywordScore}%</span>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                                <MapPin className="w-3 h-3" />
                                地理位置
                              </div>
                              <div className="progress-bar mb-1">
                                <div
                                  className="progress-fill bg-orange-500"
                                  style={{ width: `${detail.locationScore}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{detail.locationScore}%</span>
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">
                                综合得分：
                                <span className={`font-bold ml-1 ${
                                  detail.totalScore >= 85 ? 'text-green-600' :
                                  detail.totalScore >= 70 ? 'text-warn-600' : 'text-orange-600'
                                }`}>
                                  {detail.totalScore}%
                                </span>
                              </span>
                              <span className="text-sm text-gray-500">{detail.reason}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">原始记录</h5>
                      <div className="space-y-2">
                        {groupRecords.map((record) => (
                          <div key={record.id} className="bg-white rounded-md border border-gray-200 p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-gray-800">{record.pointName}</p>
                                <p className="text-sm text-gray-500 mt-1">{record.address}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <SourceBadge sourceType={record.sourceType} className="text-xs" />
                                  <StatusBadge status={record.status} className="text-xs" />
                                  <span className="text-sm text-primary-600 font-medium">
                                    {record.carbonAmount} {record.unit}
                                  </span>
                                </div>
                              </div>
                              {record.isOldCaliber && (
                                <span className="status-badge bg-orange-50 text-orange-700 border-orange-200 text-xs">
                                  旧口径
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md animate-scale-in">
            <h3 className="font-serif text-lg font-semibold text-gray-800 mb-4">驳回归并</h3>
            <p className="text-sm text-gray-600 mb-4">请填写驳回原因，该原因将记入审核痕迹</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入驳回原因..."
              className="input-field h-24 resize-none mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                className="btn-danger"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
