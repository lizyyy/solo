import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { generateSwapSchemes } from '@/algorithm/seatSwap';
import { Calculator, Sliders, ArrowRightLeft, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function ComputePage() {
  const navigate = useNavigate();
  const {
    passengers,
    seatMap,
    paidSeats,
    companionGroups,
    weightConfig,
    setWeightConfig,
    swapSchemes,
    setSwapSchemes,
    selectedSchemeId,
    setSelectedSchemeId,
  } = useAppStore();

  const [isComputing, setIsComputing] = useState(false);
  const [showWeightConfig, setShowWeightConfig] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSchemeId1, setCompareSchemeId1] = useState<string | null>(null);
  const [compareSchemeId2, setCompareSchemeId2] = useState<string | null>(null);

  const handleCompute = async () => {
    if (!seatMap) return;

    setIsComputing(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const schemes = generateSwapSchemes(
      passengers,
      seatMap.seats.filter((s) => s.status !== 'blocked'),
      paidSeats,
      companionGroups,
      weightConfig,
      3
    );

    setSwapSchemes(schemes);
    if (schemes.length > 0) {
      setSelectedSchemeId(schemes[0].schemeId);
    }
    setIsComputing(false);
  };

  const handleSelectScheme = (schemeId: string) => {
    if (compareMode) {
      if (!compareSchemeId1) {
        setCompareSchemeId1(schemeId);
      } else if (!compareSchemeId2 && compareSchemeId1 !== schemeId) {
        setCompareSchemeId2(schemeId);
      }
    } else {
      setSelectedSchemeId(schemeId);
    }
  };

  const handleViewConflicts = () => {
    navigate('/conflict');
  };

  const handleViewReport = () => {
    navigate('/report');
  };

  const selectedScheme = swapSchemes.find((s) => s.schemeId === selectedSchemeId);
  const compareScheme1 = swapSchemes.find((s) => s.schemeId === compareSchemeId1);
  const compareScheme2 = swapSchemes.find((s) => s.schemeId === compareSchemeId2);

  const weights = [
    { key: 'paidSeatWeight', label: '付费座位权重', min: 1, max: 20 },
    { key: 'companionWeight', label: '同行权重', min: 1, max: 20 },
    { key: 'cabinDiffWeight', label: '舱位差异权重', min: 1, max: 15 },
    { key: 'distanceWeight', label: '移动距离权重', min: 1, max: 15 },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-primary-800">调座计算</h1>
          <p className="text-primary-600 mt-1">配置权重参数，运行二分匹配算法生成调座方案</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              setCompareSchemeId1(null);
              setCompareSchemeId2(null);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              compareMode
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-primary-300 text-primary-700 hover:bg-primary-50'
            )}
          >
            <ArrowRightLeft className="w-4 h-4" />
            方案对比
          </button>
          <button
            onClick={handleCompute}
            disabled={isComputing || !seatMap}
            className="flex items-center gap-2 px-6 py-2 bg-accent-400 text-primary-800 rounded-lg hover:bg-accent-500 transition-colors font-medium shadow-md disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {isComputing ? '计算中...' : '开始匹配'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowWeightConfig(!showWeightConfig)}
          className="w-full flex items-center justify-between p-4 border-b border-gray-200 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-primary-600" />
            <span className="font-semibold text-primary-700">权重配置</span>
          </div>
          {showWeightConfig ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showWeightConfig && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-8">
              {weights.map((w) => (
                <div key={w.key}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">{w.label}</label>
                    <span className="text-sm font-bold text-primary-600">{weightConfig[w.key]}</span>
                  </div>
                  <input
                    type="range"
                    min={w.min}
                    max={w.max}
                    value={weightConfig[w.key]}
                    onChange={(e) => setWeightConfig({ ...weightConfig, [w.key]: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {compareMode && compareScheme1 && compareScheme2 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-primary-700 mb-4">方案对比</h3>
          <div className="grid grid-cols-2 gap-6">
            {[compareScheme1, compareScheme2].map((scheme, idx) => (
              <div key={scheme?.schemeId} className="border-2 border-primary-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-semibold text-primary-700">方案 {idx + 1}</h4>
                  {scheme?.isRecommended && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-accent-100 text-accent-700 text-xs rounded-full">
                      <Star className="w-3 h-3" />
                      推荐
                    </span>
                  )}
                </div>
                {scheme && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">总得分</span>
                      <span className="font-bold text-primary-600">{scheme.totalScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">调座人数</span>
                      <span className="font-medium">{scheme.actions.length} 人</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">冲突总数</span>
                      <span className="font-medium text-warning-600">{scheme.conflicts.length} 个</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">付费座位变更</span>
                      <span className="font-medium">
                        {scheme.conflicts.filter((c) => c.conflictType === 'paid_displaced').length} 个
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">同行拆分</span>
                      <span className="font-medium">
                        {scheme.conflicts.filter((c) => c.conflictType === 'companion_split').length} 个
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {swapSchemes.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-primary-700">
              生成方案 ({swapSchemes.length} 个)
              {compareMode && <span className="text-sm font-normal text-gray-500 ml-2">请选择两个方案进行对比</span>}
            </h3>
          </div>

          <div className="space-y-4">
            {swapSchemes.map((scheme, idx) => {
              const isSelected =
                (!compareMode && scheme.schemeId === selectedSchemeId) ||
                scheme.schemeId === compareSchemeId1 ||
                scheme.schemeId === compareSchemeId2;

              return (
                <div
                  key={scheme.schemeId}
                  onClick={() => handleSelectScheme(scheme.schemeId)}
                  className={cn(
                    'border-2 rounded-lg p-4 cursor-pointer transition-all',
                    isSelected ? 'border-accent-400 bg-accent-50' : 'border-gray-200 hover:border-primary-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center font-bold',
                          scheme.isRecommended ? 'bg-accent-400 text-primary-800' : 'bg-primary-100 text-primary-700'
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-primary-700">方案 {scheme.schemeId.split('-')[1]}</h4>
                          {scheme.isRecommended && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-accent-100 text-accent-700 text-xs rounded-full">
                              <Star className="w-3 h-3" />
                              推荐
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {scheme.actions.length} 人调座 · {scheme.conflicts.length} 个冲突
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-700">{scheme.totalScore}</div>
                      <div className="text-xs text-gray-500">总得分</div>
                    </div>
                  </div>

                  {isSelected && !compareMode && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewConflicts();
                          }}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                        >
                          查看冲突解释
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewReport();
                          }}
                          className="px-4 py-2 bg-accent-400 text-primary-800 rounded-lg hover:bg-accent-500 text-sm font-medium"
                        >
                          生成调座报告
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedScheme && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-primary-700 mb-4">方案详情 - 调座动作</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">乘客</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">原座位</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600"></th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">新座位</th>
                </tr>
              </thead>
              <tbody>
                {selectedScheme.actions.map((action) => {
                  const passenger = passengers.find((p) => p.id === action.passengerId);
                  return (
                    <tr key={action.actionId} className="border-b border-gray-100">
                      <td className="py-3 px-4">{passenger?.name || action.passengerId}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded font-mono">
                          {action.fromSeat}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <ArrowRightLeft className="w-4 h-4 text-primary-500 mx-auto" />
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded font-mono">
                          {action.toSeat}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
