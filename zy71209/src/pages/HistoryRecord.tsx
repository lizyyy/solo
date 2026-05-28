import { useState, useMemo } from 'react';
import { Header } from '../components/layout/Header';
import { Container } from '../components/layout/Container';
import { Search, Filter, History, ArrowRightLeft, DollarSign, Clock, FileText, Upload, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { OperationType } from '../types';

const operationTypeLabels: Record<OperationType, { label: string; icon: JSX.Element; color: string }> = {
  status_update: { label: '状态变更', icon: <ArrowRightLeft className="w-4 h-4" />, color: 'bg-blue-100 text-blue-600' },
  supplement: { label: '补仓操作', icon: <DollarSign className="w-4 h-4" />, color: 'bg-green-100 text-green-600' },
  extension: { label: '展期操作', icon: <Clock className="w-4 h-4" />, color: 'bg-purple-100 text-purple-600' },
  disposal: { label: '处置操作', icon: <FileText className="w-4 h-4" />, color: 'bg-red-100 text-red-600' },
  import: { label: '数据导入', icon: <Upload className="w-4 h-4" />, color: 'bg-gray-100 text-gray-600' },
};

export default function HistoryRecord() {
  const { history, pledges, customers } = useAppStore();
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('');

  const filteredHistory = useMemo(() => {
    return history
      .filter((record) => {
        if (filterType && record.operationType !== filterType) {
          return false;
        }

        if (searchText) {
          const searchLower = searchText.toLowerCase();
          const pledge = pledges.find((p) => p.id === record.pledgeId);
          const customer = customers.find((c) => c.id === pledge?.customerId);

          const matchesSearch =
            customer?.customerName.toLowerCase().includes(searchLower) ||
            customer?.accountNo.toLowerCase().includes(searchLower) ||
            pledge?.stockName.toLowerCase().includes(searchLower) ||
            pledge?.stockCode.toLowerCase().includes(searchLower) ||
            record.fieldName.toLowerCase().includes(searchLower) ||
            record.beforeValue.toLowerCase().includes(searchLower) ||
            record.afterValue.toLowerCase().includes(searchLower) ||
            record.operator.toLowerCase().includes(searchLower);

          if (!matchesSearch) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime());
  }, [history, pledges, customers, searchText, filterType]);

  const getRecordInfo = (pledgeId: string) => {
    const pledge = pledges.find((p) => p.id === pledgeId);
    const customer = customers.find((c) => c.id === pledge?.customerId);
    return { pledge, customer };
  };

  const handleReset = () => {
    setSearchText('');
    setFilterType('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activePage="history" />

      <Container>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1e3a5f]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            历史记录
          </h1>
          <p className="text-gray-600 mt-1">
            查看所有操作的历史记录，包括状态变更、补仓、展期、处置和数据导入
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索客户、股票、操作字段或操作人"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] text-sm"
              >
                <option value="">全部操作类型</option>
                {Object.entries(operationTypeLabels).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              重置筛选
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(operationTypeLabels).map(([key, value]) => {
              const count = history.filter((h) => h.operationType === key).length;
              return (
                <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-10 h-10 rounded-lg ${value.color} flex items-center justify-center`}>
                    {value.icon}
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                    <div className="text-xs text-gray-500">{value.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无符合条件的历史记录</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredHistory.slice(0, 100).map((record) => {
                const { pledge, customer } = getRecordInfo(record.pledgeId);
                const typeConfig = operationTypeLabels[record.operationType];

                return (
                  <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg ${typeConfig.color} flex items-center justify-center flex-shrink-0`}>
                        {typeConfig.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">
                                {typeConfig.label}
                              </span>
                              {customer && pledge && (
                                <span className="text-sm text-gray-500">
                                  {customer.customerName} ({pledge.stockName})
                                </span>
                              )}
                              {record.operationType === 'import' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                                  <AlertTriangle className="w-3 h-3" />
                                  系统操作
                                </span>
                              )}
                            </div>

                            <div className="text-sm text-gray-600">
                              <span className="text-gray-500">{record.fieldName}：</span>
                              <span className="text-red-600 line-through">{record.beforeValue}</span>
                              <span className="mx-2">→</span>
                              <span className="text-green-600">{record.afterValue}</span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="text-sm text-gray-500">
                              {new Date(record.operateTime).toLocaleString('zh-CN')}
                            </div>
                            <div className="text-xs text-gray-400">
                              操作人：{record.operator}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredHistory.length > 100 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
              显示前 100 条记录，共 {filteredHistory.length} 条
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
