import { useState } from 'react';
import { Shield, Clock, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store';
import { ThresholdConfig } from '../types';

const ThresholdPage: React.FC = () => {
  const { thresholds } = useAppStore();
  const [activeTab, setActiveTab] = useState<'current' | 'old'>('current');
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const currentThresholds = thresholds.filter(t => t.isCurrent);
  const oldThresholds = thresholds.filter(t => !t.isCurrent);

  const displayThresholds = activeTab === 'current' ? currentThresholds : oldThresholds;
  const versions = [...new Set(thresholds.map(t => t.version))];

  const getZoneName = (zone: number): string => {
    const names: Record<number, string> = {
      1: '低温预热区',
      2: '升温区',
      3: '氧化区',
      4: '高温烧成区'
    };
    return names[zone] || `温区${zone}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-700">安全阈值表</h2>
          <p className="text-neutral-500 mt-1">查看各温区的温度阈值配置和历史口径标准</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Shield className="w-4 h-4" />
          <span>共 {thresholds.length} 条配置记录</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="flex border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('current')}
            className={`
              flex items-center gap-2 px-6 py-4 font-medium transition-all
              ${activeTab === 'current' 
                ? 'text-primary border-b-2 border-primary bg-primary/5' 
                : 'text-neutral-500 hover:text-neutral-700'
              }
            `}
          >
            <CheckCircle className="w-4 h-4" />
            当前口径 (v2024.01)
          </button>
          <button
            onClick={() => setActiveTab('old')}
            className={`
              flex items-center gap-2 px-6 py-4 font-medium transition-all
              ${activeTab === 'old' 
                ? 'text-primary border-b-2 border-primary bg-primary/5' 
                : 'text-neutral-500 hover:text-neutral-700'
              }
            `}
          >
            <Clock className="w-4 h-4" />
            历史口径
          </button>
        </div>

        {activeTab === 'old' && (
          <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center gap-4">
            <span className="text-sm text-neutral-500">选择版本：</span>
            <select
              value={selectedVersion || ''}
              onChange={(e) => setSelectedVersion(e.target.value || null)}
              className="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">全部版本</option>
              {versions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">温区</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">区域名称</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wider">最低温度</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wider">最高温度</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wider">预警阈值</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">版本</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {displayThresholds
                .filter(t => !selectedVersion || t.version === selectedVersion)
                .map((threshold: ThresholdConfig, index: number) => (
                  <tr 
                    key={threshold.id} 
                    className={`
                      hover:bg-neutral-50 transition-colors
                      ${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 text-primary rounded-lg text-sm font-bold">
                        {threshold.zone}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-neutral-700">{getZoneName(threshold.zone)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-mono text-neutral-600">{threshold.minTemp}℃</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-mono text-neutral-600">{threshold.maxTemp}℃</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        ±{threshold.warningThreshold}℃
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`
                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${threshold.isCurrent 
                          ? 'bg-success/10 text-success' 
                          : 'bg-neutral-100 text-neutral-600'
                        }
                      `}>
                        {threshold.version}
                        {threshold.isCurrent && <CheckCircle className="w-3 h-3 ml-1" />}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-500">{threshold.description}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800 mb-2">补录说明</h4>
              <p className="text-sm text-amber-700 leading-relaxed">
                当遇到老配方产品时，可能需要使用历史口径标准进行判定。
                请在参数回放页发现异常后，返回此页面确认适用的阈值版本，
                系统支持手动补录历史口径数据。
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-800 mb-2">当前生效版本</h4>
              <p className="text-sm text-blue-700 leading-relaxed mb-3">
                <span className="font-bold">v2024.01</span> 自 2024年1月1日 起生效
              </p>
              <div className="text-xs text-blue-600 space-y-1">
                <p>• 适用：新高铝瓷、长石瓷配方</p>
                <p>• 收紧了高温烧成区的温度范围</p>
                <p>• 老配方产品请参考 v2023.09</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThresholdPage;
