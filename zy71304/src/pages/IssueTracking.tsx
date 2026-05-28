import { useState } from 'react';
import { IssueTimeline } from '@/components/IssueTimeline';
import { usePrintStore } from '@/store/usePrintStore';
import { Search, Plus, Filter, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';
import type { IssueStatus, IssueType } from '@/types';

export default function IssueTracking() {
  const { currentBatch, issues, corrections, updateIssueStatus, confirmCorrection, currentUser } = usePrintStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all');

  const batchIssues = currentBatch
    ? issues.filter((i) => i.batchId === currentBatch.id)
    : issues;

  const filteredIssues = batchIssues.filter((issue) => {
    const matchesSearch = issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.discoveredBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    const matchesType = typeFilter === 'all' || issue.issueType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const issueTypeLabels: Record<IssueType, string> = {
    temp_diff_sign: '温差符号错误',
    material_missing: '材料参数缺失',
    unit_mixed: '单位混用',
    high_stress: '高应力区域',
    excessive_shrinkage: '过度收缩',
    cooling_issue: '冷却问题',
    bed_temp_issue: '床温问题',
    other: '其他问题',
  };

  const issueStatusLabels: Record<IssueStatus, string> = {
    discovered: '已发现',
    corrected: '已修正',
    confirmed: '已确认',
  };

  const getStatusIcon = (status: IssueStatus) => {
    switch (status) {
      case 'discovered':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'corrected':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleConfirmCorrection = (issueId: string) => {
    const issue = issues.find((i) => i.id === issueId);
    if (issue?.correctionId) {
      confirmCorrection(issue.correctionId, 'pass', currentUser);
    }
  };

  const getIssueCorrection = (issueId: string) => {
    const issue = issues.find((i) => i.id === issueId);
    if (issue?.correctionId) {
      return corrections.find((c) => c.id === issue.correctionId);
    }
    return null;
  };

  if (!currentBatch) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">🔍</div>
          <div className="text-xl mb-2">请先选择或创建一个批次</div>
          <div className="text-sm">前往参数录入页面开始分析</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">问题追踪</h2>
          <p className="text-sm text-gray-400">批次 #{currentBatch.id.slice(-6)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            共 {batchIssues.length} 个问题，
            <span className="text-green-400">
              {batchIssues.filter((i) => i.status === 'confirmed').length} 已确认
            </span>
            ，
            <span className="text-red-400">
              {batchIssues.filter((i) => i.status === 'discovered').length} 待处理
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索问题..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IssueStatus | 'all')}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="discovered">已发现</option>
            <option value="corrected">已修正</option>
            <option value="confirmed">已确认</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as IssueType | 'all')}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="temp_diff_sign">温差符号错误</option>
            <option value="material_missing">材料参数缺失</option>
            <option value="unit_mixed">单位混用</option>
            <option value="high_stress">高应力区域</option>
            <option value="other">其他问题</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">问题列表</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredIssues.map((issue) => {
              const correction = getIssueCorrection(issue.id);
              return (
                <div
                  key={issue.id}
                  className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(issue.status)}
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-gray-300">
                        {issueTypeLabels[issue.issueType]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-gray-400">
                        {issueStatusLabels[issue.status]}
                      </span>
                    </div>
                    {issue.status === 'corrected' && (
                      <button
                        onClick={() => handleConfirmCorrection(issue.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" />
                        确认
                      </button>
                    )}
                  </div>

                  <div className="text-sm text-white mb-2">{issue.description}</div>

                  <div className="text-xs text-gray-500">
                    发现人: {issue.discoveredBy} | {new Date(issue.discoveredAt).toLocaleString()}
                  </div>

                  {correction && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="text-xs text-blue-400 mb-1">修正方案:</div>
                      <div className="text-xs text-gray-400">{correction.suggestion}</div>
                      {correction.adjustedParams && (
                        <div className="mt-2 text-xs text-gray-500">
                          参数调整: {Object.entries(correction.adjustedParams).map(([k, v]) => `${k}=${v}`).join(', ')}
                        </div>
                      )}
                      {correction.confirmedBy && (
                        <div className="mt-2 text-xs text-green-400">
                          确认人: {correction.confirmedBy} | {new Date(correction.confirmedAt || '').toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredIssues.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <div className="text-4xl mb-2">📝</div>
                <div>暂无问题记录</div>
                <div className="text-sm">运行分析后系统将自动检测问题</div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">追踪时间线</h3>
          <IssueTimeline issues={filteredIssues} corrections={corrections} />
        </div>
      </div>
    </div>
  );
}
