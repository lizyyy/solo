import React, { useState, useEffect } from 'react';
import { PlayCircle, CheckCircle, Clock, AlertTriangle, FileText, Table2, RefreshCw, StepForward, User } from 'lucide-react';
import { useWindStore } from '../store/useWindStore';
import { StatusBadge } from '../components/StatusBadge';
import { formatDateTime } from '../utils/windUtils';
import type { ProcessStep } from '../../shared/types';

const initialSteps: ProcessStep[] = [
  {
    id: 1,
    title: '点云抽稀日志导入',
    description: '许工导入三份点云抽稀日志，系统自动检测告警',
    status: 'pending'
  },
  {
    id: 2,
    title: '检测截图遮挡并标记',
    description: '发现LOG-002告警标签被移动端截图遮挡，标记为待施工经理复核，不归为正常',
    status: 'pending'
  },
  {
    id: 3,
    title: '许工补看安全半径表',
    description: '从2023版旧口径补录LOG-003缺失的历史数据',
    status: 'pending'
  },
  {
    id: 4,
    title: '人工修正 + 重跑分析',
    description: '对LOG-003进行人工修正后重跑，更新安全距离报告',
    status: 'pending'
  },
  {
    id: 5,
    title: '安全距离报告更新',
    description: '报告自动刷新，显示三种处理结果的不同结论',
    status: 'pending'
  }
];

export const DemoPage: React.FC = () => {
  const { logs, operations, resetToDemo, generateReport, currentRole } = useWindStore();
  const [steps, setSteps] = useState<ProcessStep[]>(initialSteps);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoPlaying && currentStep < steps.length) {
      timer = setTimeout(() => {
        setSteps(prev => prev.map((s, i) => 
          i === currentStep ? { ...s, status: 'active', timestamp: new Date().toISOString() } : s
        ));
        
        setTimeout(() => {
          setSteps(prev => prev.map((s, i) => 
            i === currentStep ? { ...s, status: 'completed' } : s
          ));
          setCurrentStep(prev => prev + 1);
        }, 1500);
      }, 800);
    } else if (currentStep >= steps.length) {
      setIsAutoPlaying(false);
      generateReport();
    }
    return () => clearTimeout(timer);
  }, [isAutoPlaying, currentStep, steps.length, generateReport]);

  const startDemo = () => {
    resetToDemo();
    setSteps(initialSteps);
    setCurrentStep(0);
    setIsAutoPlaying(true);
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setSteps(prev => prev.map((s, i) => 
        i === currentStep 
          ? { ...s, status: 'active', timestamp: new Date().toISOString() }
          : i < currentStep ? { ...s, status: 'completed' } : s
      ));
      
      setTimeout(() => {
        setSteps(prev => prev.map((s, i) => 
          i === currentStep ? { ...s, status: 'completed' } : s
        ));
        setCurrentStep(prev => prev + 1);
        if (currentStep === steps.length - 1) {
          generateReport();
        }
      }, 1000);
    }
  };

  const getStepIcon = (step: ProcessStep) => {
    if (step.status === 'completed') return <CheckCircle size={20} className="text-emerald-500" />;
    if (step.status === 'active') return <PlayCircle size={20} className="text-amber-500 animate-pulse" />;
    return <Clock size={20} className="text-industrial-300" />;
  };

  const getStepBg = (step: ProcessStep) => {
    if (step.status === 'completed') return 'bg-emerald-50 border-emerald-200';
    if (step.status === 'active') return 'bg-amber-50 border-amber-300';
    return 'bg-industrial-50 border-industrial-200';
  };

  const latestOps = operations.slice(-4).reverse();

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-industrial-800 font-mono">流程演示</h2>
          <p className="text-sm text-industrial-500 mt-1">
            许工给新人讲解：点云抽稀日志导入 → 安全半径表补录 → 安全距离报告更新的完整流程
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={startDemo}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <PlayCircle size={16} />
            {currentStep > 0 ? '重新演示' : '开始演示'}
          </button>
          {!isAutoPlaying && currentStep < steps.length && currentStep > 0 && (
            <button
              onClick={nextStep}
              className="btn-industrial text-sm flex items-center gap-2"
            >
              <StepForward size={16} />
              下一步
            </button>
          )}
          <button
            onClick={resetToDemo}
            className="btn-industrial text-sm flex items-center gap-2"
          >
            <RefreshCw size={16} />
            重置数据
          </button>
        </div>
      </div>

      {/* 说明卡片 */}
      <div className="bg-gradient-to-r from-industrial-800 to-industrial-700 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <User size={20} />
              许工说：
            </h3>
            <p className="text-industrial-200 leading-relaxed">
              新人你看，这系统就是处理滑翔伞起降区安全距离评估的。
              核心流程是三步：<span className="text-emerald-400 font-medium">导入点云抽稀日志</span>、
              <span className="text-amber-400 font-medium">碰到截图遮挡别急着归正常</span>、
              <span className="text-blue-400 font-medium">补看安全半径表后报告自动更新</span>。
              今天演示数据里有三种情况：顺利的、截图挡住的、旧口径补的，跑完能看出处理结果不一样。
            </p>
          </div>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="ml-4 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
          >
            {showExplanation ? '收起详情' : '展开专业术语'}
          </button>
        </div>
        {showExplanation && (
          <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-emerald-400 font-medium mb-1">点云抽稀</p>
              <p className="text-industrial-300">机载LiDAR扫描的原始点云数据量太大，按比例减少点数同时保留关键特征，抽稀率80%以上算合格</p>
            </div>
            <div>
              <p className="text-amber-400 font-medium mb-1">告警标签遮挡</p>
              <p className="text-industrial-300">移动端现场拍摄的截图水印正好挡在告警数值区域，OCR识别不准，必须人工复核原始数据</p>
            </div>
            <div>
              <p className="text-blue-400 font-medium mb-1">安全半径新旧口径</p>
              <p className="text-industrial-300">2024版GB规范比2023版增加了20%安全裕度，历史数据要标注用的哪个口径，差20米可不是小事</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧 - 流程步骤 */}
        <div className="lg:col-span-2">
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <PlayCircle size={18} />
                五步处理流程
              </h3>
              <p className="text-xs text-industrial-500 mt-1">
                演示进度：{Math.min(currentStep, steps.length)} / {steps.length} 步
              </p>
            </div>
            <div className="p-6">
              <div className="relative">
                {/* 连接线 */}
                <div className="absolute left-5 top-10 bottom-10 w-0.5 bg-industrial-200"></div>
                <div 
                  className="absolute left-5 top-10 w-0.5 bg-emerald-500 transition-all duration-500"
                  style={{ height: `${(currentStep / steps.length) * 100}%` }}
                ></div>
                
                {/* 步骤列表 */}
                <div className="space-y-4">
                  {steps.map((step, _) => (
                    <div 
                      key={step.id}
                      className={`relative flex gap-4 p-4 rounded-lg border-2 transition-all duration-300 ${getStepBg(step)}`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        step.status === 'completed' ? 'bg-emerald-100' :
                        step.status === 'active' ? 'bg-amber-100' : 'bg-industrial-100'
                      }`}>
                        {getStepIcon(step)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-industrial-400">步骤 {step.id}</span>
                          <h4 className={`font-semibold ${
                            step.status === 'active' ? 'text-amber-800' :
                            step.status === 'completed' ? 'text-emerald-800' : 'text-industrial-600'
                          }`}>
                            {step.title}
                          </h4>
                          {step.status === 'active' && (
                            <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-medium animate-pulse">
                              进行中
                            </span>
                          )}
                          {step.timestamp && (
                            <span className="text-xs text-industrial-400 font-mono ml-auto">
                              {formatDateTime(step.timestamp).split(' ')[1]}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm mt-1 ${
                          step.status === 'pending' ? 'text-industrial-400' : 'text-industrial-600'
                        }`}>
                          {step.description}
                        </p>
                        
                        {/* 步骤2和3的特殊说明 */}
                        {step.id === 2 && step.status !== 'pending' && (
                          <div className="mt-3 p-3 bg-amber-100/50 rounded border border-amber-200">
                            <div className="flex items-start gap-2 text-amber-800 text-sm">
                              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium">关键细节：截图遮挡不急着归正常</p>
                                <p className="text-amber-700 text-xs mt-0.5">
                                  施工经理晚上催结果时，许工也不能直接发。先标黄"待复核"，等施工经理看过原始热成像数据再说。
                                  这是移动端巡检的通病，水印经常挡住告警数值区域。
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {step.id === 3 && step.status !== 'pending' && (
                          <div className="mt-3 p-3 bg-blue-100/50 rounded border border-blue-200">
                            <div className="flex items-start gap-2 text-blue-800 text-sm">
                              <Table2 size={16} className="flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium">许工补看安全半径表</p>
                                <p className="text-blue-700 text-xs mt-0.5">
                                  LOG-003是去年的数据，当时用的2023旧口径。新规范2024版要求加20%安全裕度，
                                  所以要从历史表补录旧口径数据，同时标注清楚，避免和新数据混淆。
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 三种记录对比 */}
          {currentStep >= steps.length && (
            <div className="card-industrial rounded-lg overflow-hidden mt-6">
              <div className="p-4 border-b border-industrial-200 bg-gradient-to-r from-emerald-50 via-amber-50 to-blue-50">
                <h3 className="font-semibold text-industrial-800">演示完成！三种记录处理结果对比</h3>
                <p className="text-xs text-industrial-500 mt-1">注意看三种情况的处理结果不一样</p>
              </div>
              <div className="divide-y divide-industrial-100">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 flex items-center justify-between hover:bg-industrial-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={log.status} size="md" />
                      <div>
                        <p className="font-mono text-sm font-medium text-industrial-800">{log.batchNo}</p>
                        <p className="text-xs text-industrial-500">{log.source}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-industrial-700">
                        告警 {log.alerts.length} 条
                        {log.hasScreenshotOcclusion && <span className="text-amber-600 ml-2">含遮挡</span>}
                      </p>
                      {log.rerunCount > 0 && (
                        <p className="text-xs text-blue-600">重跑 {log.rerunCount} 次</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-industrial-50 border-t border-industrial-200">
                <p className="text-sm text-industrial-600">
                  <span className="font-medium">许工总结：</span>
                  三种情况三种结果——
                  <span className="text-emerald-600">LOG-001顺顺利利直接过</span>、
                  <span className="text-amber-600">LOG-002挡住了等经理复核</span>、
                  <span className="text-blue-600">LOG-003补了旧口径数据</span>，
                  报告里都标得清清楚楚，晚上发给施工经理就不会出问题了。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 右侧 - 操作记录和数据预览 */}
        <div className="space-y-6">
          {/* 当前角色 */}
          <div className="card-industrial rounded-lg p-4">
            <h4 className="text-sm font-semibold text-industrial-800 mb-2">当前角色</h4>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                currentRole === 'engineer' ? 'bg-emerald-100' : 'bg-amber-100'
              }`}>
                <User size={20} className={currentRole === 'engineer' ? 'text-emerald-600' : 'text-amber-600'} />
              </div>
              <div>
                <p className="font-medium text-industrial-800">
                  {currentRole === 'engineer' ? '许工' : '施工经理'}
                </p>
                <p className="text-xs text-industrial-500">
                  {currentRole === 'engineer' ? '设备工程师' : '施工管理'}
                </p>
              </div>
            </div>
          </div>

          {/* 操作记录 */}
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200">
              <h4 className="text-sm font-semibold text-industrial-800 flex items-center gap-2">
                <Clock size={16} />
                操作记录
              </h4>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {latestOps.length > 0 ? latestOps.map((op) => (
                <div key={op.id} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-industrial-400"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-industrial-700">{op.action}</span>
                      <span className="text-xs text-industrial-400 font-mono flex-shrink-0">
                        {formatDateTime(op.timestamp).split(' ')[1]}
                      </span>
                    </div>
                    <p className="text-xs text-industrial-500 mt-0.5 truncate">{op.detail}</p>
                    <p className="text-xs text-industrial-400 mt-0.5">— {op.operatorName}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-industrial-400 text-center py-4">点击"开始演示"查看操作记录</p>
              )}
            </div>
          </div>

          {/* 演示数据说明 */}
          <div className="bg-industrial-800 rounded-lg p-5 text-white">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <FileText size={16} />
              演示数据构成
            </h4>
            <div className="text-sm space-y-3 text-industrial-200">
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-emerald-400 font-medium">1份顺利记录</p>
                  <p className="text-xs">LOG-001 机载LiDAR数据完整，无遮挡</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-amber-400 font-medium">1份截图遮挡</p>
                  <p className="text-xs">LOG-002 移动端巡检，告警标签被水印挡40%</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Table2 size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-blue-400 font-medium">1份旧口径补录</p>
                  <p className="text-xs">LOG-003 从2023版安全半径表补录</p>
                </div>
              </div>
              <div className="pt-3 border-t border-industrial-700">
                <p className="text-emerald-400 font-medium">1次人工修正 + 1次重跑</p>
                <p className="text-xs mt-1">许工修正口径后重跑分析，报告自动更新</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
