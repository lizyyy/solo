import React from 'react';
import { X, Users, Link2, Clock, Sliders, Mic } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { generateClueGroups, formatTime } from '@/engine/evidenceRecorder';

export const ClueOrganizer: React.FC = () => {
  const showClueOrganizer = useGameStore(state => state.showClueOrganizer);
  const toggleClueOrganizer = useGameStore(state => state.toggleClueOrganizer);
  const events = useGameStore(state => state.events);
  const actionLogs = useGameStore(state => state.actionLogs);
  const channels = useGameStore(state => state.channels);

  const clueGroups = generateClueGroups(events, actionLogs, 8);

  if (!showClueOrganizer) return null;

  const getChannelName = (channelId: number) => {
    return channels.find(c => c.id === channelId)?.name || `CH${channelId}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="text-purple-400" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">交接助手</h2>
              <p className="text-sm text-gray-400">自动归类相关线索，方便同事接手</p>
            </div>
          </div>
          <button
            onClick={toggleClueOrganizer}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {clueGroups.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Link2 size={48} className="mx-auto mb-4 opacity-50" />
              <p>暂无线索组</p>
              <p className="text-sm mt-2">完成一局游戏后可查看自动归类的线索</p>
            </div>
          ) : (
            <div className="space-y-6">
              {clueGroups.map((group, index) => (
                <div key={group.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-semibold text-white">{group.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Clock size={12} />
                          <span>{formatTime(group.timeWindow.start)} - {formatTime(group.timeWindow.end)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">
                        <Mic size={14} className="inline mr-1" />
                        {group.events.length} 事件
                      </span>
                      <span className="text-gray-400">
                        <Sliders size={14} className="inline mr-1" />
                        {group.actions.length} 操作
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    {group.relatedChannels.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">关联声道</h4>
                        <div className="flex flex-wrap gap-2">
                          {group.relatedChannels.map(channelId => (
                            <span
                              key={channelId}
                              className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-sm"
                            >
                              {getChannelName(channelId)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <Mic size={14} className="text-red-400" />
                          事件线索
                        </h4>
                        <div className="space-y-2">
                          {group.events.map(event => (
                            <div key={event.id} className="bg-gray-900/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500 font-mono">
                                  {formatTime(event.timestamp)}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  event.resolved
                                    ? 'bg-green-900/50 text-green-400'
                                    : 'bg-red-900/50 text-red-400'
                                }`}>
                                  {event.resolved ? '已处理' : '未处理'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-300">{event.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <Sliders size={14} className="text-green-400" />
                          操作记录
                        </h4>
                        {group.actions.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">无相关操作</p>
                        ) : (
                          <div className="space-y-2">
                            {group.actions.map(action => (
                              <div key={action.id} className="bg-gray-900/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-gray-500 font-mono">
                                    {formatTime(action.timestamp)}
                                  </span>
                                  {action.channelId && (
                                    <span className="text-xs text-blue-400">
                                      CH{action.channelId}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-300">
                                  {action.type === 'fader_move' && `推子调整: ${action.fromValue} → ${action.toValue}`}
                                  {action.type === 'master_adjust' && `主输出: ${action.fromValue} → ${action.toValue}`}
                                  {action.type === 'mute' && `静音: ${action.toValue === 1 ? '开' : '关'}`}
                                  {action.type === 'solo' && `独奏: ${action.toValue === 1 ? '开' : '关'}`}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="flex items-center gap-2 text-sm">
                        <Link2 size={14} className="text-purple-400" />
                        <span className="text-gray-400">
                          交接说明：此时间段内 {group.relatedChannels.length > 0 ? group.relatedChannels.map(c => getChannelName(c)).join('、') : '多个声道'} 发生了相关问题，
                          共执行了 {group.actions.length} 次操作。
                          {group.events.some(e => !e.resolved) && ' ⚠️ 注意：仍有未处理的问题！'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              💡 提示：线索组基于时间窗口和声道关联自动生成，帮助快速理解问题上下文
            </p>
            <button
              onClick={toggleClueOrganizer}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              完成交接
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
