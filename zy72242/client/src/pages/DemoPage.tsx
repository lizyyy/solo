import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { demoApi } from '../services/api';
import {
  PlayCircleIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
  BanknotesIcon,
  AcademicCapIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

export default function DemoPage() {
  const { state, initDemo, loadRecords } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepResults, setStepResults] = useState<any[]>([]);
  const [initializing, setInitializing] = useState(false);

  const steps = [
    {
      step: 1,
      title: '节假日顺延导入',
      icon: DocumentTextIcon,
      description: '导入包含节假日顺延的演示数据',
      detail: '系统自动标记T+1→T+2等人工修改记录，生成对账说明。T+1→T+2修改会被高亮标记，状态设为reviewing，留待基金经理复核。',
      keyPoint: 'T+1→T+2修改记录不急着归正常，留给基金经理复核'
    },
    {
      step: 2,
      title: '尾差调整补录',
      icon: AdjustmentsHorizontalIcon,
      description: '支付平台产品阿南补看尾差调整条',
      detail: '补录尾差调整条后，系统自动更新所有关联记录的对账说明。对账说明会增加"已补录尾差调整条"说明。',
      keyPoint: '尾差调整后，对账说明自动更新'
    },
    {
      step: 3,
      title: '对账说明更新',
      icon: BanknotesIcon,
      description: '查看更新后的对账说明，确认信息完整',
      detail: '对账说明包含三段：为什么被留下、缺什么材料、下一步找谁。T+1→T+2修改记录保持reviewing状态，不自动归正常。',
      keyPoint: '对账说明自动包含：为什么被留下、缺什么材料、下一步找谁'
    }
  ];

  const handleInitStep = async (step: number) => {
    setInitializing(true);
    try {
      await initDemo(step);
      setCurrentStep(step);
    } catch (error) {
      console.error('初始化失败:', error);
    } finally {
      setInitializing(false);
    }
  };

  const handleFullDemo = async () => {
    setInitializing(true);
    try {
      await initDemo();
      setCurrentStep(3);
    } catch (error) {
      console.error('初始化失败:', error);
    } finally {
      setInitializing(false);
    }
  };

  const handleReset = async () => {
    try {
      await demoApi.resetDemo();
      setCurrentStep(0);
      await loadRecords();
    } catch (error) {
      console.error('重置失败:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif-sc text-gray-900">演示模式</h2>
          <p className="text-sm text-gray-500 mt-1">支付平台产品阿南给新人讲流程的演示环境</p>
        </div>
        <div className="flex space-x-2">
          <button onClick={handleFullDemo} disabled={initializing} className="btn-primary flex items-center space-x-1">
            <PlayCircleIcon className="w-4 h-4" />
            <span>{initializing ? '初始化中...' : '一键初始化完整演示'}</span>
          </button>
          <button onClick={handleReset} className="btn-secondary flex items-center space-x-1">
            <ArrowPathIcon className="w-4 h-4" />
            <span>重置</span>
          </button>
        </div>
      </div>

      <div className="card bg-gradient-to-br from-finance-50 to-blue-50 border-finance-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-finance-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <AcademicCapIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-serif-sc text-lg font-semibold text-finance-800">演示场景说明</h3>
            <p className="text-sm text-finance-700 mt-1">
              本演示包含四个关键场景：节假日顺延说明、尾差调整条、一次人工修正（T+1→T+2）、一次重跑。
              可分步演示，也可一键完成。演示数据走完三步流程：
              节假日顺延导入 → 补看尾差调整 → 对账说明更新。
            </p>
            <div className="mt-3 flex items-center space-x-2 text-sm">
              <span className="badge bg-amber-100 text-amber-800">节假日顺延</span>
              <span className="badge bg-indigo-100 text-indigo-800">尾差调整</span>
              <span className="badge bg-red-100 text-red-800">T+1→T+2人工修正</span>
              <span className="badge bg-purple-100 text-purple-800">重跑</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200" />
        <div
          className="absolute top-6 left-0 h-0.5 bg-finance-600 transition-all duration-500"
          style={{ width: `${(currentStep / 3) * 100}%` }}
        />

        <div className="relative grid grid-cols-3 gap-8">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep >= step.step;
            const isCurrent = currentStep === step.step;

            return (
              <div key={step.step} className="text-center">
                <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center border-2 transition-all duration-300 ${
                  isActive ? 'bg-finance-600 border-finance-600 text-white' :
                  isCurrent ? 'bg-white border-finance-600 text-finance-600 animate-pulse-slow' :
                  'bg-white border-gray-300 text-gray-400'
                }`}>
                  {isActive ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </div>

                <div className="mt-4">
                  <h4 className="font-serif-sc text-sm font-semibold text-gray-900">Step {step.step}: {step.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                </div>

                <div className={`mt-3 card text-left text-sm ${isCurrent ? 'border-finance-300 bg-finance-50' : ''}`}>
                  <p className="text-gray-700">{step.detail}</p>
                  <div className="mt-2 p-2 bg-amber-50 rounded text-amber-800 text-xs font-medium">
                    重点: {step.keyPoint}
                  </div>
                  {!isActive && (
                    <button
                      onClick={() => handleInitStep(step.step)}
                      disabled={initializing}
                      className="mt-3 btn-primary w-full text-sm flex items-center justify-center space-x-1"
                    >
                      <PlayCircleIcon className="w-4 h-4" />
                      <span>{initializing ? '执行中...' : `执行Step ${step.step}`}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-4">复核追踪要点</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <div className="text-sm font-semibold text-red-800 mb-2">谁改了什么</div>
            <div className="text-xs text-red-700">
              每条修改记录都追踪操作人、操作时间、修改前后的值。<br/>
              如：张三将到账日从2024-05-05修改为2024-05-06。
            </div>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
            <div className="text-sm font-semibold text-amber-800 mb-2">为什么改</div>
            <div className="text-xs text-amber-700">
              修改原因必须记录。系统会自动推断节假日顺延等规则原因。<br/>
              如：节假日顺延+手工调整。
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="text-sm font-semibold text-blue-800 mb-2">改完影响哪些结果</div>
            <div className="text-xs text-blue-700">
              每次操作的影响范围都有记录。<br/>
              如：对账状态变为reviewing，触发基金经理复核。
            </div>
          </div>
        </div>
      </div>

      {currentStep === 3 && (
        <div className="card bg-green-50 border-green-200 animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif-sc text-lg font-semibold text-green-800">演示流程已完成</h3>
              <p className="text-sm text-green-700 mt-1">
                三步流程已走完。请前往对账核查主页查看标记好的记录，或点击记录查看详情和操作时间线。
              </p>
            </div>
            <a href="/" className="btn-success ml-auto">查看对账核查主页</a>
          </div>
        </div>
      )}
    </div>
  );
}
