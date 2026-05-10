import React from 'react';
import { useApp } from '../context/AppContext';
import { generateLayoutOptions } from '../utils/calculationEngine';
import type { LayoutDirection, LayoutPattern } from '../types';

export const StepLayoutSelection: React.FC = () => {
  const { state, setFieldValue, updateInputData } = useApp();
  const { inputData } = state;
  const { layoutDirection, layoutPattern, groutWidth, tile } = inputData;

  const layoutOptions = generateLayoutOptions(inputData);

  const handleLayoutChange = (direction: LayoutDirection, pattern: LayoutPattern) => {
    updateInputData({
      layoutDirection: direction,
      layoutPattern: pattern,
    });
  };

  const handleGroutChange = (value: string | number) => {
    setFieldValue('groutWidth', value, 'StepLayoutSelection');
  };

  const directionLabels: Record<LayoutDirection, string> = {
    horizontal: '正铺（横向）',
    vertical: '竖铺（纵向）',
    diagonal: '斜铺（45度）',
  };

  const patternLabels: Record<LayoutPattern, string> = {
    straight: '直铺',
    brick: '工字铺',
    herringbone: '人字铺',
    diagonal: '斜铺',
  };

  const isSquareTile = tile.width === tile.height;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          📐 铺贴方向
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['horizontal', 'vertical', 'diagonal'] as LayoutDirection[]).map((direction) => {
            const isSelected = layoutDirection === direction;
            
            return (
              <button
                key={direction}
                onClick={() => handleLayoutChange(direction, layoutPattern === 'herringbone' ? 'straight' : layoutPattern)}
                className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 shadow-lg transform scale-105'
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow'
                }`}
              >
                <div className="text-4xl mb-3">
                  {direction === 'horizontal' && '➡️'}
                  {direction === 'vertical' && '⬇️'}
                  {direction === 'diagonal' && '↘️'}
                </div>
                <div className="text-lg font-bold text-gray-800">
                  {directionLabels[direction]}
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  {direction === 'horizontal' && '适合标准房间，视觉效果开阔'}
                  {direction === 'vertical' && '适合狭长空间，视觉上拉伸空间'}
                  {direction === 'diagonal' && '空间感更强，但损耗增加约10%'}
                </div>
                {direction === 'diagonal' && (
                  <div className="mt-3 text-xs text-orange-600 font-medium">
                    ⚠️ 损耗增加
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-6 rounded-xl border border-rose-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🎯 铺贴图案
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['straight', 'brick', 'herringbone', 'diagonal'] as LayoutPattern[]).map((pattern) => {
            const isSelected = layoutPattern === pattern;
            const isDisabled = pattern === 'herringbone' && !isSquareTile;
            
            return (
              <button
                key={pattern}
                onClick={() => !isDisabled && handleLayoutChange(
                  pattern === 'diagonal' ? 'diagonal' : layoutDirection,
                  pattern
                )}
                disabled={isDisabled}
                className={`p-5 rounded-xl border-2 transition-all duration-200 text-left ${
                  isDisabled
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    : isSelected
                    ? 'border-rose-500 bg-rose-50 shadow-lg transform scale-105'
                    : 'border-gray-200 bg-white hover:border-rose-300 hover:shadow'
                }`}
              >
                <div className="text-3xl mb-2">
                  {pattern === 'straight' && '▫️'}
                  {pattern === 'brick' && '🧱'}
                  {pattern === 'herringbone' && '🔶'}
                  {pattern === 'diagonal' && '🔷'}
                </div>
                <div className="text-base font-bold text-gray-800">
                  {patternLabels[pattern]}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {pattern === 'straight' && '最常用，损耗最小'}
                  {pattern === 'brick' && '层次感强，损耗+2%'}
                  {pattern === 'herringbone' && '高端大气，损耗+15%'}
                  {pattern === 'diagonal' && '空间感强，损耗+10%'}
                </div>
                {isDisabled && (
                  <div className="mt-2 text-xs text-red-600">
                    需正方形瓷砖
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 rounded-xl border border-cyan-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🧵 缝宽设置
        </h3>
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            瓷砖缝宽 (cm)
          </label>
          <input
            type="number"
            step="0.1"
            value={groutWidth}
            onChange={(e) => handleGroutChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
          />
          <div className="mt-4 flex gap-2">
            {[0.1, 0.2, 0.3, 0.5, 1.0].map((width) => (
              <button
                key={width}
                onClick={() => handleGroutChange(width)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  groutWidth === width
                    ? 'bg-cyan-500 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-cyan-50'
                }`}
              >
                {width}cm
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            💡 常见缝宽：抛光砖 0.1-0.3cm，仿古砖 0.3-0.5cm，文化砖 0.5-1.0cm
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-6 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          📊 方案对比
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-3 px-2">方案</th>
                <th className="text-left py-3 px-2">方向</th>
                <th className="text-left py-3 px-2">图案</th>
                <th className="text-left py-3 px-2">预估损耗</th>
                <th className="text-left py-3 px-2">优点</th>
                <th className="text-left py-3 px-2">推荐</th>
              </tr>
            </thead>
            <tbody>
              {layoutOptions.map((option) => (
                <tr
                  key={option.id}
                  className={`border-b border-gray-100 hover:bg-white transition-colors cursor-pointer ${
                    option.direction === layoutDirection && option.pattern === layoutPattern
                      ? 'bg-blue-50'
                      : ''
                  }`}
                  onClick={() => handleLayoutChange(option.direction, option.pattern)}
                >
                  <td className="py-3 px-2 font-medium">{option.name}</td>
                  <td className="py-3 px-2">{directionLabels[option.direction]}</td>
                  <td className="py-3 px-2">{patternLabels[option.pattern]}</td>
                  <td className="py-3 px-2">
                    <span className={`font-bold ${
                      option.estimatedWaste > 15 ? 'text-red-600' :
                      option.estimatedWaste > 10 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {option.estimatedWaste}%
                    </span>
                  </td>
                  <td className="py-3 px-2 text-gray-600">
                    {option.advantages.slice(0, 2).join('、')}
                  </td>
                  <td className="py-3 px-2">
                    {option.isRecommended && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        推荐
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-xl border border-yellow-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          📝 关键假设
        </h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• 铺贴方向决定了瓷砖在房间中的基本排列方式</li>
          <li>• 铺贴图案影响视觉效果和损耗率</li>
          <li>• 缝宽会影响实际铺贴的瓷砖数量计算</li>
          <li>• 斜铺和人字铺会显著增加切割损耗</li>
        </ul>
      </div>
    </div>
  );
};
