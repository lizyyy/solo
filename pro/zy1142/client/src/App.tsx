import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  FileText, 
  Download, 
  Save, 
  History,
  Atom,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle
} from 'lucide-react';
import {
  PhysicsParameter,
  PhysicsProblemType,
  PhysicsSolution,
  ValidationError,
} from '../../shared/types';
import { 
  fetchProblemTypes, 
  solveQuick,
  exportProblem,
} from './api';
import ParameterPanel from './components/ParameterPanel';
import SolutionPanel from './components/SolutionPanel';
import AnimationPanel from './components/AnimationPanel';

interface ProblemTypeInfo {
  type: PhysicsProblemType;
  label: string;
  description: string;
  defaultParams: PhysicsParameter[];
}

type ActiveTab = 'solution' | 'animation' | 'export';

const App: React.FC = () => {
  const [problemTypes, setProblemTypes] = useState<ProblemTypeInfo[]>([]);
  const [selectedType, setSelectedType] = useState<PhysicsProblemType>('incline');
  const [parameters, setParameters] = useState<PhysicsParameter[]>([]);
  const [solution, setSolution] = useState<PhysicsSolution | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSolving, setIsSolving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('solution');
  const [isLoading, setIsLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'markdown' | 'html' | 'json'>('markdown');
  const [exportOptions, setExportOptions] = useState({
    includeDerivations: true,
    includeTrajectory: false,
    includeDiagrams: false,
  });

  useEffect(() => {
    const loadProblemTypes = async () => {
      try {
        setIsLoading(true);
        const types = await fetchProblemTypes();
        setProblemTypes(types);
        
        const initialType = types.find(t => t.type === 'incline');
        if (initialType) {
          setSelectedType(initialType.type);
          setParameters([...initialType.defaultParams]);
        }
      } catch (error) {
        console.error('Failed to load problem types:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProblemTypes();
  }, []);

  const handleTypeChange = useCallback((type: PhysicsProblemType) => {
    const typeInfo = problemTypes.find(t => t.type === type);
    if (typeInfo) {
      setSelectedType(type);
      setParameters([...typeInfo.defaultParams]);
      setSolution(null);
      setValidationErrors([]);
      setActiveTab('solution');
    }
  }, [problemTypes]);

  const handleParameterChange = useCallback((name: string, value: number, _unit?: string) => {
    setParameters(prev => 
      prev.map(p => p.name === name ? { ...p, value } : p)
    );
    setValidationErrors([]);
  }, []);

  const handleSolve = useCallback(async () => {
    setIsSolving(true);
    setValidationErrors([]);
    
    try {
      const result = await solveQuick(selectedType, parameters);
      
      if (!result.validation.valid) {
        setValidationErrors(result.validation.errors);
        setSolution(null);
      } else if (result.solution) {
        setSolution(result.solution);
        setActiveTab('solution');
      }
    } catch (error) {
      console.error('Solve failed:', error);
      setValidationErrors([{
        field: 'server',
        message: '求解失败，请检查网络连接或重试',
        rule: 'server_error',
      }]);
    } finally {
      setIsSolving(false);
    }
  }, [selectedType, parameters]);

  const handleReset = useCallback(() => {
    const typeInfo = problemTypes.find(t => t.type === selectedType);
    if (typeInfo) {
      setParameters([...typeInfo.defaultParams]);
      setSolution(null);
      setValidationErrors([]);
    }
  }, [selectedType, problemTypes]);

  const handleExport = useCallback(async () => {
    if (!solution) return;
    
    try {
      const blob = await exportProblem(solution.problemId, {
        format: exportFormat,
        ...exportOptions,
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `physics-solution-${Date.now()}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [solution, exportFormat, exportOptions]);

  const selectedTypeInfo = problemTypes.find(t => t.type === selectedType);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800/80 backdrop-blur-lg border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Atom className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">物理题解题工具</h1>
                <p className="text-gray-400 text-sm">Physics Solver & Animation</p>
              </div>
            </div>

            {solution && (
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                导出报告
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-sm mb-3">选择题型</p>
          <div className="flex flex-wrap gap-3">
            {problemTypes.map((type) => (
              <button
                key={type.type}
                onClick={() => handleTypeChange(type.type)}
                className={`px-5 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  selectedType === type.type
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span className="text-lg">
                  {type.type === 'incline' && '📐'}
                  {type.type === 'projectile' && '🎯'}
                  {type.type === 'spring' && '🔩'}
                </span>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <div className="bg-gray-800 rounded-2xl p-6">
              <ParameterPanel
                problemType={selectedType}
                typeLabel={selectedTypeInfo?.label || selectedType}
                parameters={parameters}
                validationErrors={validationErrors}
                onParameterChange={handleParameterChange}
                onSolve={handleSolve}
                onReset={handleReset}
                isSolving={isSolving}
                canSolve={!isSolving}
              />
            </div>
          </div>

          <div className="lg:col-span-8">
            {solution ? (
              <div className="space-y-6">
                <div className="bg-gray-800 rounded-xl p-1 inline-flex gap-1">
                  {[
                    { id: 'solution' as ActiveTab, label: '解题结果', icon: FileText },
                    { id: 'animation' as ActiveTab, label: '动画演示', icon: Play },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        activeTab === tab.id
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'solution' && (
                  <div className="fade-in">
                    <SolutionPanel
                      solution={solution}
                      problemType={selectedType}
                    />
                  </div>
                )}

                {activeTab === 'animation' && (
                  <div className="fade-in">
                    <AnimationPanel
                      trajectory={solution.trajectory}
                      problemType={selectedType}
                      title="运动动画演示"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-2xl p-12 text-center">
                <div className="w-20 h-20 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-10 h-10 text-gray-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  暂无解题结果
                </h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  请在左侧面板填写参数，然后点击「开始求解」按钮来计算结果并查看动画演示。
                </p>
                
                <div className="mt-8 grid grid-cols-3 gap-4 max-w-xl mx-auto">
                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <div className="text-2xl mb-2">📐</div>
                    <p className="text-gray-300 text-sm font-medium">斜面滑块</p>
                    <p className="text-gray-500 text-xs mt-1">受力分析、摩擦力、匀加速运动</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <div className="text-2xl mb-2">🎯</div>
                    <p className="text-gray-300 text-sm font-medium">抛体运动</p>
                    <p className="text-gray-500 text-xs mt-1">速度分解、平抛、斜抛、射程计算</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <div className="text-2xl mb-2">🔩</div>
                    <p className="text-gray-300 text-sm font-medium">弹簧振子</p>
                    <p className="text-gray-500 text-xs mt-1">简谐运动、周期、振幅、能量守恒</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">导出报告</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  导出格式
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'markdown' as const, label: 'Markdown', icon: '📄' },
                    { id: 'html' as const, label: 'HTML', icon: '🌐' },
                    { id: 'json' as const, label: 'JSON', icon: '📊' },
                  ].map((format) => (
                    <button
                      key={format.id}
                      onClick={() => setExportFormat(format.id)}
                      className={`px-4 py-3 rounded-xl font-medium transition-all ${
                        exportFormat === format.id
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <span className="text-lg block">{format.icon}</span>
                      <span className="text-sm">{format.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  包含内容
                </label>
                <div className="space-y-3">
                  {[
                    { id: 'includeDerivations' as const, label: '推导步骤', description: '包含公式推导和数值代入过程' },
                    { id: 'includeTrajectory' as const, label: '轨迹数据', description: '包含运动轨迹采样数据' },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={exportOptions[option.id]}
                        onChange={(e) =>
                          setExportOptions((prev) => ({
                            ...prev,
                            [option.id]: e.target.checked,
                          }))
                        }
                        className="mt-1 w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                      />
                      <div>
                        <span className="text-white font-medium block">{option.label}</span>
                        <span className="text-gray-400 text-sm">{option.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-700">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-center text-gray-500 text-sm">
            物理题解题工具 · 支持斜面滑块、抛体运动、弹簧振子三类问题
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
