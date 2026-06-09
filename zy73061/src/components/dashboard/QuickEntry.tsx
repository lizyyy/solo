import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, FileWarning, BookOpen, ArrowRight, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { LevelBadge } from '@/components/common/Badges';
import { formatDateTime } from '@/utils/unitConverter';

export default function QuickEntry() {
  const navigate = useNavigate();
  const warnings = useAppStore((s) => s.warnings);
  const records = useAppStore((s) => s.records);
  const currentVersion = useAppStore((s) => s.getCurrentVersion());
  const openRecord = useAppStore((s) => s.setSelectedRecordId);

  const topAlerts = [...warnings]
    .sort((a, b) => {
      const order = { red: 0, yellow: 1, green: 2 } as const;
      return order[a.level] - order[b.level] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="card-base p-5 flex flex-col">
        <h3 className="section-title">快捷入口</h3>
        <div className="grid grid-cols-2 gap-3 flex-1">
          <button
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-gradient-to-br from-industrial-500 to-industrial-700 text-white hover:from-industrial-600 hover:to-industrial-800 transition-all hover:-translate-y-0.5 hover:shadow-hover"
            onClick={() => navigate('/inspections')}
          >
            <PlusCircle className="w-7 h-7" />
            <span className="text-sm font-medium">新建巡检记录</span>
          </button>
          <Link
            to="/formula"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-industrial-200 bg-industrial-50/40 text-industrial-700 hover:bg-industrial-100 transition-all hover:-translate-y-0.5 hover:shadow-hover"
          >
            <BookOpen className="w-7 h-7" />
            <span className="text-sm font-medium">阈值公式说明</span>
          </Link>
          <Link
            to="/timeline"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-industrial-200 bg-white text-industrial-700 hover:bg-industrial-50 transition-all hover:-translate-y-0.5 hover:shadow-hover"
          >
            <FileText className="w-7 h-7" />
            <span className="text-sm font-medium">历史时间线</span>
          </Link>
          <Link
            to="/inspections"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-alert-orange/30 bg-alert-orange/5 text-[#b54a1e] hover:bg-alert-orange/10 transition-all hover:-translate-y-0.5 hover:shadow-hover"
          >
            <FileWarning className="w-7 h-7" />
            <span className="text-sm font-medium">待确认异常</span>
          </Link>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-industrial-50 border border-industrial-100">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-industrial-500" />
            <span className="text-xs font-semibold text-industrial-700">当前计算口径</span>
          </div>
          <div className="text-xs text-industrial-600 leading-relaxed">
            <span className="inline-block px-2 py-0.5 rounded bg-industrial-500 text-white font-semibold num mr-1.5">
              {currentVersion?.version}
            </span>
            {currentVersion?.description}
            <div className="text-industrial-400 mt-1">生效日期：{currentVersion?.effective_date}</div>
          </div>
        </div>
      </div>

      <div className="card-base p-5 xl:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title mb-0">待处理异常 Top 5</h3>
          <Link
            to="/inspections"
            className="text-xs text-industrial-500 hover:text-industrial-700 inline-flex items-center gap-1"
          >
            查看全部 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border border-surface-border">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th-cell w-[78px]">等级</th>
                <th className="th-cell">设备/管线</th>
                <th className="th-cell w-[120px]">计算值</th>
                <th className="th-cell w-[140px]">生成时间</th>
                <th className="th-cell w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {topAlerts.map((w) => {
                const rec = records.find((r) => r.id === w.record_id);
                const rule = useAppStore.getState().rules.find((r) => r.id === w.rule_id);
                return (
                  <tr
                    key={w.id}
                    className="hover:bg-industrial-50/40 transition-colors cursor-pointer group"
                    onClick={() => {
                      openRecord(rec?.id || null);
                      navigate('/inspections');
                    }}
                  >
                    <td className="td-cell">
                      <LevelBadge level={w.level} />
                    </td>
                    <td className="td-cell">
                      <div className="font-medium text-industrial-700 num">{rec?.equipment_no}</div>
                      <div className="text-xs text-industrial-500 mt-0.5 truncate max-w-[260px]">{rec?.pipeline_name}</div>
                      {w.change_reason && (
                        <div className="text-[11px] text-alert-orange mt-0.5">※ {w.change_reason}</div>
                      )}
                    </td>
                    <td className="td-cell">
                      <span className="num font-semibold text-industrial-700">
                        {w.calculated_value.toFixed(2)}
                      </span>
                      <span className="text-xs text-industrial-400 ml-1">{rule?.unit}</span>
                    </td>
                    <td className="td-cell text-xs text-industrial-500 num">
                      {formatDateTime(w.created_at)}
                    </td>
                    <td className="td-cell text-right">
                      <ArrowRight className="w-4 h-4 text-industrial-300 group-hover:text-industrial-600 transition-colors inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
