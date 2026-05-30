import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
} from 'recharts';
import { useSimulationStore } from '@/store/useSimulationStore';
import {
  generateEnergyConservationExplanation,
  generateFrictionLossExplanation,
  generateVelocityFittingExplanation,
} from '@/utils/explanation/generator';
import { exportToCSV, exportToJSON } from '@/utils/export/exporter';
import ReactMarkdown from 'react-markdown';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';

type ChartTab = 'energy' | 'velocity' | 'loss';

const CHART_COLORS = {
  potentialEnergy: '#5e88cd',
  kineticEnergy: '#ff8f42',
  frictionLoss: '#eb4848',
  airDragLoss: '#a855f7',
  velocity: '#5e88cd',
  sample: '#ff8f42',
};

export default function Analysis() {
  const { currentSimulation } = useSimulationStore();
  const [activeTab, setActiveTab] = useState<ChartTab>('energy');

  const chartData = useMemo(() => {
    if (!currentSimulation) return [];
    return currentSimulation.dataPoints.map((d) => ({
      time: d.timestamp,
      potentialEnergy: d.potentialEnergy,
      kineticEnergy: d.kineticEnergy,
      frictionLoss: d.frictionLoss,
      airDragLoss: d.airDragLoss,
      velocity: d.velocity,
      isSupplemented: d.isSupplemented,
    }));
  }, [currentSimulation]);

  const sampleData = useMemo(() => {
    if (!currentSimulation) return [];
    return currentSimulation.dataPoints
      .filter((d) => d.sample)
      .map((d) => ({
        time: d.timestamp,
        measuredVelocity: d.sample!.measuredVelocity,
      }));
  }, [currentSimulation]);

  const lossPieData = useMemo(() => {
    if (!currentSimulation || currentSimulation.dataPoints.length === 0) return [];
    const lastPoint = currentSimulation.dataPoints[currentSimulation.dataPoints.length - 1];
    return [
      { name: '摩擦损耗', value: lastPoint.frictionLoss, color: CHART_COLORS.frictionLoss },
      { name: '空气阻力损耗', value: lastPoint.airDragLoss, color: CHART_COLORS.airDragLoss },
    ];
  }, [currentSimulation]);

  const explanation = useMemo(() => {
    if (!currentSimulation) return '';
    const dp = currentSimulation.dataPoints;
    const pp = currentSimulation.physicsParams;
    switch (activeTab) {
      case 'energy':
        return generateEnergyConservationExplanation(dp, pp);
      case 'loss':
        return generateFrictionLossExplanation(dp, pp);
      case 'velocity':
        return generateVelocityFittingExplanation(dp);
      default:
        return '';
    }
  }, [currentSimulation, activeTab]);

  if (!currentSimulation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-primary-300">尚未创建模拟，请先新建模拟</p>
      </div>
    );
  }

  const tabs: { key: ChartTab; label: string }[] = [
    { key: 'energy', label: '能量图表' },
    { key: 'velocity', label: '速度分析' },
    { key: 'loss', label: '损耗分析' },
  ];

  const handleExportCSV = () => {
    exportToCSV(currentSimulation.dataPoints, currentSimulation.name);
  };

  const handleExportJSON = () => {
    exportToJSON(currentSimulation, currentSimulation.name);
  };

  const handleExportPNG = () => {
    const chartEl = document.querySelector('.recharts-surface');
    if (!chartEl) return;
    const svgData = new XMLSerializer().serializeToString(chartEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = '#0e203a';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `${currentSimulation.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-primary-700/30 px-4 py-2">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === key
                ? 'bg-primary-600 text-white'
                : 'text-primary-200 hover:bg-primary-800 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="card p-4 mb-4">
          <ResponsiveContainer width="100%" height={320}>
            {activeTab === 'energy' ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="time" tick={{ fill: '#9fb9e2', fontSize: 11 }} label={{ value: '时间 (s)', position: 'insideBottom', offset: -2, fill: '#9fb9e2', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9fb9e2', fontSize: 11 }} label={{ value: '能量 (J)', angle: -90, position: 'insideLeft', fill: '#9fb9e2', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#162d4b', border: '1px solid #1e3a5f', borderRadius: 8, color: '#e2e8f0' }} />
                <Legend />
                <Area type="monotone" dataKey="potentialEnergy" name="势能" stroke={CHART_COLORS.potentialEnergy} fill={CHART_COLORS.potentialEnergy} fillOpacity={0.2} />
                <Area type="monotone" dataKey="kineticEnergy" name="动能" stroke={CHART_COLORS.kineticEnergy} fill={CHART_COLORS.kineticEnergy} fillOpacity={0.2} />
                <Area type="monotone" dataKey="frictionLoss" name="摩擦损耗" stroke={CHART_COLORS.frictionLoss} fill={CHART_COLORS.frictionLoss} fillOpacity={0.2} />
                <Area type="monotone" dataKey="airDragLoss" name="空气阻力损耗" stroke={CHART_COLORS.airDragLoss} fill={CHART_COLORS.airDragLoss} fillOpacity={0.2} />
              </AreaChart>
            ) : activeTab === 'velocity' ? (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="time" tick={{ fill: '#9fb9e2', fontSize: 11 }} label={{ value: '时间 (s)', position: 'insideBottom', offset: -2, fill: '#9fb9e2', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9fb9e2', fontSize: 11 }} label={{ value: '速度 (m/s)', angle: -90, position: 'insideLeft', fill: '#9fb9e2', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#162d4b', border: '1px solid #1e3a5f', borderRadius: 8, color: '#e2e8f0' }} />
                <Legend />
                <Line type="monotone" dataKey="velocity" name="模拟速度" stroke={CHART_COLORS.velocity} dot={false} strokeWidth={2} />
                <Scatter name="实测采样" data={sampleData} dataKey="measuredVelocity" fill={CHART_COLORS.sample} />
              </ComposedChart>
            ) : (
              <PieChart>
                <Pie
                  data={lossPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                >
                  {lossPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#162d4b', border: '1px solid #1e3a5f', borderRadius: 8, color: '#e2e8f0' }} />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="card p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">解释生成</h3>
          <div className="text-sm text-primary-200 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{explanation}</ReactMarkdown>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">导出数据</h3>
          <div className="flex gap-2">
            <button onClick={handleExportPNG} className="btn-primary flex items-center gap-1.5 text-sm">
              <Download size={14} />
              导出 PNG
            </button>
            <button onClick={handleExportCSV} className="btn-primary flex items-center gap-1.5 text-sm">
              <FileSpreadsheet size={14} />
              导出 CSV
            </button>
            <button onClick={handleExportJSON} className="btn-primary flex items-center gap-1.5 text-sm">
              <FileJson size={14} />
              导出 JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
