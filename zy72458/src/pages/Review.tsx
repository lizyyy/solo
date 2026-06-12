import { useEffect } from 'react';
import { useAppStore } from '../store';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import DuplicateTypeBadge from '../components/DuplicateTypeBadge';
import { AlertTriangle, Eye, Clock, FileText } from 'lucide-react';

export default function Review() {
  const { complaints, fetchComplaints, fetchStats, currentRole } = useAppStore();

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
            严格展示 <code>status === 'missing_opinion'</code> 的记录：居民意见只剩汇总无原文，不归为正常，需您复核确认
          </p>
          <p className="text-red-600 text-xs mt-2">
            共 <b>{missingOpinions.length}</b> 条待复核，当前身份：
            <b className="ml-1">{currentRole === 'secretary' ? '王书记（社区书记）' : '阿宁（城更经理）'}</b>
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
            <p className="text-xs text-slate-400 mt-1">仅展示 status 严格等于 missing_opinion 的记录</p>
          </div>
        ) : (
          missingOpinions.map(c => (
            <div key={c.id} className="bg-white rounded-lg border-2 border-red-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold text-slate-800">{c.complaintNo}</h3>
                    <StatusBadge status={c.status} />
                    <DuplicateTypeBadge type={c.duplicateType} />
                    <span className="text-xs text-slate-500 font-mono">原始行号 #{c.originalRowNo}</span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="text-sm">
                      <span className="text-slate-500">卡点：</span>
                      <span className="text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded">
                        第{c.currentStep}步 - 居民意见只剩汇总无原文（待社区书记复核，不归为正常）
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Clock size={14} />
                      导入时间：{new Date(c.importTime).toLocaleString('zh-CN')}
                    </p>
                    <p className="text-sm text-slate-500">
                      来源：{c.source || '未标注'}
                    </p>
                    {c.reportNote && (
                      <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                        <b className="text-slate-700">报告说明（同源）：</b>{c.reportNote}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  to={`/complaints/${c.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  <Eye size={16} />
                  查看详情并复核
                </Link>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <FileText size={12} /> 居民意见（只剩汇总，缺原文）
                  </p>
                  <p className="text-sm text-slate-700 bg-red-50 p-3 rounded-lg border border-red-100">
                    {c.residentOpinion.summary}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">路口照片</p>
                  <p className={`text-sm p-3 rounded-lg border ${c.intersectionPhoto.hasPhoto ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                    {c.intersectionPhoto.hasPhoto ? `已补看（${c.intersectionPhoto.reviewedBy || '阿宁'}）` : '未补看'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
