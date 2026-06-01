import React from 'react';
import { ArrowRight, RefreshCw, Layers, Info } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { getAvailableStressUnits, getAvailableLifeUnits, getUnitFullName } from '../../services/unitConversion';
import { formatNumber } from '../../utils/format';

const UnitConversion: React.FC = () => {
  const { preprocessConfig, setPreprocessConfig, processedData } = useDataStore();

  const stressUnits = getAvailableStressUnits();
  const lifeUnits = getAvailableLifeUnits();

  const stressUnitStats = React.useMemo(() => {
    const stats: Record<string, number> = {};
    processedData.forEach(item => {
      if (item.stressUnit) {
        stats[item.stressUnit] = (stats[item.stressUnit] || 0) + 1;
      }
    });
    return stats;
  }, [processedData]);

  const lifeUnitStats = React.useMemo(() => {
    const stats: Record<string, number> = {};
    processedData.forEach(item => {
      if (item.lifeUnit) {
        stats[item.lifeUnit] = (stats[item.lifeUnit] || 0) + 1;
      }
    });
    return stats;
  }, [processedData]);

  const convertedCount = React.useMemo(() => {
    return processedData.filter(item => 
      item.stressUnit !== item.targetStressUnit || 
      item.lifeUnit !== item.targetLifeUnit
    ).length;
  }, [processedData]);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          <span>单位换算配置</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-engineering-500">
          <RefreshCw className="w-3 h-3" />
          <span>已换算 {convertedCount} 条数据</span>
        </div>
      </div>
      <div className="card-body space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-engineering-700 flex items-center gap-1">
                应力目标单位
              </label>
              <select
                value={preprocessConfig.targetStressUnit}
                onChange={(e) => setPreprocessConfig({ targetStressUnit: e.target.value })}
                className="px-3 py-1.5 text-sm border border-engineering-300 rounded-engineering bg-white focus:outline-none focus:ring-2 focus:ring-engineering-500 focus:border-transparent"
              >
                {stressUnits.map(unit => (
                  <option key={unit} value={unit}>
                    {unit} ({getUnitFullName(unit, 'stress')})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-engineering-500">原始单位分布：</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stressUnitStats).map(([unit, count]) => (
                  <div
                    key={unit}
                    className={`
                      flex items-center gap-1 px-2 py-1 rounded-engineering text-xs
                      ${unit === preprocessConfig.targetStressUnit 
                        ? 'bg-success-50 border border-success-200 text-success-700' 
                        : 'bg-warning-50 border border-warning-200 text-warning-700'
                      }
                    `}
                  >
                    <span className="font-semibold">{unit}</span>
                    <span className="font-mono-num">{count}条</span>
                    {unit !== preprocessConfig.targetStressUnit && (
                      <ArrowRight className="w-3 h-3" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-engineering-700 flex items-center gap-1">
                寿命目标单位
              </label>
              <select
                value={preprocessConfig.targetLifeUnit}
                onChange={(e) => setPreprocessConfig({ targetLifeUnit: e.target.value })}
                className="px-3 py-1.5 text-sm border border-engineering-300 rounded-engineering bg-white focus:outline-none focus:ring-2 focus:ring-engineering-500 focus:border-transparent"
              >
                {lifeUnits.map(unit => (
                  <option key={unit} value={unit}>
                    {unit} ({getUnitFullName(unit, 'life')})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-engineering-500">原始单位分布：</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(lifeUnitStats).map(([unit, count]) => (
                  <div
                    key={unit}
                    className={`
                      flex items-center gap-1 px-2 py-1 rounded-engineering text-xs
                      ${unit === preprocessConfig.targetLifeUnit 
                        ? 'bg-success-50 border border-success-200 text-success-700' 
                        : 'bg-warning-50 border border-warning-200 text-warning-700'
                      }
                    `}
                  >
                    <span className="font-semibold">{unit}</span>
                    <span className="font-mono-num">{count}条</span>
                    {unit !== preprocessConfig.targetLifeUnit && (
                      <ArrowRight className="w-3 h-3" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-engineering">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700 space-y-1">
              <p className="font-medium">换算规则说明：</p>
              <p>• 应力单位：以 MPa 为基准进行换算，1 MPa = 0.145038 ksi = 0.101972 kgf/mm²</p>
              <p>• 寿命单位：基于试验频率 {preprocessConfig.testFrequency} Hz 进行时间-次数换算</p>
              <p>• 换算过程会自动记录到每条数据的处理历史中，可在溯源面板查看</p>
            </div>
          </div>
        </div>

        {processedData.length > 0 && (
          <div className="border-t border-engineering-200 pt-4">
            <h4 className="text-sm font-semibold text-engineering-700 mb-3">换算示例</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {processedData.filter(item => 
                item.stressUnit !== item.targetStressUnit || 
                item.lifeUnit !== item.targetLifeUnit
              ).slice(0, 2).map(item => (
                <div key={item.id} className="p-3 bg-engineering-50 rounded-engineering text-xs">
                  <div className="font-mono-num text-engineering-500 mb-2">{item.id}</div>
                  {item.stressUnit !== item.targetStressUnit && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-warning-600">
                        {formatNumber(item.stress)} {item.stressUnit}
                      </span>
                      <ArrowRight className="w-3 h-3 text-engineering-400" />
                      <span className="text-success-600 font-semibold">
                        {formatNumber(item.stressConverted)} {item.targetStressUnit}
                      </span>
                    </div>
                  )}
                  {item.lifeUnit !== item.targetLifeUnit && (
                    <div className="flex items-center gap-2">
                      <span className="text-warning-600">
                        {formatNumber(item.life)} {item.lifeUnit}
                      </span>
                      <ArrowRight className="w-3 h-3 text-engineering-400" />
                      <span className="text-success-600 font-semibold">
                        {formatNumber(item.lifeConverted)} {item.targetLifeUnit}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnitConversion;
