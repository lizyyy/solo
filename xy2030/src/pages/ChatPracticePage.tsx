import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Lock } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { chatScenarios } from '@/data/mockData';
import Header from '@/components/Header';

const difficultyColors = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
};

const difficultyLabels = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export default function ChatPracticePage() {
  const navigate = useNavigate();
  const { user } = useAppStore();

  const handleStartScenario = (scenarioId: string) => {
    navigate(`/chat/session?scenario=${scenarioId}`);
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title="社交模拟聊天" />
      
      <div className="p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card card-purple mb-6 text-center"
        >
          <div className="text-5xl mb-3">💬</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">模拟聊天练习</h2>
          <p className="text-sm text-gray-600">
            选择不同的社交场景，练习如何开始和维持对话
          </p>
          <p className="text-xs text-gray-500 mt-2">
            已完成 {user.completedPractices} 次练习
          </p>
        </motion.div>

        <h3 className="text-lg font-semibold text-gray-800 mb-3">选择场景</h3>
        
        <div className="space-y-3">
          {chatScenarios.map((scenario, index) => {
            const isLocked = index > 2 && user.completedPractices < 3;
            
            return (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => !isLocked && handleStartScenario(scenario.id)}
                className={`card flex items-center ${
                  isLocked 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'cursor-pointer hover:shadow-lg'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mr-4 ${
                  isLocked ? 'bg-gray-100' : 'bg-gradient-to-br from-i-100 to-e-100'
                }`}>
                  {isLocked ? (
                    <Lock className="w-6 h-6 text-gray-400" />
                  ) : (
                    <span className="text-3xl">{scenario.icon}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <h4 className="font-semibold text-gray-800 mr-2">{scenario.title}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${difficultyColors[scenario.difficulty]}`}>
                      {difficultyLabels[scenario.difficulty]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-1">{scenario.description}</p>
                </div>
                
                {isLocked ? (
                  <span className="text-xs text-gray-400">完成3次练习解锁</span>
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 card"
        >
          <h3 className="font-semibold text-gray-800 mb-2">练习建议</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-e-500 mr-2">•</span>
              从简单场景开始，逐步挑战更难的场景
            </li>
            <li className="flex items-start">
              <span className="text-e-500 mr-2">•</span>
              尝试使用不同的话术模板来回应
            </li>
            <li className="flex items-start">
              <span className="text-e-500 mr-2">•</span>
              每次练习后思考：这次哪里做得好，哪里可以改进
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
