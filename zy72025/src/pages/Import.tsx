import { useEffect, useState } from 'react';
import { Navbar } from '@/components/common/Navbar';
import { ErrorToast } from '@/components/common/ErrorToast';
import { ImportPanel } from '@/components/import/ImportPanel';
import { ConflictPanel } from '@/components/import/ConflictPanel';
import { useImportStore } from '@/stores/useImportStore';
import { downloadJson } from '@/utils/helpers';
import type { PlayerRecord } from '@/types';

export default function Import() {
  const {
    levels,
    detectedConflicts,
    isLoading,
    error,
    importResult,
    fetchLevels,
    importLevelsFromFile,
    importRecordsFromFile,
    processRecord,
    resolveConflict,
    clearImportResult,
    clearConflicts,
    setError,
  } = useImportStore();

  const [showConflictPanel, setShowConflictPanel] = useState(false);
  const [lastProcessedSession, setLastProcessedSession] = useState<any>(null);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  useEffect(() => {
    if (importResult) {
      const timer = setTimeout(() => clearImportResult(), 5000);
      return () => clearTimeout(timer);
    }
  }, [importResult, clearImportResult]);

  const handleProcessRecord = async (record: PlayerRecord) => {
    try {
      clearConflicts();
      const session = await processRecord(record);
      setLastProcessedSession(session);
      if (session.conflicts.length > 0) {
        setShowConflictPanel(true);
      }
    } catch (e) {
      console.error('Failed to process record:', e);
    }
  };

  const handleExportSample = () => {
    const sampleData = {
      formatVersion: '1.0',
      exportedAt: new Date().toISOString(),
      levels: levels.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
      })),
    };
    downloadJson(sampleData, `pbc-maze-export-${Date.now()}.json`);
  };

  const handleResolveConflict = (
    conflict: any,
    resolution: any,
    resolvedBy: string,
    notes?: string
  ) => {
    if (lastProcessedSession) {
      resolveConflict(lastProcessedSession, conflict, resolution, resolvedBy, notes);
    }
  };

  const handleCloseConflictPanel = () => {
    setShowConflictPanel(false);
    setLastProcessedSession(null);
    clearConflicts();
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 pb-8">
        {error && (
          <ErrorToast message={error} onClose={() => setError(null)} />
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">数据导入</h1>
          <p className="text-white/60">导入关卡配置和学生练习记录，处理数据冲突</p>
        </div>

        {showConflictPanel ? (
          <ConflictPanel
            conflicts={detectedConflicts}
            session={lastProcessedSession}
            onResolve={handleResolveConflict}
            onClose={handleCloseConflictPanel}
          />
        ) : (
          <ImportPanel
            levels={levels}
            onImportLevels={importLevelsFromFile}
            onImportRecords={importRecordsFromFile}
            onProcessRecord={handleProcessRecord}
            onExportSample={handleExportSample}
            isLoading={isLoading}
            importResult={importResult}
          />
        )}
      </main>
    </div>
  );
}
