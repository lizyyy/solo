import { useState, useCallback } from 'react';
import { Upload, FileJson, Database, Trash2, Plus, User } from 'lucide-react';
import { usePresetStore } from '@/store/presetStore';
import { PresetCard } from '@/components/PresetCard';
import { parseFilename } from '@/utils/versionParser';
import type { PresetParameters } from '@/types';

export function ImportPage() {
  const { presets, addPreset, deletePreset, loadSampleData, clearAllData, setCurrentOperator, currentOperator } = usePresetStore();
  const [isDragging, setIsDragging] = useState(false);
  const [operatorName, setOperatorName] = useState(currentOperator);
  const [showOperatorEdit, setShowOperatorEdit] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parameters = JSON.parse(content) as PresetParameters;
        const parsed = parseFilename(file.name);
        
        addPreset({
          name: parsed.name,
          version: parsed.version,
          filename: file.name,
          operator: parsed.operator || currentOperator,
          parameters,
          status: 'draft',
        });
      } catch (err) {
        console.error('Failed to parse file:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      if (file.name.endsWith('.json')) {
        processFile(file);
      }
    });
  }, [currentOperator]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.name.endsWith('.json')) {
        processFile(file);
      }
    });
    e.target.value = '';
  };

  const handleOperatorSave = () => {
    if (operatorName.trim()) {
      setCurrentOperator(operatorName.trim());
    }
    setShowOperatorEdit(false);
  };

  return (
    <div className="min-h-screen bg-grid">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 animate-slide-down">
          <div>
            <h1 className="text-2xl font-bold text-synth-text mb-2">预设导入</h1>
            <p className="text-synth-muted">上传合成器预设文件，自动解析版本信息</p>
          </div>
          
          <div className="flex items-center gap-4">
            {showOperatorEdit ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="px-3 py-1.5 bg-synth-card border border-synth-border rounded-lg text-sm text-synth-text focus:border-accent-neon focus:outline-none"
                placeholder="操作人姓名"
                onKeyDown={(e) => e.key === 'Enter' && handleOperatorSave()}
              />
              <button
                onClick={handleOperatorSave}
                className="px-3 py-1.5 bg-accent-neon text-synth-bg rounded-lg text-sm font-medium hover:bg-accent-neon/90"
              >
                确定
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowOperatorEdit(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-synth-card border border-synth-border rounded-lg text-sm text-synth-muted hover:text-synth-text transition-colors"
            >
              <User className="w-4 h-4" />
              {currentOperator}
            </button>
          )}
          
          <button
            onClick={loadSampleData}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition-colors"
          >
            <Database className="w-4 h-4" />
            加载样例数据
          </button>
          
          {presets.length > 0 && (
            <button
              onClick={clearAllData}
              className="flex items-center gap-2 px-4 py-2 bg-synth-card border border-accent-coral/50 text-accent-coral rounded-lg hover:bg-accent-coral/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清空数据
            </button>
          )}
        </div>
      </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative p-12 rounded-2xl border-2 border-dashed transition-all duration-300 mb-8 animate-slide-up ${
            isDragging
              ? 'border-accent-neon bg-accent-neon/10 shadow-neon-lg'
              : 'border-synth-border bg-synth-card/50 hover:border-synth-muted/50'
          }`}
        >
          <input
            type="file"
            multiple
            accept=".json"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center text-center">
            <div className={`p-4 rounded-full mb-4 transition-all duration-300 ${
              isDragging ? 'bg-accent-neon/20 text-accent-neon' : 'bg-synth-surface text-synth-muted'}`}>
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-synth-text mb-2">
              {isDragging ? '释放以上传' : '拖拽文件到此处'}
            </h3>
            <p className="text-sm text-synth-muted mb-4">
              支持 JSON 格式的合成器预设文件
            </p>
            <div className="flex items-center gap-2 text-xs text-synth-muted">
              <FileJson className="w-4 h-4" />
              <code>例如: BassLead_v1.2.0_20240115_alan.json</code>
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-synth-text">已导入预设 ({presets.length})</h2>
        </div>

        {presets.length === 0 ? (
          <div className="p-12 text-center bg-synth-card rounded-xl border border-synth-border">
            <div className="text-6xl mb-4">🎛️</div>
            <h3 className="text-lg font-medium text-synth-text mb-2">暂无预设</h3>
            <p className="text-synth-muted">
              上传预设文件或点击"加载样例数据"开始使用
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presets.map((preset) => (
              <div key={preset.id} className="relative group">
                <PresetCard preset={preset} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePreset(preset.id);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-synth-bg/80 text-synth-muted hover:text-accent-coral rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
