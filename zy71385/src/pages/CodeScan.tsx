import { useState, useEffect } from 'react';
import { Play, Settings, FileCode, Search, AlertTriangle, CheckCircle, Info, Loader2, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useFlagStore } from '../store/flagStore';
import { Card } from '../components/Card';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { getMatchTypeLabel } from '../utils/riskCalculator';
import type { MatchType } from '../types';

const MATCH_TYPE_COLORS: Record<MatchType, string> = {
  static: '#10B981',
  dynamic: '#EF4444',
  suspected: '#F59E0B',
};

export function CodeScan() {
  const {
    codeReferences,
    flags,
    rules,
    initData,
    runScan,
    loading,
    getStatistics,
  } = useFlagStore();

  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);

  useEffect(() => {
    if (flags.length === 0) initData();
  }, [flags.length, initData]);

  const stats = getStatistics();

  const matchTypeStats = {
    static: codeReferences.filter(r => r.matchType === 'static').length,
    dynamic: codeReferences.filter(r => r.matchType === 'dynamic').length,
    suspected: codeReferences.filter(r => r.matchType === 'suspected').length,
  };

  const pieData = Object.entries(matchTypeStats).map(([type, count]) => ({
    name: getMatchTypeLabel(type),
    value: count,
    color: MATCH_TYPE_COLORS[type as MatchType],
  }));

  const flagsWithRefs = flags.filter(f => f.codeReferences.length > 0).length;
  const flagsNoRefs = flags.length - flagsWithRefs;

  const barData = [
    { name: '有代码引用', value: flagsWithRefs, color: '#6366F1' },
    { name: '无代码引用', value: flagsNoRefs, color: '#10B981' },
  ];

  const handleRunScan = async () => {
    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([]);

    const logs = [
      '开始扫描代码仓库...',
      '正在解析 TypeScript AST...',
      '检测静态引用模式...',
      '检测动态引用模式...',
      '匹配功能开关 Key...',
      '分析引用置信度...',
      '生成扫描报告...',
    ];

    for (let i = 0; i < logs.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setScanLogs(prev => [...prev, logs[i]]);
      setScanProgress(Math.round(((i + 1) / logs.length) * 100));
    }

    await runScan();
    setIsScanning(false);
  };

  const dynamicPatternsRule = rules.find(r => r.ruleKey === 'scan.dynamic_patterns');
  const excludeDirsRule = rules.find(r => r.ruleKey === 'scan.exclude_dirs');

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message="正在加载..." />}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">代码引用扫描</h1>
          <p className="text-gray-500 mt-1">扫描代码库中的功能开关引用，检测潜在漏检风险</p>
        </div>
        <button
          onClick={handleRunScan}
          disabled={isScanning}
          className="btn-primary flex items-center gap-2"
        >
          {isScanning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {isScanning ? '扫描中...' : '开始扫描'}
        </button>
      </div>

      {isScanning && (
        <div className="card">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">扫描进度</span>
              <span className="text-sm font-medium text-primary-600">{scanProgress}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 h-48 overflow-y-auto">
            {scanLogs.map((log, index) => (
              <p key={index} className="text-sm text-green-400 font-mono mb-1">
                <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        <Card
          title="总引用数"
          value={codeReferences.length}
          icon={<FileCode className="w-6 h-6" />}
          color="blue"
          trend={`${flagsWithRefs} 个开关有引用`}
        />
        <Card
          title="静态引用"
          value={matchTypeStats.static}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
          trend="可准确识别"
        />
        <Card
          title="动态引用"
          value={matchTypeStats.dynamic}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="red"
          trend="需要人工确认"
        />
        <Card
          title="疑似动态"
          value={matchTypeStats.suspected}
          icon={<Info className="w-6 h-6" />}
          color="orange"
          trend="建议核查"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">引用类型分布</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">开关引用情况</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">扫描规则配置</h2>
            <button className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              <Settings className="w-4 h-4" />
              去设置
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">动态引用检测模式</span>
                <span className="text-xs text-gray-400">{dynamicPatternsRule?.enabled ? '已启用' : '已禁用'}</span>
              </div>
              <div className="space-y-2">
                {Array.isArray(dynamicPatternsRule?.value) && dynamicPatternsRule.value.map((pattern: string, idx: number) => (
                  <code key={idx} className="block text-xs bg-gray-900 text-green-400 p-2 rounded font-mono">
                    {pattern}
                  </code>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                <Info className="w-3 h-3 inline mr-1" />
                用于检测通过变量拼接等方式动态获取开关的代码模式，{'{key}'}会被替换为开关名
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">扫描排除目录</span>
                <span className="text-xs text-gray-400">{excludeDirsRule?.enabled ? '已启用' : '已禁用'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(excludeDirsRule?.value) && excludeDirsRule.value.map((dir: string, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs font-mono">
                    {dir}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                <Info className="w-3 h-3 inline mr-1" />
                扫描这些目录会浪费时间且可能产生误报
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">最近扫描结果</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {codeReferences.slice(0, 10).map((ref) => {
              const flag = flags.find(f => f.id === ref.flagId);
              return (
                <div key={ref.id} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{flag?.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{ref.filePath}:{ref.lineNumber}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      ref.matchType === 'static' ? 'bg-emerald-100 text-emerald-700' :
                      ref.matchType === 'dynamic' ? 'bg-red-100 text-red-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {getMatchTypeLabel(ref.matchType)}
                    </span>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                    <code>{ref.codeSnippet}</code>
                  </pre>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      置信度: {Math.round(ref.confidence * 100)}%
                    </span>
                    {ref.matchType !== 'static' && (
                      <span className="text-xs text-risk-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        建议人工确认
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">动态引用漏检提示</h2>
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </div>
        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 mb-2">动态引用漏检风险提示</p>
              <p className="text-sm text-red-700 leading-relaxed">
                ⚠️ 以下开关可能通过变量名动态拼接引用，静态扫描无法完全覆盖。
                建议全局搜索开关名的关键词片段进行人工确认。
                当前检测到 <strong>{matchTypeStats.dynamic + matchTypeStats.suspected}</strong> 处潜在的动态引用。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {flags
                  .filter(f => f.codeReferences.some(r => r.matchType !== 'static'))
                  .slice(0, 8)
                  .map(f => (
                    <span key={f.id} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      {f.name}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
