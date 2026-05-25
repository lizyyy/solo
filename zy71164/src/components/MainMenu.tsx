import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { levels, getDifficultyColor, getDifficultyText } from '@/config/levels';
import { formatDate, formatDuration } from '@/utils/export';
import { HelpCircle, Trophy, Play, ChevronDown, ChevronUp } from 'lucide-react';

export default function MainMenu() {
  const { startGame, loadHistory, historyRecords } = useGameStore();
  const [showInstructions, setShowInstructions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const getBestScore = (levelId: string) => {
    const records = historyRecords.filter((r) => r.levelId === levelId && r.result === 'victory');
    if (records.length === 0) return null;
    return Math.max(...records.map((r) => r.score));
  };

  return (
    <div className="min-h-screen bg-sonar-bg crt-effect flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="scanline-overlay" />

      <div className="w-full max-w-4xl z-10">
        <div className="text-center mb-12">
          <h1
            className="font-vt323 text-6xl md:text-8xl text-sonar-green mb-4 tracking-wider"
            style={{ textShadow: '0 0 20px #39ff14, 0 0 40px #39ff14, 0 0 60px #39ff14' }}
          >
            潜艇声呐
          </h1>
          <h2
            className="font-vt323 text-3xl md:text-5xl text-sonar-cyan mb-2 tracking-widest"
            style={{ textShadow: '0 0 15px #00ffff' }}
          >
            GRID WARFARE
          </h2>
          <p className="text-sonar-green/70 font-jetbrains text-sm mt-4 tracking-wide">
            网格海域 · 声呐探测 · 策略推理
          </p>
          <div className="mt-2 text-sonar-green/50 font-jetbrains text-xs">
            VERSION 1.0.0 | SYSTEM ONLINE
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {levels.map((level) => {
            const bestScore = getBestScore(level.id);
            const diffColor = getDifficultyColor(level.difficulty);

            return (
              <div
                key={level.id}
                className="panel hover:border-glow transition-all duration-300 cursor-pointer group"
                onClick={() => startGame(level)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-vt323 text-2xl text-sonar-green text-glow">
                      {level.name}
                    </h3>
                    <span
                      className="text-sm font-jetbrains"
                      style={{ color: diffColor }}
                    >
                      [{getDifficultyText(level.difficulty)}]
                    </span>
                  </div>
                  <Play
                    className="w-8 h-8 text-sonar-green opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ filter: 'drop-shadow(0 0 5px #39ff14)' }}
                  />
                </div>

                <div className="space-y-2 mb-4 text-sm font-jetbrains">
                  <div className="flex justify-between">
                    <span className="text-sonar-green/60">海域大小</span>
                    <span className="text-sonar-green">
                      {level.gridSize}x{level.gridSize}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sonar-green/60">目标数量</span>
                    <span className="text-sonar-green">{level.targetCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sonar-green/60">初始能量</span>
                    <span className="text-sonar-amber">{level.initialEnergy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sonar-green/60">噪声源</span>
                    <span className="text-sonar-amber">{level.noiseSourceCount}</span>
                  </div>
                </div>

                <p className="text-xs text-sonar-green/50 font-jetbrains mb-4">
                  {level.description}
                </p>

                {bestScore !== null && (
                  <div className="flex items-center gap-2 pt-3 border-t border-sonar-green/20">
                    <Trophy className="w-4 h-4 text-sonar-amber" />
                    <span className="text-xs text-sonar-amber font-jetbrains">
                      最佳: {bestScore}分
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div
            className="panel cursor-pointer"
            onClick={() => setShowInstructions(!showInstructions)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-sonar-cyan" />
                <span className="font-vt323 text-xl text-sonar-cyan">操作说明</span>
              </div>
              {showInstructions ? (
                <ChevronUp className="w-5 h-5 text-sonar-cyan" />
              ) : (
                <ChevronDown className="w-5 h-5 text-sonar-cyan" />
              )}
            </div>

            {showInstructions && (
              <div className="mt-4 space-y-4 text-sm font-jetbrains text-sonar-green/80">
                <div>
                  <h4 className="text-sonar-green mb-2">游戏目标</h4>
                  <p>
                    在能量耗尽前，通过声呐扫描定位并消灭所有敌方潜艇。注意区分真实目标和噪声干扰！
                  </p>
                </div>

                <div>
                  <h4 className="text-sonar-green mb-2">声呐类型</h4>
                  <ul className="space-y-1 ml-4">
                    <li>
                      <span className="text-sonar-green">📡 主动扫描</span> - 3x3范围高精度，消耗5能量
                    </li>
                    <li>
                      <span className="text-sonar-cyan">🔍 扇形扫描</span> - 60度远距离，消耗8能量
                    </li>
                    <li>
                      <span className="text-sonar-amber">👂 被动监听</span> - 全图低精度，不消耗能量
                    </li>
                    <li>
                      <span className="text-sonar-red">💣 深水炸弹</span> - 攻击选中格子，消耗10能量
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-sonar-green mb-2">操作方式</h4>
                  <ul className="space-y-1 ml-4">
                    <li>• 点击网格选择目标位置</li>
                    <li>• 快捷键 1/2/3 切换扫描模式</li>
                    <li>• 空格键 发动攻击</li>
                    <li>• E 结束回合</li>
                    <li>• P 暂停游戏</li>
                    <li>• R 重新开始</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-sonar-green mb-2">图例</h4>
                  <ul className="space-y-1 ml-4">
                    <li>
                      <span className="inline-block w-3 h-3 rounded-full bg-sonar-cyan mr-2" />
                      玩家位置(P)
                    </li>
                    <li>
                      <span className="inline-block w-3 h-3 rounded-full bg-sonar-green mr-2" />
                      回波信号
                    </li>
                    <li>
                      <span className="inline-block w-3 h-3 rounded-full bg-sonar-amber mr-2" />
                      可疑信号(?)
                    </li>
                    <li>
                      <span className="inline-block w-3 h-3 rounded-full bg-sonar-amber mr-2" style={{ borderRadius: 0 }} />
                      噪声源(N)
                    </li>
                    <li>
                      <span className="inline-block w-3 h-3 mr-2" style={{ border: '2px solid #ff3333' }} />
                      已摧毁目标
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div
            className="panel cursor-pointer"
            onClick={() => setShowHistory(!showHistory)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-sonar-amber" />
                <span className="font-vt323 text-xl text-sonar-amber">
                  历史战绩 ({historyRecords.length})
                </span>
              </div>
              {showHistory ? (
                <ChevronUp className="w-5 h-5 text-sonar-amber" />
              ) : (
                <ChevronDown className="w-5 h-5 text-sonar-amber" />
              )}
            </div>

            {showHistory && (
              <div className="mt-4">
                {historyRecords.length === 0 ? (
                  <p className="text-sonar-green/50 text-center py-4 font-jetbrains text-sm">
                    暂无战绩记录
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-jetbrains">
                      <thead>
                        <tr className="text-sonar-green/70 border-b border-sonar-green/30">
                          <th className="text-left py-2 px-2">日期</th>
                          <th className="text-left py-2 px-2">关卡</th>
                          <th className="text-left py-2 px-2">结果</th>
                          <th className="text-right py-2 px-2">得分</th>
                          <th className="text-right py-2 px-2">回合</th>
                          <th className="text-right py-2 px-2">用时</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRecords.slice(0, 10).map((record) => (
                          <tr
                            key={record.id}
                            className="border-b border-sonar-green/10 hover:bg-sonar-green/5"
                          >
                            <td className="py-2 px-2 text-sonar-green/80">
                              {formatDate(record.timestamp)}
                            </td>
                            <td className="py-2 px-2 text-sonar-green">
                              {record.levelName}
                            </td>
                            <td className="py-2 px-2">
                              <span
                                style={{
                                  color:
                                    record.result === 'victory'
                                      ? 'var(--sonar-green)'
                                      : 'var(--sonar-red)',
                                }}
                              >
                                {record.result === 'victory' ? '胜利' : '失败'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right text-sonar-amber">
                              {record.score}
                            </td>
                            <td className="py-2 px-2 text-right text-sonar-green/80">
                              {record.turns}
                            </td>
                            <td className="py-2 px-2 text-right text-sonar-green/80">
                              {formatDuration(record.duration)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-sonar-green/40 text-xs font-jetbrains">
          <p>声呐网格游戏 v1.0 | 科普教育用途</p>
          <p className="mt-1">通过游戏理解声呐探测原理与三角定位法</p>
        </div>
      </div>
    </div>
  );
}
