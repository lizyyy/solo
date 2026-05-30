import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { exportSourcesCsv, exportVouchersCsv, downloadCsv } from '../utils/export';
import { SOURCE_TYPE_LABELS } from '../types';
import { FileText, Download, Clock, User, Tag, Info, AlertCircle } from 'lucide-react';

const DataSources: React.FC = () => {
  const { state } = useAppStore();
  const { sources, prospectuses, ledgers, vouchers } = state;

  const getSourceTypeIcon = (type: string) => {
    const colors: Record<string, string> = {
      prospectus: 'bg-blue-500',
      ledger: 'bg-purple-500',
      payment: 'bg-green-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getRecordCount = (sourceId: string) => {
    const prospectusCount = prospectuses.filter(p => p.sourceId === sourceId).length;
    const ledgerCount = ledgers.filter(l => l.sourceId === sourceId).length;
    const voucherCount = vouchers.filter(v => v.sourceId === sourceId).length;
    return { prospectusCount, ledgerCount, voucherCount };
  };

  const handleExportSources = () => {
    const content = exportSourcesCsv(sources);
    downloadCsv(content, '数据来源清单');
  };

  const handleExportVouchers = () => {
    const content = exportVouchersCsv(vouchers, sources);
    downloadCsv(content, '付款凭证明细');
  };

  const typeStats = {
    prospectus: sources.filter(s => s.type === 'prospectus').length,
    ledger: sources.filter(s => s.type === 'ledger').length,
    payment: sources.filter(s => s.type === 'payment').length
  };

  const recordStats = {
    prospectus: prospectuses.length,
    ledger: ledgers.length,
    payment: vouchers.length
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">募集说明书</p>
              <p className="text-2xl font-bold text-gray-800">{typeStats.prospectus} 份</p>
              <p className="text-xs text-gray-500">{recordStats.prospectus} 条记录</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">项目台账</p>
              <p className="text-2xl font-bold text-gray-800">{typeStats.ledger} 份</p>
              <p className="text-xs text-gray-500">{recordStats.ledger} 条记录</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">付款凭证</p>
              <p className="text-2xl font-bold text-gray-800">{typeStats.payment} 份</p>
              <p className="text-xs text-gray-500">{recordStats.payment} 条记录</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={handleExportSources}
          disabled={sources.length === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          导出来源清单
        </button>
        <button
          onClick={handleExportVouchers}
          disabled={vouchers.length === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          导出凭证明细
        </button>
      </div>

      {sources.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">暂无数据来源</h3>
          <p className="text-gray-500 mb-6">请先导入募集说明书、项目台账或付款凭证</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map(source => {
            const counts = getRecordCount(source.id);
            const totalRecords = counts.prospectusCount + counts.ledgerCount + counts.voucherCount;
            return (
              <div key={source.id} className="card">
                <div className="card-header flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 ${getSourceTypeIcon(source.type)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-800">{source.name}</h3>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                          {SOURCE_TYPE_LABELS[source.type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          版本 v{source.version}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {source.uploadUser}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(source.uploadDate).toLocaleString()}
                        </span>
                      </div>
                      {source.description && (
                        <p className="text-sm text-gray-600 mt-2 flex items-start gap-1">
                          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {source.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {counts.prospectusCount > 0 && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {counts.prospectusCount} 条募集记录
                      </span>
                    )}
                    {counts.ledgerCount > 0 && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                        {counts.ledgerCount} 条台账记录
                      </span>
                    )}
                    {counts.voucherCount > 0 && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                        {counts.voucherCount} 条凭证记录
                      </span>
                    )}
                  </div>
                </div>
                {totalRecords > 0 && (
                  <div className="card-body border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">数据预览（前5条）</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="table-header text-left">项目名称</th>
                            {source.type === 'prospectus' && (
                              <>
                                <th className="table-header text-left">债券代码</th>
                                <th className="table-header text-right">发行金额</th>
                                <th className="table-header text-left">用途分类</th>
                                <th className="table-header text-left">披露版本</th>
                              </>
                            )}
                            {source.type === 'ledger' && (
                              <>
                                <th className="table-header text-right">计划金额</th>
                                <th className="table-header text-right">实际金额</th>
                                <th className="table-header text-left">用途分类</th>
                                <th className="table-header text-right">进度</th>
                              </>
                            )}
                            {source.type === 'payment' && (
                              <>
                                <th className="table-header text-left">凭证号</th>
                                <th className="table-header text-right">金额</th>
                                <th className="table-header text-left">收款方</th>
                                <th className="table-header text-center">发票</th>
                                <th className="table-header text-center">审批</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {source.type === 'prospectus' && prospectuses
                            .filter(p => p.sourceId === source.id)
                            .slice(0, 5)
                            .map(p => (
                              <tr key={p.id}>
                                <td className="table-cell">{p.projectName}</td>
                                <td className="table-cell">{p.bondCode}</td>
                                <td className="table-cell text-right">{(p.issueAmount / 100000000).toFixed(2)}亿</td>
                                <td className="table-cell">{p.plannedCategory}</td>
                                <td className="table-cell">
                                  <span className={p.disclosureVersion !== 'v1.0' ? 'text-orange-600' : ''}>
                                    {p.disclosureVersion}
                                  </span>
                                </td>
                              </tr>
                            ))
                          }
                          {source.type === 'ledger' && ledgers
                            .filter(l => l.sourceId === source.id)
                            .slice(0, 5)
                            .map(l => (
                              <tr key={l.id}>
                                <td className="table-cell">{l.projectName}</td>
                                <td className="table-cell text-right">{(l.plannedAmount / 100000000).toFixed(2)}亿</td>
                                <td className="table-cell text-right">{(l.actualAmount / 100000000).toFixed(2)}亿</td>
                                <td className="table-cell">{l.category}</td>
                                <td className="table-cell text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: `${l.progress}%` }}
                                      />
                                    </div>
                                    {l.progress.toFixed(1)}%
                                  </div>
                                </td>
                              </tr>
                            ))
                          }
                          {source.type === 'payment' && vouchers
                            .filter(v => v.sourceId === source.id)
                            .slice(0, 5)
                            .map(v => (
                              <tr key={v.id}>
                                <td className="table-cell">{v.projectName}</td>
                                <td className="table-cell font-mono">{v.voucherNumber}</td>
                                <td className="table-cell text-right">{(v.amount / 10000).toFixed(2)}万</td>
                                <td className="table-cell max-w-[150px] truncate">{v.payee}</td>
                                <td className="table-cell text-center">
                                  {v.hasReceipt ? (
                                    <span className="text-green-600">✓</span>
                                  ) : (
                                    <span className="text-red-500">✗</span>
                                  )}
                                </td>
                                <td className="table-cell text-center">
                                  {v.hasApproval ? (
                                    <span className="text-green-600">✓</span>
                                  ) : (
                                    <span className="text-red-500">✗</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    </div>
                    {totalRecords > 5 && (
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        还有 {totalRecords - 5} 条记录未显示
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card bg-yellow-50 border-yellow-200">
        <div className="card-header border-yellow-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">版本管理说明</h3>
          </div>
        </div>
        <div className="card-body">
          <div className="text-sm text-yellow-700 space-y-2">
            <p>• 每次导入数据时，请填写版本号，便于后续追踪数据变更历史</p>
            <p>• 建议采用语义化版本号，如：v1.0（初始版本）、v1.1（补充数据）、v2.0（重大更新）</p>
            <p>• 同一来源文件的不同版本会独立保存，不会覆盖历史数据</p>
            <p>• 系统处理数据时会使用所有已导入的数据源，如遇数据冲突以最新版本为准</p>
            <p>• 请在说明中简要描述本次更新的内容，便于后续追溯</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataSources;
