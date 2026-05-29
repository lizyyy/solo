import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, RotateCcw, Save, FileDown, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { useEstimationStore } from '@/store/useEstimationStore';
import { generateShortId } from '@/engine/reproducibleId';
import TidalParamsForm from '@/components/params/TidalParamsForm';
import DeviceParamsForm from '@/components/params/DeviceParamsForm';
import CycleSegmentEditor from '@/components/params/CycleSegmentEditor';
import UnitSelector from '@/components/params/UnitSelector';
import { ValidationPanel } from '@/components/results/ValidationPanel';
import { EnergyDisplay } from '@/components/results/EnergyDisplay';
import { PeriodIntegrationChart } from '@/components/results/PeriodIntegrationChart';
import { DeviceGauge } from '@/components/results/DeviceGauge';
import { ExportOptions } from '@/components/export/ExportOptions';
import { cn } from '@/lib/utils';

export default function EstimationPage() {
  const navigate = useNavigate();
  const {
    result,
    validation,
    isCalculating,
    parentId,
    calculate,
    saveCurrentRecord,
    loadSampleData,
    loadInvalidSample,
    reset,
  } = useEstimationStore();

  const [savedId, setSavedId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showSaveNote, setShowSaveNote] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    if (!result) return;
    const id = await saveCurrentRecord(saveNote || undefined);
    if (id) {
      setSavedId(id);
      setShowSaveNote(false);
      setSaveNote('');
    }
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <div className="card">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={loadSampleData}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                加载正常样例
              </button>
              <button
                onClick={loadInvalidSample}
                className="btn-secondary text-sm flex items-center gap-2 text-alert-400"
              >
                <AlertTriangle className="w-4 h-4" />
                加载失败样例
              </button>
              <button
                onClick={reset}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
              <UnitSelector />
            </div>
            
            {parentId && (
              <div className="mt-4 p-3 bg-tech-500/10 border border-tech-500/30 rounded-lg flex items-center gap-3 text-sm">
                <ExternalLink className="w-4 h-4 text-tech-400" />
                <span className="text-gray-300">
                  基于记录
                  <code className="px-2 py-0.5 bg-ocean-600 rounded text-tech-400 mx-1">
                    {generateShortId(parentId)}
                  </code>
                  续算
                </span>
              </div>
            )}
          </div>

          <TidalParamsForm />
          <DeviceParamsForm />
          <CycleSegmentEditor />
          <ValidationPanel />

          <div className="flex flex-wrap gap-4">
            <button
              onClick={calculate}
              disabled={isCalculating || !validation.valid}
              className={cn(
                "btn-primary flex items-center gap-2 flex-1 justify-center",
                (!validation.valid || isCalculating) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isCalculating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  计算中...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  执行估算
                </>
              )}
            </button>
            
            {result && (
              <>
                <button
                  onClick={() => setShowSaveNote(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  保存记录
                </button>
                <button
                  onClick={() => setShowExport(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <FileDown className="w-5 h-5" />
                  导出报告
                </button>
              </>
            )}
          </div>

          {savedId && (
            <div className="p-4 bg-success-500/10 border border-success-500/30 rounded-xl animate-slide-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-success-500" />
                  <div>
                    <p className="font-medium text-success-400">记录已保存</p>
                    <p className="text-sm text-gray-400">
                      可复算ID:
                      <code
                        className="ml-2 px-2 py-1 bg-ocean-700 rounded text-tech-400 cursor-pointer hover:text-tech-300"
                        onClick={() => copyId(savedId)}
                        title="点击复制完整ID"
                      >
                        {generateShortId(savedId)}...
                      </code>
                      {copied && <span className="ml-2 text-success-400 text-xs">已复制!</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/records')}
                  className="text-sm text-tech-400 hover:text-tech-300"
                >
                  查看所有记录 →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:w-[480px] space-y-6">
          <EnergyDisplay />
          <DeviceGauge />
          {result && <PeriodIntegrationChart />}
        </div>
      </div>

      {showSaveNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="card w-full max-w-md animate-slide-up">
            <h3 className="text-lg font-display font-semibold mb-4">保存记录</h3>
            <label className="input-label">备注（可选）</label>
            <input
              type="text"
              value={saveNote}
              onChange={(e) => setSaveNote(e.target.value)}
              placeholder="为这条记录添加备注..."
              className="input-field mb-6"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveNote(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button onClick={handleSave} className="btn-primary flex-1">
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <ExportOptions isOpen={showExport} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
