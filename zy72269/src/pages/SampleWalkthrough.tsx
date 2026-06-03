import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Play,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Database,
  FileText,
  Map,
  AlertTriangle,
  Compass,
  ClipboardCheck,
  Download
} from 'lucide-react';
import { useAppStore } from '@/store';
import { generateSampleWalkthrough, getSampleDataInstructions } from '@/services/reportService';
import { loadSampleData } from '@/sample/data';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

export default function SampleWalkthrough() {
  const tasks = useAppStore((state) => state.tasks);
  const setIsLoading = useAppStore((state) => state.setIsLoading);
  const resetAll = useAppStore((state) => state.resetAll);

  const [currentStep, setCurrentStep] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);

  const steps = generateSampleWalkthrough();
  const instructions = getSampleDataInstructions();

  const hasSampleData = tasks.some(t => t.marks.length > 0);

  const stepIcons: Record<string, typeof FileText> = {
    '/': Database,
    '/import': FileText,
    '/replay': Map,
    '/conflicts': AlertTriangle,
    '/abnormal': Compass,
    '/self-check': ClipboardCheck,
    '/report': Download
  };

  const handleLoadSample = () => {
    setIsLoading(true);
    setTimeout(() => {
      loadSampleData();
      setIsLoading(false);
    }, 500);
  };

  const handleReset = () => {
    if (confirm('确定要重置所有样例数据吗？此操作不可恢复。')) {
      resetAll();
    }
  };

  const currentStepData = steps[currentStep];
  const StepIcon = stepIcons[currentStepData?.route] || BookOpen;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">样例演示</h1>
          <p className="font-mono text-sm text-primary-400 mt-1">
            新人学习指南 - 从样例跑到报告
          </p>
        </div>
        <div className="flex gap-3">
          {hasSampleData ? (
            <Button variant="secondary" onClick={handleReset}>
              重置样例
            </Button>
          ) : (
            <Button variant="primary" onClick={handleLoadSample}>
              <Database size={16} className="mr-2" />
              加载样例数据
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowInstructions(!showInstructions)}>
            <BookOpen size={16} className="mr-2" />
            使用说明
          </Button>
        </div>
      </div>

      {showInstructions && (
        <Card className="mb-6">
          <pre className="font-mono text-sm text-primary-300 whitespace-pre-wrap">
            {instructions}
          </pre>
        </Card>
      )}

      <div className="bg-primary-800/30 border-2 border-primary-600 p-4 mb-6">
        <h4 className="font-mono text-sm font-semibold text-primary-300 mb-3 flex items-center gap-2">
          <BookOpen size={16} /> 学习路径说明
        </h4>
        <p className="text-sm text-primary-300 mb-3">
          本演示将引导您完成水下管线巡检标记系统的完整工作流程。
          建议按顺序完成以下三步，重点关注：
        </p>
        <ul className="text-sm text-primary-300 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-accent-warning">1.</span>
            <span><strong>第一次导入</strong>：导入水下管线巡检标记原始材料，系统执行导入前自检</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-warning">2.</span>
            <span><strong>补看楼层剖面草图</strong>：设备工程师许工查看草图，系统自动检测冲突并列示证据</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-warning">3.</span>
            <span><strong>路径回放更新</strong>：根据复核结果更新路径，Z轴异常留给现场班组复核</span>
          </li>
        </ul>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {steps.map((step, idx) => {
          const Icon = stepIcons[step.route] || BookOpen;
          const isActive = idx === currentStep;
          const isPast = idx < currentStep;
          return (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <button
                onClick={() => setCurrentStep(idx)}
                className={`flex items-center gap-2 px-4 py-2 border-2 transition-all ${
                  isActive
                    ? 'bg-primary-600 border-primary-400 text-white shadow-glow'
                    : isPast
                      ? 'bg-accent-success/20 border-accent-success/50 text-accent-success'
                      : 'border-primary-700 text-primary-400 hover:border-primary-500'
                }`}
              >
                {isPast ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                <span className="font-mono text-sm whitespace-nowrap">
                  第{step.id}步
                </span>
              </button>
              {idx < steps.length - 1 && (
                <ChevronRight size={20} className="text-primary-600 mx-1 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-primary-700/50 border-2 border-primary-500 flex items-center justify-center flex-shrink-0">
                <StepIcon size={32} className="text-primary-300" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="default">第 {currentStepData.id} 步 / 共 {steps.length} 步</Badge>
                  <h3 className="font-mono text-lg font-semibold text-primary-100">
                    {currentStepData.title}
                  </h3>
                </div>
                <p className="text-primary-300 mb-4">
                  {currentStepData.description}
                </p>
                {currentStepData.action && (
                  <div className="bg-primary-800/50 border border-primary-600 p-4 mb-4">
                    <p className="font-mono text-xs text-primary-400 mb-1">操作指引</p>
                    <p className="text-sm text-primary-200">{currentStepData.action}</p>
                  </div>
                )}
                <div className="bg-accent-success/10 border border-accent-success/30 p-4">
                  <p className="font-mono text-xs text-accent-success mb-1">预期结果</p>
                  <p className="text-sm text-primary-200">{currentStepData.expectedResult}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="学习进度">
            <div className="space-y-3">
              {steps.slice(0, currentStep + 1).map((step, idx) => {
                const Icon = stepIcons[step.route] || BookOpen;
                return (
                  <div key={step.id} className="flex items-center gap-3">
                    {idx < currentStep ? (
                      <CheckCircle2 size={18} className="text-accent-success flex-shrink-0" />
                    ) : (
                      <Play size={18} className="text-accent-warning animate-pulse flex-shrink-0" />
                    )}
                    <span className={`text-sm ${idx === currentStep ? 'text-primary-200 font-medium' : 'text-primary-400'}`}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
              {steps.slice(currentStep + 1).map((step) => {
                const Icon = stepIcons[step.route] || BookOpen;
                return (
                  <div key={step.id} className="flex items-center gap-3 opacity-50">
                    <Icon size={18} className="text-primary-600 flex-shrink-0" />
                    <span className="text-sm text-primary-500">{step.title}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-primary-700">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-primary-400">完成进度</span>
                <span className="font-mono text-primary-200">{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
              </div>
              <div className="h-2 bg-primary-800">
                <div
                  className="h-full bg-accent-success transition-all duration-500"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          </Card>

          <Card title="关键要点">
            <div className="space-y-3">
              {currentStep === 0 && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-warning">●</span>
                    <p className="text-sm text-primary-300">水下管线巡检标记的备注经常比正式表还重要，别把这些材料洗成一行干净数据</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-warning">●</span>
                    <p className="text-sm text-primary-300">拿正常材料、错口径材料、补录材料各跑一遍</p>
                  </div>
                </>
              )}
              {currentStep === 1 && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-warning">●</span>
                    <p className="text-sm text-primary-300">导入前必须执行自检：重复导入、Z轴方向、补录重算、导出一致</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-warning">●</span>
                    <p className="text-sm text-primary-300">原始备注必须完整保留，不得清洗格式化</p>
                  </div>
                </>
              )}
              {currentStep === 4 && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-warning">●</span>
                    <p className="text-sm text-primary-300">障碍物备注和楼层剖面草图矛盾时，先列出冲突证据</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-warning">●</span>
                    <p className="text-sm text-primary-300">让设备工程师许工选确认或驳回，不要替业务同事自动拍板</p>
                  </div>
                </>
              )}
              {currentStep === 5 && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-warning">●</span>
                    <p className="text-sm text-primary-300">Z轴方向按旧习惯写反时，别急着归正常</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-warning">●</span>
                    <p className="text-sm text-primary-300">留给现场班组复核，系统不自动修正</p>
                  </div>
                </>
              )}
              {currentStep >= 6 && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-success">●</span>
                    <p className="text-sm text-primary-300">导出前执行一致性校验</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-accent-success">●</span>
                    <p className="text-sm text-primary-300">报告必须包含所有原始备注</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft size={16} className="mr-1" />
              上一步
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button
                variant="primary"
                className="flex-1 justify-center"
                onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
              >
                下一步
                <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Link to={currentStepData.route} className="flex-1">
                <Button variant="success" className="w-full justify-center">
                  开始操作 <ArrowRight size={16} className="ml-1" />
                </Button>
              </Link>
            )}
          </div>

          <Link to={currentStepData.route}>
            <Button variant="secondary" className="w-full justify-center">
              <Play size={16} className="mr-2" />
              跳转到「{currentStepData.title}」页面
            </Button>
          </Link>
        </div>
      </div>

      <Card title="测试验证清单" className="mt-8">
        <p className="text-sm text-primary-300 mb-4">
          完成学习后，请确认以下测试场景均已验证通过：
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            '正常材料导入完整，原始备注保留',
            '错口径材料标记正确，警告显示',
            '补录材料导入后自动重算路径',
            '路径回放与历史记录一致',
            '障碍物备注与草图冲突正确检测',
            '冲突证据列示完整，可手动裁决',
            'Z轴写反检测正确，标记待复核',
            '四大自检项全部通过',
            '导出报告包含所有原始数据'
          ].map((item, idx) => (
            <label key={idx} className="flex items-center gap-2 p-2 hover:bg-primary-800/30 cursor-pointer transition-colors">
              <input type="checkbox" className="w-4 h-4 accent-primary-500" />
              <span className="text-sm text-primary-300">{item}</span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
