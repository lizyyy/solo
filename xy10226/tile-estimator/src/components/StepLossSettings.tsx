import React from 'react';
import { useApp } from '../context/AppContext';

export const StepLossSettings: React.FC = () => {
  const { state, setFieldValue, updateInputData } = useApp();
  const { inputData } = state;
  const { lossModel, batchOptions } = inputData;

  const handleLossChange = (field: string, value: string | number | boolean) => {
    setFieldValue(`lossModel.${field}`, value, 'StepLossSettings');
  };

  const handleBatchOptionChange = (field: string, value: boolean | number) => {
    updateInputData({
      batchOptions: {
        ...batchOptions,
        [field]: value,
      },
    });
  };

  // 计算预估总损耗
  const estimatedBaseLoss = lossModel.standard;
  const estimatedExtraLoss = 
    (inputData.layoutDirection === 'diagonal' ? lossModel.diagonal : 0) +
    (inputData.openings.length * 2) +
    (batchOptions.allowMultipleBatches ? lossModel.batchDifference : 0);
  const totalEstimatedLoss = estimatedBaseLoss + estimatedExtraLoss;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          📊 损耗模型设置
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标准损耗率 (%)
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={lossModel.standard}
              onChange={(e) => handleLossChange('standard', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">
              行业标准通常为 5-10%
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              斜铺额外损耗 (%)
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={lossModel.diagonal}
              onChange={(e) => handleLossChange('diagonal', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">
              斜铺时增加的额外损耗，通常为 8-15%
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              复杂形状额外损耗 (%)
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={lossModel.complexShapes}
              onChange={(e) => handleLossChange('complexShapes', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">
              多边形、弧形等复杂形状的额外损耗
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              批次差异预留 (%)
            </label>
            <input
              type="number"
              min="0"
              max="15"
              value={lossModel.batchDifference}
              onChange={(e) => handleLossChange('batchDifference', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">
              用于补货时的批次差异预留
            </p>
          </div>
        </div>

        <div className="mt-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lossModel.wasteUsage}
              onChange={(e) => handleLossChange('wasteUsage', e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              允许使用切割边角料
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-8">
            勾选后，切割产生的较大边角料会被用于填充小块区域，可降低实际损耗
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🎨 批次采购策略
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                允许使用多个批次
              </label>
              <p className="text-xs text-gray-500">
                勾选后会考虑相邻批次作为备选方案
              </p>
            </div>
            <button
              onClick={() => handleBatchOptionChange('allowMultipleBatches', !batchOptions.allowMultipleBatches)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                batchOptions.allowMultipleBatches ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  batchOptions.allowMultipleBatches ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {batchOptions.allowMultipleBatches && (
            <div className="mt-6 pt-6 border-t border-purple-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                颜色容差 (%)
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={batchOptions.colorTolerance * 100}
                onChange={(e) => handleBatchOptionChange('colorTolerance', parseInt(e.target.value) / 100)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0% (严格)</span>
                <span className="font-medium text-purple-600">
                  {(batchOptions.colorTolerance * 100).toFixed(0)}%
                </span>
                <span>50% (宽松)</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {batchOptions.colorTolerance < 0.1
                  ? '🟢 严格模式：仅接受同批次或极近批次'
                  : batchOptions.colorTolerance < 0.3
                  ? '🟡 标准模式：接受相邻批次'
                  : '🟠 宽松模式：接受较远距离批次'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          📈 预估损耗分析
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg text-center">
            <p className="text-xs text-gray-500">标准损耗</p>
            <p className="text-2xl font-bold text-blue-600">
              {estimatedBaseLoss}%
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg text-center">
            <p className="text-xs text-gray-500">额外损耗</p>
            <p className="text-2xl font-bold text-orange-600">
              {estimatedExtraLoss}%
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg text-center col-span-2">
            <p className="text-xs text-gray-500">预估总损耗</p>
            <p className={`text-3xl font-bold ${
              totalEstimatedLoss > 20 ? 'text-red-600' :
              totalEstimatedLoss > 15 ? 'text-orange-600' :
              'text-green-600'
            }`}>
              {totalEstimatedLoss}%
            </p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-white rounded-lg">
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                totalEstimatedLoss > 20 ? 'bg-red-500' :
                totalEstimatedLoss > 15 ? 'bg-orange-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(totalEstimatedLoss * 3, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>0%</span>
            <span>10% (正常)</span>
            <span>20% (较高)</span>
            <span>33% (很高)</span>
          </div>
        </div>

        {totalEstimatedLoss > 20 && (
          <div className="mt-4 p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-orange-800">
              ⚠️ 损耗率较高，建议：
            </p>
            <ul className="text-xs text-orange-700 mt-1 list-disc list-inside">
              {inputData.layoutDirection === 'diagonal' && (
                <li>考虑改用正铺方式，可降低约 {lossModel.diagonal}% 损耗</li>
              )}
              {inputData.layoutPattern === 'herringbone' && (
                <li>考虑改用直铺方式，可降低约 15% 损耗</li>
              )}
              <li>选择与房间尺寸更匹配的瓷砖规格</li>
            </ul>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-xl border border-yellow-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          📝 关键假设
        </h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• 标准损耗率基于行业经验值，适用于规则矩形空间</li>
          <li>• 斜铺损耗增加是由于对角线切割导致边角料利用率降低</li>
          <li>• 批次预留用于补货时的颜色一致性管理</li>
          <li>• 边角料利用需要施工人员合理规划切割方案</li>
        </ul>
      </div>
    </div>
  );
};
