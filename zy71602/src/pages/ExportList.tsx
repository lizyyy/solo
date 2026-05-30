import React from 'react';
import { FileText, Download, Calendar, User, Hash } from 'lucide-react';
import { useLimitStore } from '../store/limitStore';
import { formatDateTime } from '../utils/format';

export const ExportList: React.FC = () => {
  const exportRecords = useLimitStore((state) => state.exportRecords);
  const getWalletLimitById = useLimitStore((state) => state.getWalletLimitById);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">报告导出记录</h1>
        <p className="text-slate-500 mt-1">所有复核报告的导出历史，支持内容溯源</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-600">共 {exportRecords.length} 条导出记录</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {exportRecords.map((record) => {
            const walletLimit = getWalletLimitById(record.walletLimitId);
            return (
              <div key={record.id} className="p-5 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={
                        record.format === 'xlsx'
                          ? 'bg-emerald-100 text-emerald-600'
                          : record.format === 'csv'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-slate-100 text-slate-600'
                      }
                    >
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{record.fileName}</div>
                      <div className="text-sm text-slate-500 mt-1">
                        {walletLimit?.walletName || '未知钱包'}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {record.operator}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateTime(record.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {record.contentHash}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        'px-2.5 py-1 text-xs font-medium rounded ' +
                        (record.format === 'xlsx'
                          ? 'bg-emerald-100 text-emerald-700'
                          : record.format === 'csv'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-700')
                      }
                    >
                      {record.format.toUpperCase()}
                    </span>
                    <button
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="重新下载"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {exportRecords.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600 font-medium">暂无导出记录</p>
              <p className="text-sm mt-1">在限额详情页可以导出复核报告</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-sky-50 border border-sky-200 rounded-xl p-5">
        <h3 className="font-semibold text-sky-900 mb-2">关于内容哈希</h3>
        <p className="text-sm text-sky-700">
          每条导出记录都包含一个内容哈希值，用于验证报告内容的完整性。哈希值由报告内容生成，
          任何内容的修改都会导致哈希值变化。这确保了导出的报告可以被追溯和验证，防止数据篡改。
        </p>
      </div>
    </div>
  );
};
