import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import TopToolbar from '@/components/TopToolbar';
import { FilterPanel } from '@/components/FilterPanel';
import { WaveformDisplay } from '@/components/WaveformDisplay';
import { MisnoteList } from '@/components/MisnoteList';
import OperationHistory from '@/components/OperationHistory';
import ExportDialog from '@/components/ExportDialog';
import { Loader2, AlertCircle } from 'lucide-react';

type RightPanelTab = 'misnotes' | 'history';

export default function Home() {
  const { loadInitialData, currentRehearsal } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('misnotes');

  useEffect(() => {
    const init = async () => {
      try {
        await loadInitialData();
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    };
    init();
  }, [loadInitialData]);

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-page p-8">
        <div className="max-w-lg w-full bg-bg-card rounded-xl border border-red-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                加载失败
              </h2>
              <p className="text-sm text-text-secondary">
                系统初始化时发生错误
              </p>
            </div>
          </div>
          <div className="bg-bg-subtle rounded-lg p-4 mb-4">
            <p className="text-sm text-red-400 font-mono break-all">
              {error.message}
            </p>
            {error.stack && (
              <details className="mt-3">
                <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                  查看详细堆栈
                </summary>
                <pre className="mt-2 text-xs text-text-tertiary whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full"
          >
            刷新页面重试
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-page">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              正在加载...
            </h2>
            <p className="text-sm text-text-secondary">
              准备儿童合奏错音定位系统
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-page text-text-primary overflow-hidden">
      <TopToolbar onExportClick={() => setShowExportDialog(true)} />

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 flex-shrink-0 border-r border-border overflow-y-auto">
          <FilterPanel />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-hidden">
            <WaveformDisplay />
          </div>

          <div className="h-64 border-t border-border overflow-hidden flex-shrink-0">
            <OperationHistory />
          </div>
        </main>

        <aside className="w-96 flex-shrink-0 border-l border-border flex flex-col overflow-hidden">
          <div className="flex border-b border-border bg-bg-card">
            <button
              onClick={() => setRightPanelTab('misnotes')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                rightPanelTab === 'misnotes'
                  ? 'text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              错音列表
              {rightPanelTab === 'misnotes' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setRightPanelTab('history')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                rightPanelTab === 'history'
                  ? 'text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              操作历史
              {rightPanelTab === 'history' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightPanelTab === 'misnotes' ? (
              <MisnoteList />
            ) : (
              <OperationHistory />
            )}
          </div>
        </aside>
      </div>

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </div>
  );
}
