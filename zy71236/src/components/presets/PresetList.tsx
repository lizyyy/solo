import { useState } from 'react';
import { useSynthStore } from '../../store/useSynthStore';
import { Button } from '../ui/Button';
import { Preset } from '../../types/synth';
import { Save, Trash2, Download, Upload, Play, FileJson, History } from 'lucide-react';
import { readFileAsText } from '../../utils/export';
import { BadDataDialog } from '../presets/BadDataDialog';
import { ValidationResult, ValidationError } from '../../types/synth';

interface PresetCardProps {
  preset: Preset;
  onLoad: () => void;
  onDelete: () => void;
}

function PresetCard({ preset, onLoad, onDelete }: PresetCardProps) {
  const date = new Date(preset.createdAt).toLocaleDateString('zh-CN');

  return (
    <div className="p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-cyan-500/50 transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-200 truncate">{preset.name}</div>
          <div className="text-xs text-gray-500">{date}</div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            onClick={onLoad}
            className="p-1.5 h-auto"
          >
            <Play size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="p-1.5 h-auto text-red-400 hover:text-red-300"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="text-xs text-gray-500 space-y-0.5">
        <div>波形: {preset.params.oscillator.waveform}</div>
        <div>滤波: {preset.params.filter.type}</div>
      </div>
    </div>
  );
}

export function PresetList() {
  const {
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    importFile,
    exportConfig,
    exportSessionFile,
  } = useSynthStore();
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleSave = () => {
    if (!newPresetName.trim()) {
      setSaveError('请输入预设名称');
      return;
    }

    const result = savePreset(newPresetName.trim());
    if (result.success) {
      setNewPresetName('');
      setShowSaveDialog(false);
      setSaveError(null);
    } else {
      setSaveError(result.error || '保存失败');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const result = importFile(content);
      setValidationResult(result);

      if (!result.valid) {
        console.warn('Import validation errors:', result.errors);
      }
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [
          {
            type: 'json_parse',
            message: `文件读取失败: ${(err as Error).message}`,
          },
        ],
      });
    }

    e.target.value = '';
  };

  const handleExportConfig = () => {
    const json = exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `synth-config-${Date.now()}.synthconfig.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportSession = () => {
    const json = exportSessionFile();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `synth-session-${Date.now()}.synthsession.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-300 font-bold text-sm tracking-widest uppercase flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-400 rounded-full" />
          预设管理
        </h3>
        <span className="text-xs text-gray-500 font-mono">{presets.length} 个预设</span>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant="primary"
          onClick={() => setShowSaveDialog(true)}
          className="flex-1"
        >
          <Save size={14} className="mr-1" />
          保存
        </Button>
        <div className="relative flex-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="w-full"
          >
            <Download size={14} className="mr-1" />
            导出
          </Button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-40">
              <button
                onClick={handleExportConfig}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2 rounded-t-lg"
              >
                <FileJson size={14} />
                仅配置
              </button>
              <button
                onClick={handleExportSession}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2 rounded-b-lg"
              >
                <History size={14} />
                完整会话
              </button>
            </div>
          )}
        </div>
        <label className="flex-1">
          <input
            type="file"
            accept=".json,.synthconfig,.synthsession,.synthlab"
            onChange={handleImport}
            className="hidden"
          />
          <Button size="sm" variant="secondary" className="w-full cursor-pointer">
            <Upload size={14} className="mr-1" />
            导入
          </Button>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
        {presets.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">💾</div>
            <div className="text-sm">暂无预设</div>
            <div className="text-xs">点击保存按钮创建预设</div>
          </div>
        ) : (
          presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onLoad={() => loadPreset(preset.id)}
              onDelete={() => deletePreset(preset.id)}
            />
          ))
        )}
      </div>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80">
            <h4 className="text-lg font-bold text-gray-200 mb-4">保存预设</h4>

            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="输入预设名称..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500 mb-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />

            {saveError && <div className="text-red-400 text-sm mb-4">{saveError}</div>}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveError(null);
                }}
                className="flex-1"
              >
                取消
              </Button>
              <Button variant="primary" onClick={handleSave} className="flex-1">
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {validationResult && (
        <BadDataDialog
          result={validationResult}
          onClose={() => setValidationResult(null)}
        />
      )}
    </div>
  );
}
