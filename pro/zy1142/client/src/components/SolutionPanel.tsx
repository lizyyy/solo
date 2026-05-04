import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { 
  BookOpen, 
  Calculator, 
  ChevronDown, 
  ChevronRight,
  Table,
  Target,
  Zap
} from 'lucide-react';
import EquationRenderer from './EquationRenderer';
import { 
  PhysicsSolution, 
  PhysicsProblemType,
  KeyQuantity
} from '../../../shared/types';

interface SolutionPanelProps {
  solution: PhysicsSolution;
  problemType: PhysicsProblemType;
}

const SolutionPanel: React.FC<SolutionPanelProps> = ({ solution, problemType }) => {
  const [expandedSections, setExpandedSections] = React.useState<{
    equations: boolean;
    derivations: boolean;
    substitutions: boolean;
    results: boolean;
    keyQuantities: boolean;
    charts: boolean;
  }>({
    equations: true,
    derivations: true,
    substitutions: true,
    results: true,
    keyQuantities: true,
    charts: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const SectionHeader: React.FC<{
    title: string;
    icon: React.ReactNode;
    section: keyof typeof expandedSections;
    count?: number;
  }> = ({ title, icon, section, count }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-semibold text-white">{title}</span>
        {count !== undefined && (
          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
            {count}
          </span>
        )}
      </div>
      {expandedSections[section] ? (
        <ChevronDown className="w-5 h-5 text-gray-400" />
      ) : (
        <ChevronRight className="w-5 h-5 text-gray-400" />
      )}
    </button>
  );

  const getChartData = () => {
    return solution.trajectory.map(point => {
      const data: any = {
        time: point.time.toFixed(2),
        x: parseFloat(point.x.toFixed(3)),
        y: parseFloat(point.y.toFixed(3)),
      };
      
      if (point.velocity !== undefined) {
        data.velocity = parseFloat(point.velocity.toFixed(3));
      }
      if (point.vx !== undefined) {
        data.vx = parseFloat(point.vx.toFixed(3));
      }
      if (point.vy !== undefined) {
        data.vy = parseFloat(point.vy.toFixed(3));
      }
      if (point.acceleration !== undefined) {
        data.acceleration = parseFloat(point.acceleration.toFixed(3));
      }
      if (point.extension !== undefined) {
        data.extension = parseFloat(point.extension.toFixed(3));
      }
      
      return data;
    });
  };

  const chartData = getChartData();

  const KeyQuantitiesTable: React.FC<{ quantities: KeyQuantity[] }> = ({ quantities }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-700">
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">物理量</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">值</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">单位</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">阶段</th>
          </tr>
        </thead>
        <tbody>
          {quantities.map((q, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}>
              <td className="px-4 py-3 text-white font-medium">{q.label}</td>
              <td className="px-4 py-3 text-blue-400 font-mono">{q.value.toFixed(3)}</td>
              <td className="px-4 py-3 text-gray-400">{q.unit}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                  {q.phase}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const ResultsTable: React.FC = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-700">
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">物理量</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">符号</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">值</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">单位</th>
            <th className="px-4 py-3 text-left text-gray-300 font-semibold">说明</th>
          </tr>
        </thead>
        <tbody>
          {solution.results.map((result, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}>
              <td className="px-4 py-3 text-white font-medium">{result.label}</td>
              <td className="px-4 py-3 text-gray-400 font-mono">{result.name}</td>
              <td className="px-4 py-3 text-blue-400 font-mono font-semibold">
                {isFinite(result.value) ? result.value.toFixed(4) : '∞'}
              </td>
              <td className="px-4 py-3 text-gray-400">{result.unit}</td>
              <td className="px-4 py-3 text-gray-500 text-sm">{result.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const FinalAnswers: React.FC = () => (
    <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-xl p-6">
      <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
        <Target className="w-5 h-5" />
        最终答案
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {solution.finalAnswers.map((answer, index) => (
          <div
            key={index}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="text-sm text-gray-400 mb-2">{answer.label}</div>
            <div className="text-center py-2">
              <EquationRenderer latex={answer.latex} displayMode={true} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <FinalAnswers />

      <div className="space-y-3">
        <SectionHeader
          title="关键物理量"
          icon={<Table className="w-5 h-5 text-blue-400" />}
          section="keyQuantities"
          count={solution.keyQuantities.length}
        />
        {expandedSections.keyQuantities && (
          <div className="bg-gray-800 rounded-lg overflow-hidden fade-in">
            <KeyQuantitiesTable quantities={solution.keyQuantities} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="基本公式"
          icon={<BookOpen className="w-5 h-5 text-purple-400" />}
          section="equations"
          count={solution.equations.length}
        />
        {expandedSections.equations && (
          <div className="space-y-3 fade-in">
            {solution.equations.map((eq) => (
              <div key={eq.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    eq.type === 'principle' ? 'bg-red-500/20 text-red-400' :
                    eq.type === 'definition' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {eq.type === 'principle' ? '原理' :
                     eq.type === 'definition' ? '定义' : '推导'}
                  </span>
                  <span className="text-gray-400 text-sm">{eq.description}</span>
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <EquationRenderer latex={eq.latex} displayMode={true} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="推导步骤"
          icon={<Calculator className="w-5 h-5 text-orange-400" />}
          section="derivations"
          count={solution.derivations.length}
        />
        {expandedSections.derivations && (
          <div className="space-y-3 fade-in">
            {solution.derivations.map((step) => (
              <div key={step.step} className="bg-gray-800 rounded-lg p-4 border-l-4 border-orange-500">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {step.step}
                  </span>
                  <span className="text-white font-medium">{step.explanation}</span>
                </div>
                {step.rule && (
                  <div className="mb-3 ml-11 text-sm text-gray-400">
                    <span className="text-orange-400">依据：</span> {step.rule}
                  </div>
                )}
                <div className="ml-11 bg-gray-700 rounded-lg p-3">
                  <EquationRenderer latex={step.latex} displayMode={true} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="数值代入"
          icon={<Zap className="w-5 h-5 text-yellow-400" />}
          section="substitutions"
          count={solution.substitutions.length}
        />
        {expandedSections.substitutions && (
          <div className="space-y-3 fade-in">
            {solution.substitutions.map((step) => (
              <div key={step.step} className="bg-gray-800 rounded-lg p-4 border-l-4 border-yellow-500">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {step.step}
                  </span>
                  <span className="text-white font-medium">{step.explanation}</span>
                </div>
                <div className="ml-11 bg-gray-700 rounded-lg p-3">
                  <EquationRenderer latex={step.latex} displayMode={true} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="详细结果"
          icon={<Table className="w-5 h-5 text-teal-400" />}
          section="results"
          count={solution.results.length}
        />
        {expandedSections.results && (
          <div className="bg-gray-800 rounded-lg overflow-hidden fade-in">
            <ResultsTable />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="运动图表"
          icon={<Calculator className="w-5 h-5 text-indigo-400" />}
          section="charts"
        />
        {expandedSections.charts && (
          <div className="space-y-6 fade-in">
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-4">位置-时间图</h4>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorX" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" label={{ value: '时间 (s)', position: 'bottom', fill: '#9ca3af' }} />
                  <YAxis stroke="#9ca3af" label={{ value: '位置 (m)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="x" name="x位置" stroke="#3b82f6" fillOpacity={1} fill="url(#colorX)" />
                  {problemType !== 'spring' && (
                    <Area type="monotone" dataKey="y" name="y位置" stroke="#22c55e" fillOpacity={1} fill="url(#colorY)" />
                  )}
                  {problemType === 'spring' && (
                    <Area type="monotone" dataKey="extension" name="位移" stroke="#f59e0b" fillOpacity={1} fill="url(#colorX)" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {chartData.some(d => d.velocity !== undefined) && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-4">速度-时间图</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9ca3af" label={{ value: '时间 (s)', position: 'bottom', fill: '#9ca3af' }} />
                    <YAxis stroke="#9ca3af" label={{ value: '速度 (m/s)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Legend />
                    {problemType === 'spring' ? (
                      <Line type="monotone" dataKey="velocity" name="速度" stroke="#22c55e" strokeWidth={2} dot={false} />
                    ) : (
                      <>
                        <Line type="monotone" dataKey="vx" name="x速度" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="vy" name="y速度" stroke="#22c55e" strokeWidth={2} dot={false} />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartData.some(d => d.acceleration !== undefined) && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-4">加速度-时间图</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9ca3af" label={{ value: '时间 (s)', position: 'bottom', fill: '#9ca3af' }} />
                    <YAxis stroke="#9ca3af" label={{ value: '加速度 (m/s²)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="acceleration" name="加速度" stroke="#ef4444" fillOpacity={1} fill="url(#colorAcc)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SolutionPanel;
