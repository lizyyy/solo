import { useMemo } from 'react';
import { useDataStore } from '@/store/useDataStore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
} from 'recharts';
import { formatTime } from '@/utils/csvParser';
import { DEFAULT_THRESHOLD_CONFIG, FIELD_UNITS } from '@/config/thresholds';
import { ThermometerSun } from 'lucide-react';

export function TemperatureChart() {
  const { records, selectedRecordId, setSelectedRecordId } = useDataStore();

  const chartData = useMemo(() => {
    return records.map((record) => ({
      id: record.id,
      time: formatTime(record.timestamp),
      temperature: record.temperature,
      isExtreme: record.dataQuality.isExtreme,
      isWarning: record.temperature !== null &&
        record.temperature >= DEFAULT_THRESHOLD_CONFIG.temperatureWarning &&
        record.temperature < DEFAULT_THRESHOLD_CONFIG.temperatureDanger,
      isDanger: record.temperature !== null &&
        record.temperature >= DEFAULT_THRESHOLD_CONFIG.temperatureDanger &&
        !record.dataQuality.isExtreme,
      supplementNote: record.supplementNote,
    }));
  }, [records]);

  const customDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || payload.temperature === null) return null;

    let fill = '#10B981';
    let stroke = '#059669';
    let r = 4;

    if (payload.isExtreme) {
      fill = '#DC2626';
      stroke = '#991B1B';
      r = 6;
    } else if (payload.isDanger) {
      fill = '#EF4444';
      stroke = '#DC2626';
      r = 5;
    } else if (payload.isWarning) {
      fill = '#F59E0B';
      stroke = '#D97706';
      r = 4;
    }

    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        className={payload.isExtreme ? 'animate-pulse' : ''}
        style={{ cursor: 'pointer' }}
        onClick={() => setSelectedRecordId(payload.id)}
      />
    );
  };

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && payload[0].payload) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
          <div className="font-mono text-sm text-slate-300 mb-1">{data.id}</div>
          <div className="text-xs text-slate-400 mb-2">{data.time}</div>
          <div className={`font-mono text-lg font-bold ${
            data.isExtreme ? 'text-red-400' :
            data.isDanger ? 'text-red-400' :
            data.isWarning ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {data.temperature?.toFixed(1)} {FIELD_UNITS.temperature}
          </div>
          {data.isExtreme && (
            <div className="text-xs text-red-400 mt-1">⚠️ 极端值（已排除）</div>
          )}
          {data.isDanger && !data.isExtreme && (
            <div className="text-xs text-red-400 mt-1">🔴 超过危险阈值</div>
          )}
          {data.isWarning && (
            <div className="text-xs text-amber-400 mt-1">🟠 超过警告阈值</div>
          )}
          {data.supplementNote && (
            <div className="text-xs text-blue-400 mt-1 border-t border-slate-600 pt-1 mt-2">
              📝 {data.supplementNote.content}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (records.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ThermometerSun className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-slate-200">温度时间序列</h3>
        </div>
        <div className="text-center py-16 text-slate-500">
          <ThermometerSun className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请先导入数据并运行分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <ThermometerSun className="w-5 h-5 text-red-400" />
          温度时间序列图
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-400">正常</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-slate-400">警告</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-400">危险</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
            <span className="text-slate-400">极端值</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              stroke="#64748B"
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              interval={Math.floor(chartData.length / 8)}
            />
            <YAxis
              stroke="#64748B"
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              domain={[20, 100]}
              label={{
                value: `温度 (${FIELD_UNITS.temperature})`,
                angle: -90,
                position: 'insideLeft',
                fill: '#94A3B8',
                style: { textAnchor: 'middle', fontSize: 12 },
              }}
            />
            <Tooltip content={customTooltip} />
            <Legend />

            <ReferenceLine
              y={DEFAULT_THRESHOLD_CONFIG.temperatureWarning}
              stroke="#F59E0B"
              strokeDasharray="5 5"
              label={{
                value: `警告阈值 ${DEFAULT_THRESHOLD_CONFIG.temperatureWarning}°C`,
                fill: '#F59E0B',
                fontSize: 11,
                position: 'insideTopRight',
              }}
            />
            <ReferenceLine
              y={DEFAULT_THRESHOLD_CONFIG.temperatureDanger}
              stroke="#EF4444"
              strokeDasharray="5 5"
              label={{
                value: `危险阈值 ${DEFAULT_THRESHOLD_CONFIG.temperatureDanger}°C`,
                fill: '#EF4444',
                fontSize: 11,
                position: 'insideTopRight',
              }}
            />

            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#60A5FA"
              strokeWidth={2}
              dot={customDot}
              activeDot={{ r: 8 }}
              name="温度"
              connectNulls={false}
            />

            <Scatter dataKey="temperature" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-500 mt-3 text-center">
        点击数据点可查看该记录的完整判断过程 · 极端值已用红色脉动标记并从平均值计算中排除
      </p>
    </div>
  );
}
