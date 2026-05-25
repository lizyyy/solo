import React, { useState, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Grid3X3, Layers, MapPin, FileText, 
  GitCompare, Upload, Download, Settings, Filter, Eye, EyeOff,
  X
} from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';

const TopBar: React.FC = () => {
  const plans = useSimulationStore(state => state.plans);
  const selectedPlan = useSimulationStore(state => state.selectedPlan);
  const setSelectedPlan = useSimulationStore(state => state.setSelectedPlan);
  const isPlaying = useSimulationStore(state => state.isPlaying);
  const setPlaying = useSimulationStore(state => state.setPlaying);
  const resetSimulation = useSimulationStore(state => state.resetSimulation);
  const setCameraView = useSimulationStore(state => state.setCameraView);
  const showPaths = useSimulationStore(state => state.showPaths);
  const setShowPaths = useSimulationStore(state => state.setShowPaths);
  const showLabels = useSimulationStore(state => state.showLabels);
  const setShowLabels = useSimulationStore(state => state.setShowLabels);
  const setShowReport = useSimulationStore(state => state.setShowReport);
  const runComparison = useSimulationStore(state => state.runComparison);
  const setShowCompare = useSimulationStore(state => state.setShowCompare);
  const importPlan = useSimulationStore(state => state.importPlan);
  const exportPlan = useSimulationStore(state => state.exportPlan);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const success = importPlan(content);
        if (success) {
          alert('方案导入成功！');
        } else {
          alert('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    }
    setShowImport(false);
  };
  
  const handleExport = () => {
    if (selectedPlan) {
      const json = exportPlan(selectedPlan.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedPlan.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  
  return (
    <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 flex items-center justify-between px-4 z-20">
      <div className="flex items-center gap-4">
        <h1 className="text-white font-bold text-lg flex items-center gap-2">
          <Grid3X3 className="w-6 h-6 text-blue-400" />
          校园消防疏散模拟系统
        </h1>
        
        <div className="h-8 w-px bg-slate-700" />
        
        <select
          value={selectedPlan?.id || ''}
          onChange={(e) => setSelectedPlan(e.target.value)}
          className="bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-600 text-sm focus:outline-none focus:border-blue-500 min-w-[180px]"
        >
          {plans.map(plan => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
              {plan.type === 'normal' && ' ✅'}
              {plan.type === 'conflict' && ' ⚠️'}
              {plan.type === 'empty' && ' 📋'}
            </option>
          ))}
        </select>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowImport(true)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
            title="导入方案"
          >
            <Upload className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleExport}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
            title="导出方案"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={runComparison}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm transition-colors"
            title="方案对比"
          >
            <GitCompare className="w-4 h-4" />
            方案对比
          </button>
        </div>
        
        <div className="h-8 w-px bg-slate-700" />
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPlaying(!isPlaying)}
            className={`p-2 rounded-lg transition-colors ${
              isPlaying 
                ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            title={isPlaying ? '暂停' : '开始'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <button
            onClick={resetSimulation}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            title="重置"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setCameraView('overview')}
            className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            总览
          </button>
          <button
            onClick={() => setCameraView('top')}
            className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            俯视
          </button>
          <button
            onClick={() => setCameraView('front')}
            className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            正视
          </button>
          <button
            onClick={() => setCameraView('side')}
            className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            侧视
          </button>
          <button
            onClick={() => setCameraView('free')}
            className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            自由
          </button>
        </div>
        
        <div className="h-8 w-px bg-slate-700" />
        
        <button
          onClick={() => setShowPaths(!showPaths)}
          className={`p-2 rounded-lg transition-colors ${
            showPaths ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          title="显示路径"
        >
          <Layers className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`p-2 rounded-lg transition-colors ${
            showLabels ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          title="显示标签"
        >
          <MapPin className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
          title="筛选设置"
        >
          <Filter className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => setShowReport(true)}
          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
          title="导出报告"
        >
          <FileText className="w-5 h-5" />
        </button>
      </div>
      
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-96 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">导入方案</h3>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-4">选择JSON格式的方案文件进行导入</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="w-full text-slate-300 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TopBar;
