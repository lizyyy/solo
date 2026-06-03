import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { TimelineNode } from './TimelineNode';
import { useAppStore } from '@/store/useAppStore';

export function HistoryTimeline() {
  const { historyRecords } = useAppStore();

  return (
    <div className="h-full flex flex-col bg-primary-900/40 backdrop-blur-sm border-t border-primary-700/30">
      <div className="p-3 border-b border-primary-700/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary-700/50">
            <History size={14} className="text-primary-300" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">历史记录</h3>
            <p className="text-[10px] text-gray-400">
              共 {historyRecords.length} 条操作
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {historyRecords.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center px-4"
          >
            <div className="w-12 h-12 rounded-full bg-primary-800/50 flex items-center justify-center mb-3">
              <History size={20} className="text-primary-500" />
            </div>
            <h4 className="text-xs font-medium text-white mb-1">暂无操作记录</h4>
            <p className="text-[10px] text-gray-400">
              开始演示后，操作轨迹将显示在这里
            </p>
          </motion.div>
        ) : (
          <div className="space-y-0">
            {[...historyRecords].reverse().map((record, index) => (
              <TimelineNode
                key={record.id}
                record={record}
                isLatest={index === 0}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-primary-700/30 bg-primary-900/60">
        <div className="text-[9px] text-gray-500">
          <p>📝 <span className="text-gray-400">培训提示：</span>历史记录完整保留每一步操作，方便事后追溯。</p>
        </div>
      </div>
    </div>
  );
}
