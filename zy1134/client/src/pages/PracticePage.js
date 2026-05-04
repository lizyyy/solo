import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Clock,
  Music,
  ChevronDown,
  Play,
  RotateCcw
} from 'lucide-react';
import { practiceApi, questionsApi } from '../services/api';

// 题目类型名称映射
const QUESTION_TYPE_NAMES = {
  'scale_identification': '音阶音级识别',
  'chord_construction': '和弦构成',
  'inversion': '转位判断',
  'roman_numeral': '罗马数字和弦功能',
  'cadence': '终止式判断'
};

// 练习状态枚举
const PRACTICE_STATES = {
  SETUP: 'setup',
  PRACTICING: 'practicing',
  ANSWERED: 'answered',
  FINISHED: 'finished'
};

// 筛选设置组件
function PracticeSetup({ onStart, loading }) {
  const [questionType, setQuestionType] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [knowledgePoints, setKnowledgePoints] = useState({});
  const [selectedKnowledgePoint, setSelectedKnowledgePoint] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showKpDropdown, setShowKpDropdown] = useState(false);

  useEffect(() => {
    fetchKnowledgePoints();
  }, []);

  const fetchKnowledgePoints = async () => {
    try {
      const response = await questionsApi.getKnowledgePoints();
      setKnowledgePoints(response.data.data || {});
    } catch (error) {
      console.error('Failed to fetch knowledge points:', error);
    }
  };

  const questionTypes = [
    { value: '', label: '全部题型' },
    { value: 'scale_identification', label: '音阶音级识别' },
    { value: 'chord_construction', label: '和弦构成' },
    { value: 'inversion', label: '转位判断' },
    { value: 'roman_numeral', label: '罗马数字和弦功能' },
    { value: 'cadence', label: '终止式判断' }
  ];

  const countOptions = [5, 10, 15, 20];

  const handleStart = () => {
    onStart({
      questionType: questionType || undefined,
      knowledgePointId: selectedKnowledgePoint ? parseInt(selectedKnowledgePoint) : undefined,
      count: questionCount
    });
  };

  // 扁平化知识点列表
  const allKnowledgePoints = [];
  Object.entries(knowledgePoints).forEach(([category, points]) => {
    points.forEach(kp => {
      allKnowledgePoints.push({
        ...kp,
        categoryLabel: category
      });
    });
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">开始新练习</h1>
              <p className="text-blue-100 mt-1">选择练习条件开始答题</p>
            </div>
          </div>
        </div>

        {/* 表单内容 */}
        <div className="p-6 space-y-6">
          {/* 题目类型 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">选择题型</label>
            <div className="relative">
              <button
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span>{questionTypes.find(t => t.value === questionType)?.label || '全部题型'}</span>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showTypeDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {questionTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setQuestionType(type.value);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                        questionType === type.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 知识点 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">选择知识点（可选）</label>
            <div className="relative">
              <button
                onClick={() => setShowKpDropdown(!showKpDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span>
                  {allKnowledgePoints.find(kp => kp.id.toString() === selectedKnowledgePoint)?.name || '全部知识点'}
                </span>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showKpDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showKpDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedKnowledgePoint('');
                      setShowKpDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                      selectedKnowledgePoint === '' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    全部知识点
                  </button>
                  {Object.entries(knowledgePoints).map(([category, points]) => (
                    <div key={category}>
                      <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                        {category}
                      </div>
                      {points.map((kp) => (
                        <button
                          key={kp.id}
                          onClick={() => {
                            setSelectedKnowledgePoint(kp.id.toString());
                            setShowKpDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                            selectedKnowledgePoint === kp.id.toString() ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                          }`}
                        >
                          {kp.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 题目数量 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">题目数量</label>
            <div className="flex gap-2">
              {countOptions.map((count) => (
                <button
                  key={count}
                  onClick={() => setQuestionCount(count)}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                    questionCount === count
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {count} 题
                </button>
              ))}
            </div>
          </div>

          {/* 开始按钮 */}
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                准备中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                开始练习
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// 题目展示组件
function QuestionDisplay({ 
  question, 
  currentIndex, 
  totalQuestions,
  onSubmit,
  userAnswer,
  isAnswered,
  result,
  timeSpent
}) {
  const [selectedOption, setSelectedOption] = useState(userAnswer || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOptionSelect = (option) => {
    if (isAnswered) return;
    setSelectedOption(option);
  };

  const handleSubmit = async () => {
    if (!selectedOption || isAnswered) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(selectedOption);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 渲染选项
  const renderOptions = () => {
    if (!question.options) return null;

    return question.options.map((option, index) => {
      const isSelected = JSON.stringify(selectedOption) === JSON.stringify(option);
      const isCorrect = result && JSON.stringify(result.correctAnswer) === JSON.stringify(option);
      const isWrong = isAnswered && isSelected && !isCorrect;

      let optionStyle = 'border-gray-200 hover:border-blue-300 hover:bg-blue-50';
      
      if (isAnswered) {
        if (isCorrect) {
          optionStyle = 'border-green-400 bg-green-50';
        } else if (isWrong) {
          optionStyle = 'border-red-400 bg-red-50';
        } else {
          optionStyle = 'border-gray-200 opacity-60';
        }
      } else if (isSelected) {
        optionStyle = 'border-blue-500 bg-blue-50 ring-2 ring-blue-200';
      }

      return (
        <button
          key={index}
          onClick={() => handleOptionSelect(option)}
          disabled={isAnswered}
          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${optionStyle}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                isSelected && !isAnswered ? 'bg-blue-500 text-white' : 
                isCorrect ? 'bg-green-500 text-white' :
                isWrong ? 'bg-red-500 text-white' :
                'bg-gray-100 text-gray-600'
              }`}>
                {String.fromCharCode(65 + index)}
              </span>
              <span className="font-medium">
                {Array.isArray(option) ? option.join(' - ') : option}
              </span>
            </div>
            {isAnswered && isCorrect && <CheckCircle className="w-5 h-5 text-green-500" />}
            {isWrong && <XCircle className="w-5 h-5 text-red-500" />}
          </div>
        </button>
      );
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* 进度条 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">第 {currentIndex + 1} 题</span>
            <span className="text-sm text-gray-400">/ 共 {totalQuestions} 题</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>{Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* 题目卡片 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 题目头部 */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                {QUESTION_TYPE_NAMES[question.type] || question.type}
              </span>
              <span className="text-sm text-gray-500">
                难度: {'★'.repeat(question.difficulty)}{'☆'.repeat(5 - question.difficulty)}
              </span>
            </div>
            {question.knowledge_point_name && (
              <span className="text-sm text-gray-500">{question.knowledge_point_name}</span>
            )}
          </div>
        </div>

        {/* 题目内容 */}
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {question.content?.question || '请作答'}
          </h2>

          {/* 附加信息显示 */}
          {question.content?.key && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-sm font-medium text-blue-700">
                调性: {question.content.key} {question.content.scaleType === 'major' ? '大调' : question.content.scaleType === 'harmonic_minor' ? '和声小调' : '小调'}
              </span>
            </div>
          )}

          {/* 选项 */}
          <div className="space-y-3">
            {renderOptions()}
          </div>

          {/* 答案反馈 */}
          {isAnswered && result && (
            <div className={`mt-6 p-4 rounded-lg border ${
              result.isCorrect 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {result.isCorrect ? (
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className={`font-semibold ${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                    {result.isCorrect ? '回答正确！' : '回答错误'}
                  </h3>
                  
                  {/* 错因标签 */}
                  {result.errorTags && result.errorTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {result.errorTags.map((tag, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded"
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* 解析 */}
                  {result.explanation && (
                    <p className="text-gray-600 mt-3 text-sm leading-relaxed">
                      <strong>解析:</strong> {result.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between">
          <button
            disabled={currentIndex === 0}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            上一题
          </button>

          {!isAnswered ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedOption || isSubmitting}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  提交中...
                </>
              ) : (
                '提交答案'
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                if (currentIndex === totalQuestions - 1) {
                  // 最后一题，触发完成
                  window.dispatchEvent(new CustomEvent('practiceFinished'));
                } else {
                  // 下一题
                  window.dispatchEvent(new CustomEvent('nextQuestion'));
                }
              }}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              {currentIndex === totalQuestions - 1 ? '完成练习' : '下一题'}
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 练习结果页面
function PracticeResult({ sessionResult, onRestart, onViewWrongNotes }) {
  if (!sessionResult) return null;

  const { statistics, answers } = sessionResult;
  const accuracy = statistics.accuracy || 0;

  // 正确率颜色
  const getAccuracyColor = () => {
    if (accuracy >= 80) return 'text-green-600';
    if (accuracy >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAccuracyBg = () => {
    if (accuracy >= 80) return 'bg-green-50 border-green-200';
    if (accuracy >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* 结果卡片 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8 text-white text-center">
          <h1 className="text-3xl font-bold mb-2">练习完成！</h1>
          <p className="text-blue-100">查看你的答题情况</p>
        </div>

        {/* 统计数据 */}
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-gray-900">{statistics.total}</p>
              <p className="text-sm text-gray-500 mt-1">总题数</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{statistics.correct}</p>
              <p className="text-sm text-gray-500 mt-1">正确</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{statistics.wrong}</p>
              <p className="text-sm text-gray-500 mt-1">错误</p>
            </div>
          </div>

          {/* 正确率展示 */}
          <div className={`p-6 rounded-lg border ${getAccuracyBg()} mb-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">正确率</p>
                <p className={`text-4xl font-bold ${getAccuracyColor()}`}>{accuracy}%</p>
              </div>
              <div className="w-24 h-24 relative">
                {/* 圆形进度条 */}
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={accuracy >= 80 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${accuracy * 2.83} 283`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle className={`w-8 h-8 ${getAccuracyColor()}`} />
                </div>
              </div>
            </div>
          </div>

          {/* 错因分布 */}
          {statistics.errorTagCounts && Object.keys(statistics.errorTagCounts).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">错因分析</h3>
              <div className="space-y-2">
                {Object.entries(statistics.errorTagCounts).map(([tag, count]) => (
                  <div key={tag} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-32">{tag}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-orange-400 h-2 rounded-full"
                        style={{ 
                          width: `${(count / Math.max(...Object.values(statistics.errorTagCounts), 1)) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500 w-8">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-4">
            <button
              onClick={onRestart}
              className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              再练一次
            </button>
            {statistics.wrong > 0 && (
              <button
                onClick={onViewWrongNotes}
                className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <AlertCircle className="w-5 h-5" />
                查看错题
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 主练习页面组件
function PracticePage() {
  const [searchParams] = useSearchParams();
  const [practiceState, setPracticeState] = useState(PRACTICE_STATES.SETUP);
  const [sessionId, setSessionId] = useState(null);
  const [questionIds, setQuestionIds] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [timer, setTimer] = useState(null);

  // 从 URL 参数预填充
  useEffect(() => {
    const type = searchParams.get('type');
    const knowledgePointId = searchParams.get('knowledgePointId');
    // 这里可以用来预填充筛选条件
  }, [searchParams]);

  // 计时器
  useEffect(() => {
    if (practiceState === PRACTICE_STATES.PRACTICING || practiceState === PRACTICE_STATES.ANSWERED) {
      const newTimer = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
      setTimer(newTimer);
      
      return () => {
        if (newTimer) clearInterval(newTimer);
      };
    }
  }, [practiceState]);

  // 监听自定义事件
  useEffect(() => {
    const handleNextQuestion = () => {
      goToNextQuestion();
    };
    
    const handlePracticeFinished = () => {
      finishSession();
    };
    
    window.addEventListener('nextQuestion', handleNextQuestion);
    window.addEventListener('practiceFinished', handlePracticeFinished);
    
    return () => {
      window.removeEventListener('nextQuestion', handleNextQuestion);
      window.removeEventListener('practiceFinished', handlePracticeFinished);
    };
  }, [currentQuestionIndex, questionIds.length]);

  // 开始练习
  const handleStart = async (params) => {
    setLoading(true);
    try {
      const response = await practiceApi.startSession(params);
      const { sessionId: newSessionId, questionIds: newQuestionIds } = response.data.data;
      
      setSessionId(newSessionId);
      setQuestionIds(newQuestionIds);
      setCurrentQuestionIndex(0);
      setTimeSpent(0);
      
      // 加载第一题
      if (newQuestionIds.length > 0) {
        await loadQuestion(newQuestionIds[0]);
      }
      
      setPracticeState(PRACTICE_STATES.PRACTICING);
    } catch (error) {
      console.error('Failed to start practice:', error);
      alert('开始练习失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载题目
  const loadQuestion = async (questionId) => {
    try {
      const response = await practiceApi.getPracticeQuestion(questionId);
      setCurrentQuestion(response.data.data);
      setUserAnswer(null);
      setResult(null);
      setPracticeState(PRACTICE_STATES.PRACTICING);
    } catch (error) {
      console.error('Failed to load question:', error);
    }
  };

  // 提交答案
  const handleSubmit = async (answer) => {
    try {
      const response = await practiceApi.submitAnswer({
        questionId: questionIds[currentQuestionIndex],
        sessionId,
        userAnswer: answer,
        timeSpent
      });
      
      setResult(response.data.data);
      setUserAnswer(answer);
      setPracticeState(PRACTICE_STATES.ANSWERED);
    } catch (error) {
      console.error('Failed to submit answer:', error);
      alert('提交答案失败，请稍后重试');
    }
  };

  // 下一题
  const goToNextQuestion = () => {
    if (currentQuestionIndex < questionIds.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      loadQuestion(questionIds[nextIndex]);
    }
  };

  // 结束会话
  const finishSession = async () => {
    try {
      const response = await practiceApi.endSession(sessionId);
      setSessionResult(response.data.data);
      setPracticeState(PRACTICE_STATES.FINISHED);
      
      // 清除计时器
      if (timer) {
        clearInterval(timer);
        setTimer(null);
      }
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  // 重新开始
  const handleRestart = () => {
    setPracticeState(PRACTICE_STATES.SETUP);
    setSessionId(null);
    setQuestionIds([]);
    setCurrentQuestionIndex(0);
    setCurrentQuestion(null);
    setUserAnswer(null);
    setResult(null);
    setSessionResult(null);
    setTimeSpent(0);
  };

  // 查看错题
  const handleViewWrongNotes = () => {
    window.location.href = '/wrong-notes';
  };

  return (
    <div className="space-y-6">
      {practiceState === PRACTICE_STATES.SETUP && (
        <PracticeSetup onStart={handleStart} loading={loading} />
      )}

      {(practiceState === PRACTICE_STATES.PRACTICING || practiceState === PRACTICE_STATES.ANSWERED) && currentQuestion && (
        <QuestionDisplay
          question={currentQuestion}
          currentIndex={currentQuestionIndex}
          totalQuestions={questionIds.length}
          onSubmit={handleSubmit}
          userAnswer={userAnswer}
          isAnswered={practiceState === PRACTICE_STATES.ANSWERED}
          result={result}
          timeSpent={timeSpent}
        />
      )}

      {practiceState === PRACTICE_STATES.FINISHED && (
        <PracticeResult
          sessionResult={sessionResult}
          onRestart={handleRestart}
          onViewWrongNotes={handleViewWrongNotes}
        />
      )}
    </div>
  );
}

export default PracticePage;
