import React, { useState } from 'react';
import { Search, Check, X, ShieldAlert, Crown, Info } from 'lucide-react';
import { Audience } from '../game/types';
import { useGameStore } from '../store/useGameStore';

interface SecurityStationProps {
  audience: Audience | null;
  isScanning: boolean;
  scanProgress: number;
  scanResult: 'idle' | 'safe' | 'warning' | 'danger';
}

const SecurityStation: React.FC<SecurityStationProps> = ({
  audience,
  isScanning,
  scanProgress,
  scanResult
}) => {
  const { startScan, passAudience, blockAudience } = useGameStore();
  const [showItems, setShowItems] = useState(false);

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'high': return { text: '高危', color: 'bg-warning text-white' };
      case 'medium': return { text: '中危', color: 'bg-vip text-white' };
      case 'low': return { text: '低危', color: 'bg-yellow-600 text-white' };
      default: return { text: '安全', color: 'bg-success text-white' };
    }
  };

  const getScanResultStyle = () => {
    switch (scanResult) {
      case 'danger': return 'border-warning bg-warning/10';
      case 'warning': return 'border-vip bg-vip/10';
      case 'safe': return 'border-success bg-success/10';
      default: return 'border-navy-600 bg-navy-800';
    }
  };

  if (!audience) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>等待下一位观众...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className={`flex-1 p-6 rounded-xl border-2 transition-all duration-300 ${getScanResultStyle()}`}>
        <div className="flex items-start gap-4 mb-6">
          <div className="text-6xl">{audience.avatar}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-2xl font-bold">{audience.name}</h3>
              {audience.isVIP && <Crown className="w-6 h-6 text-vip" />}
              {audience.isSpecial && (
                <span className="px-2 py-0.5 bg-purple-600 text-xs rounded">特殊观众</span>
              )}
            </div>
            <p className="text-gray-400">
              {audience.channel === 'vip' ? 'VIP通道' : '普通通道'}安检
            </p>
          </div>
        </div>

        {isScanning ? (
          <div className="mb-6">
            <div className="relative h-24 bg-navy-900 rounded-lg overflow-hidden mb-4">
              <div
                className="absolute w-full h-1 bg-success shadow-lg shadow-success/50"
                style={{ top: `${scanProgress}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl animate-pulse">📦</span>
              </div>
            </div>
            <div className="w-full bg-navy-700 rounded-full h-2">
              <div
                className="bg-success h-2 rounded-full transition-all duration-200"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-400 mt-2">扫描中... {scanProgress}%</p>
          </div>
        ) : scanResult !== 'idle' ? (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className={`w-5 h-5 ${
                scanResult === 'danger' ? 'text-warning' : 
                scanResult === 'warning' ? 'text-vip' : 'text-success'
              }`} />
              <span className={`font-medium ${
                scanResult === 'danger' ? 'text-warning' : 
                scanResult === 'warning' ? 'text-vip' : 'text-success'
              }`}>
                {scanResult === 'danger' ? '发现高危物品！' : 
                 scanResult === 'warning' ? '发现可疑物品' : '扫描完成，无异常'}
              </span>
            </div>
            
            <button
              onClick={() => setShowItems(!showItems)}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-3"
            >
              <Info className="w-4 h-4" />
              {showItems ? '隐藏物品' : '查看携带物品'}
            </button>
            
            {showItems && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {audience.items.map(item => {
                  const risk = getRiskLabel(item.riskLevel);
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border ${
                        item.isContraband ? 'border-warning/50 bg-warning/10' : 'border-navy-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      {item.isContraband && (
                        <span className={`text-xs px-2 py-0.5 rounded ${risk.color}`}>
                          {risk.text}
                        </span>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex gap-3 mt-auto">
          {scanResult === 'idle' && !isScanning && (
            <button
              onClick={startScan}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-navy-600 hover:bg-navy-500 
                rounded-xl font-medium transition-colors"
            >
              <Search className="w-5 h-5" />
              开始扫描
            </button>
          )}
          
          {scanResult !== 'idle' && !isScanning && (
            <>
              <button
                onClick={() => passAudience()}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-success 
                  hover:bg-success/80 rounded-xl font-medium transition-colors"
              >
                <Check className="w-5 h-5" />
                放行通过
              </button>
              <button
                onClick={() => blockAudience()}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-warning 
                  hover:bg-warning/80 rounded-xl font-medium transition-colors"
              >
                <X className="w-5 h-5" />
                拦截处置
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityStation;
