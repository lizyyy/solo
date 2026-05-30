import React from 'react';
import { ChannelFader } from './ChannelFader';
import { MasterFader } from './MasterFader';
import { useGameStore } from '@/store/useGameStore';
import { GameEvent } from '@/types';

export const MixerBoard: React.FC = () => {
  const channels = useGameStore(state => state.channels);
  const events = useGameStore(state => state.events);

  const unresolvedEvents = events.filter(e => !e.resolved);

  const getChannelWarnings = (channelId: number): { hasWarning: boolean; hasCritical: boolean } => {
    const channelEvents = unresolvedEvents.filter(e => e.channelId === channelId);
    return {
      hasWarning: channelEvents.some(e => e.severity === 'warning'),
      hasCritical: channelEvents.some(e => e.severity === 'critical'),
    };
  };

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">混音控制台</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-gray-400">LIVE</span>
        </div>
      </div>

      <div className="flex items-end gap-3 overflow-x-auto pb-2">
        {channels.map(channel => {
          const { hasWarning, hasCritical } = getChannelWarnings(channel.id);
          return (
            <ChannelFader
              key={channel.id}
              channel={channel}
              hasWarning={hasWarning}
              hasCritical={hasCritical}
            />
          );
        })}

        <div className="w-px h-64 bg-gray-600 mx-2" />

        <MasterFader />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>8 通道输入</span>
          <span>立体声主输出</span>
          <span>4 编组返听</span>
        </div>
      </div>
    </div>
  );
};
