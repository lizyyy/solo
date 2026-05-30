import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { formatAmount } from '../utils/fundCategorization';
import { groupRecordsByCategory, groupRecordsByStatus } from '../utils/filter';
import { APPROVAL_STATUS_LABELS, DISCREPANCY_TYPE_LABELS } from '../types';
import { TrendingUp, AlertCircle, CheckCircle, Clock, XCircle, FileText, DollarSign, PieChart } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { state } = useAppStore();
  const { fundUsages, discrepancies, sources } = state;

  const totalPlanned = fundUsages.reduce((sum, r) => sum + r.plannedAmount, 0);
  const totalActual = fundUsages.reduce((sum, r) => sum + r.actualAmount, 0);
  const unresolvedDiscrepancies = discrepancies.filter(d => !d.resolved);
  const byCategory = groupRecordsByCategory(fundUsages);
  const byStatus = groupRecordsByStatus(fundUsages);

  const discrepancyByType: Record<string, number> = {};
  unresolvedDiscrepancies.forEach(d => {
    discrepancyByType[d.type] = (discrepancyByType[d.type] || 0) + 1;
  });

  const stats = [
    {
      label: '项目总数',
      value: fundUsages.length,
      icon: FileText,
      color: 'bg-blue-500'
    },
    {
      label: '计划总金额',
      value: formatAmount(totalPlanned),
      icon: DollarSign,
      color: 'bg-green-500'
    },
    {
      label: '实际支出',
      value: formatAmount(totalActual),
      icon: TrendingUp,
      color: 'bg-purple-500'
    },
    {
      label: '待处理差异',
      value: unresolvedDiscrepancies.length,
      icon: AlertCircle,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="space-y-6">
      {fundUsages.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <FileText className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">暂无数据</h3>
          <p className="text-gray-500 mb-6">请先导入募集说明书、项目台账和付款凭证</p>
          <div className="space-y-2 text-sm text-gray-600">
            <p>1. 点击左侧"数据导入"菜单</p>
            <p>2. 或点击左下角"加载示例数据"快速体验</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  {stat.label === '实际支出' && (
                    <p className="text-xs text-gray-500 mt-2">
                      整体进度: {((totalActual / totalPlanned) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header flex items-center gap-2">
                <PieChart className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold">按用途分类</h3>
              </div>
              <div className="card-body">
                <div className="space-y-4">
                  {Object.entries(byCategory).map(([category, records]) => {
                    const planned = records.reduce((sum, r) => sum + r.plannedAmount, 0);
                    const actual = records.reduce((sum, r) => sum + r.actualAmount, 0);
                    const progress = (actual / planned) * 100;
                    return (
                      <div key={category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{category}</span>
                          <span className="text-gray-500">
                            {records.length} 个项目 · {formatAmount(actual)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>计划: {formatAmount(planned)}</span>
                          <span>{progress.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold">审核状态分布</h3>
              </div>
              <div className="card-body">
                <div className="space-y-3">
                  {Object.entries(byStatus).map(([status, records]) => {
                    const statusConfig: Record<string, { icon: any; class: string }> = {
                      pending: { icon: Clock, class: 'bg-yellow-100 text-yellow-700' },
                      approved: { icon: CheckCircle, class: 'bg-green-100 text-green-700' },
                      rejected: { icon: XCircle, class: 'bg-red-100 text-red-700' },
                      needs_explanation: { icon: AlertCircle, class: 'bg-orange-100 text-orange-700' }
                    };
                    const config = statusConfig[status];
                    const Icon = config.icon;
                    return (
                      <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${config.class} rounded-lg flex items-center justify-center`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-700">{APPROVAL_STATUS_LABELS[status as keyof typeof APPROVAL_STATUS_LABELS]}</p>
                            <p className="text-xs text-gray-500">{records.length} 个项目</p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-gray-800">
                          {formatAmount(records.reduce((sum, r) => sum + r.actualAmount, 0))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {unresolvedDiscrepancies.length > 0 && (
            <div className="card">
              <div className="card-header flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold">待处理差异概览</h3>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {Object.entries(discrepancyByType).map(([type, count]) => (
                    <div key={type} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{count}</p>
                      <p className="text-sm text-gray-600">
                        {DISCREPANCY_TYPE_LABELS[type as keyof typeof DISCREPANCY_TYPE_LABELS]}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">最新差异</h4>
                  <div className="space-y-2">
                    {unresolvedDiscrepancies.slice(0, 5).map(d => {
                      const record = fundUsages.find(r => r.id === d.recordId);
                      return (
                        <div
                          key={d.id}
                          className={`p-3 rounded-md border-l-4 ${
                            d.severity === 'high' ? 'severity-high' :
                            d.severity === 'medium' ? 'severity-medium' : 'severity-low'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-800">
                                {record?.projectName || '未知项目'}
                              </p>
                              <p className="text-sm text-gray-600">{d.description}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              d.severity === 'high' ? 'bg-red-100 text-red-700' :
                              d.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {d.severity === 'high' ? '高' : d.severity === 'medium' ? '中' : '低'}
                            </span>
                          </div>
                          {d.affectedResults.length > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              <span className="font-medium">影响结果：</span>
                              {d.affectedResults.slice(0, 2).join('；')}
                              {d.affectedResults.length > 2 && ` 等${d.affectedResults.length}项`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold">数据来源</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sources.map(source => (
                  <div key={source.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                        {source.type === 'prospectus' ? '募集说明书' :
                         source.type === 'ledger' ? '项目台账' : '付款凭证'}
                      </span>
                      <span className="text-xs text-gray-500">v{source.version}</span>
                    </div>
                    <p className="font-medium text-gray-800 text-sm mb-1 truncate">{source.name}</p>
                    <p className="text-xs text-gray-500">
                      上传人: {source.uploadUser} · {new Date(source.uploadDate).toLocaleDateString()}
                    </p>
                    {source.description && (
                      <p className="text-xs text-gray-500 mt-1">{source.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
