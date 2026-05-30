import React, { useState } from 'react';
import { Play, Volume2, Mic, Headphones, AlertTriangle, ChevronRight, ChevronLeft, X, Music } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';

interface WelcomeGuideProps {
  show: boolean;
  onClose: () => void;
}

const guideSteps = [
  {
    title: '欢迎来到混音台救场夜！',
    icon: Music,
    content: '你是今晚的值班调音师，乐队正在演出中。你的任务是处理各种突发的调音问题，确保演出顺利进行。',
    color: 'text-purple-400',
  },
  {
    title: '操作推子控制音量',
    icon: Volume2,
    content: '拖动每个声道的推子可以调整该声道的音量。注意观察电平表，避免音量过高导致失真。',
    color: 'text-green-400',
    tip: '绿色区域安全，黄色警告，红色危险！',
  },
  {
    title: '处理啸叫问题',
    icon: Mic,
    content: '当出现啸叫（feedback）时，立即降低对应声道的音量或主输出。啸叫持续会严重扣分！',
    color: 'text-red-400',
    tip: '人声麦最容易出现啸叫，注意CH1-CH2声道。',
  },
  {
    title: '响应返听请求',
    icon: Headphones,
    content: '歌手和乐手会通过返听请求调整他们的监听音量。点击耳机图标可以调整返听状态。',
    color: 'text-blue-400',
    tip: '及时响应返听请求可以获得加分。',
  },
  {
    title: '避免主输出爆峰',
    icon: AlertTriangle,
    content: '主输出音量超过85%会触发爆峰警告，严重影响音质。注意控制总输出电平！',
    color: 'text-orange-400',
    tip: '爆峰一次扣30分，要特别注意！',
  },
  {
    title: '游戏结束后复盘',
    icon: Play,
    content: '演出结束后，你可以查看复盘报告，包括评分、时间线、证据链分析。交接助手会帮你整理线索。',
    color: 'text-yellow-400',
    tip: '从摘要点回明细，操作记录不会断链！',
  },
];

export const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ show, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const startGame = useGameStore(state => state.startGame);

  if (!show) return null;

  const step = guideSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === guideSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
      setTimeout(() => startGame(), 100);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">新手引导</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className={`w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center ${step.color}`}>
              <step.icon size={40} />
            </div>
          </div>

          <h3 className={`text-2xl font-bold text-center mb-4 ${step.color}`}>
            {step.title}
          </h3>

          <p className="text-gray-300 text-center leading-relaxed mb-4">
            {step.content}
          </p>

          {step.tip && (
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <p className="text-sm text-yellow-400">
                💡 {step.tip}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-2">
          <div className="flex justify-center gap-2">
            {guideSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-white w-6'
                    : index < currentStep
                    ? 'bg-gray-400'
                    : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={isFirstStep}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg transition-all ${
              isFirstStep
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <ChevronLeft size={18} />
            上一步
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
          >
            {isLastStep ? '开始游戏' : '下一步'}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
