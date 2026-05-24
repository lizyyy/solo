import React from 'react';
import { Play, Pause, RotateCcw, Eye, Grid3X3, Layers, MapPin, Settings, FileText } from 'lucide-react';
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
  
  return (
    <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-white font-bold text-lg flex items-center gap-2">
          <Grid3X3 className="w-6 h-6 text-blue-400" />
          校园消防疏散模拟系统
        </h1>
        
        <div className="h-8 w-px bg-slate-700" />
        
        <select
          value={selectedPlan?.id || ''}
          onChange={(e) => setSelectedPlan(e.target.value)}
          className="bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-600 text-sm focus:outline-none focus:border-blue-500"
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
            onClick={() => setPlaying(!isPlaying)}
            className={`p-2 rounded-lg transition-colors ${
              isPlaying 
                ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <button
            onClick={resetSimulation}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
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
          onClick={() => setShowReport(true)}
          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          title="导出报告"
        >
          <FileText className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
