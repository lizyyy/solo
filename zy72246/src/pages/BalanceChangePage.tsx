import { useState, useMemo, useCallback } from 'react';
import {
  DollarSign,
  Download,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store';
import { BalanceChangeRecord, ProcessingStatus } from '@/types';

type ChangeTypeFilter = 'ALL' | BalanceChangeRecord['changeType'];
type SortField = 'changeDate' | 'changeAmount' | 'newBalance' | 'version';
type SortOrder = 'asc' | 'desc';

const changeTypeConfig: Record<BalanceChangeRecord['changeType'], { label: string; color: string }> = {
  TAX: { label: '税费', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  ADJUSTMENT: { label: '调整', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  REVERSAL: { label: '冲正', color: 'bg-red-100 text-red-800 border-red-300' },
  HOLIDAY: { label: '假期', color: 'bg-purple-100 text-purple-800 border-purple-300' },
};

export default function BalanceChangePage() {
  const { balanceChanges, taxNotes } = useAppStore();
  const [typeFilter, setTypeFilter] = useState<ChangeTypeFilter>('ALL');
  const [keyword, setKeyword] = useState('');
  const [sortField, setSortField] = useState<SortField>('changeDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const getTaxNote = useCallback(
    (taxNoteId: string) => taxNotes.find((n) => n.id === taxNoteId),
    [taxNotes],
  );

  const filteredRecords = useMemo(() => {
    let records = [...balanceChanges];

    if (typeFilter !== 'ALL') {
      records = records.filter((r) => r.changeType === typeFilter);
    }

    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      records = records.filter((r) => {
        const note = getTaxNote(r.taxNoteId);
        return (
          r.id.toLowerCase().includes(kw) ||
          r.remark.toLowerCase().includes(kw) ||
          r.generatedBy.toLowerCase().includes(kw) ||
          (note?.stockCode.toLowerCase().includes(kw) ?? false) ||
          (note?.stockName.toLowerCase().includes(kw) ?? false) ||
          (note?.tradeDate.includes(kw) ?? false)
        );
      });
    }

    records.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'changeDate':
          cmp = new Date(a.changeDate).getTime() - new Date(b.changeDate).getTime();
          break;
        case 'changeAmount':
          cmp = a.changeAmount - b.changeAmount;
          break;
        case 'newBalance':
          cmp = a.newBalance - b.newBalance;
          break;
        case 'version':
          cmp = a.version - b.version;
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return records;
  }, [balanceChanges, typeFilter, keyword, sortField, sortOrder, getTaxNote]);

  const summaryStats = useMemo(() => {
    const total = balanceChanges.length;
    const totalAmount = balanceChanges.reduce((sum, r) => sum + r.changeAmount, 0);
    const byType = {
      TAX: balanceChanges.filter((r) => r.changeType === 'TAX').length,
      ADJUSTMENT: balanceChanges.filter((r) => r.changeType === 'ADJUSTMENT').length,
      REVERSAL: balanceChanges.filter((r) => r.changeType === 'REVERSAL').length,
      HOLIDAY: balanceChanges.filter((r) => r.changeType === 'HOLIDAY').length,
    };
    return { total, totalAmount, byType };
  }, [balanceChanges]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('desc');
      }
    },
    [sortField],
  );

  const handleExportCSV = useCallback(() => {
    const headers = [
      '记录ID',
      '证券代码',
      '证券名称',
      '交易日期',
      '变更前余额',
      '变更金额',
      '变更后余额',
      '变更类型',
      '变更日期',
      '备注',
      '生成人',
      '生成时间',
      '版本号',
    ];

    const rows = balanceChanges.map((r) => {
      const note = getTaxNote(r.taxNoteId);
      return [
        r.id,
        note?.stockCode ?? '',
        note?.stockName ?? '',
        note?.tradeDate ?? '',
        r.previousBalance.toFixed(2),
        r.changeAmount.toFixed(2),
        r.newBalance.toFixed(2),
        changeTypeConfig[r.changeType].label,
        new Date(r.changeDate).toLocaleString('zh-CN'),
        r.remark,
        r.generatedBy,
        new Date(r.generatedAt).toLocaleString('zh-CN'),
        r.version.toString(),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '余额变更记录.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [balanceChanges, getTaxNote]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortOrder === 'asc' ? (
      <TrendingUp className="w-3 h-3 text-blue-600" />
    ) : (
      <TrendingDown className="w-3 h-3 text-blue-600" />
    );
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('zh-CN');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-2xl font-bold text-slate-800"
              style={{ fontFamily: "'Noto Serif SC', serif" }}
            >
              余额变更记录
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              查看所有税费率备注的余额变更历史，支持筛选与导出
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            <span>导出 CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">总变更次数</p>
                <p className="text-2xl font-bold text-slate-800">{summaryStats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">总变更金额</p>
                <p className="text-2xl font-bold text-slate-800">
                  HK$ {summaryStats.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Filter className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">类型分布</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                    税费 {summaryStats.byType.TAX}
                  </span>
                  <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                    调整 {summaryStats.byType.ADJUSTMENT}
                  </span>
                  <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                    冲正 {summaryStats.byType.REVERSAL}
                  </span>
                  <span className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                    假期 {summaryStats.byType.HOLIDAY}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <ArrowUpDown className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">当前筛选结果</p>
                <p className="text-2xl font-bold text-slate-800">{filteredRecords.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索证券代码、名称、交易日期、备注、生成人..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ChangeTypeFilter)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">全部类型</option>
                <option value="TAX">税费</option>
                <option value="ADJUSTMENT">调整</option>
                <option value="REVERSAL">冲正</option>
                <option value="HOLIDAY">假期</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">变更记录列表</h3>
            <span className="text-xs text-slate-500">
              共 {filteredRecords.length} 条记录
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    证券信息
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('changeAmount')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>变更前余额</span>
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('changeAmount')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>变更金额</span>
                      <SortIcon field="changeAmount" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('newBalance')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>变更后余额</span>
                      <SortIcon field="newBalance" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    变更类型
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('changeDate')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>变更日期</span>
                      <SortIcon field="changeDate" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    备注
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    生成人
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    生成时间
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('version')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>版本号</span>
                      <SortIcon field="version" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map((record) => {
                  const note = getTaxNote(record.taxNoteId);
                  const typeInfo = changeTypeConfig[record.changeType];
                  const isPositive = record.changeAmount >= 0;

                  return (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-mono text-slate-800">
                            {note?.stockCode ?? '-'}
                          </p>
                          <p className="text-sm text-slate-600">
                            {note?.stockName ?? '-'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {note?.tradeDate ?? '-'}
                          </p>
                          {note && (
                            <div className="mt-1">
                              <StatusBadge status={note.processingStatus} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">
                        HK$ {record.previousBalance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1">
                          {isPositive ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                          <span
                            className={`text-sm font-mono font-medium ${
                              isPositive ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {isPositive ? '+' : ''}HK$ {record.changeAmount.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">
                        HK$ {record.newBalance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${typeInfo.color}`}
                        >
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {formatDate(record.changeDate)}
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate"
                        title={record.remark}
                      >
                        {record.remark}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {record.generatedBy}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDate(record.generatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">
                          v{record.version}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      暂无余额变更记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
