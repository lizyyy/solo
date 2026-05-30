import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Upload, Car, Wind, Gauge, Check, AlertCircle } from 'lucide-react';
import type { CarParams, WingConfig, WindConfig } from '../types';

type ImportType = 'car' | 'wing' | 'wind';

interface ImportPreview {
  type: ImportType;
  rawData: string;
  parsedData: Record<string, unknown>;
  source: string;
  isValid: boolean;
  error?: string;
}

export const DataImport = () => {
  const { importCarData, importWingData, importWindData, carParams, wingConfig, windConfig, status } = useGameStore();
  const [activeTab, setActiveTab] = useState<ImportType>('car');
  const [importText, setImportText] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const isDisabled = status === 'running';

  const parseJson = (text: string): { data: Record<string, unknown> | null; error?: string } => {
    try {
      const data = JSON.parse(text);
      if (typeof data !== 'object' || data === null) {
        return { data: null, error: '数据必须是JSON对象' };
      }
      return { data };
    } catch (e) {
      return { data: null, error: 'JSON格式错误: ' + (e as Error).message };
    }
  };

  const validateImport = (type: ImportType, data: Record<string, unknown>): { valid: boolean; error?: string } => {
    switch (type) {
      case 'car': {
        const required = ['mass', 'power', 'baseDragCoeff', 'baseLiftCoeff', 'frontalArea', 'tireGrip'];
        const missing = required.filter(k => !(k in data));
        if (missing.length > 0) return { valid: false, error: `缺少字段: ${missing.join(', ')}` };
        
        if (typeof data.mass !== 'number' || data.mass < 100 || data.mass > 2000)
          return { valid: false, error: 'mass 应在 100-2000 kg 之间' };
        if (typeof data.power !== 'number' || data.power < 10000 || data.power > 1000000)
          return { valid: false, error: 'power 应在 10-1000 kW 之间' };
        
        return { valid: true };
      }
      case 'wing': {
        if (!('angle' in data)) return { valid: false, error: '缺少字段: angle' };
        if (typeof data.angle !== 'number' || data.angle < -15 || data.angle > 15)
          return { valid: false, error: 'angle 应在 -15° ~ +15° 之间' };
        return { valid: true };
      }
      case 'wind': {
        if (!('speed' in data)) return { valid: false, error: '缺少字段: speed' };
        if (typeof data.speed !== 'number' || data.speed < 0 || data.speed > 300)
          return { valid: false, error: 'speed 应在 0-300 km/h 之间' };
        if (data.direction !== undefined && (typeof data.direction !== 'number' || data.direction < 0 || data.direction > 360))
          return { valid: false, error: 'direction 应在 0-360° 之间' };
        return { valid: true };
      }
    }
  };

  const handlePreview = () => {
    const source = sourceName.trim() || 'manual_import';
    const { data, error } = parseJson(importText);
    
    if (error) {
      setPreview({
        type: activeTab,
        rawData: importText,
        parsedData: {},
        source,
        isValid: false,
        error
      });
      return;
    }

    const validation = validateImport(activeTab, data!);
    setPreview({
      type: activeTab,
      rawData: importText,
      parsedData: data!,
      source,
      isValid: validation.valid,
      error: validation.error
    });
  };

  const handleImport = () => {
    if (!preview || !preview.isValid) return;
    
    const source = preview.source;
    
    switch (activeTab) {
      case 'car':
        importCarData(preview.parsedData as Partial<CarParams>, source);
        break;
      case 'wing':
        importWingData(preview.parsedData as { angle: number }, source);
        break;
      case 'wind':
        importWindData(preview.parsedData as { speed: number; direction?: number }, source);
        break;
    }

    setShowSuccess(activeTab);
    setImportText('');
    setSourceName('');
    setPreview(null);
    
    setTimeout(() => setShowSuccess(null), 2000);
  };

  const loadExample = () => {
    const examples: Record<ImportType, string> = {
      car: JSON.stringify({
        mass: 750,
        power: 450000,
        baseDragCoeff: 0.35,
        baseLiftCoeff: 0.1,
        frontalArea: 1.8,
        tireGrip: 1.2
      }, null, 2),
      wing: JSON.stringify({ angle: -8 }, null, 2),
      wind: JSON.stringify({ speed: 50, direction: 0 }, null, 2)
    };
    setImportText(examples[activeTab]);
    setSourceName(`示例_${activeTab}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const tabs: { type: ImportType; label: string; icon: React.ElementType; color: string }[] = [
    { type: 'car', label: '赛车参数', icon: Car, color: 'text-[#ff6b35]' },
    { type: 'wing', label: '翼片配置', icon: Gauge, color: 'text-[#00d4ff]' },
    { type: 'wind', label: '风速数据', icon: Wind, color: 'text-[#4ade80]' }
  ];

  const currentData: Record<ImportType, { id: string; source: string; importTime: number; rawData: string }> = {
    car: carParams,
    wing: wingConfig,
    wind: windConfig
  };

  return (
    <div className="bg-[#0f1c33] border border-[#1e3a5f] rounded-xl p-4 space-y-4">
      <h2 className="text-lg font-bold text-[#00d4ff] font-['Orbitron'] tracking-wider">
        数据导入
      </h2>

      <div className="flex gap-1 bg-[#0a1628] rounded-lg p-1">
        {tabs.map(({ type, label, icon: Icon, color }) => (
          <button
            key={type}
            onClick={() => { setActiveTab(type); setPreview(null); }}
            disabled={isDisabled}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all
              ${activeTab === type 
                ? `bg-[#1e3a5f] ${color}` 
                : 'text-gray-400 hover:text-white hover:bg-[#1e3a5f]/50'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
        <div className="text-xs text-gray-400 mb-2">当前{tabs.find(t => t.type === activeTab)?.label}</div>
        <div className="space-y-1 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-gray-500">ID:</span>
            <span className="text-[#00d4ff]">{currentData[activeTab].id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">来源:</span>
            <span className="text-white">{currentData[activeTab].source}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">导入时间:</span>
            <span className="text-gray-300">{formatDate(currentData[activeTab].importTime)}</span>
          </div>
        </div>
        <div className="mt-2 p-2 bg-[#0f1c33] rounded text-[10px] text-gray-500 font-mono overflow-x-auto">
          原始数据: {currentData[activeTab].rawData}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">数据来源标识</label>
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="例如: 张三_赛车参数"
            disabled={isDisabled}
            className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e3a5f] rounded-lg text-white text-sm
              focus:outline-none focus:border-[#00d4ff] transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">JSON数据</label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`粘贴${tabs.find(t => t.type === activeTab)?.label}JSON数据...`}
            rows={4}
            disabled={isDisabled}
            className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e3a5f] rounded-lg text-white text-sm font-mono
              focus:outline-none focus:border-[#00d4ff] transition-colors resize-none
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadExample}
            disabled={isDisabled}
            className="flex-1 py-2 px-3 bg-[#1e3a5f] hover:bg-[#2a4a6f] text-gray-300 text-sm rounded-lg
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            加载示例
          </button>
          <button
            onClick={handlePreview}
            disabled={isDisabled || !importText.trim()}
            className="flex-1 py-2 px-3 bg-[#ff6b35] hover:bg-[#ff8555] text-white text-sm font-medium rounded-lg
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" />
            预览校验
          </button>
        </div>
      </div>

      {preview && (
        <div className={`rounded-lg p-3 border ${
          preview.isValid 
            ? 'bg-green-900/20 border-green-500/30' 
            : 'bg-red-900/20 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {preview.isValid ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${
              preview.isValid ? 'text-green-400' : 'text-red-400'
            }`}>
              {preview.isValid ? '数据校验通过' : '数据校验失败'}
            </span>
          </div>
          
          {preview.error && (
            <div className="text-xs text-red-400 mb-2">{preview.error}</div>
          )}
          
          {preview.isValid && (
            <>
              <div className="text-xs text-gray-400 mb-1">解析后的数据:</div>
              <pre className="text-[11px] text-gray-300 font-mono bg-[#0a1628] p-2 rounded overflow-x-auto">
                {JSON.stringify(preview.parsedData, null, 2)}
              </pre>
              <button
                onClick={handleImport}
                className="w-full mt-3 py-2 px-3 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg
                  transition-colors flex items-center justify-center gap-1"
              >
                <Upload className="w-4 h-4" />
                确认导入（将创建新的数据源ID）
              </button>
            </>
          )}
        </div>
      )}

      {showSuccess && (
        <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-green-400 text-sm">
            {tabs.find(t => t.type === showSuccess)?.label}导入成功！新ID已生成
          </span>
        </div>
      )}

      <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
        <div className="text-xs text-gray-400 mb-2">导入说明</div>
        <ul className="text-[11px] text-gray-500 space-y-1">
          <li>• 每次导入都会生成新的ID，保留完整溯源链</li>
          <li>• 原始数据和处理结果分开存储，便于复核</li>
          <li>• 来源标识用于区分不同学生/小组的数据</li>
          <li>• 问题诊断时会显示触发问题的数据ID</li>
        </ul>
      </div>
    </div>
  );
};
