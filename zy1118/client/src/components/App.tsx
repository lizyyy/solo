import { useState, useEffect, useCallback } from 'react';
import type { Plan, Booth, ValidationResult, Position, ViewMode, Hall, FlowZone, PowerZone } from '../types';
import { planApi } from '../services/api';
import { ThreeDView } from './ThreeDView';
import { TopDownView } from './TopDownView';
import { ValidationPanel } from './ValidationPanel';
import { ImportModal } from './ImportModal';
import { v4 as uuidv4 } from 'uuid';

const defaultHall: Hall = {
  id: uuidv4(),
  name: '演示展厅',
  dimensions: { width: 40, depth: 30, height: 6 },
  gridSize: 1,
  entrances: [
    { id: 'entrance-1', name: '主入口', position: { x: 15, y: 0 }, size: { width: 10, depth: 1 }, isMain: true }
  ],
  exits: [
    { id: 'exit-1', name: '消防出口1', position: { x: 0, y: 10 }, size: { width: 1, depth: 3 }, isEmergency: true },
    { id: 'exit-2', name: '消防出口2', position: { x: 39, y: 15 }, size: { width: 1, depth: 3 }, isEmergency: true }
  ],
  walls: [],
  pillars: [
    { id: 'pillar-1', position: { x: 10, y: 10 }, size: { width: 1, depth: 1 } },
    { id: 'pillar-2', position: { x: 25, y: 10 }, size: { width: 1, depth: 1 } },
    { id: 'pillar-3', position: { x: 10, y: 20 }, size: { width: 1, depth: 1 } },
    { id: 'pillar-4', position: { x: 25, y: 20 }, size: { width: 1, depth: 1 } }
  ],
  fixedObstacles: []
};

const createDemoBooths = (): Booth[] => {
  return [
    { id: uuidv4(), name: '科技公司A', type: 'standard', position: { x: 2, y: 3 }, size: { width: 3, depth: 3 }, rotation: 0, isPopular: false, powerDemand: 800, props: [] },
    { id: uuidv4(), name: '食品展区', type: 'food', position: { x: 6, y: 3 }, size: { width: 3, depth: 3 }, rotation: 0, isPopular: true, powerDemand: 1500, props: [] },
    { id: uuidv4(), name: '主舞台', type: 'stage', position: { x: 15, y: 5 }, size: { width: 10, depth: 6 }, rotation: 0, isPopular: true, powerDemand: 5000, props: [] },
    { id: uuidv4(), name: '服务台', type: 'info_desk', position: { x: 3, y: 12 }, size: { width: 3, depth: 2 }, rotation: 0, isPopular: false, powerDemand: 300, props: [] },
    { id: uuidv4(), name: '赞助商A', type: 'sponsor', position: { x: 28, y: 3 }, size: { width: 6, depth: 3 }, rotation: 0, isPopular: true, powerDemand: 2000, props: [] },
    { id: uuidv4(), name: '创业团队B', type: 'standard', position: { x: 30, y: 12 }, size: { width: 3, depth: 3 }, rotation: 0, isPopular: false, powerDemand: 600, props: [] },
    { id: uuidv4(), name: '创业团队C', type: 'standard', position: { x: 34, y: 12 }, size: { width: 3, depth: 3 }, rotation: 0, isPopular: false, powerDemand: 600, props: [] },
    { id: uuidv4(), name: '创业团队D', type: 'standard', position: { x: 10, y: 15 }, size: { width: 3, depth: 3 }, rotation: 0, isPopular: false, powerDemand: 500, props: [] },
    { id: uuidv4(), name: '游戏体验区', type: 'premium', position: { x: 25, y: 22 }, size: { width: 6, depth: 4 }, rotation: 0, isPopular: true, powerDemand: 3000, props: [] },
  ];
};

export function App() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('topdown');
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showValidationPanel, setShowValidationPanel] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const data = await planApi.getAll();
      setPlans(data);
      
      if (data.length === 0) {
        const demoPlan = {
          id: uuidv4(),
          name: '演示方案',
          description: '这是一个自动创建的演示方案',
          createdAt: new Date(),
          updatedAt: new Date(),
          hall: defaultHall,
          booths: createDemoBooths(),
          flowZones: [],
          powerZones: []
        };
        setCurrentPlan(demoPlan);
      } else {
        setCurrentPlan(data[0]);
        if (data[0].id) {
          const results = await planApi.validate(data[0].id);
          setValidationResults(results);
        }
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
      
      const demoPlan = {
        id: uuidv4(),
        name: '演示方案',
        description: '这是一个自动创建的演示方案',
        createdAt: new Date(),
        updatedAt: new Date(),
        hall: defaultHall,
        booths: createDemoBooths(),
        flowZones: [],
        powerZones: []
      };
      setCurrentPlan(demoPlan);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const runValidation = useCallback(async () => {
    if (!currentPlan?.id) return;
    
    setIsLoading(true);
    try {
      const results = await planApi.validate(currentPlan.id);
      setValidationResults(results);
      showNotification(`校验完成，发现 ${results.filter(r => !r.passed).length} 个问题`);
    } catch (err) {
      console.error('Validation failed:', err);
      showNotification('校验失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentPlan, showNotification]);

  const savePlan = useCallback(async () => {
    if (!currentPlan) return;
    
    setIsLoading(true);
    try {
      const existingPlan = plans.find(p => p.id === currentPlan.id);
      
      let savedPlan: Plan;
      if (existingPlan) {
        savedPlan = await planApi.update(currentPlan.id, {
          name: currentPlan.name,
          description: currentPlan.description,
          hall: currentPlan.hall,
          booths: currentPlan.booths,
          flowZones: currentPlan.flowZones,
          powerZones: currentPlan.powerZones
        });
      } else {
        savedPlan = await planApi.create({
          name: currentPlan.name,
          description: currentPlan.description,
          hall: currentPlan.hall,
          booths: currentPlan.booths,
          flowZones: currentPlan.flowZones,
          powerZones: currentPlan.powerZones
        });
        setPlans(prev => [...prev, savedPlan]);
      }
      
      setCurrentPlan(savedPlan);
      showNotification('方案已保存');
      
      const results = await planApi.validate(savedPlan.id);
      setValidationResults(results);
    } catch (err) {
      console.error('Save failed:', err);
      showNotification('保存失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentPlan, plans, showNotification]);

  const handleMoveBooth = useCallback((id: string, newPosition: Position) => {
    setCurrentPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        booths: prev.booths.map(b => 
          b.id === id ? { ...b, position: newPosition } : b
        )
      };
    });
  }, []);

  const handleImportComplete = useCallback((data: {
    hall?: Hall;
    booths?: Booth[];
    flowZones?: FlowZone[];
    powerZones?: PowerZone[];
  }) => {
    setCurrentPlan(prev => {
      if (!prev) {
        return {
          id: uuidv4(),
          name: '新方案',
          createdAt: new Date(),
          updatedAt: new Date(),
          hall: data.hall || defaultHall,
          booths: data.booths || [],
          flowZones: data.flowZones || [],
          powerZones: data.powerZones || []
        };
      }
      return {
        ...prev,
        hall: data.hall || prev.hall,
        booths: data.booths || prev.booths,
        flowZones: data.flowZones || prev.flowZones,
        powerZones: data.powerZones || prev.powerZones
      };
    });
    
    showNotification('数据导入成功');
  }, [showNotification]);

  const handleFocusResult = useCallback((result: ValidationResult) => {
    const affectedBooth = result.affectedObjects?.find(o => o.type === 'booth');
    if (affectedBooth) {
      setSelectedBoothId(affectedBooth.id);
    }
  }, []);

  const exportReport = useCallback(async (format: 'json' | 'markdown' | 'html') => {
    if (!currentPlan?.id) return;
    
    try {
      if (format === 'json') {
        const report = await planApi.getReport(currentPlan.id, 'json');
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentPlan.name}-report.json`;
        a.click();
      } else {
        const content = await planApi.getReport(currentPlan.id, format);
        const blob = new Blob([content], { type: format === 'html' ? 'text/html' : 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentPlan.name}-report.${format === 'html' ? 'html' : 'md'}`;
        a.click();
      }
      showNotification(`报告已导出为 ${format.toUpperCase()} 格式`);
    } catch (err) {
      console.error('Export failed:', err);
      showNotification('导出失败', 'error');
    }
  }, [currentPlan, showNotification]);

  const createNewPlan = useCallback(() => {
    const newPlan: Plan = {
      id: uuidv4(),
      name: '新方案',
      createdAt: new Date(),
      updatedAt: new Date(),
      hall: defaultHall,
      booths: [],
      flowZones: [],
      powerZones: []
    };
    setCurrentPlan(newPlan);
    setValidationResults([]);
    showNotification('已创建新方案');
  }, [showNotification]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏛️</span>
          <h1 className="font-semibold text-gray-800">布展预演工具</h1>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('topdown')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'topdown'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            俯视图
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === '3d'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            3D视图
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            导入数据
          </button>
          <button
            onClick={runValidation}
            disabled={isLoading || !currentPlan}
            className="px-3 py-1.5 text-sm bg-warning-50 text-warning-600 hover:bg-warning-100 rounded-lg transition-colors disabled:opacity-50"
          >
            运行校验
          </button>
          <button
            onClick={savePlan}
            disabled={isLoading || !currentPlan}
            className="px-4 py-1.5 text-sm bg-primary-500 text-white hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50"
          >
            保存方案
          </button>
          <button
            onClick={() => setShowValidationPanel(prev => !prev)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {showValidationPanel ? '隐藏面板' : '显示面板'}
          </button>
          <div className="relative group">
            <button className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              导出报告 ▼
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 hidden group-hover:block z-10">
              <button
                onClick={() => exportReport('json')}
                className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
              >
                JSON 格式
              </button>
              <button
                onClick={() => exportReport('markdown')}
                className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
              >
                Markdown 格式
              </button>
              <button
                onClick={() => exportReport('html')}
                className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
              >
                HTML 格式
              </button>
            </div>
          </div>
          <button
            onClick={createNewPlan}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            + 新建
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden">
          {currentPlan ? (
            viewMode === '3d' ? (
              <ThreeDView
                plan={currentPlan}
                validationResults={validationResults}
                selectedBoothId={selectedBoothId}
                onSelectBooth={setSelectedBoothId}
              />
            ) : (
              <TopDownView
                plan={currentPlan}
                validationResults={validationResults}
                selectedBoothId={selectedBoothId}
                onSelectBooth={setSelectedBoothId}
                onMoveBooth={handleMoveBooth}
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-4">🏛️</div>
                <p className="text-lg">欢迎使用布展预演工具</p>
                <p className="text-sm mt-2">创建新方案或导入数据开始使用</p>
              </div>
            </div>
          )}
        </main>

        {showValidationPanel && (
          <aside className="w-80 shrink-0">
            <ValidationPanel
              results={validationResults}
              onFocusResult={handleFocusResult}
            />
          </aside>
        )}
      </div>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />

      {notification && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm ${
          notification.type === 'success' 
            ? 'bg-success-500 text-white' 
            : 'bg-danger-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}
