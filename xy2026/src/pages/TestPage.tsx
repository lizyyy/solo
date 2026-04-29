import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mockTests } from '../data/mockData';

export default function TestPage() {
  const navigate = useNavigate();
  const { testId } = useParams<{ testId: string }>();
  const { addTestResult } = useApp();
  
  const test = mockTests.find(t => t.id === testId);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<{
    level: 'mild' | 'moderate' | 'severe';
    description: string;
    suggestions: string[];
  } | null>(null);

  if (!test) {
    return (
      <div className="empty-state">
        <p>测试不存在</p>
        <button
          onClick={() => navigate('/emotion-tools')}
          className="btn btn-primary mt-4"
        >
          返回
        </button>
      </div>
    );
  }

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // 计算结果
      const totalScore = answers.reduce((acc, answerIndex, questionIndex) => {
        return acc + test.questions[questionIndex].options[answerIndex].score;
      }, 0);

      let level: 'mild' | 'moderate' | 'severe';
      let description: string;
      let suggestions: string[];

      if (totalScore <= 5) {
        level = 'mild';
        description = '你的情绪状态整体良好，继续保持积极的生活态度。';
        suggestions = [
          '继续保持规律的作息',
          '每天花一些时间做自己喜欢的事情',
          '与朋友家人保持良好的沟通'
        ];
      } else if (totalScore <= 10) {
        level = 'moderate';
        description = '你可能正在经历一些情绪困扰，建议适当调整生活节奏。';
        suggestions = [
          '尝试每天进行15分钟的冥想或深呼吸',
          '保证充足的睡眠时间',
          '适当增加户外活动',
          '如症状持续，建议寻求专业帮助'
        ];
      } else {
        level = 'severe';
        description = '你的情绪状态需要关注，建议尽快寻求专业帮助。';
        suggestions = [
          '建议尽快咨询专业心理医生',
          '告诉家人或朋友你的感受',
          '不要独自面对困难',
          '记住：寻求帮助是勇敢的表现'
        ];
      }

      const result = { level, description, suggestions };
      setResultData(result);

      addTestResult({
        testId: test.id,
        totalScore,
        level,
        description,
        suggestions
      });

      setShowResult(true);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const currentAnswer = answers[currentQuestion];
  const isLastQuestion = currentQuestion === test.questions.length - 1;
  const canProceed = currentAnswer !== undefined;

  if (showResult && resultData) {
    return (
      <div className="fade-in">
        <div className="card">
          <h2 className="text-xl font-semibold text-center mb-6">测试结果</h2>
          
          <div className="text-center mb-6">
            <div className={`text-4xl font-bold mb-2 ${
              resultData.level === 'mild' ? 'text-green-500' :
              resultData.level === 'moderate' ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {resultData.level === 'mild' ? '😊' : resultData.level === 'moderate' ? '😐' : '😔'}
            </div>
            <p className="text-lg font-semibold">
              {resultData.level === 'mild' ? '状态良好' :
               resultData.level === 'moderate' ? '需要关注' : '建议寻求帮助'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-gray-700">{resultData.description}</p>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-3">💡 建议</h3>
            <ul className="space-y-2">
              {resultData.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-sm text-gray-500 text-center mb-6">
            <p>⚠️ 此测试仅供参考，不能替代专业诊断。</p>
            <p>如有需要，请寻求专业心理帮助。</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/emotion-tools')}
              className="flex-1 btn btn-secondary"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* 头部 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/emotion-tools')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-lg font-semibold">{test.title}</h1>
          <p className="text-sm text-gray-500">
            第 {currentQuestion + 1} / {test.questions.length} 题
          </p>
        </div>
      </div>

      {/* 进度条 */}
      <div className="h-2 bg-gray-200 rounded-full mb-8">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${((currentQuestion + 1) / test.questions.length) * 100}%` }}
        />
      </div>

      {/* 问题 */}
      <div className="card mb-6">
        <p className="text-lg font-medium mb-6">
          {test.questions[currentQuestion].text}
        </p>

        <div className="space-y-3">
          {test.questions[currentQuestion].options.map((option, index) => (
            <button
              key={option.id}
              className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                currentAnswer === index
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleAnswer(index)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  currentAnswer === index
                    ? 'border-amber-500 bg-amber-500'
                    : 'border-gray-300'
                }`}>
                  {currentAnswer === index && (
                    <Check size={14} className="text-white" />
                  )}
                </div>
                <span>{option.text}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 导航按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handlePrev}
          disabled={currentQuestion === 0}
          className={`flex-1 btn ${
            currentQuestion === 0 ? 'btn-secondary opacity-50' : 'btn-secondary'
          }`}
        >
          <ChevronLeft size={20} />
          上一题
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className={`flex-1 btn ${
            canProceed ? 'btn-primary' : 'btn-secondary opacity-50'
          }`}
        >
          {isLastQuestion ? '查看结果' : '下一题'}
          {!isLastQuestion && <ChevronRight size={20} />}
        </button>
      </div>
    </div>
  );
}
