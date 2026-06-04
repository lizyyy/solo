import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '@/store/useAppStore';

const COLORS = {
  cardBg: '#1a1a2e',
  cardBorder: '#2a2a4a',
  alertOrange: '#e94560',
  calmBlue: '#0f3460',
  passGreen: '#16c784',
};

export default function Dashboard() {
  const alerts = useAppStore((s) => s.alerts);
  const pendingCount = useAppStore((s) => s.getPendingConflictsCount());

  const sortedAlerts = [...alerts].sort(
    (a, b) => new Date(a.calculatedAt).getTime() - new Date(b.calculatedAt).getTime(),
  );

  const latestAlert = sortedAlerts[sortedAlerts.length - 1] ?? null;

  const trendData = sortedAlerts.map((a) => ({
    time: format(new Date(a.calculatedAt), 'HH:mm'),
    median: a.medianValue,
    threshold: a.threshold,
  }));

  if (alerts.length === 0) {
    return (
      <div
        className="flex items-center justify-center min-h-[60vh] rounded-xl"
        style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}` }}
      >
        <p className="text-gray-400 text-lg" style={{ fontFamily: "'Noto Sans SC', sans-serif" }}>
          暂无报警数据，请先导入材料
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className="rounded-xl p-6 flex flex-col gap-4"
          style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}` }}
        >
          <div className="flex items-center gap-2">
            <Activity size={20} style={{ color: COLORS.calmBlue }} />
            <span
              className="text-sm text-gray-400"
              style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
            >
              鲁棒中位数
            </span>
          </div>

          <div className="flex items-end gap-3">
            <span
              className="text-5xl font-bold leading-none"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: latestAlert?.isAlert ? COLORS.alertOrange : COLORS.passGreen,
              }}
            >
              {latestAlert?.medianValue.toFixed(2) ?? '--'}
            </span>
            <span
              className="text-sm text-gray-500 pb-1"
              style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
            >
              / 阈值 {latestAlert?.threshold.toFixed(2) ?? '--'}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-auto">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background: latestAlert?.isAlert ? COLORS.alertOrange : COLORS.passGreen,
              }}
            />
            <span
              className="text-sm"
              style={{
                fontFamily: "'Noto Sans SC', sans-serif",
                color: latestAlert?.isAlert ? COLORS.alertOrange : COLORS.passGreen,
              }}
            >
              {latestAlert?.isAlert ? '报警' : '正常'}
            </span>
            {latestAlert && (
              <span className="text-xs text-gray-500 ml-auto" style={{ fontFamily: "'Noto Sans SC', sans-serif" }}>
                {format(new Date(latestAlert.calculatedAt), 'yyyy-MM-dd HH:mm')}
              </span>
            )}
          </div>
        </div>

        <div
          className="rounded-xl p-6 flex flex-col gap-4"
          style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.cardBorder}`,
            borderLeft: `4px solid ${COLORS.alertOrange}`,
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: COLORS.alertOrange }} />
            <span
              className="text-sm text-gray-400"
              style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
            >
              待处理冲突
            </span>
          </div>

          <span
            className="text-5xl font-bold leading-none"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: pendingCount > 0 ? COLORS.alertOrange : COLORS.passGreen,
            }}
          >
            {pendingCount}
          </span>

          <span
            className="text-sm text-gray-500"
            style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
          >
            {pendingCount > 0 ? '存在待处理的冲突项，请尽快处理' : '所有冲突均已处理'}
          </span>
        </div>
      </div>

      <div
        className="rounded-xl p-6"
        style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}` }}
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={20} style={{ color: COLORS.calmBlue }} />
          <span
            className="text-sm text-gray-400"
            style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
          >
            中位数趋势
          </span>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData}>
            <XAxis
              dataKey="time"
              tick={{ fill: '#6b7280', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
              axisLine={{ stroke: COLORS.cardBorder }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
              axisLine={{ stroke: COLORS.cardBorder }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 8,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
              }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Line
              type="monotone"
              dataKey="median"
              stroke={COLORS.passGreen}
              strokeWidth={2}
              dot={{ r: 3, fill: COLORS.passGreen }}
              name="中位数"
            />
            <Line
              type="monotone"
              dataKey="threshold"
              stroke={COLORS.alertOrange}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              name="阈值"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
