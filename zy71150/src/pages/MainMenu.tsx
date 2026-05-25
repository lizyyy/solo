import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { levelConfigs } from '../data/levels';
import { useGameStore } from '../store/gameStore';
import { 
  Play, 
  BookOpen, 
  History, 
  Trophy,
  Clock,
  Users,
  Star,
  ChevronRight,
  X,
  AlertTriangle,
  Target,
  Heart
} from 'lucide-react';
import { formatTime } from '../utils/gameUtils';

type TabType = 'levels' | 'rules' | 'history';

export const MainMenu: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('levels');
  const gameRecords = useGameStore(state => state.gameRecords);

  const handleStartGame = (levelId: string) => {
    navigate(`/game/${levelId}`);
  };

  const difficultyColors = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700'
  };

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };

  const failTypeLabels: Record<string, { label: string; color: string }> = {
    missed_critical: { label: '危重漏分', color: 'text-red-600' },
    wait_timeout: { label: '等待超时', color: 'text-orange-600' },
    wrong_triage: { label: '分诊错误', color: 'text-yellow-600' },
    resource_waste: { label: '资源浪费', color: 'text-blue-600' }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="p-3 bg-blue-500 rounded-xl">
              <Heart className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">急诊分诊训练系统</h1>
          </div>
          <p className="text-gray-600">在真实场景中练习 ESI 分诊技能</p>
        </motion.div>

        <div className="flex justify-center gap-2 mb-6">
          {[
            { key: 'levels' as TabType, label: '关卡选择', icon: Play },
            { key: 'rules' as TabType, label: '游戏规则', icon: BookOpen },
            { key: 'history' as TabType, label: '历史记录', icon: History }
          ].map(({ key, label, icon: Icon }) => (
            <motion.button
              key={key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(key)}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all
                ${activeTab === key 
                  ? 'bg-blue-500 text-white shadow-lg' 
                  : 'bg-white text-gray-600 hover:bg-gray-50 shadow'
                }
              `}
            >
              <Icon size={18} />
              {label}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'levels' && (
            <motion.div
              key="levels"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid md:grid-cols-3 gap-4"
            >
              {levelConfigs.map((level, index) => (
                <motion.div
                  key={level.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer"
                  onClick={() => handleStartGame(level.id)}
                >
                  <div className={`h-2 ${
                    level.difficulty === 'easy' ? 'bg-green-500' :
                    level.difficulty === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-800">{level.name}</h3>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${difficultyColors[level.difficulty]}`}>
                        {difficultyLabels[level.difficulty]}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">{level.description}</p>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Target size={14} />
                        <span>目标: {level.targetPatients}人</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Users size={14} />
                        <span>诊室: {level.rooms.length}间</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Clock size={14} />
                        <span>间隔: {level.patientSpawnRate}秒</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Star size={14} />
                        <span>初始: {level.initialPatients}人</span>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                    >
                      <Play size={18} />
                      开始游戏
                      <ChevronRight size={18} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === 'rules' && (
            <motion.div
              key="rules"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">游戏规则</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-500" />
                    ESI 分诊标准
                  </h3>
                  <div className="grid md:grid-cols-5 gap-2">
                    {[
                      { level: 1, name: '立即抢救', desc: '生命垂危', color: 'bg-red-500', time: '0分钟' },
                      { level: 2, name: '紧急', desc: '病情危重', color: 'bg-orange-500', time: '10分钟' },
                      { level: 3, name: '紧急', desc: '病情较重', color: 'bg-yellow-500', time: '30分钟' },
                      { level: 4, name: '次紧急', desc: '病情稳定', color: 'bg-cyan-500', time: '60分钟' },
                      { level: 5, name: '非紧急', desc: '病情轻微', color: 'bg-green-500', time: '120分钟' }
                    ].map(item => (
                      <div key={item.level} className={`p-3 rounded-lg text-white ${item.color}`}>
                        <div className="text-2xl font-bold">ESI {item.level}</div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs opacity-80 mt-1">{item.desc}</div>
                        <div className="text-xs mt-2 opacity-80">应等待: {item.time}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">操作流程</h3>
                  <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
                    <li>点击患者卡片查看详细信息（主诉、生命体征、症状）</li>
                    <li>根据 ESI 标准点击对应分级按钮进行分诊</li>
                    <li>点击空闲诊室将患者送入处理</li>
                    <li>注意患者等待时间，避免超时！</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">计分规则</h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="font-medium text-green-700 mb-1">加分项</div>
                      <ul className="text-green-600 space-y-0.5">
                        <li>• ESI I 正确分诊: +50分</li>
                        <li>• ESI II 正确分诊: +40分</li>
                        <li>• ESI III 正确分诊: +30分</li>
                        <li>• ESI IV 正确分诊: +20分</li>
                        <li>• ESI V 正确分诊: +10分</li>
                        <li>• 成功处理复评: +30分</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="font-medium text-red-700 mb-1">扣分项</div>
                      <ul className="text-red-600 space-y-0.5">
                        <li>• 分诊错误: -20分</li>
                        <li>• 危重患者超时: -100分（游戏失败）</li>
                        <li>• 普通患者超时: -30分</li>
                        <li>• 资源浪费: -10分</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">边界案例提示</h3>
                  <ul className="text-sm text-gray-600 space-y-1.5">
                    <li>⚠️ <strong>隐匿性危重</strong>: 部分患者初始表现不严重，但会快速恶化</li>
                    <li>⚠️ <strong>复评事件</strong>: 患者状态可能变化，需要重新评估</li>
                    <li>⚠️ <strong>资源紧张</strong>: 高等级诊室应用于高优先级患者</li>
                    <li>⚠️ <strong>假阳性</strong>: 部分症状类似危重但实际较轻</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">历史记录</h2>
              
              {gameRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History size={48} className="mx-auto mb-3 opacity-50" />
                  <p>暂无游戏记录</p>
                  <p className="text-sm">完成一局游戏后记录将显示在这里</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gameRecords.map((record, index) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          record.status === 'won' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          <Trophy className={record.status === 'won' ? 'text-green-600' : 'text-red-600'} size={24} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">{record.levelName}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(record.timestamp).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">{record.score}</div>
                          <div className="text-xs text-gray-500">得分</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-gray-700">
                            {record.patientsProcessed}/{record.targetPatients}
                          </div>
                          <div className="text-xs text-gray-500">处理数</div>
                        </div>
                        <div className="text-center">
                          <div className="font-mono text-gray-700">{formatTime(record.duration)}</div>
                          <div className="text-xs text-gray-500">用时</div>
                        </div>
                        <div className="text-center">
                          <div className={`font-semibold ${
                            record.status === 'won' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {record.status === 'won' ? '胜利' : '失败'}
                          </div>
                          <div className="text-xs text-gray-500">结果</div>
                        </div>

                        {record.failReasons.length > 0 && (
                          <div className="w-48">
                            <div className="text-xs text-gray-500 mb-1">失误记录</div>
                            <div className="flex flex-wrap gap-1">
                              {record.failReasons.slice(0, 3).map((fail, idx) => (
                                <span 
                                  key={idx}
                                  className={`text-xs px-1.5 py-0.5 rounded ${failTypeLabels[fail.type]?.color || 'text-gray-600'} bg-gray-100`}
                                >
                                  {failTypeLabels[fail.type]?.label || fail.type}
                                </span>
                              ))}
                              {record.failReasons.length > 3 && (
                                <span className="text-xs text-gray-500">+{record.failReasons.length - 3}</span>
                              )}
                            </div>
                          </div>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/replay/${record.id}`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          <Play size={14} />
                          回放
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
