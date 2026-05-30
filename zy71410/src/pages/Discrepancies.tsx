import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { DiscrepancyType, DISCREPANCY_TYPE_LABELS, Discrepancy } from '../types';
import { AlertTriangle, CheckCircle, Clock, Filter, Search, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

const Discrepancies: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { discrepancies, fundUsages } = state;

  const [filterType, setFilterType] = useState<DiscrepancyType | ''>('');
  const [filterSeverity, setFilterSeverity] = useState<'high' | 'medium' | 'low' | ''>('');
  const [filterResolved, setFilterResolved] = useState<'resolved' | 'unresolved' | ''>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [operator, setOperator] = useState('');
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({});

  const unresolvedCount = discrepancies.filter(d => !d.resolved).length;
  const highCount = discrepancies.filter(d => !d.resolved && d.severity === 'high').length;

  const filteredDiscrepancies = useMemo(() => {
    return discrepancies.filter(d => {
      if (filterType && d.type !== filterType) return false;
      if (filterSeverity && d.severity !== filterSeverity) return false;
      if (filterResolved === 'resolved' && !d.resolved) return false;
      if (filterResolved === 'unresolved' && d.resolved) return false;
      
      if (searchKeyword) {
        const record = fundUsages.find(r => r.id === d.recordId);
        const searchLower = searchKeyword.toLowerCase();
        return (
          d.description.toLowerCase().includes(searchLower) ||
          record?.projectName.toLowerCase().includes(searchLower) ||
          d.affectedResults.some(r => r.toLowerCase().includes(searchLower))
        );
      }
      
      return true;
    }).sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [discrepancies, filterType, filterSeverity, filterResolved, searchKeyword, fundUsages]);

  const getProjectName = (recordId: string) => {
    const record = fundUsages.find(r => r.id === recordId);
    return record?.projectName || '未知项目';
  };

  const handleResolve = (discrepancy: Discrepancy) => {
    const op = operator || prompt('请输入操作人姓名:');
    if (!op) return;
    const text = resolutionText[discrepancy.id] || '';
    if (!text.trim()) {
      alert('请输入解决方案');
      return;
    }
    dispatch({
      type: 'RESOLVE_DISCREPANCY',
      payload: {
        discrepancyId: discrepancy.id,
        resolution: text,
        operator: op
      }
    });
    setResolutionText(prev => ({ ...prev, [discrepancy.id]: '' }));
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return severity;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const types: DiscrepancyType[] = ['category_mismatch', 'voucher_gap', 'disclosure_version', 'amount_mismatch', 'date_mismatch'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待处理差异</p>
              <p className="text-2xl font-bold text-gray-800">{unresolvedCount}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">高风险</p>
              <p className="text-2xl font-bold text-gray-800">{highCount}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已解决</p>
              <p className="text-2xl font-bold text-gray-800">{discrepancies.filter(d => d.resolved).length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">总计</p>
              <p className="text-2xl font-bold text-gray-800">{discrepancies.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">操作人:</span>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="input-field w-24"
                  placeholder="姓名"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索项目或描述..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="input-field pl-9 w-64"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as DiscrepancyType | '')}
                className="select-field w-auto"
              >
                <option value="">全部类型</option>
                {types.map(t => (
                  <option key={t} value={t}>{DISCREPANCY_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as 'high' | 'medium' | 'low' | '')}
                className="select-field w-auto"
              >
                <option value="">全部严重程度</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
              <select
                value={filterResolved}
                onChange={(e) => setFilterResolved(e.target.value as 'resolved' | 'unresolved' | '')}
                className="select-field w-auto"
              >
                <option value="">全部状态</option>
                <option value="unresolved">待处理</option>
                <option value="resolved">已解决</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card-body">
          {filteredDiscrepancies.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
              <p className="text-gray-500">暂无符合条件的差异记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDiscrepancies.map(d => {
                const isExpanded = expandedId === d.id;
                return (
                  <div
                    key={d.id}
                    className={`p-4 rounded-lg border transition-all ${
                      d.resolved ? 'bg-gray-50 border-gray-200 opacity-75' :
                      d.severity === 'high' ? 'severity-high' :
                      d.severity === 'medium' ? 'severity-medium' : 'severity-low'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSeverityClass(d.severity)}`}>
                            {getSeverityLabel(d.severity)}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            {DISCREPANCY_TYPE_LABELS[d.type]}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            d.resolved ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {d.resolved ? '已解决' : '待处理'}
                          </span>
                        </div>
                        <p className="font-medium text-gray-800">{getProjectName(d.recordId)}</p>
                        <p className="text-sm text-gray-600 mt-1">{d.description}</p>
                        {d.expectedValue && d.actualValue && (
                          <p className="text-xs text-gray-500 mt-2">
                            期望值: <span className="font-medium">{d.expectedValue}</span>
                            {' → '}
                            实际值: <span className="font-medium text-orange-600">{d.actualValue}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : d.id)}
                          className="p-2 hover:bg-white hover:bg-opacity-50 rounded transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium text-gray-800 mb-3">影响结果分析</h4>
                            <div className="bg-white bg-opacity-50 rounded-lg p-4">
                              <ul className="space-y-2">
                                {d.affectedResults.map((result, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                      d.severity === 'high' ? 'bg-red-500' :
                                      d.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                    }`}></span>
                                    <span className="text-gray-700">{result}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {!d.resolved ? (
                            <div>
                              <h4 className="font-medium text-gray-800 mb-3">处理差异</h4>
                              <div className="space-y-3">
                                <textarea
                                  value={resolutionText[d.id] || ''}
                                  onChange={(e) => setResolutionText(prev => ({
                                    ...prev,
                                    [d.id]: e.target.value
                                  }))}
                                  className="input-field resize-none"
                                  rows={3}
                                  placeholder="请输入解决方案或说明..."
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleResolve(d)}
                                    className="btn-primary flex items-center gap-2"
                                  >
                                    <Check className="w-4 h-4" />
                                    标记为已解决
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <h4 className="font-medium text-gray-800 mb-3">解决方案</h4>
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p className="text-sm text-green-700">{d.resolution}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {d.fieldName && (
                          <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                            <p className="text-xs text-gray-500">
                              关联字段: {d.fieldName}
                              {d.recordId && ` · 记录ID: ${d.recordId}`}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold">差异类型说明</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">用途错类</h4>
              <p className="text-sm text-red-600">
                项目的实际用途分类与募集说明书或台账不一致。会影响资金用途归类结果，需要提供正式说明文件。
              </p>
            </div>
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h4 className="font-medium text-orange-800 mb-2">凭证缺口</h4>
              <p className="text-sm text-orange-600">
                缺少付款凭证、发票或审批文件。缺口部分无法证明合规性，需在15个工作日内补充。
              </p>
            </div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">披露口径问题</h4>
              <p className="text-sm text-yellow-600">
                使用旧版披露标准。需按最新目录重新核对，可能需要追溯调整历史披露数据。
              </p>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-2">金额不一致</h4>
              <p className="text-sm text-purple-600">
                募集说明书、台账、凭证之间的金额存在差异。需核对数据源，提供调整说明。
              </p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">日期不一致</h4>
              <p className="text-sm text-blue-600">
                实际支付日期晚于预计或计划日期。需评估对项目进度的影响，在披露中说明延期原因。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Discrepancies;
