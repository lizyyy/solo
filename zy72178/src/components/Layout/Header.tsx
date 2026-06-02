import { Download, Upload, Play, RefreshCw } from 'lucide-react';
import { useCheckupStore } from '../../store/checkupStore';
import { useSampleStore } from '../../store/sampleStore';
import { useModelVersionStore } from '../../store/modelVersionStore';
import { useAppStore } from '../../store/appStore';
import { formatDateTime } from '../../utils/date';
import { useState } from 'react';
import { exportReport } from '../../services/reportGenerator';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const navigate = useNavigate();
  const { currentUser, isLoading } = useAppStore();
  const { runs, currentRun, fetchRuns } = useCheckupStore();
  const { samples, selectedSampleIds, fetchSamples } = useSampleStore();
  const { versions, activeVersionId, fetchVersions } = useModelVersionStore();
  const [showNewCheckupModal, setShowNewCheckupModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleRefresh = async () => {
    await Promise.all([
      fetchRuns(),
      fetchSamples(),
      fetchVersions(),
    ]);
  };

  const handleNewCheckup = async () => {
    if (selectedSampleIds.length === 0) {
      alert('请先在样本管理页选择要体检的样本');
      navigate('/samples');
      return;
    }
    if (!activeVersionId) {
      alert('请先配置模型版本');
      navigate('/settings');
      return;
    }
    setShowNewCheckupModal(true);
  };

  const handleExport = async (format: 'markdown' | 'json' | 'csv') => {
    if (!currentRun) {
      alert('请先选择一个体检记录');
      return;
    }
    setExporting(true);
    try {
      await exportReport(currentRun.id, format);
    } catch (error) {
      alert('导出失败: ' + (error as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-800">{title}</h1>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentRun && (
              <div className="relative group">
                <button
                  disabled={exporting}
                  className="btn btn-secondary gap-2"
                >
                  <Download className="w-4 h-4" />
                  导出报告
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all min-w-36 z-50">
                  <button
                    onClick={() => handleExport('markdown')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 text-slate-700"
                  >
                    Markdown 报告
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 text-slate-700"
                  >
                    JSON 明细
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 text-slate-700"
                  >
                    CSV 明细
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => navigate('/samples')}
              className="btn btn-secondary gap-2"
            >
              <Upload className="w-4 h-4" />
              上传样本
            </button>
            <button
              onClick={handleNewCheckup}
              className="btn btn-primary gap-2"
            >
              <Play className="w-4 h-4" />
              运行体检
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
              title="刷新数据"
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {currentRun && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-2">
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-slate-700">当前体检:</span>
              {currentRun.name}
            </span>
            <span className="text-slate-300">|</span>
            <span>模型: {runs.find(r => r.id === currentRun.id)?.name}</span>
            <span className="text-slate-300">|</span>
            <span>完成时间: {formatDateTime(currentRun.completedAt || currentRun.startedAt)}</span>
            <span className="text-slate-300">|</span>
            <span>操作人: {currentRun.createdBy}</span>
          </div>
        )}
      </div>

      {showNewCheckupModal && (
        <NewCheckupModal
          onClose={() => setShowNewCheckupModal(false)}
          selectedCount={selectedSampleIds.length}
          activeVersionId={activeVersionId}
          versions={versions}
        />
      )}
    </header>
  );
}

function NewCheckupModal({
  onClose,
  selectedCount,
  activeVersionId,
  versions,
}: {
  onClose: () => void;
  selectedCount: number;
  activeVersionId: string | null;
  versions: any[];
}) {
  const [runName, setRunName] = useState('');
  const [creating, setCreating] = useState(false);
  const { createRun } = useCheckupStore();
  const { selectedSampleIds } = useSampleStore();
  const navigate = useNavigate();

  const activeVersion = versions.find(v => v.id === activeVersionId);

  const handleSubmit = async () => {
    if (!activeVersionId) return;
    setCreating(true);
    try {
      const run = await createRun({
        name: runName || undefined,
        sampleIds: selectedSampleIds,
        modelVersionId: activeVersionId,
      });
      navigate(`/checkup/${run.id}`);
      onClose();
    } catch (error) {
      alert('创建体检失败: ' + (error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        <h3 className="text-lg font-serif font-bold text-slate-800 mb-4">运行新体检</h3>
        <div className="space-y-4">
          <div>
            <label className="label">体检名称（可选）</label>
            <input
              type="text"
              className="input"
              placeholder="例如：新版本回归测试"
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
            />
          </div>
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">已选样本</span>
              <span className="font-medium text-slate-700">{selectedCount} 条</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">使用模型</span>
              <span className="font-medium text-slate-700">
                {activeVersion ? `${activeVersion.name} (${activeVersion.version})` : '未选择'}
              </span>
            </div>
            {activeVersion && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">阈值配置</span>
                <span className="font-medium text-slate-700">{activeVersion.config.threshold}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn btn-secondary">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating || !activeVersionId}
            className="btn btn-primary"
          >
            {creating ? '运行中...' : '开始体检'}
          </button>
        </div>
      </div>
    </div>
  );
}
