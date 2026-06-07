import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import PageHeader from '../components/PageHeader';
import { Calculator, ChevronDown, ChevronUp, Info, History, Settings } from 'lucide-react';

const paramVersions = [
  {
    version: 'v2.1.0',
    date: '2024-05-15',
    isCurrent: true,
    params: {
      rampWeight: 0.4,
      complaintWeight: 0.3,
      areaSizeFactor: 0.2,
      populationDensity: 0.1,
    },
    changeLog: '调整坡道权重从0.35提升至0.4，根据近3个月数据分析，坡道问题对居民满意度影响更大',
  },
  {
    version: 'v2.0.0',
    date: '2024-03-01',
    isCurrent: false,
    params: {
      rampWeight: 0.35,
      complaintWeight: 0.35,
      areaSizeFactor: 0.2,
      populationDensity: 0.1,
    },
    changeLog: '模型重大更新，新增人口密度参数，优化评分算法',
  },
  {
    version: 'v1.5.0',
    date: '2024-01-10',
    isCurrent: false,
    params: {
      rampWeight: 0.3,
      complaintWeight: 0.4,
      areaSizeFactor: 0.3,
      populationDensity: 0,
    },
    changeLog: '初始版本参数配置',
  },
];

export default function CalculationPanel() {
  const { scoreCalculations } = useAppStore();
  const [expandedVersion, setExpandedVersion] = useState<string | null>('v2.1.0');
  const [expandedCalc, setExpandedCalc] = useState<string | null>(null);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="计算面板"
        subtitle="专业评分模型参数配置、版本对比与取舍理由说明"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-600" />
            参数版本管理
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            所有评分计算使用的参数版本都会留痕，确保结果可追溯、可解释
          </p>

          <div className="space-y-3">
            {paramVersions.map((version) => (
              <div key={version.version} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedVersion(
                    expandedVersion === version.version ? null : version.version
                  )}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                      version.isCurrent 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {version.version.split('.')[0]}.{version.version.split('.')[1]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{version.version}</p>
                        {version.isCurrent && (
                          <span className="badge bg-green-100 text-green-700">当前版本</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{version.date}</p>
                    </div>
                  </div>
                  {expandedVersion === version.version ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {expandedVersion === version.version && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {Object.entries(version.params).map(([key, value]) => (
                        <div key={key} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">{key}</p>
                          <p className="font-mono font-bold text-gray-900 mt-1">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs font-medium text-blue-800 flex items-center gap-1 mb-1">
                        <Info className="w-3 h-3" />
                        版本更新说明
                      </p>
                      <p className="text-sm text-blue-700">{version.changeLog}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary-600" />
            计算结果追溯
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            每条评分结果都附带参数快照和取舍理由，做到"知其然，知其所以然"
          </p>

          <div className="space-y-3">
            {scoreCalculations.map((calc) => (
              <div key={calc.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedCalc(
                    expandedCalc === calc.id ? null : calc.id
                  )}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-primary-700">{calc.score}</span>
                      <span className="text-sm text-gray-500">分</span>
                      <span className="badge bg-gray-100 text-gray-600 font-mono">
                        {calc.modelVersion}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      计算人：{calc.calculatedBy} · {calc.calculatedAt.split('T')[0]}
                    </p>
                  </div>
                  {expandedCalc === calc.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {expandedCalc === calc.id && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">参数快照</p>
                      <div className="p-3 bg-gray-900 rounded-lg font-mono text-xs text-green-400 overflow-x-auto">
                        <pre>{JSON.stringify(calc.params, null, 2)}</pre>
                      </div>
                    </div>
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm font-medium text-orange-800 flex items-center gap-2 mb-2">
                        <History className="w-4 h-4" />
                        取舍理由
                      </p>
                      <p className="text-sm text-orange-700">{calc.tradeOffReason}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">评分公式说明</h3>
        <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
          <p className="text-gray-700">
            综合评分 = 坡道评分 × 坡道权重 + 投诉评分 × 投诉权重 + 区域系数 × 区域大小因子 + 人口密度因子
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-white rounded border border-gray-200">
            <p className="text-gray-500 text-xs">坡道评分</p>
            <p className="text-gray-900 mt-1">0-100分，根据坡度、防滑、扶手等综合评估</p>
          </div>
          <div className="p-3 bg-white rounded border border-gray-200">
            <p className="text-gray-500 text-xs">投诉评分</p>
            <p className="text-gray-900 mt-1">100 - 投诉数量×10，反映居民满意度</p>
          </div>
          <div className="p-3 bg-white rounded border border-gray-200">
            <p className="text-gray-500 text-xs">区域系数</p>
            <p className="text-gray-900 mt-1">根据区域面积调整，越大得分越高</p>
          </div>
          <div className="p-3 bg-white rounded border border-gray-200">
            <p className="text-gray-500 text-xs">人口密度</p>
            <p className="text-gray-900 mt-1">高密度区域适当加分，资源更紧张</p>
          </div>
        </div>
      </div>
    </div>
  );
}
