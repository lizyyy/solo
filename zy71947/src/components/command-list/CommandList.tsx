import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSequenceStore } from '../../store/useSequenceStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { CommandItem } from './CommandItem';
import type { AnomalyType } from '../../types';
import {
  List,
  Filter,
  AlertOctagon,
  AlertTriangle,
  Zap,
  Search,
  X,
} from 'lucide-react';

const filterOptions: { value: AnomalyType | 'ALL'; label: string; icon: React.ReactNode }[] = [
  { value: 'ALL', label: '全部', icon: <List className="w-3 h-3" /> },
  { value: 'WINDOW_OVERLAP', label: '窗口重叠', icon: <AlertOctagon className="w-3 h-3 text-cyber-red" /> },
  { value: 'TELEMETRY_MISSING', label: '遥测缺帧', icon: <AlertTriangle className="w-3 h-3 text-cyber-yellow" /> },
  { value: 'MANUAL_INSERT', label: '人工调整', icon: <Zap className="w-3 h-3 text-cyber-purple" /> },
];

export const CommandList: React.FC = () => {
  const { sequence, affectedCommandIds } = useSequenceStore();
  const { primaryTimeFormat, toggleCommandList, showCommandList } = usePlaybackStore();
  const [filter, setFilter] = useState<AnomalyType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCommands = useMemo(() => {
    let result = sequence.commands;

    if (filter !== 'ALL') {
      result = result.filter(cmd => cmd.anomaly?.anomalyType === filter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        cmd =>
          cmd.commandName.toLowerCase().includes(query) ||
          cmd.payloadName.toLowerCase().includes(query) ||
          cmd.reason.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => a.time.relativeSeconds - b.time.relativeSeconds);
  }, [sequence.commands, filter, searchQuery]);

  if (!showCommandList) {
    return (
      <motion.button
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        onClick={toggleCommandList}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-space-800/90 border border-r-0 border-space-600 rounded-r p-2 hover:bg-space-700 transition-colors"
      >
        <List className="w-5 h-5 text-cyber-cyan" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      exit={{ x: -300 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-80 bg-space-900/95 border-r border-space-600/50 flex flex-col h-full backdrop-blur-sm"
    >
      <div className="p-4 border-b border-space-600/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-cyber-cyan" />
            <h2 className="text-sm font-semibold text-cyber-cyan font-mono">指令序列</h2>
          </div>
          <button
            onClick={toggleCommandList}
            className="p-1 hover:bg-space-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索指令..."
            className="w-full pl-8 pr-3 py-1.5 bg-space-800 border border-space-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyber-cyan/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-gray-500 hover:text-gray-300" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {filterOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                filter === option.value
                  ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50'
                  : 'text-gray-400 hover:bg-space-700 border border-transparent'
              }`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 bg-space-800/50 border-b border-space-600/30">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">共 {filteredCommands.length} 条指令</span>
          <span className="text-gray-600">按时间排序</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, index) => (
              <CommandItem
                key={cmd.id}
                command={cmd}
                isAffected={affectedCommandIds.includes(cmd.id)}
                format={primaryTimeFormat}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-gray-500"
            >
              <Filter className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">没有找到匹配的指令</p>
              <p className="text-xs mt-1">尝试调整筛选条件</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
