import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AlertTriangle,
  MapPin,
  FileClock,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/types';

const steps = [
  { step: 1, title: '公交刷卡时段导入', desc: '批量上传公交刷卡数据', key: 'import' },
  { step: 2, title: '巡检员补看红线图备注', desc: '小付补充现场信息', key: 'inspect' },
  { step: 3, title: '点位清单更新', desc: '居民代表复核确认', key: 'update' },
];

export const Dashboard: React.FC = () => {
  const { breakpoints, fetchBreakpoints, loading } = useAppStore();

  useEffect(() => {
    fetchBreakpoints();
  }, [fetchBreakpoints]);

  const stats = {
    total: breakpoints.length,
    pendingReview: breakpoints.filter((b) => b.status === 'pending_review').length,
    withDetour: breakpoints.filter((b) => b.hasConstructionDetour).length,
    completed: breakpoints.filter((b) => b.status === 'completed' || b.status === 'confirmed').length,
  };

  const pendingReviewItems = breakpoints.filter((b) => b.status === 'pending_review');

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">慢行绿道断点修补</h2>
            <p className="text-emerald-200 text-sm max-w-lg">
              居民代表开会前只有十分钟，请直接标记施工临时改道，不要反复翻公交刷卡时段。
              施工改道要留待复核，别急着归正常。
            </p>
          </div>
          <Link
            to="/breakpoints"
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            查看全部断点
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-stone-600" />
            </div>
            <span className="text-sm text-stone-500">断点总数</span>
          </div>
          <div className="text-3xl font-bold text-stone-800">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-orange-200 shadow-sm bg-orange-50/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-orange-600">待复核（居民代表）</span>
          </div>
          <div className="text-3xl font-bold text-orange-700">{stats.pendingReview}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-amber-200 shadow-sm bg-amber-50/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <FileClock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-amber-600">施工改道未同步</span>
          </div>
          <div className="text-3xl font-bold text-amber-700">{stats.withDetour}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-green-200 shadow-sm bg-green-50/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-green-600">已确认完成</span>
          </div>
          <div className="text-3xl font-bold text-green-700">{stats.completed}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-stone-800 mb-5 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" />
          三步工作流
        </h3>
        <div className="grid grid-cols-3 gap-6">
          {steps.map((s, idx) => (
            <div
              key={s.step}
              className="relative bg-stone-50 rounded-xl p-5 border border-stone-200"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg mb-3">
                {s.step}
              </div>
              <h4 className="font-bold text-stone-800 mb-1">{s.title}</h4>
              <p className="text-sm text-stone-500 mb-3">{s.desc}</p>
              {idx === 0 && (
                <Link
                  to="/import"
                  className="text-sm text-emerald-600 font-medium hover:underline"
                >
                  去导入 →
                </Link>
              )}
              {idx === 1 && (
                <Link
                  to="/breakpoints"
                  className="text-sm text-emerald-600 font-medium hover:underline"
                >
                  去巡检 →
                </Link>
              )}
              {idx === 2 && (
                <Link
                  to="/breakpoints?status=pending_review"
                  className="text-sm text-emerald-600 font-medium hover:underline"
                >
                  去复核 →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {pendingReviewItems.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
          <div className="bg-orange-50 px-6 py-3 border-b border-orange-200">
            <h3 className="font-bold text-orange-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              待居民代表复核的施工临时改道
            </h3>
          </div>
          <div className="divide-y divide-orange-100">
            {pendingReviewItems.slice(0, 5).map((bp) => (
              <Link
                key={bp.id}
                to={`/breakpoints/${bp.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-orange-50/50 transition-colors"
              >
                <div>
                  <div className="font-medium text-stone-800">{bp.name}</div>
                  <div className="text-sm text-stone-500">{bp.location}</div>
                </div>
                <div className="flex items-center gap-3">
                  {bp.redlineNote && (
                    <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded">
                      有红线图备注
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[bp.status]}`}
                  >
                    {STATUS_LABELS[bp.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
