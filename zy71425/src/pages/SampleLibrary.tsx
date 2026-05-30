import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SAMPLES } from '../samples';
import { useEditorStore } from '../store/useEditorStore';
import { useSimulationStore } from '../store/useSimulationStore';
import { BookOpen, Play, AlertTriangle, CheckCircle2, Zap, Unlink, Target, ArrowRight } from 'lucide-react';

const difficultyColors = {
  easy: 'text-neon-green',
  medium: 'text-energy-yellow',
  hard: 'text-energy-red',
};

const typeIcons = {
  'magnetic_direction': Zap,
  'high_energy': Zap,
  'track_broken': Unlink,
  'wall_collision': Target,
  'success': CheckCircle2,
};

const typeColors = {
  'magnetic_direction': 'bg-magnetic-purple/20 text-magnetic-purple border-magnetic-purple/50',
  'high_energy': 'bg-energy-red/20 text-energy-red border-energy-red/50',
  'track_broken': 'bg-energy-yellow/20 text-energy-yellow border-energy-yellow/50',
  'wall_collision': 'bg-energy-red/20 text-energy-red border-energy-red/50',
  'success': 'bg-neon-green/20 text-neon-green border-neon-green/50',
};

export function SampleLibrary() {
  const navigate = useNavigate();
  const { loadSample, clearAll } = useEditorStore();
  const { clear: clearSimulation } = useSimulationStore();

  const handleLoadSample = (sampleId: string) => {
    clearSimulation();
    clearAll();
    loadSample(sampleId);
    navigate('/editor');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            样例库
          </h1>
          <p className="font-mono text-sm text-tech-light max-w-2xl">
            选择预置样例开始学习。每个样例都设计了特定的物理场景，包含错误案例和成功案例。
            尝试找出问题并修正它们！
          </p>
        </motion.div>

        <div className="mb-8">
          <h2 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-energy-red" />
            错误诊断样例
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {SAMPLES.filter((s) => s.type !== 'success').map((sample, index) => {
              const TypeIcon = typeIcons[sample.type] || AlertTriangle;
              return (
                <motion.div
                  key={sample.id}
                  id={sample.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card hover:border-plasma-blue/50 transition-all cursor-pointer group"
                  onClick={() => handleLoadSample(sample.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${sample.type === 'success' ? 'bg-neon-green/20' : 'bg-energy-red/20'}`}>
                      <TypeIcon className={`w-6 h-6 ${sample.type === 'success' ? 'text-neon-green' : 'text-energy-red'}`} />
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-mono border ${typeColors[sample.type]}`}>
                      {sample.typeLabel}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-lg text-white mb-2 group-hover:text-plasma-blue transition-colors">
                    {sample.name}
                  </h3>
                  <p className="font-mono text-xs text-tech-light mb-4 h-10">
                    {sample.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className={`${difficultyColors[sample.difficulty]}`}>
                        难度: {sample.difficulty === 'easy' ? '简单' : sample.difficulty === 'medium' ? '中等' : '困难'}
                      </span>
                      <span className="text-tech-gray">|</span>
                      <span className="text-tech-light">
                        轨道: {sample.trackElements.length} 片
                      </span>
                      <span className="text-tech-gray">|</span>
                      <span className="text-tech-light">
                        磁场: {sample.magneticFields.length} 块
                      </span>
                    </div>
                  </div>

                  <div className="bg-space-medium rounded-lg p-3 mb-4">
                    <div className="font-mono text-xs text-tech-light mb-1">学习目标</div>
                    <div className="font-mono text-sm text-white">
                      {sample.learningObjective}
                    </div>
                  </div>

                  <motion.button
                    className="w-full btn-secondary flex items-center justify-center gap-2 group-hover:border-plasma-blue group-hover:text-plasma-blue transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Play className="w-4 h-4" />
                    加载样例
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-neon-green" />
            成功参考样例
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {SAMPLES.filter((s) => s.type === 'success').map((sample, index) => {
              const TypeIcon = typeIcons[sample.type] || CheckCircle2;
              return (
                <motion.div
                  key={sample.id}
                  id={sample.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card hover:border-plasma-blue/50 transition-all cursor-pointer group"
                  onClick={() => handleLoadSample(sample.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-neon-green/20 p-3 rounded-xl">
                      <TypeIcon className="w-6 h-6 text-neon-green" />
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-mono border bg-neon-green/20 text-neon-green border-neon-green/50">
                      {sample.typeLabel}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-lg text-white mb-2 group-hover:text-plasma-blue transition-colors">
                    {sample.name}
                  </h3>
                  <p className="font-mono text-xs text-tech-light mb-4">
                    {sample.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className={difficultyColors[sample.difficulty]}>
                        难度: {sample.difficulty === 'easy' ? '简单' : sample.difficulty === 'medium' ? '中等' : '困难'}
                      </span>
                      <span className="text-tech-gray">|</span>
                      <span className="text-tech-light">
                        轨道: {sample.trackElements.length} 片
                      </span>
                      <span className="text-tech-gray">|</span>
                      <span className="text-tech-light">
                        磁场: {sample.magneticFields.length} 块
                      </span>
                    </div>
                  </div>

                  <div className="bg-space-medium rounded-lg p-3 mb-4">
                    <div className="font-mono text-xs text-tech-light mb-1">学习目标</div>
                    <div className="font-mono text-sm text-white">
                      {sample.learningObjective}
                    </div>
                  </div>

                  <motion.button
                    className="w-full btn-secondary flex items-center justify-center gap-2 group-hover:border-plasma-blue group-hover:text-plasma-blue transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Play className="w-4 h-4" />
                    加载样例
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 card border-plasma-blue/30 bg-plasma-blue/5"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-plasma-blue/20">
              <BookOpen className="w-6 h-6 text-plasma-blue" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-white mb-2">使用说明</h3>
              <ul className="font-mono text-sm text-tech-light space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-plasma-blue">1.</span>
                  选择一个样例加载到编辑器中
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-plasma-blue">2.</span>
                  观察轨道布局和磁场配置，尝试找出问题所在
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-plasma-blue">3.</span>
                  点击"运行模拟"观察粒子轨迹
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-plasma-blue">4.</span>
                  查看分析结果了解失败原因，修改轨道后重新尝试
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-plasma-blue">5.</span>
                  所有记录会自动保存到历史记录中，可随时复盘
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
