import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { LogCard } from './LogCard';
import { useAppStore } from '@/store/useAppStore';

export function LogPanel() {
  const { pointCloudLogs } = useAppStore();

  return (
    <div className="h-full flex flex-col bg-primary-900/40 backdrop-blur-sm border-r border-primary-700/30">
      <div className="p-4 border-b border-primary-700/30">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary-700/50">
            <FileText size={18} className="text-primary-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">点云抽稀日志</h2>
            <p className="text-xs text-gray-400">
              共 {pointCloudLogs.length} 条记录
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pointCloudLogs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center px-4"
          >
            <div className="w-16 h-16 rounded-full bg-primary-800/50 flex items-center justify-center mb-4">
              <FileText size={32} className="text-primary-500" />
            </div>
            <h3 className="text-sm font-medium text-white mb-2">暂无日志记录</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              请从下方流程控制栏选择演示场景，
              <br />
              点击"导入日志"开始演示
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {[...pointCloudLogs].reverse().map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <LogCard log={log} isLatest={index === 0} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <div className="p-3 border-t border-primary-700/30 bg-primary-900/60">
        <div className="text-[10px] text-gray-500 space-y-1">
          <p>💡 <span className="text-gray-400">小陶说：</span>每条日志记录了点云抽稀的处理参数和检测结果。</p>
          <p>🎯 <span className="text-gray-400">培训要点：</span>注意观察不同场景下障碍物状态的变化。</p>
        </div>
      </div>
    </div>
  );
}
