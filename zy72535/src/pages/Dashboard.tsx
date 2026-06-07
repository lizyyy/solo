import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Play,
  Eye,
} from 'lucide-react';
import { useReviewStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/utils/hash';

export default function Dashboard() {
  const navigate = useNavigate();
  const { initializeData, records, runBatchProcess } = useReviewStore();

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const totalRecords = records.length;
  const pendingReview = records.filter(r => r.status === 'PENDING_REVIEW').length;
  const confirmed = records.filter(r => r.status === 'CONFIRMED').length;
  const reviewing = records.filter(r => r.status === 'REVIEWING').length;
  const passRate = records.filter(r => r.autoResult === 'PASS').length / (totalRecords || 1) * 100;

  const stats = [
    {
      label: '审查总数',
      value: totalRecords,
      icon: FileCheck,
      color: 'from-primary-500 to-primary-600',
    },
    {
      label: '待复核',
      value: pendingReview,
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
    },
    {
      label: '审查中',
      value: reviewing,
      icon: AlertTriangle,
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: '已确认',
      value: confirmed,
      icon: CheckCircle2,
      color: 'from-emerald-500 to-emerald-600',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary-500">
            虚拟主播脚本安全审查
          </h1>
          <p className="mt-2 text-slate-600">
            脱敏规则备注管理、灰度批次追踪、人工改判保护全流程覆盖
          </p>
        </div>
        <button
          onClick={() => runBatchProcess()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-md"
        >
          <Play className="w-4 h-4" />
          执行批跑
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-gradient-to-br ${stat.color} rounded-xl p-6 text-white shadow-lg transform hover:scale-[1.02] transition-transform`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/80 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
              </div>
              <stat.icon className="w-10 h-10 text-white/30" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-serif font-semibold text-primary-500">
            审查记录列表
          </h2>
          <div className="text-sm text-slate-500">
            通过率：{passRate.toFixed(1)}%
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-600">脚本内容</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">自动结果</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">状态</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">人工改判</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">更新时间</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <p className="text-sm text-slate-800 max-w-xs truncate">
                      {record.scriptContent}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={record.autoResult} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="py-3 px-4">
                    {record.hasManualJudgment ? (
                      <span className="text-amber-600 text-sm flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        已有改判
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm">无</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">
                    {formatDate(record.updatedAt)}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => navigate(`/review/${record.id}`)}
                      className="text-primary-500 hover:text-primary-600 text-sm flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
