import React from 'react';
import { useWeights } from '../context/AppContext';
import { WeightConfig } from '../types';
import { DEFAULT_WEIGHTS } from '../utils/scoring';

const WeightPanel: React.FC = () => {
  const { weights, updateWeight, resetWeights } = useWeights();

  const weightLabels: Record<keyof WeightConfig, { label: string; description: string }> = {
    monthlyRent: {
      label: '月租金',
      description: '租金价格的重要性，价格越低评分越高',
    },
    depositRisk: {
      label: '押金风险',
      description: '押金金额和退还条件的安全性',
    },
    commuteTime: {
      label: '通勤时间',
      description: '每日通勤时长，时间越短评分越高',
    },
    lighting: {
      label: '采光',
      description: '房屋采光情况，越好评分越高',
    },
    noise: {
      label: '噪音',
      description: '周边安静程度，越安静评分越高',
    },
    waterLeak: {
      label: '漏水',
      description: '是否存在漏水问题，无漏水评分越高',
    },
    odor: {
      label: '异味',
      description: '是否存在异味问题，无异味评分越高',
    },
    repairCost: {
      label: '维修成本',
      description: '需要维修的项目数量和严重程度',
    },
    surroundingSafety: {
      label: '周边安全',
      description: '小区和周边治安情况',
    },
    agencyFee: {
      label: '中介费',
      description: '中介费用高低，无中介费评分越高',
    },
    additionalFees: {
      label: '额外费用',
      description: '物业费、网费等额外费用',
    },
  };

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const defaultTotal = Object.values(DEFAULT_WEIGHTS).reduce((sum, w) => sum + w, 0);

  const categories = [
    {
      title: '成本因素',
      keys: ['monthlyRent', 'depositRisk', 'agencyFee', 'additionalFees'] as const,
    },
    {
      title: '时间成本',
      keys: ['commuteTime'] as const,
    },
    {
      title: '房屋质量',
      keys: ['lighting', 'noise', 'waterLeak', 'odor', 'repairCost'] as const,
    },
    {
      title: '环境因素',
      keys: ['surroundingSafety'] as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">评分权重设置</h1>
          <p className="text-gray-500 mt-1">
            调整各项因素的权重，系统将根据您的偏好重新计算所有房源的评分
          </p>
        </div>
        <button
          onClick={resetWeights}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          恢复默认权重
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-800">权重说明</h4>
            <p className="text-sm text-blue-700 mt-1">
              当前总权重: <span className="font-semibold">{totalWeight}</span> (默认: {defaultTotal})。
              权重越高，该因素对最终评分的影响越大。您可以根据个人偏好调整，比如更看重通勤时间可以增加其权重。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{category.title}</h3>
            
            <div className="space-y-6">
              {category.keys.map((key) => {
                const config = weightLabels[key];
                const currentValue = weights[key];
                const defaultValue = DEFAULT_WEIGHTS[key];
                const isModified = currentValue !== defaultValue;

                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          {config.label}
                          {isModified && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              已修改
                            </span>
                          )}
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">
                          默认: {defaultValue}
                        </span>
                        <input
                          type="number"
                          value={currentValue}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value) && value >= 0 && value <= 100) {
                              updateWeight(key, value);
                            }
                          }}
                          className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min={0}
                          max={100}
                        />
                      </div>
                    </div>
                    
                    <input
                      type="range"
                      min={0}
                      max={30}
                      value={currentValue}
                      onChange={(e) => updateWeight(key, parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0</span>
                      <span className="text-blue-600 font-medium">{currentValue}</span>
                      <span>30</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">快速预设</h3>
        <p className="text-sm text-gray-500 mb-4">
          选择适合您需求的预设权重配置，或根据个人情况自定义调整
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => {
              updateWeight('commuteTime', 20);
              updateWeight('monthlyRent', 10);
              updateWeight('lighting', 8);
              updateWeight('noise', 8);
              updateWeight('waterLeak', 10);
              updateWeight('odor', 10);
              updateWeight('repairCost', 10);
              updateWeight('surroundingSafety', 10);
              updateWeight('depositRisk', 8);
              updateWeight('agencyFee', 3);
              updateWeight('additionalFees', 3);
            }}
            className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="text-sm font-semibold text-gray-800 mb-1">🏃 通勤优先</div>
            <p className="text-xs text-gray-500">
              适合每天需要长时间通勤的上班族，更看重通勤时间
            </p>
          </button>

          <button
            onClick={() => {
              updateWeight('monthlyRent', 25);
              updateWeight('depositRisk', 15);
              updateWeight('agencyFee', 5);
              updateWeight('additionalFees', 5);
              updateWeight('commuteTime', 10);
              updateWeight('lighting', 8);
              updateWeight('noise', 8);
              updateWeight('waterLeak', 8);
              updateWeight('odor', 8);
              updateWeight('repairCost', 8);
              updateWeight('surroundingSafety', 8);
            }}
            className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="text-sm font-semibold text-gray-800 mb-1">💰 预算优先</div>
            <p className="text-xs text-gray-500">
              适合预算有限的租客，更看重租金和各项费用
            </p>
          </button>

          <button
            onClick={() => {
              updateWeight('lighting', 15);
              updateWeight('noise', 15);
              updateWeight('waterLeak', 12);
              updateWeight('odor', 12);
              updateWeight('repairCost', 12);
              updateWeight('surroundingSafety', 12);
              updateWeight('monthlyRent', 10);
              updateWeight('commuteTime', 8);
              updateWeight('depositRisk', 8);
              updateWeight('agencyFee', 3);
              updateWeight('additionalFees', 3);
            }}
            className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="text-sm font-semibold text-gray-800 mb-1">🏠 品质优先</div>
            <p className="text-xs text-gray-500">
              适合追求居住品质的租客，更看重房屋质量和环境
            </p>
          </button>

          <button
            onClick={() => {
              updateWeight('depositRisk', 20);
              updateWeight('surroundingSafety', 15);
              updateWeight('waterLeak', 12);
              updateWeight('odor', 12);
              updateWeight('repairCost', 12);
              updateWeight('monthlyRent', 10);
              updateWeight('commuteTime', 10);
              updateWeight('lighting', 8);
              updateWeight('noise', 8);
              updateWeight('agencyFee', 3);
              updateWeight('additionalFees', 2);
            }}
            className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="text-sm font-semibold text-gray-800 mb-1">🛡️ 安全优先</div>
            <p className="text-xs text-gray-500">
              适合看重安全和押金保障的租客，更看重风险因素
            </p>
          </button>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-yellow-800">注意事项</h4>
            <ul className="text-sm text-yellow-700 mt-1 space-y-1">
              <li>• 调整权重后，所有房源的评分会实时重新计算，房源列表的排序也会相应变化</li>
              <li>• 权重值建议在 0-30 之间，过高的权重可能导致其他因素被忽略</li>
              <li>• 您可以随时点击"恢复默认权重"按钮回到初始配置</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeightPanel;
