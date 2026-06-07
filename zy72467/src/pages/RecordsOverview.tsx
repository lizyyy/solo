import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { StatusBadge, SourceBadge } from '@/components/StatusBadge';
import { ChevronDown, ChevronRight, Clock, User, Hash } from 'lucide-react';
import type { FinalRecord } from '../../shared/types';

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const RecordRow: React.FC<{ record: FinalRecord }> = ({ record }) => {
  const [expanded, setExpanded] = useState(false);

  const rowBgColor = 
    record.status === 'conflict' ? 'bg-red-50 hover:bg-red-100' :
    record.status === 'pending_review' ? 'bg-orange-50 hover:bg-orange-100' :
    'bg-white hover:bg-slate-50';

  return (
    <>
      <tr 
        className={`${rowBgColor} border-b border-slate-200 cursor-pointer transition-colors`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-1 text-slate-500">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span className="font-medium text-slate-800">{record.location}</span>
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex gap-1.5">
            <StatusBadge status={record.status} />
            <SourceBadge source={record.source} />
          </div>
        </td>
        <td className="px-4 py-3 align-top text-sm text-slate-600">
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
            <Hash className="w-3 h-3" />
            <span>原始行号：</span>
            {record.rampData && <span className="mr-2">坡道-{record.rampData.originalRowNumber}</span>}
            {record.samplingData && <span>采样点-{record.samplingData.originalRowNumber}</span>}
          </div>
          {record.residentOpinionSummary}
          {!record.hasOpinionOriginal && (
            <span className="ml-2 text-xs text-orange-600 font-medium">（无原文）</span>
          )}
        </td>
        <td className="px-4 py-3 align-top text-sm text-slate-600">
          <div className="flex items-center gap-1 text-xs">
            <User className="w-3 h-3" />
            <span>{record.modifiedBy}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <Clock className="w-3 h-3" />
            <span>{formatDate(record.lastModified)}</span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-200">
          <td colSpan={4} className="px-8 py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {record.rampData && (
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <h4 className="text-sm font-medium text-blue-700 mb-2">无障碍坡道数据</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>来源文件：{record.rampData.sourceFile}</p>
                      <p>有无坡道：{record.rampData.hasRamp ? '有' : '无'}</p>
                      <p>坡道状况：{record.rampData.rampCondition}</p>
                    </div>
                  </div>
                )}
                {record.samplingData && (
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <h4 className="text-sm font-medium text-purple-700 mb-2">夜间采样点数据</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>来源文件：{record.samplingData.sourceFile}</p>
                      <p>采样点名称：{record.samplingData.samplingPoint}</p>
                      <p>夜间服务：{record.samplingData.nightService ? '是' : '否'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">居民意见</h4>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm">
                  {record.residentOpinionOriginal ? (
                    <div>
                      <p className="text-slate-500 text-xs mb-1">原文：</p>
                      <p className="text-slate-700">{record.residentOpinionOriginal}</p>
                    </div>
                  ) : (
                    <p className="text-orange-600">⚠️ 缺少居民意见原文，请在自检中心补全</p>
                  )}
                  <p className="text-slate-500 text-xs mt-2 mb-1">汇总：</p>
                  <p className="text-slate-600">{record.residentOpinionSummary}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">操作痕迹</h4>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="relative">
                    {record.modificationHistory.map((log, idx) => (
                      <div key={log.id} className="flex gap-3 pb-3 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                          {idx < record.modificationHistory.length - 1 && (
                            <div className="w-px bg-slate-200 flex-1 my-1" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-800">{log.action}</p>
                          <p className="text-xs text-slate-500">
                            {log.operator} · {formatDate(log.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const RecordsOverview: React.FC = () => {
  const { records, loading, error, fetchRecords } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');

  useEffect(() => {
    fetchRecords({ status: statusFilter || undefined, source: sourceFilter || undefined });
  }, [statusFilter, sourceFilter, fetchRecords]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">记录总览</h3>
          <p className="text-sm text-slate-500 mt-1">查看所有无障碍坡道和夜间采样点记录</p>
        </div>
        <div className="text-sm text-slate-500">
          共 <span className="font-semibold text-slate-700">{records.length}</span> 条记录
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">处理状态</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="pending_review">待复核</option>
            <option value="conflict">冲突</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">数据来源</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">全部</option>
            <option value="ramp">无障碍坡道</option>
            <option value="sampling">夜间采样点</option>
            <option value="merged">合并数据</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-slate-500">暂无记录</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">位置</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">居民意见</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">最后修改</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <RecordRow key={record.id} record={record} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
