import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { filterRecords, sortRecords, searchRecords, getRecordHistory } from '../utils/filter';
import { formatAmount } from '../utils/fundCategorization';
import { FundCategory, ApprovalStatus, APPROVAL_STATUS_LABELS, FundUsageRecord } from '../types';
import { Search, Filter, SortAsc, SortDesc, Eye, Check, X, AlertTriangle, Edit, History, ChevronDown, ChevronUp } from 'lucide-react';

const FundUsage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { fundUsages, discrepancies, processingHistory, filters } = state;

  const [searchKeyword, setSearchKeyword] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<keyof FundUsageRecord>('paymentDate');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FundUsageRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newCategory, setNewCategory] = useState<FundCategory>('清洁能源');
  const [editReason, setEditReason] = useState('');
  const [operator, setOperator] = useState('');

  const [localFilters, setLocalFilters] = useState({
    category: '' as FundCategory | '',
    approvalStatus: '' as ApprovalStatus | '',
    hasDiscrepancies: undefined as boolean | undefined,
    startDate: '',
    endDate: ''
  });

  const filteredRecords = useMemo(() => {
    let result = [...fundUsages];
    
    result = searchRecords(result, searchKeyword);
    
    result = filterRecords(result, {
      ...filters,
      category: localFilters.category || undefined,
      approvalStatus: localFilters.approvalStatus || undefined,
      hasDiscrepancies: localFilters.hasDiscrepancies,
      startDate: localFilters.startDate || undefined,
      endDate: localFilters.endDate || undefined
    }, discrepancies);
    
    result = sortRecords(result, sortBy, sortAsc);
    
    return result;
  }, [fundUsages, searchKeyword, localFilters, sortBy, sortAsc, filters, discrepancies]);

  const getStatusClass = (status: ApprovalStatus) => {
    const classes: Record<ApprovalStatus, string> = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
      needs_explanation: 'status-needs-explanation'
    };
    return classes[status];
  };

  const getRecordDiscrepancies = (recordId: string) => {
    return discrepancies.filter(d => d.recordId === recordId && !d.resolved);
  };

  const handleApprove = (record: FundUsageRecord) => {
    const op = operator || prompt('请输入操作人姓名:');
    if (!op) return;
    const comments = prompt('请输入审核意见（可选）:');
    dispatch({
      type: 'APPROVE_RECORD',
      payload: { recordId: record.id, operator: op, comments }
    });
  };

  const handleReject = (record: FundUsageRecord) => {
    const op = operator || prompt('请输入操作人姓名:');
    if (!op) return;
    const reason = prompt('请输入拒绝原因:');
    if (!reason) return;
    dispatch({
      type: 'REJECT_RECORD',
      payload: { recordId: record.id, operator: op, reason }
    });
  };

  const handleRequestExplanation = (record: FundUsageRecord) => {
    const op = operator || prompt('请输入操作人姓名:');
    if (!op) return;
    const reason = prompt('请输入要求解释的原因:');
    if (!reason) return;
    dispatch({
      type: 'REQUEST_EXPLANATION',
      payload: { recordId: record.id, operator: op, reason }
    });
  };

  const handleUpdateCategory = () => {
    if (!selectedRecord) return;
    if (!operator) {
      alert('请先输入操作人姓名');
      return;
    }
    if (!editReason.trim()) {
      alert('请输入修改原因');
      return;
    }
    dispatch({
      type: 'UPDATE_CATEGORY',
      payload: {
        recordId: selectedRecord.id,
        newCategory,
        operator,
        reason: editReason
      }
    });
    setShowEditModal(false);
    setEditReason('');
  };

  const recordHistory = selectedRecord
    ? getRecordHistory(selectedRecord.id, processingHistory)
    : [];

  const categories: FundCategory[] = ['清洁能源', '清洁交通', '可持续水资源管理', '废物处理', '绿色建筑', '生态保护', '其他'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索项目名称、债券代码、分类..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="input-field pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${
              showFilters ? 'bg-green-100 text-green-700' : ''
            }`}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>
          <button
            onClick={() => {
              setSortAsc(!sortAsc);
            }}
            className="btn-secondary flex items-center gap-2"
          >
            {sortAsc ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            排序
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as keyof FundUsageRecord)}
            className="select-field w-auto"
          >
            <option value="paymentDate">按支付日期</option>
            <option value="projectName">按项目名称</option>
            <option value="actualAmount">按实际金额</option>
            <option value="category">按分类</option>
            <option value="approvalStatus">按审核状态</option>
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="card p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用途分类</label>
              <select
                value={localFilters.category}
                onChange={(e) => setLocalFilters({ ...localFilters, category: e.target.value as FundCategory | '' })}
                className="select-field"
              >
                <option value="">全部</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">审核状态</label>
              <select
                value={localFilters.approvalStatus}
                onChange={(e) => setLocalFilters({ ...localFilters, approvalStatus: e.target.value as ApprovalStatus | '' })}
                className="select-field"
              >
                <option value="">全部</option>
                {Object.entries(APPROVAL_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">差异状态</label>
              <select
                value={localFilters.hasDiscrepancies === undefined ? '' : String(localFilters.hasDiscrepancies)}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  hasDiscrepancies: e.target.value === '' ? undefined : e.target.value === 'true'
                })}
                className="select-field"
              >
                <option value="">全部</option>
                <option value="true">有差异</option>
                <option value="false">无差异</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                type="date"
                value={localFilters.startDate}
                onChange={(e) => setLocalFilters({ ...localFilters, startDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                type="date"
                value={localFilters.endDate}
                onChange={(e) => setLocalFilters({ ...localFilters, endDate: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setLocalFilters({
                category: '',
                approvalStatus: '',
                hasDiscrepancies: undefined,
                startDate: '',
                endDate: ''
              })}
              className="btn-secondary text-sm"
            >
              重置筛选
            </button>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600">
        共 {filteredRecords.length} 条记录
        {searchKeyword && ` · 搜索: "${searchKeyword}"`}
      </div>

      {filteredRecords.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">暂无符合条件的记录</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="table-header text-left">项目名称</th>
                  <th className="table-header text-left">债券代码</th>
                  <th className="table-header text-left">用途分类</th>
                  <th className="table-header text-right">计划金额</th>
                  <th className="table-header text-right">实际金额</th>
                  <th className="table-header text-left">支付日期</th>
                  <th className="table-header text-left">披露版本</th>
                  <th className="table-header text-left">状态</th>
                  <th className="table-header text-left">差异</th>
                  <th className="table-header text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.map(record => {
                  const recordDiscrepancies = getRecordDiscrepancies(record.id);
                  const isExpanded = selectedRecord?.id === record.id;
                  return (
                    <React.Fragment key={record.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="table-cell font-medium">{record.projectName}</td>
                        <td className="table-cell">{record.bondCode}</td>
                        <td className="table-cell">
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                            {record.category}
                          </span>
                        </td>
                        <td className="table-cell text-right text-gray-500">{formatAmount(record.plannedAmount)}</td>
                        <td className="table-cell text-right font-medium">{formatAmount(record.actualAmount)}</td>
                        <td className="table-cell">{record.paymentDate || '-'}</td>
                        <td className="table-cell">
                          <span className={`text-xs ${
                            record.disclosureVersion !== 'v1.0' ? 'text-orange-600' : 'text-gray-600'
                          }`}>
                            {record.disclosureVersion}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={`status-badge ${getStatusClass(record.approvalStatus)}`}>
                            {APPROVAL_STATUS_LABELS[record.approvalStatus]}
                          </span>
                        </td>
                        <td className="table-cell">
                          {recordDiscrepancies.length > 0 ? (
                            <span className="flex items-center gap-1 text-orange-600">
                              <AlertTriangle className="w-4 h-4" />
                              {recordDiscrepancies.length} 项
                            </span>
                          ) : (
                            <span className="text-green-600">正常</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedRecord(isExpanded ? null : record)}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="查看详情"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRecord(record);
                                setNewCategory(record.category);
                                setShowEditModal(true);
                              }}
                              className="p-1 hover:bg-gray-100 rounded text-blue-600"
                              title="修改分类"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {record.approvalStatus !== 'approved' && (
                              <>
                                <button
                                  onClick={() => handleApprove(record)}
                                  className="p-1 hover:bg-gray-100 rounded text-green-600"
                                  title="审核通过"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(record)}
                                  className="p-1 hover:bg-gray-100 rounded text-red-600"
                                  title="拒绝"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {record.approvalStatus === 'pending' && (
                              <button
                                onClick={() => handleRequestExplanation(record)}
                                className="p-1 hover:bg-gray-100 rounded text-orange-600"
                                title="要求解释"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div>
                                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                  <Eye className="w-4 h-4" />
                                  详细信息
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">计划用途:</span>
                                    <span className="text-gray-700">{record.explanation || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">执行进度:</span>
                                    <span className="text-gray-700">
                                      {((record.actualAmount / record.plannedAmount) * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">披露版本:</span>
                                    <span className={record.disclosureVersion !== 'v1.0' ? 'text-orange-600' : 'text-gray-700'}>
                                      {record.disclosureVersion}
                                      {record.disclosureVersion !== 'v1.0' && ' (非最新版)'}
                                    </span>
                                  </div>
                                  {record.affectedResults && record.affectedResults.length > 0 && (
                                    <div className="mt-4">
                                      <span className="text-gray-500">影响结果:</span>
                                      <ul className="mt-2 space-y-1">
                                        {record.affectedResults.map((result, i) => (
                                          <li key={i} className="flex items-start gap-2 text-sm text-orange-700">
                                            <span className="text-orange-500 mt-1">•</span>
                                            {result}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  差异记录 ({recordDiscrepancies.length})
                                </h4>
                                {recordDiscrepancies.length === 0 ? (
                                  <p className="text-sm text-green-600">暂无未解决差异</p>
                                ) : (
                                  <div className="space-y-2">
                                    {recordDiscrepancies.map(d => (
                                      <div
                                        key={d.id}
                                        className={`p-3 rounded-md ${
                                          d.severity === 'high' ? 'severity-high' :
                                          d.severity === 'medium' ? 'severity-medium' : 'severity-low'
                                        }`}
                                      >
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-medium text-sm">{d.description}</span>
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            d.severity === 'high' ? 'bg-red-100 text-red-700' :
                                            d.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-blue-100 text-blue-700'
                                          }`}>
                                            {d.severity === 'high' ? '高' : d.severity === 'medium' ? '中' : '低'}
                                          </span>
                                        </div>
                                        {d.affectedResults.length > 0 && (
                                          <div className="text-xs text-gray-600 mt-2">
                                            <span className="font-medium">影响:</span>
                                            <ul className="mt-1 space-y-0.5">
                                              {d.affectedResults.slice(0, 3).map((r, i) => (
                                                <li key={i}>• {r}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {recordHistory.length > 0 && (
                                <div className="lg:col-span-2">
                                  <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                    <History className="w-4 h-4" />
                                    处理历史
                                  </h4>
                                  <div className="space-y-2">
                                    {recordHistory.map((h: any, i: number) => (
                                      <div key={i} className="flex items-start gap-3 text-sm p-3 bg-white rounded border border-gray-200">
                                        <div className="w-2 h-2 mt-2 rounded-full bg-green-500 flex-shrink-0"></div>
                                        <div className="flex-1">
                                          <div className="flex justify-between">
                                            <span className="font-medium">{h.action}</span>
                                            <span className="text-gray-500 text-xs">
                                              {new Date(h.timestamp).toLocaleString()}
                                            </span>
                                          </div>
                                          {h.oldValue && h.newValue && (
                                            <p className="text-gray-600 text-xs mt-1">
                                              {h.oldValue} → {h.newValue}
                                            </p>
                                          )}
                                          {h.reason && (
                                            <p className="text-gray-500 text-xs mt-1">原因: {h.reason}</p>
                                          )}
                                          <p className="text-gray-500 text-xs">操作人: {h.operator}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEditModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">修改用途分类</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  项目: {selectedRecord.projectName}
                </label>
                <p className="text-sm text-gray-500">
                  当前分类: {selectedRecord.category}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  新分类 *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as FundCategory)}
                  className="select-field"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  修改原因 *
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="请详细说明修改分类的原因..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditReason('');
                  }}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleUpdateCategory}
                  className="btn-primary"
                >
                  确认修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundUsage;
