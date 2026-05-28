import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Database, AlertTriangle, Clock, Zap, Globe } from 'lucide-react';
import { useDataStore } from '@/store/useDataStore';
import { useFilterStore } from '@/store/useFilterStore';
import GlassPanel from '@/components/ui/GlassPanel';
import Badge from '@/components/ui/Badge';

export default function StatusBar() {
  const { enterprises, transactions, gaps, issues } = useDataStore();
  const { timePosition, isPlaying } = useFilterStore();
  const [fps, setFps] = useState(60);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const frameTimes: number[] = [];
    let lastTime = performance.now();
    let animationId: number;

    const measureFps = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      frameTimes.push(delta);
      if (frameTimes.length > 60) {
        frameTimes.shift();
      }

      const averageDelta = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const currentFps = Math.round(1000 / averageDelta);
      setFps(currentFps);

      animationId = requestAnimationFrame(measureFps);
    };

    animationId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const openIssues = issues.filter((i) => i.status === 'open' || i.status === 'explained');
  const totalGap = gaps.reduce((sum, g) => sum + g.gap, 0);
  const totalTransactionAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  const getFpsColor = () => {
    if (fps >= 55) return 'text-accent-green';
    if (fps >= 30) return 'text-accent-yellow';
    return 'text-accent-red';
  };

  return (
    <GlassPanel
      padding="px-6 py-2"
      rounded="rounded-2xl"
      className="w-full"
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-cyan" />
            <span className="text-white/70 text-sm font-mono">
              {currentTime.toLocaleString('zh-CN')}
            </span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${isPlaying ? 'text-accent-green animate-pulse' : 'text-white/40'}`} />
            <span className={`text-sm font-medium ${isPlaying ? 'text-accent-green' : 'text-white/50'}`}>
              {isPlaying ? '播放中' : '已暂停'}
            </span>
            {isPlaying && (
              <motion.div
                className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden"
                initial={false}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-accent-cyan to-accent-green"
                  initial={{ width: 0 }}
                  animate={{ width: `${timePosition}%` }}
                  transition={{ duration: 0.1 }}
                />
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2" title="企业数量">
              <Database className="w-4 h-4 text-accent-cyan" />
              <span className="text-white/80 text-sm font-medium">
                {enterprises.length}
              </span>
            </div>

            <div className="flex items-center gap-2" title="交易总量">
              <Activity className="w-4 h-4 text-accent-green" />
              <span className="text-white/80 text-sm font-medium">
                {transactions.length} 笔 / {totalTransactionAmount.toLocaleString()} 吨
              </span>
            </div>

            <div className="flex items-center gap-2" title="缺口总量">
              <AlertTriangle className="w-4 h-4 text-accent-orange" />
              <span className="text-white/80 text-sm font-medium">
                {totalGap.toLocaleString()} 吨
              </span>
            </div>

            <div className="flex items-center gap-2" title="问题数量">
              <Badge variant="danger" size="sm" pulse={openIssues.length > 0}>
                {openIssues.length}
              </Badge>
              <span className="text-white/50 text-sm">待处理问题</span>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-2" title="帧率">
            <Globe className="w-4 h-4 text-accent-purple" />
            <span className={`text-sm font-mono font-medium ${getFpsColor()}`}>
              {fps} FPS
            </span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
