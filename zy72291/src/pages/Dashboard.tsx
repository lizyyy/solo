import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Table2, FileBarChart, AlertTriangle, CheckCircle, Clock, ChevronRight, TrendingUp, AlertCircle } from 'lucide-react';
import { useWindStore } from '../store/useWindStore';
import { StatusBadge } from '../components/StatusBadge';
import { WindRoseChart } from '../components/WindRoseChart';
import { ComparisonChart } from '../components/ComparisonChart';
import { formatDateTime, formatNumber } from '../utils/windUtils';

export const Dashboard: React.FC = () => {
  const { logs, radiusTable, report, operations, currentRole } = useWindStore();

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    pending: logs.filter(l => l.status === 'pending_review').length,
    legacy: logs.filter(l => l.status === 'legacy').length,
  };

  const latestOperations = operations.slice(-5).reverse();

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-industrial-800 font-mono">小看板</h2>
          <p className="text-sm text-industrial-500 mt-1">
            当前角色：{currentRole === 'engineer' ? '许工（设备工程师）' : '施工经理'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/logs" className="btn-industrial text-sm flex items-center gap-2">
            <FileText size={16} />
            查看日志
          </Link>
          <Link to="/report" className="btn-primary text-sm flex items-center gap-2">
            <FileBarChart size={16} />
            生成报告
          </Link>
        </div>
      </div>

      {/* 统计卡片 - 三种处理结果 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-industrial p-5 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-industrial-500">总记录数</p>
              <p className="text-3xl font-bold text-industrial-800 font-mono mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-industrial-100 rounded-lg flex items-center justify-center">
              <FileText className="text-industrial-600" size={20} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-industrial-100">
            <Link to="/logs" className="text-xs text-industrial-600 hover:text-industrial-800 flex items-center gap-1">
              查看全部 <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        <div className="card-industrial p-5 rounded-lg border-l-4 border-emerald-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-industrial-500">顺利通过</p>
              <p className="text-3xl font-bold text-emerald-600 font-mono mt-1">{stats.success}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-emerald-500" size={20} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-industrial-100">
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <TrendingUp size={12} />
              数据完整，直接通过
            </p>
          </div>
        </div>

        <div className="card-industrial p-5 rounded-lg border-l-4 border-amber-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-industrial-500">待施工经理复核</p>
              <p className="text-3xl font-bold text-amber-600 font-mono mt-1">{stats.pending}</p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center animate-pulse-slow">
              <Clock className="text-amber-500" size={20} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-industrial-100">
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={12} />
              截图遮挡，读数存疑
            </p>
          </div>
        </div>

        <div className="card-industrial p-5 rounded-lg border-l-4 border-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-industrial-500">旧口径补录</p>
              <p className="text-3xl font-bold text-blue-600 font-mono mt-1">{stats.legacy}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Table2 className="text-blue-500" size={20} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-industrial-100">
            <p className="text-xs text-blue-600 flex items-center gap-1">
              <AlertCircle size={12} />
              从安全半径表补入历史数据
            </p>
          </div>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧 - 日志列表预览 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 日志列表 */}
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200 flex items-center justify-between">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <FileText size={18} />
                点云抽稀日志
              </h3>
              <Link to="/logs" className="text-sm text-industrial-600 hover:text-industrial-800 flex items-center gap-1">
                查看全部 <ChevronRight size={14} />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">批次号</th>
                    <th className="table-header">点数</th>
                    <th className="table-header">抽稀率</th>
                    <th className="table-header">来源</th>
                    <th className="table-header">状态</th>
                    <th className="table-header">告警</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-industrial-50 transition-colors">
                      <td className="table-cell font-mono text-sm text-industrial-800">{log.batchNo}</td>
                      <td className="table-cell font-mono text-sm">{formatNumber(log.pointCount)}</td>
                      <td className="table-cell font-mono text-sm">{(log.thinningRate * 100).toFixed(0)}%</td>
                      <td className="table-cell text-sm text-industrial-600">{log.source}</td>
                      <td className="table-cell">
                        <StatusBadge status={log.status} size="sm" />
                      </td>
                      <td className="table-cell">
                        <span className={`text-sm font-mono ${
                          log.alerts.some(a => a.level === 'danger') ? 'text-red-600' :
                          log.alerts.some(a => a.level === 'warning') ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {log.alerts.length} 条
                        </span>
                        {log.hasScreenshotOcclusion && (
                          <span className="ml-2 text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle size={10} /> 遮挡
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 三种结果对比图 */}
          {report && (
            <div className="card-industrial rounded-lg overflow-hidden">
              <div className="p-4 border-b border-industrial-200">
                <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                  <TrendingUp size={18} />
                  三种处理结果安全距离对比
                </h3>
                <p className="text-xs text-industrial-500 mt-1">
                  绿色=顺利通过 | 橙色=截图遮挡待复核 | 蓝色=旧口径补录
                </p>
              </div>
              <div className="p-4">
                <ComparisonChart results={report.results} height={300} />
              </div>
            </div>
          )}
        </div>

        {/* 右侧 - 风向图和操作记录 */}
        <div className="space-y-6">
          {/* 风向玫瑰图 */}
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200 flex items-center justify-between">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L12 22M2 12L22 12" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                安全半径风向图
              </h3>
            </div>
            <div className="p-2">
              <WindRoseChart radiusTable={radiusTable} height={280} />
            </div>
            <div className="px-4 pb-4">
              <Link to="/radius" className="text-xs text-industrial-600 hover:text-industrial-800 flex items-center gap-1">
                查看安全半径表 <ChevronRight size={12} />
              </Link>
            </div>
          </div>

          {/* 最新操作记录 */}
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <Clock size={18} />
                最新操作
              </h3>
            </div>
            <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
              {latestOperations.map((op) => (
                <div key={op.id} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-industrial-400"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-industrial-700">{op.action}</span>
                      <span className="text-xs text-industrial-400 font-mono flex-shrink-0">
                        {formatDateTime(op.timestamp).split(' ')[1]}
                      </span>
                    </div>
                    <p className="text-xs text-industrial-500 mt-0.5 truncate">{op.detail}</p>
                    <p className="text-xs text-industrial-400 mt-0.5">— {op.operatorName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 报告摘要 */}
          {report && (
            <div className="card-industrial rounded-lg overflow-hidden">
              <div className="p-4 border-b border-industrial-200 flex items-center justify-between">
                <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                  <FileBarChart size={18} />
                  最新报告
                </h3>
                <StatusBadge status={report.status === 'pending_review' ? 'pending_review' : 'success'} size="sm" />
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-industrial-500">报告编号</span>
                  <span className="font-mono text-industrial-700">{report.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-industrial-500">生成时间</span>
                  <span className="text-industrial-700">{formatDateTime(report.generatedAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-industrial-500">口径版本</span>
                  <span className="text-industrial-700">
                    {report.radiusVersion === 'mixed' ? '新旧混合' : report.radiusVersion === 'new' ? '2024新口径' : '2023旧口径'}
                  </span>
                </div>
                <div className="pt-2 border-t border-industrial-100">
                  <p className="text-xs text-industrial-500">{report.notes}</p>
                </div>
                <Link to="/report" className="btn-primary w-full text-center text-sm py-2 mt-2">
                  查看完整报告
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
