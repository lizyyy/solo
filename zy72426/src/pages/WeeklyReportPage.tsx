import { useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { StatsCard } from '@/components/report/StatsCard';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { exportWeeklyReport } from '@/utils/exporter';
import { FileBarChart, Download, Users, Music, CheckCircle, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

export const WeeklyReportPage = () => {
  const { records, groups, runSelfCheck } = useEmotionLabelStore();

  const emotionStats = useMemo(() => {
    const stats = new Map<string, number>();
    records.forEach((r) => {
      stats.set(r.emotionTag, (stats.get(r.emotionTag) || 0) + 1);
    });
    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const statusStats = useMemo(() => {
    return {
      total: records.length,
      confirmed: records.filter((r) => r.status === 'confirmed').length,
      reviewing: records.filter((r) => r.status === 'reviewing').length,
      pending: records.filter((r) => r.status === 'pending').length,
      exception: records.filter((r) => r.status === 'exception').length,
    };
  }, [records]);

  const groupStats = useMemo(() => {
    return {
      total: groups.length,
      confirmed: groups.filter((g) => g.reviewStatus === 'confirmed').length,
      pending: groups.filter((g) => g.reviewStatus === 'pending').length,
    };
  }, [groups]);

  const handleExport = () => {
    runSelfCheck();
    setTimeout(() => {
      exportWeeklyReport(records, groups);
    }, 300);
  };

  const completionRate = statusStats.total > 0
    ? ((statusStats.confirmed / statusStats.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            第三步：店长周报更新
          </h1>
          <p className="text-gray-500 mt-1">
            给店长看的汇总视图，导出前自动运行自检确保数据一致性
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-5 py-2.5 text-white bg-[#dd6b20] rounded hover:bg-[#c05621] transition-colors"
        >
          <Download className="w-4 h-4" />
          导出周报Excel
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="总记录数"
          value={statusStats.total}
          subtitle="音频样本总数"
          icon={<Music className="w-8 h-8" />}
          color="blue"
        />
        <StatsCard
          title="已确认"
          value={statusStats.confirmed}
          subtitle={`完成率 ${completionRate}%`}
          icon={<CheckCircle className="w-8 h-8" />}
          color="green"
        />
        <StatsCard
          title="待复核"
          value={statusStats.reviewing}
          subtitle="需许老师确认"
          icon={<AlertTriangle className="w-8 h-8" />}
          color="amber"
        />
        <StatsCard
          title="已确认分组"
          value={groupStats.confirmed}
          subtitle={`共 ${groupStats.total} 个分组`}
          icon={<Users className="w-8 h-8" />}
          color="gray"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card
            title={
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#1e3a5f]" />
                情绪标签分布
              </div>
            }
            subtitle="按歌曲数量排序"
          >
            <div className="space-y-3">
              {emotionStats.map(([tag, count]) => {
                const percentage = statusStats.total > 0 ? (count / statusStats.total) * 100 : 0;
                return (
                  <div key={tag}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{tag}</span>
                      <span className="text-sm text-gray-500">
                        {count} 首 ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1e3a5f] rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card
            title={
              <div className="flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-[#1e3a5f]" />
                处理进度
              </div>
            }
            subtitle="各状态记录统计"
          >
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded">
                <p className="text-3xl font-bold text-gray-800">{statusStats.total}</p>
                <p className="text-sm text-gray-500 mt-1">总计</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded">
                <p className="text-3xl font-bold text-green-700">{statusStats.confirmed}</p>
                <p className="text-sm text-green-600 mt-1">已确认</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded">
                <p className="text-3xl font-bold text-amber-700">{statusStats.reviewing}</p>
                <p className="text-sm text-amber-600 mt-1">待复核</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded">
                <p className="text-3xl font-bold text-gray-700">{statusStats.pending}</p>
                <p className="text-sm text-gray-500 mt-1">待处理</p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">整体完成进度</span>
                <span className="text-sm font-medium text-gray-800">{completionRate}%</span>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2c5282] to-[#1e3a5f] rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title={
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                待处理事项
              </div>
            }
          >
            <div className="space-y-3">
              {statusStats.reviewing > 0 && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded border border-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {statusStats.reviewing} 条记录待复核
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      需许老师确认现场名/版权名关联
                    </p>
                  </div>
                </div>
              )}
              {statusStats.pending > 0 && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded border border-gray-200">
                  <Clock className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {statusStats.pending} 条记录待处理
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      尚未标注情绪标签或备注
                    </p>
                  </div>
                </div>
              )}
              {groupStats.pending > 0 && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded border border-blue-200">
                  <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      {groupStats.pending} 个分组待确认
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      同名映射需要音乐老师复核
                    </p>
                  </div>
                </div>
              )}
              {statusStats.reviewing === 0 && statusStats.pending === 0 && groupStats.pending === 0 && (
                <div className="text-center py-4">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-green-700 font-medium">全部处理完毕！</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="操作提示">
            <div className="space-y-3 text-sm text-gray-600">
              <p>1. 导出周报前系统会自动运行自检，确保数据一致性</p>
              <p>2. 周报包含：统计汇总、情绪分布、明细数据三个sheet</p>
              <p>3. 所有导出数据与页面展示完全一致，可追溯原始行号</p>
              <p>4. 如有待复核记录，建议先请许老师复核后再导出</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
