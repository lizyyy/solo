import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Database,
  Hash,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  FileText,
  FileJson,
  Trophy,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
} from 'lucide-react';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b'];

const ComparisonPanel: React.FC = () => {
  const { currentResult, currentExperiment } = useAppStore();
  const [exportFormat, setExportFormat] = useState<'markdown' | 'json'>('markdown');

  if (!currentResult || !currentExperiment) {
    return (
      <div className="card">
        <div className="card-body py-20 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">请先运行实验以查看对比分析</p>
        </div>
      </div>
    );
  }

  const { comparison } = currentResult;

  const radarData = [
    { subject: '等值查询', bplus: 80, hash: 100 },
    { subject: '范围查询', bplus: 100, hash: 10 },
    { subject: '前缀查询', bplus: 90, hash: 10 },
    { subject: '插入性能', bplus: 70, hash: 85 },
    { subject: '删除性能', bplus: 65, hash: 80 },
    { subject: '排序支持', bplus: 100, hash: 0 },
  ];

  const winsData = [
    { name: 'B+ 树', value: comparison.bplus.queriesWon },
    { name: '哈希', value: comparison.hash.queriesWon },
  ];

  const performanceData = [
    { name: '总页访问', 'B+ 树': comparison.bplus.totalPageAccesses, 哈希: comparison.hash.totalPageAccesses },
  ];

  const exportToMarkdown = () => {
    const now = new Date().toISOString();
    const md = `# 数据库索引对比实验报告

## 实验信息
- **实验名称**: ${currentExperiment.name}
- **实验 ID**: ${currentExperiment.id}
- **生成时间**: ${now}
- **随机种子**: ${currentExperiment.seed}

## 实验配置
- **数据规模**: ${currentExperiment.dataSize} 条记录
- **B+ 树阶数**: ${currentExperiment.bplusOrder}
- **哈希初始桶数**: ${currentExperiment.hashInitialBuckets}
- **哈希负载因子**: ${currentExperiment.hashLoadFactor}

## 查询样本 (${currentExperiment.queries.length} 个)

| 查询名称 | 类型 | B+ 树耗时 | 哈希耗时 | 胜出者 |
|----------|------|-----------|----------|--------|
${currentResult.queryResults.map((qr) => 
  `| ${qr.queryName} | ${qr.queryType} | ${qr.bplusResult.stats.estimatedTime}ms | ${qr.hashResult.stats.estimatedTime}ms | ${
    qr.winner === 'bplus' ? 'B+ 树' : qr.winner === 'hash' ? '哈希' : '平局'
  } |`
).join('\n')}

## 综合对比

### 总体统计
| 指标 | B+ 树 | 哈希索引 |
|------|--------|----------|
| 总页访问次数 | ${comparison.bplus.totalPageAccesses} | ${comparison.hash.totalPageAccesses} |
| 总耗时 | ${comparison.bplus.totalTime}ms | ${comparison.hash.totalTime}ms |
| 查询胜出数 | ${comparison.bplus.queriesWon} | ${comparison.hash.queriesWon} |

### 总体胜出: ${
  comparison.overallWinner === 'bplus' ? 'B+ 树索引' : comparison.overallWinner === 'hash' ? '哈希索引' : '平局'
}

## B+ 树索引分析

### 优势
${comparison.bplus.strengths.map((s) => `- ${s}`).join('\n')}

### 劣势
${comparison.bplus.weaknesses.map((w) => `- ${w}`).join('\n')}

### 最佳适用场景
${comparison.bplus.bestScenarios.map((s) => `- ${s}`).join('\n')}

## 哈希索引分析

### 优势
${comparison.hash.strengths.map((s) => `- ${s}`).join('\n')}

### 劣势
${comparison.hash.weaknesses.map((w) => `- ${w}`).join('\n')}

### 最佳适用场景
${comparison.hash.bestScenarios.map((s) => `- ${s}`).join('\n')}

## 建议

${comparison.recommendations.map((r) => `- ${r}`).join('\n')}

---

*此报告由数据库索引实验台自动生成
`;

    downloadFile(md, `experiment-report-${Date.now()}.md`, 'text/markdown');
  };

  const exportToJson = () => {
    const data = {
      experiment: currentExperiment,
      result: currentResult,
      generatedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `experiment-result-${Date.now()}.json`, 'application/json');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (exportFormat === 'markdown') {
      exportToMarkdown();
    } else {
      exportToJson();
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-amber-500 p-2 rounded-lg">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">综合对比分析</h2>
                <p className="text-sm text-gray-500">
                  总体胜出: 
                  <span className={`font-semibold ml-1 ${
                    comparison.overallWinner === 'bplus' ? 'text-primary-600' :
                    comparison.overallWinner === 'hash' ? 'text-accent-600' : 'text-gray-600'
                  }`}>
                    {comparison.overallWinner === 'bplus' ? 'B+ 树索引' :
                     comparison.overallWinner === 'hash' ? '哈希索引' : '平局'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setExportFormat('markdown')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    exportFormat === 'markdown'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Markdown</span>
                </button>
                <button
                  onClick={() => setExportFormat('json')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    exportFormat === 'json'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FileJson className="w-4 h-4" />
                  <span>JSON</span>
                </button>
              </div>
              <button
                onClick={handleExport}
                className="btn btn-primary"
              >
                <Download className="w-4 h-4 mr-2" />
                导出报告
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">能力雷达图</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="B+ 树" dataKey="bplus" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.3} />
                  <Radar name="哈希" dataKey="hash" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">查询胜出统计</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {winsData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center space-x-6 mt-2">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-primary-500" />
                <span className="text-sm text-gray-600">B+ 树: {comparison.bplus.queriesWon} 胜</span>
              </div>
              <div className="flex items-center space-x-2">
                <Hash className="w-4 h-4 text-accent-500" />
                <span className="text-sm text-gray-600">哈希: {comparison.hash.queriesWon} 胜</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-900">B+ 树索引分析</h3>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <ThumbsUp className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-medium text-gray-700">优势</h4>
              </div>
              <ul className="space-y-1.5">
                {comparison.bplus.strengths.map((s, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-2">
                <ThumbsDown className="w-4 h-4 text-red-500" />
                <h4 className="text-sm font-medium text-gray-700">劣势</h4>
              </div>
              <ul className="space-y-1.5">
                {comparison.bplus.weaknesses.map((w, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">{w}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1.5">
                <Lightbulb className="w-4 h-4 text-primary-600" />
                <h4 className="text-sm font-medium text-primary-800">最佳适用场景</h4>
              </div>
              <ul className="space-y-1">
                {comparison.bplus.bestScenarios.map((s, idx) => (
                  <li key={idx} className="text-sm text-primary-700">• {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-2">
              <Hash className="w-5 h-5 text-accent-500" />
              <h3 className="font-semibold text-gray-900">哈希索引分析</h3>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <ThumbsUp className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-medium text-gray-700">优势</h4>
              </div>
              <ul className="space-y-1.5">
                {comparison.hash.strengths.map((s, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-2">
                <ThumbsDown className="w-4 h-4 text-red-500" />
                <h4 className="text-sm font-medium text-gray-700">劣势</h4>
              </div>
              <ul className="space-y-1.5">
                {comparison.hash.weaknesses.map((w, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">{w}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-accent-50 border border-accent-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1.5">
                <Lightbulb className="w-4 h-4 text-accent-600" />
                <h4 className="text-sm font-medium text-accent-800">最佳适用场景</h4>
              </div>
              <ul className="space-y-1">
                {comparison.hash.bestScenarios.map((s, idx) => (
                  <li key={idx} className="text-sm text-accent-700">• {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-900">建议</h3>
          </div>
        </div>
        <div className="card-body">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <ul className="space-y-2">
              {comparison.recommendations.map((r, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-amber-600 font-bold">{idx + 1}.</span>
                  <span className="text-amber-800">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonPanel;
