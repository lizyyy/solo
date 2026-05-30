import { useState, useRef } from 'react';
import { FolderOpen, Upload, BookOpen, ChevronDown } from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';
import { sampleData } from '../data/samples';
import { SimulationConfig } from '../types/simulation';

export const SampleManager = () => {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadSample, importConfig } = useSimulationStore();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as SimulationConfig;
        importConfig(data);
        alert('样例导入成功！');
      } catch {
        alert('文件格式错误，请检查JSON文件');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-purple-700" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">样例管理</h2>
          <p className="text-sm text-gray-500">选择内置样例或导入自定义配置</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-gray-700">选择内置样例</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isOpen && (
            <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 max-h-64 overflow-y-auto">
              {sampleData.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    loadSample(sample);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  <div className="font-medium text-gray-900">{sample.name}</div>
                  <div className="text-sm text-gray-500">{sample.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="font-medium">导入JSON样例</span>
          </button>
        </div>
      </div>
    </div>
  );
};
