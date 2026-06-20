import PageContainer from '@/components/layout/PageContainer';
import StatCard from '@/components/dashboard/StatCard';
import RiskBarChart from '@/components/dashboard/RiskBarChart';
import QuickEntry from '@/components/dashboard/QuickEntry';
import { useAppStore } from '@/store/useAppStore';
import { getDashboardStats, getEffectiveWarnings } from '@/utils/stats';
import { OctagonAlert, AlertTriangle, CheckCircle2, UserCheck } from 'lucide-react';

export default function DashboardPage() {
  const warnings = useAppStore((s) => s.warnings);
  const records = useAppStore((s) => s.records);

  const stats = getDashboardStats(warnings, records);
  const effectiveWarnings = getEffectiveWarnings(warnings, records);

  return (
    <PageContainer
      title="管线阈值预警总览"
      subtitle="实时汇总各管线预警状态、异常分布与待办事项。先扫汇总卡片，再点异常数字追明细。设备编号重复未确认前，对应记录不计入红/黄/绿最终数字。"
      breadcrumb={[{ label: '汇总仪表盘' }]}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="红警（超标）"
          value={stats.red}
          unit="条"
          delta={{ value: 0, label: '按公式核算' }}
          accentStyle="red"
          icon={<OctagonAlert className="w-5 h-5" />}
          clickTo="/inspections"
        />
        <StatCard
          title="黄警（预警区间）"
          value={stats.yellow}
          unit="条"
          delta={{ value: 0, label: '已剔除待确认' }}
          accentStyle="orange"
          icon={<AlertTriangle className="w-5 h-5" />}
          clickTo="/inspections"
        />
        <StatCard
          title="正常绿区"
          value={stats.green}
          unit="条"
          delta={{ value: 0, label: '同一口径' }}
          accentStyle="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
          clickTo="/inspections"
        />
        <StatCard
          title="待人工确认"
          value={stats.pending}
          unit="条"
          delta={{ value: 0, label: '重复设备' }}
          accentStyle="yellow"
          icon={<UserCheck className="w-5 h-5" />}
          clickTo="/inspections"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <RiskBarChart warnings={effectiveWarnings} records={records} />
        <div className="card-base p-5">
          <h3 className="section-title">计算口径与单位说明</h3>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-industrial-50 border border-industrial-100">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-industrial-500" />
                <span className="font-semibold text-industrial-700">所有指标统一当前口径 v2.3</span>
              </div>
              <p className="text-xs text-industrial-600 leading-relaxed pl-4">
                汇总、明细、时间线均由同一套 calculator 实时核算，等级与边界值一致；历史数据已按当前口径重新折算。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded bg-surface-muted">
                <div className="text-industrial-500 mb-1">压力单位</div>
                <div className="font-mono text-industrial-700 num">MPa（1 MPa = 10 bar）</div>
              </div>
              <div className="p-2.5 rounded bg-surface-muted">
                <div className="text-industrial-500 mb-1">温度单位</div>
                <div className="font-mono text-industrial-700 num">℃（已扣除环境温度）</div>
              </div>
              <div className="p-2.5 rounded bg-surface-muted">
                <div className="text-industrial-500 mb-1">振动单位</div>
                <div className="font-mono text-industrial-700 num">mm/s（三方向合成有效值）</div>
              </div>
              <div className="p-2.5 rounded bg-surface-muted">
                <div className="text-industrial-500 mb-1">边界判定</div>
                <div className="font-mono text-industrial-700 num">
                  外边界 = 红警，预警区间 = 黄警
                </div>
              </div>
            </div>
            <p className="text-[11px] text-industrial-400 pt-1.5 border-t border-surface-border leading-relaxed">
              新手提示：从左上"红警"数字点进去 → 自动跳到巡检明细并筛选红警记录 → 点击记录行打开"异常详情抽屉"
              → 追完整计算链路。若看到⚠️黄条，先处理设备编号重复的人工确认——确认前该设备不计入最终汇总。
            </p>
          </div>
        </div>
      </div>

      <QuickEntry />
    </PageContainer>
  );
}
