import React from 'react';
import { Audience, ChannelType } from '../game/types';
import { Users, Crown, ArrowRightLeft } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

interface QueuePanelProps {
  normalQueue: Audience[];
  vipQueue: Audience[];
  onDispatch?: (audienceId: string, channel: ChannelType) => void;
}

const QueuePanel: React.FC<QueuePanelProps> = ({ normalQueue, vipQueue, onDispatch }) => {
  const { sendToChannel } = useGameStore();

  const getRiskColor = (audience: Audience) => {
    const hasHighRisk = audience.items.some(i => i.riskLevel === 'high');
    const hasMediumRisk = audience.items.some(i => i.riskLevel === 'medium');
    if (hasHighRisk) return 'border-warning';
    if (hasMediumRisk) return 'border-vip';
    return 'border-transparent';
  };

  const AudienceCard: React.FC<{ audience: Audience; channel: ChannelType }> = ({ audience, channel }) => (
    <div
      className={`relative p-2 bg-navy-700 rounded-lg border-2 ${getRiskColor(audience)} 
        ${audience.isVIP ? 'ring-2 ring-vip ring-opacity-50' : ''} 
        ${audience.isSpecial ? 'ring-2 ring-purple-400 ring-opacity-50' : ''}
        animate-slide-in hover:bg-navy-600 transition-colors`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{audience.avatar}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm truncate">{audience.name}</span>
            {audience.isVIP && <Crown className="w-3 h-3 text-vip" />}
            {audience.isSpecial && <span className="text-xs text-purple-400">♿</span>}
          </div>
          <div className="flex gap-1 mt-1">
            {audience.items.slice(0, 3).map(item => (
              <span key={item.id} className="text-sm" title={item.name}>
                {item.icon}
              </span>
            ))}
            {audience.items.length > 3 && (
              <span className="text-xs text-gray-400">+{audience.items.length - 3}</span>
            )}
          </div>
        </div>
        {onDispatch && (
          <button
            onClick={() => sendToChannel(audience.id, channel === 'vip' ? 'normal' : 'vip')}
            className="p-1 hover:bg-navy-500 rounded transition-colors"
            title={`调度到${channel === 'vip' ? '普通' : 'VIP'}通道`}
          >
            <ArrowRightLeft className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-2 px-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-300">普通通道</span>
          <span className="text-xs bg-navy-600 px-2 py-0.5 rounded-full">
            {normalQueue.length}人
          </span>
        </div>
        <div className="h-[calc(100%-2rem)] overflow-y-auto scrollbar-thin px-2 space-y-2">
          {normalQueue.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无排队</div>
          ) : (
            normalQueue.map(audience => (
              <AudienceCard key={audience.id} audience={audience} channel="normal" />
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden border-t border-navy-700 pt-4">
        <div className="flex items-center gap-2 mb-2 px-2">
          <Crown className="w-4 h-4 text-vip" />
          <span className="font-medium text-vip">VIP通道</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            vipQueue.length > 5 ? 'bg-warning animate-pulse-fast' : 
            vipQueue.length > 3 ? 'bg-vip' : 'bg-navy-600'
          }`}>
            {vipQueue.length}人
            {vipQueue.length > 5 && ' ⚠️拥堵'}
          </span>
        </div>
        <div className="h-[calc(100%-2rem)] overflow-y-auto scrollbar-thin px-2 space-y-2">
          {vipQueue.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无VIP</div>
          ) : (
            vipQueue.map(audience => (
              <AudienceCard key={audience.id} audience={audience} channel="vip" />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default QueuePanel;
