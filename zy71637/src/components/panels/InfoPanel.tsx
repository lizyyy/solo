import React from 'react';
import { motion } from 'framer-motion';
import {
  Layers,
  Clock,
  DollarSign,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Tag,
  MapPin,
  Box,
} from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { formatTime, formatPrice, formatQuantity, formatLevel, formatSide } from '../../utils/formatters';

export const InfoPanel: React.FC = () => {
  const { selectedCube, processedSnapshots, currentTimeIndex } = useDataStore();
  const currentSnapshot = processedSnapshots[currentTimeIndex];

  if (!selectedCube && !currentSnapshot) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
          <Box className="text-slate-600" size={28} />
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">未选择对象</h3>
        <p className="text-sm text-slate-500">
          点击3D场景中的立方体查看详细信息，或拖动时间轴浏览盘口快照
        </p>
      </div>
    );
  }

  if (selectedCube) {
    return (
      <div className="p-4 space-y-4">
        <motion.div
          className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-slate-700/50"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">档位详情</h3>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    selectedCube.isBid
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {formatSide(selectedCube.isBid)}
                </span>
                <span>第 {formatLevel(selectedCube.level)} 档</span>
              </div>
            </div>
            {selectedCube.isAnomaly && (
              <div className="flex items-center gap-1 px-2 py-1 bg-rose-500/20 text-rose-400 rounded-lg text-xs">
                <AlertTriangle size={12} />
                <span>异常</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
              <div className="flex items-center gap-2 text-slate-400">
                <DollarSign size={14} />
                <span className="text-sm">价格</span>
              </div>
              <span className="text-white font-mono font-medium">
                {formatPrice(selectedCube.price)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
              <div className="flex items-center gap-2 text-slate-400">
                <BarChart3 size={14} />
                <span className="text-sm">挂单量</span>
              </div>
              <span className="text-white font-mono font-medium">
                {formatQuantity(selectedCube.quantity)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock size={14} />
                <span className="text-sm">时间</span>
              </div>
              <span className="text-white font-mono font-medium">
                {formatTime(selectedCube.timestamp)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
              <div className="flex items-center gap-2 text-slate-400">
                <Layers size={14} />
                <span className="text-sm">档位</span>
              </div>
              <span className="text-white font-mono font-medium">
                {selectedCube.level}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin size={14} />
                <span className="text-sm">3D坐标</span>
              </div>
              <span className="text-slate-300 font-mono text-xs">
                ({selectedCube.x.toFixed(2)}, {selectedCube.y.toFixed(2)}, {selectedCube.z.toFixed(2)})
              </span>
            </div>
          </div>
        </motion.div>

        {selectedCube.isAnomaly && (
          <motion.div
            className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center gap-2 mb-3 text-rose-400">
              <AlertTriangle size={18} />
              <h4 className="font-medium">异常信息</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">严重程度</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i <= selectedCube.anomalySeverity
                          ? 'bg-rose-500'
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                该档位数据存在异常，可能影响策略判断。请查看「异常」标签页获取详细分析和处理建议。
              </p>
            </div>
          </motion.div>
        )}

        <motion.div
          className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Tag size={14} />
            快速操作
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <button className="px-3 py-2 text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-all">
              添加标注
            </button>
            <button className="px-3 py-2 text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-all">
              跟踪此档
            </button>
            <button className="px-3 py-2 text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-all">
              导出数据
            </button>
            <button className="px-3 py-2 text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-all">
              定位时间
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <motion.div
        className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-slate-700/50"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">当前快照</h3>
            <p className="text-sm text-slate-400">
              {formatTime(currentSnapshot?.timestamp || 0)}
            </p>
          </div>
          <span className="text-xs text-slate-500">
            #{currentTimeIndex + 1} / {processedSnapshots.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
            <div className="flex items-center gap-1 text-cyan-400 text-xs mb-1">
              <TrendingUp size={12} />
              <span>买一价</span>
            </div>
            <p className="text-white font-mono font-medium">
              {formatPrice(currentSnapshot?.bids[0]?.price || 0)}
            </p>
            <p className="text-xs text-slate-400">
              {formatQuantity(currentSnapshot?.bids[0]?.quantity || 0)} 手
            </p>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
            <div className="flex items-center gap-1 text-rose-400 text-xs mb-1">
              <TrendingDown size={12} />
              <span>卖一价</span>
            </div>
            <p className="text-white font-mono font-medium">
              {formatPrice(currentSnapshot?.asks[0]?.price || 0)}
            </p>
            <p className="text-xs text-slate-400">
              {formatQuantity(currentSnapshot?.asks[0]?.quantity || 0)} 手
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <h4 className="text-xs font-medium text-slate-400 mb-2">买盘档位</h4>
          {currentSnapshot?.bids.slice(0, 5).map((bid, i) => (
            <div
              key={`bid-${i}`}
              className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-slate-700/30 transition-all"
            >
              <span className="text-slate-500 w-12">买{formatLevel(i + 1)}</span>
              <span className="text-cyan-400 font-mono">{formatPrice(bid.price)}</span>
              <span className="text-slate-300 font-mono">{formatQuantity(bid.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 mt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2">卖盘档位</h4>
          {currentSnapshot?.asks.slice(0, 5).map((ask, i) => (
            <div
              key={`ask-${i}`}
              className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-slate-700/30 transition-all"
            >
              <span className="text-slate-500 w-12">卖{formatLevel(i + 1)}</span>
              <span className="text-rose-400 font-mono">{formatPrice(ask.price)}</span>
              <span className="text-slate-300 font-mono">{formatQuantity(ask.quantity)}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
