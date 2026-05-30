import { useState } from 'react';
import { HelpCircle, X, ChevronRight, Play, Sliders, Rocket, Save, Search } from 'lucide-react';
import { guideSteps } from '../../data/presets';

export default function GuidePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'play': return <Play size={20} />;
      case 'sliders': return <Sliders size={20} />;
      case 'rocket': return <Rocket size={20} />;
      case 'save': return <Save size={20} />;
      case 'search': return <Search size={20} />;
      default: return <HelpCircle size={20} />;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/30 transition-all hover:scale-110"
        title="使用帮助"
      >
        <HelpCircle size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          快速入门指南
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all"
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {guideSteps.map((step, index) => (
          <div
            key={index}
            onClick={() => setCurrentStep(index)}
            className={`p-3 rounded-lg cursor-pointer transition-all ${
              currentStep === index
                ? 'bg-cyan-500/20 border border-cyan-500/50'
                : 'bg-slate-800/50 border border-transparent hover:border-slate-600'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                currentStep === index ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
              }`}>
                {getIcon(step.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">0{index + 1}</span>
                  <h4 className="text-sm font-semibold text-slate-200 truncate">
                    {step.title}
                  </h4>
                </div>
                {currentStep === index && (
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className={`text-slate-500 transition-transform ${
                currentStep === index ? 'rotate-90' : ''
              }`} />
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-slate-800/30 border-t border-slate-700/50">
        <div className="flex items-center justify-center gap-1">
          {guideSteps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                currentStep === index ? 'bg-cyan-500 w-6' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
        <div className="mt-3 flex justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-3 py-1 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            上一步
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(guideSteps.length - 1, currentStep + 1))}
            disabled={currentStep === guideSteps.length - 1}
            className="px-3 py-1 text-xs rounded bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            下一步
          </button>
        </div>
      </div>
    </div>
  );
}
