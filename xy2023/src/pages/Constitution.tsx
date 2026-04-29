import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/common';
import { constitutionQuestions, constitutionResults } from '@/data/mockData';

const ConstitutionTest: React.FC = () => {
  const navigate = useNavigate();
  const { state, setConstitutionAnswer, completeConstitutionTest } = useApp();
  const { constitutionAnswers, userProfile } = state;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResult, setShowResult] = useState(
    userProfile.constitutionTestCompleted && userProfile.constitutionType !== 'unknown'
  );
  const [resultType, setResultType] = useState<string | null>(
    userProfile.constitutionTestCompleted && userProfile.constitutionType !== 'unknown'
      ? userProfile.constitutionType
      : null
  );

  const question = constitutionQuestions[currentQuestion];
  const answeredCount = Object.keys(constitutionAnswers).length;
  const progress = (answeredCount / constitutionQuestions.length) * 100;

  const handleAnswer = (value: string) => {
    setConstitutionAnswer(question.id, value);

    if (currentQuestion < constitutionQuestions.length - 1) {
      setTimeout(() => {
        setCurrentQuestion(prev => prev + 1);
      }, 300);
    } else {
      const type = completeConstitutionTest();
      if (type) {
        setResultType(type);
        setShowResult(true);
      }
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    } else {
      navigate(-1);
    }
  };

  if (showResult && resultType) {
    const result = constitutionResults[resultType];
    if (!result) {
      return (
        <div className="safe-area">
          <Header title="体质判定结果" showBack onBack={() => navigate('/')} />
          <div className="screen-container">
            <div className="text-center py-8">
              <span className="text-6xl">🤔</span>
              <h2 className="text-xl font-bold text-gray-800 mt-4">判定失败</h2>
              <p className="text-gray-500 mt-2">请重新测试</p>
              <button
                onClick={() => navigate('/constitution')}
                className="btn-primary mt-6"
              >
                重新测试
              </button>
            </div>
          </div>
        </div>
      );
    }

    const taboos = result.taboos ?? result.dietaryAdvice?.avoid ?? [];

    return (
      <div className="safe-area">
        <Header title="体质判定结果" showBack onBack={() => navigate('/')} />
        <div className="screen-container">
          <div className="card text-center mb-6">
            <div className="text-6xl mb-4">
              {resultType === 'cold' ? '❄️' : resultType === 'qi_deficiency' ? '💪' : '🔥'}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{result.name}</h2>
            <p className="text-gray-600">{result.description}</p>
          </div>

          <div className="card mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>🚫</span> 饮食禁忌
            </h3>
            <ul className="space-y-2">
              {taboos.map((taboo, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-red-400 mt-0.5">•</span>
                  {taboo}
                </li>
              ))}
            </ul>
          </div>

          <div className="card mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>🦶</span> 泡脚配方
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">药材：</p>
                <div className="flex flex-wrap gap-2">
                  {result.footBathRecipe.ingredients.map((ing, index) => (
                    <span
                      key={index}
                      className="chip bg-blue-100 text-blue-700"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">步骤：</p>
                <ol className="space-y-2">
                  {result.footBathRecipe.steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="bg-pink-100 text-pink-600 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">温度：</span>
                  <span className="font-medium text-gray-800">{result.footBathRecipe.temperature}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">时长：</span>
                  <span className="font-medium text-gray-800">{result.footBathRecipe.duration}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>👕</span> 穿衣建议
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">重点保暖部位：</p>
                <div className="flex flex-wrap gap-2">
                  {result.clothingAdvice.keyAreas.map((area, index) => (
                    <span
                      key={index}
                      className="chip bg-orange-100 text-orange-700"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">推荐材质：</p>
                <div className="flex flex-wrap gap-2">
                  {result.clothingAdvice.materials.map((material, index) => (
                    <span
                      key={index}
                      className="chip bg-green-100 text-green-700"
                    >
                      {material}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">小贴士：</p>
                <ul className="space-y-2">
                  {result.clothingAdvice.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-400 mt-0.5">✓</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full btn-primary"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="safe-area">
      <Header title="体质判定" showBack onBack={handleBack} />
      
      <div className="screen-container">
        {/* 进度条 */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>第 {currentQuestion + 1} 题 / 共 {constitutionQuestions.length} 题</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 问题卡片 */}
        <div className="card mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-6">{question.question}</h2>
          <div className="space-y-3">
            {question.options.map(option => {
              const isSelected = constitutionAnswers[question.id] === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(option.value)}
                  className={`w-full p-4 rounded-xl text-left transition-all duration-200 ${
                    isSelected
                      ? 'bg-pink-50 border-2 border-primary shadow-md'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`font-medium ${
                      isSelected ? 'text-primary' : 'text-gray-700'
                    }`}>
                      {option.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 跳过提示 */}
        <p className="text-center text-sm text-gray-400">
          请选择最符合你情况的选项
        </p>
      </div>
    </div>
  );
};

export default ConstitutionTest;
