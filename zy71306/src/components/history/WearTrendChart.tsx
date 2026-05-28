import { useCalibrationStore } from '../../store/calibrationStore';
import { Card } from '../common/Card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatTime } from '../../utils/formatters';

export default function WearTrendChart() {
  const { records, selectedRecords } = useCalibrationStore();

  const chartData = records
    .slice(0, 20)
    .reverse()
    .map((record, index) => ({
      index,
      time: formatTime(record.timestamp),
      磨损: Math.round(record.wearLevel),
      压力: record.stylusPressure * 30,
      id: record.id,
      isSelected: selectedRecords.includes(record.id),
    }));

  if (chartData.length === 0) {
    return (
      <Card title="磨损趋势">
        <div className="text-center py-12 text-walnut-400">
          <p>暂无校准记录</p>
          <p className="text-sm mt-2">保存校准后将显示趋势图表</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="磨损趋势 (最近20条)">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3d2410" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#8b7355', fontSize: 10 }}
              tickLine={{ stroke: '#5d3a1a' }}
            />
            <YAxis
              tick={{ fill: '#8b7355', fontSize: 10 }}
              tickLine={{ stroke: '#5d3a1a' }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#2C1810',
                border: '1px solid #D4AF37',
                borderRadius: '8px',
                color: '#E8C04A',
              }}
              labelStyle={{ color: '#D4AF37' }}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
            <Line
              type="monotone"
              dataKey="磨损"
              stroke="#C41E3A"
              strokeWidth={2}
              dot={{ fill: '#C41E3A', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#FF6B35' }}
            />
            <Line
              type="monotone"
              dataKey="压力"
              stroke="#D4AF37"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-6 mt-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-danger-500" />
          <span className="text-walnut-300">磨损程度 (%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-brass-500" style={{ borderStyle: 'dashed' }} />
          <span className="text-walnut-300">唱针压力 (相对值)</span>
        </div>
      </div>
    </Card>
  );
}
