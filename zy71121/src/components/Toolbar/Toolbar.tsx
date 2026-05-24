import { useState } from 'react';
import { 
  RotateCcw, 
  Eye, 
  FileJson, 
  ChevronDown,
  Maximize2,
  LayoutGrid,
  ArrowUp,
  Move3d
} from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { samplePresets } from '../../data/samples';
import { ViewPreset } from '../../types';
import { ExportButton } from '../Export/ExportButton';

const viewOptions: { id: ViewPreset; label: string; icon: any }[] = [
  { id: 'overview', label: '总览', icon: Maximize2 },
  { id: 'side', label: '侧视', icon: ArrowUp },
  { id: 'top', label: '俯视', icon: LayoutGrid },
  { id: 'front', label: '正视', icon: Move3d },
];

export function Toolbar() {
  const { reset, loadSample, currentView, setCurrentView } = useSimulationStore();
  const [showSamples, setShowSamples] = useState(false);
  const [showViews, setShowViews] = useState(false);
  
  const currentViewOption = viewOptions.find(v => v.id === currentView);
  const CurrentViewIcon = currentViewOption?.icon || Eye;
  
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
      <div className="bg-white rounded-xl shadow-lg px-4 py-2 flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowSamples(!showSamples)}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all text-sm font-medium shadow-md"
          >
            <FileJson className="w-4 h-4" />
            导入样例
            <ChevronDown className={`w-4 h-4 transition-transform ${showSamples ? 'rotate-180' : ''}`} />
          </button>
          
          {showSamples && (
            <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 py-2 w-64 z-50">
              {samplePresets.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    loadSample(sample);
                    setShowSamples(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-green-50 transition-colors"
                >
                  <div className="font-medium text-gray-800">{sample.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{sample.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="w-px h-6 bg-gray-200" />
        
        <div className="relative">
          <button
            onClick={() => setShowViews(!showViews)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm font-medium"
          >
            <CurrentViewIcon className="w-4 h-4" />
            {currentViewOption?.label || '视角'}
            <ChevronDown className={`w-4 h-4 transition-transform ${showViews ? 'rotate-180' : ''}`} />
          </button>
          
          {showViews && (
            <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50">
              {viewOptions.map((view) => {
                const Icon = view.icon;
                return (
                  <button
                    key={view.id}
                    onClick={() => {
                      setCurrentView(view.id);
                      setShowViews(false);
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                      currentView === view.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {view.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="w-px h-6 bg-gray-200" />
        
        <button
          onClick={reset}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
        
        <div className="w-px h-6 bg-gray-200" />
        
        <ExportButton />
      </div>
      
      {showSamples && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowSamples(false)}
        />
      )}
      {showViews && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowViews(false)}
        />
      )}
    </div>
  );
}
