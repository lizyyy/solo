import { useEffect } from 'react';
import { useAppStore } from '../store';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { AlertTriangle, Eye, Clock } from 'lucide-react';

export default function Review() {
  const { complaints, fetchComplaints, fetchStats } = useAppStore();

  useEffect(() => {
    fetchComplaints();
    fetchStats();
  }, []);

  const missingOpinions = complaints.filter(c => c.status === 'missing_opinion');

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={24} />
        <div>
          <p className="text-red-800 font-medium">
            社区书记复核视图
          </p>
          <p className="text-red-600 text-sm mt-1">
            以下记录居民意见只剩汇总无原文，不归为正常，需要您复核确认
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {missingOpinions.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye size={32} className="text-green-600" />
            </div>
            <p className="text-slate-600">暂无待复核记录</p>
          </div>
        ) : (
          missingOpinions.map(c => (
            <div key={c.id} className="bg-white rounded-lg border-2 border-red-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-800">{c.complaintNo}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-slate-500">
                      原始行号：<span className="text-slate-700">{c.originalRowNo}</span>
                    </p>
                    <p className="text-sm text-slate-500">
                      卡点：<span className="text-red-600 font-medium">第{c.currentStep}步 - 居民意见只剩汇总无原文</span>
                    </p>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Clock size={14} />
                      导入时间：{new Date(c.importTime).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/complaints/${c.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  <Eye size={16} />
                  查看详情并复核
                </Link>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">居民意见（只剩汇总）：</p>
                <p className="text-sm text-slate-700 bg-red-50 p-3 rounded-lg border border-red-100">
                  {c.residentOpinion.summary}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
