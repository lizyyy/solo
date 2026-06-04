import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  SkipForward, 
  RotateCcw,
  GraduationCap,
  FileText,
  Image,
  UserCheck,
  FileCheck,
  ChevronRight
} from 'lucide-react';
import { useDiagnosisStore } from '../store/useDiagnosisStore';
import { demoOperationLogs } from '../data/demoData';

const demoSteps = [
  {
    id: 1,
    title: '第一步：导入传感器数据',
    icon: FileText,
    description: '新人导入传感器数据，系统检测到摄氏度(℃)和开尔文(K)混用，但不自动修正',
    highlight: '关键：检测到单位混用，但留给训练教练老唐复核',
    logRange: [0, 3],
  },
  {
    id: 2,
    title: '第二步：工况照片补录',
    icon: Image,
    description: '工况照片后来才补到群里，训练教练老唐回看时才发现问题',
    highlight: '关键：照片补录后，交接报告自动更新',
    logRange: [3, 4],
  },
  {
    id: 3,
    title: '第三步：人工复核修正',
    icon: UserCheck,
    description: '老唐对照照片和数据进行人工复核，修正温度单位',
    highlight: '关键：传感器编号里的结论不能直接照抄',
    logRange: [4, 7],
  },
  {
    id: 4,
    title: '第四步：重跑诊断生成报告',
    icon: FileCheck,
    description: '修正后重跑诊断，生成最终交接报告',
    highlight: '关键：报告说明问题原因、缺失材料、下一步找谁',
    logRange: [7, 8],
  },
];

export function Demo() {
  const navigate = useNavigate();
  const { getCurrentTask } = useDiagnosisStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState(0);

  const task = getCurrentTask();

  useEffect(() => {
    if (isPlaying && currentStep < demoSteps.length) {
      const timer = setInterval(() => {
        const step = demoSteps[currentStep];
        if (visibleLogs < step.logRange[1]) {
          setVisibleLogs(prev => prev + 1);
        } else if (currentStep < demoSteps.length - 1) {
          setCurrentStep(prev => prev + 1);
        } else {
          setIsPlaying(false);
        }
      }, 1500);
      return () => clearInterval(timer);
    }
  }, [isPlaying, currentStep, visibleLogs]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setVisibleLogs(0);
    setIsPlaying(false);
  };

  const handleNext = () => {
    if (currentStep < demoSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setVisibleLogs(demoSteps[currentStep + 1].logRange[1]);
    }
  };

  const handleStepClick = (index: number) => {
    setCurrentStep(index);
    setVisibleLogs(demoSteps[index].logRange[1]);
    setIsPlaying(false);
  };

  const handleStartWorkflow = () => {
    if (task) {
      navigate(`/diagnosis/${task.id}/import`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-alert-orange p-2 rounded-lg">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-industrial-900">教学演示模式</h1>
            <p className="text-industrial-500 mt-1">训练教练老唐讲解完整诊断流程</p>
          </div>
        </div>
        <button
          onClick={handleStartWorkflow}
          className="btn-primary flex items-center gap-2"
        >
          开始实操
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayPause}
                className="w-10 h-10 rounded-full bg-industrial-800 text-white flex items-center justify-center hover:bg-industrial-700 transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={handleReset}
                className="w-10 h-10 rounded-full border border-industrial-200 flex items-center justify-center hover:bg-industrial-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-industrial-600" />
              </button>
              <button
                onClick={handleNext}
                className="w-10 h-10 rounded-full border border-industrial-200 flex items-center justify-center hover:bg-industrial-50 transition-colors"
                disabled={currentStep >= demoSteps.length - 1}
              >
                <SkipForward className="w-4 h-4 text-industrial-600" />
              </button>
            </div>
            <div className="text-sm text-industrial-500">
              步骤 {currentStep + 1} / {demoSteps.length}
            </div>
          </div>
          <div className="w-48 bg-industrial-100 rounded-full h-2">
            <div
              className="bg-alert-orange h-2 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / demoSteps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {demoSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <button
                key={step.id}
                onClick={() => handleStepClick(index)}
                className={`p-3 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-alert-orange text-white'
                    : isCompleted
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-industrial-50 border border-industrial-100'
                }`}
              >
                <Icon className={`w-5 h-5 mb-2 ${
                  isActive ? 'text-white' : isCompleted ? 'text-emerald-600' : 'text-industrial-400'
                }`} />
                <p className={`text-sm font-medium ${
                  isActive ? 'text-white' : isCompleted ? 'text-emerald-800' : 'text-industrial-600'
                }`}>
                  {step.title}
                </p>
              </button>
            );
          })}
        </div>

        <div className="bg-industrial-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-industrial-900 mb-2">
            {demoSteps[currentStep].title}
          </h3>
          <p className="text-industrial-700 mb-4">
            {demoSteps[currentStep].description}
          </p>
          <div className="bg-warning-50 border-l-4 border-warning-400 p-3 rounded-r">
            <p className="text-warning-800 font-medium">
              💡 {demoSteps[currentStep].highlight}
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-industrial-700 mb-3">操作日志</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {demoOperationLogs.slice(0, visibleLogs).map((log, index) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-white rounded-lg border border-industrial-100 animate-fade-in"
              >
                <div className="w-6 h-6 bg-industrial-200 rounded-full flex items-center justify-center text-xs font-semibold text-industrial-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-industrial-800">{log.action}</span>
                    <span className="text-xs text-industrial-400">{log.timestamp}</span>
                  </div>
                  <p className="text-sm text-industrial-500 mt-1">操作人：{log.operator}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-warning border-2">
        <h3 className="font-semibold text-warning-800 mb-3 flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          老唐教学笔记
        </h3>
        <div className="space-y-3 text-warning-700">
          <p>📝 <strong>重点1：</strong>传感器数据里的结论不能直接照抄，必须人工复核</p>
          <p>📝 <strong>重点2：</strong>碰到摄氏度和开尔文混用，别急着归正常，留给训练教练复核</p>
          <p>📝 <strong>重点3：</strong>交接报告要说明：为什么留下、缺什么材料、下一步找谁</p>
          <p>📝 <strong>重点4：</strong>最后给人的不是功能清单，而是能复盘的记录和可重新跑的命令</p>
        </div>
      </div>
    </div>
  );
}
