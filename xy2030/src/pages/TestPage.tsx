import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Brain, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '@/store/appStore';
import { questions } from '@/data/mockData';
import { QuestionOption } from '@/types';
import Header from '@/components/Header';

const testDescriptions = {
  I: {
    high: '你是一个典型的i人！你从独处中获得能量，喜欢深度思考和专注。社交场合可能会让你感到疲惫，但你有丰富的内心世界。',
    medium: '你偏向i人方向，喜欢在安静的环境中思考。你享受有意义的深度交流，而不是泛泛的闲聊。',
    low: '你比较均衡，既能享受独处时光，也能在社交场合中找到自己的位置。',
  },
  E: {
    high: '你是一个典型的e人！你从与他人互动中获得能量，喜欢热闹的环境，善于表达和社交。',
    medium: '你偏向e人方向，喜欢与人交流，在社交场合中感到自在。你善于调动气氛，是团队中的活跃分子。',
    low: '你比较均衡，既能与人打成一片，也需要独处时间来充电。',
  },
};

const testTips = {
  I: [
    '尝试从小规模的社交开始，比如和一两个朋友见面',
    '准备一些万能话题，避免尴尬冷场',
    '记住：独处不是孤僻，而是i人的充电方式',
    '找同样是i人的朋友，你们会更有共鸣',
    '在大型聚会前，给自己预留独处时间恢复能量',
  ],
  E: [
    '你的活力很有感染力，继续保持！',
    '注意倾听他人，给别人表达的机会',
    '有时候安静也是一种力量',
    '尝试深度交流，而不仅仅是表面闲聊',
    '记得给自己留一些独处时间反思',
  ],
};

export default function TestPage() {
  const navigate = useNavigate();
  const { currentTestStep, testAnswers, setCurrentTestStep, setTestAnswer, clearTest, updatePersonalityType } = useAppStore();
  
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{ type: 'I' | 'E'; concentration: number; description: string; tips: string[] } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentQuestion = questions[currentTestStep];
  const progress = ((currentTestStep + 1) / questions.length) * 100;

  const handleSelectOption = (option: QuestionOption) => {
    setSelectedOption(option.id);
  };

  const handleNext = () => {
    if (!selectedOption || !currentQuestion) return;

    const option = currentQuestion.options.find(o => o.id === selectedOption);
    if (option) {
      setTestAnswer(currentQuestion.id, option);
    }

    if (currentTestStep < questions.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentTestStep(currentTestStep + 1);
        setSelectedOption(null);
        setIsAnimating(false);
      }, 300);
    } else {
      calculateResult();
    }
  };

  const handlePrev = () => {
    if (currentTestStep > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentTestStep(currentTestStep - 1);
        setSelectedOption(null);
        setIsAnimating(false);
      }, 300);
    }
  };

  const calculateResult = () => {
    let iScore = 0;
    let eScore = 0;
    let totalWeight = 0;

    Object.values(testAnswers).forEach(answer => {
      totalWeight += answer.weight;
      if (answer.type === 'I') {
        iScore += answer.weight;
      } else {
        eScore += answer.weight;
      }
    });

    const type: 'I' | 'E' = iScore >= eScore ? 'I' : 'E';
    const dominantScore = type === 'I' ? iScore : eScore;
    const concentration = Math.round((dominantScore / totalWeight) * 100);

    let level: 'high' | 'medium' | 'low';
    if (concentration >= 70) level = 'high';
    else if (concentration >= 40) level = 'medium';
    else level = 'low';

    const description = testDescriptions[type][level];
    const tips = testTips[type];

    setResult({ type, concentration, description, tips });
    updatePersonalityType(type, iScore, eScore, concentration);
    setShowResult(true);

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: type === 'I' ? ['#8b5cf6', '#a78bfa', '#c4b5fd'] : ['#10b981', '#34d399', '#6ee7b7'],
    });
  };

  const handleRetake = () => {
    clearTest();
    setSelectedOption(null);
    setShowResult(false);
    setResult(null);
  };

  const handleComplete = () => {
    navigate('/');
  };

  useEffect(() => {
    if (currentQuestion && testAnswers[currentQuestion.id]) {
      setSelectedOption(testAnswers[currentQuestion.id].id);
    }
  }, [currentTestStep, currentQuestion, testAnswers]);

  if (showResult && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-i-50 to-e-50">
        <Header title="测试结果" showBack onBack={handleRetake} />
        
        <div className="p-4 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card text-center mb-6"
          >
            <div className="text-6xl mb-4">
              {result.type === 'I' ? '🦋' : '🌟'}
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              你是<span className={result.type === 'I' ? 'text-i-500' : 'text-e-500'}>
                {result.type === 'I' ? 'i人' : 'e人'}
              </span>
            </h2>
            
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center mr-4">
                <span className="text-sm text-i-500 mr-2">i</span>
                <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      result.type === 'I' 
                        ? 'bg-gradient-to-r from-i-400 to-i-600' 
                        : 'bg-gradient-to-r from-i-400 to-e-400'
                    }`}
                    style={{
                      width: result.type === 'I' 
                        ? `${50 + result.concentration * 0.45}%`
                        : `${50 + result.concentration * 0.45}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-e-500 ml-2">e</span>
              </div>
            </div>
            
            <p className="text-3xl font-bold mb-4">
              <span className={result.type === 'I' ? 'text-i-500' : 'text-e-500'}>
                {result.concentration}%
              </span>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {result.type === 'I' ? '社恐浓度' : '社牛浓度'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card mb-6"
          >
            <div className="flex items-center mb-3">
              <Brain className="w-5 h-5 text-i-500 mr-2" />
              <h3 className="font-semibold text-gray-800">结果解析</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">{result.description}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card card-green mb-6"
          >
            <div className="flex items-center mb-3">
              <Sparkles className="w-5 h-5 text-e-500 mr-2" />
              <h3 className="font-semibold text-gray-800">成长建议</h3>
            </div>
            <ul className="space-y-2">
              {result.tips.map((tip, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-e-500 mr-2 mt-1">•</span>
                  <span className="text-gray-600 text-sm">{tip}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-4"
          >
            <button
              onClick={handleRetake}
              className="btn-primary btn-outline flex items-center justify-center"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              重新测试
            </button>
            <button
              onClick={handleComplete}
              className="btn-primary btn-purple flex items-center justify-center"
            >
              开始成长之路
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-i-50 to-e-50">
      <Header title="IE人格测试" showBack />
      
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">问题进度</span>
            <span className="text-sm font-medium text-i-500">
              {currentTestStep + 1} / {questions.length}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-i-400 to-e-400 rounded-full"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {currentQuestion && (
            <motion.div
              key={currentTestStep}
              initial={{ opacity: 0, x: isAnimating ? (selectedOption ? 50 : -50) : 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <div className="card mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 leading-relaxed">
                  {currentQuestion.text}
                </h2>
                
                <div className="space-y-3">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleSelectOption(option)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        selectedOption === option.id
                          ? 'border-i-500 bg-i-50 shadow-md'
                          : 'border-gray-200 hover:border-i-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center ${
                          selectedOption === option.id
                            ? 'border-i-500 bg-i-500'
                            : 'border-gray-300'
                        }`}>
                          {selectedOption === option.id && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-3 h-3 bg-white rounded-full"
                            />
                          )}
                        </div>
                        <span className={`font-medium ${
                          selectedOption === option.id ? 'text-i-700' : 'text-gray-700'
                        }`}>
                          {option.text}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handlePrev}
            disabled={currentTestStep === 0}
            className={`btn-primary ${
              currentTestStep === 0 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'btn-outline'
            }`}
          >
            上一题
          </button>
          <button
            onClick={handleNext}
            disabled={!selectedOption}
            className={`btn-primary ${
              selectedOption ? 'btn-purple' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {currentTestStep === questions.length - 1 ? '查看结果' : '下一题'}
          </button>
        </div>
      </div>
    </div>
  );
}
