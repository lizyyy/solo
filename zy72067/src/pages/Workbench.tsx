import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import RecordTable from '@/components/workbench/RecordTable';
import SceneView from '@/components/workbench/SceneView';
import ParameterPanel from '@/components/workbench/ParameterPanel';
import DetailPanel from '@/components/workbench/DetailPanel';
import SourcePopover from '@/components/workbench/SourcePopover';
import ErrorBanner from '@/components/ErrorBanner';
import CorrectionPanel from '@/components/workbench/CorrectionPanel';

export default function Workbench() {
  const {
    fetchScheme,
    fetchRecords,
    fetchConflicts,
    fetchParameterChanges,
    fetchImportErrors,
    fetchSnapshots,
    selectedRecord,
    currentScheme,
    correctionPanelOpen,
  } = useStore();

  useEffect(() => {
    async function load() {
      await fetchScheme('demo-001');
      const schemeId = useStore.getState().currentScheme?.id ?? 'demo-001';
      await Promise.all([
        fetchRecords(schemeId),
        fetchConflicts(schemeId),
        fetchParameterChanges(schemeId),
        fetchImportErrors(schemeId),
      ]);
    }
    load();
  }, [fetchScheme, fetchRecords, fetchConflicts, fetchParameterChanges, fetchImportErrors]);

  useEffect(() => {
    if (selectedRecord) {
      fetchSnapshots(selectedRecord.id);
    }
  }, [selectedRecord, fetchSnapshots]);

  return (
    <div className="flex h-screen flex-col bg-[#1a1a2e] text-gray-100">
      <ErrorBanner />
      <div className="flex flex-1 min-h-0">
        <div className="w-[40%] border-r border-gray-700 p-4 overflow-hidden flex flex-col">
          <div className="mb-2 text-sm font-semibold text-gray-300">热斑记录</div>
          <div className="flex-1 overflow-hidden">
            <RecordTable />
          </div>
        </div>
        <div className="w-[35%] border-r border-gray-700 p-4 overflow-hidden flex flex-col">
          <div className="mb-2 text-sm font-semibold text-gray-300">场景视图</div>
          <div className="flex-1 overflow-hidden">
            <SceneView />
          </div>
        </div>
        <div className="w-[25%] p-4 overflow-hidden flex flex-col gap-4">
          {correctionPanelOpen ? (
            <CorrectionPanel />
          ) : (
            <ParameterPanel />
          )}
        </div>
      </div>
      <DetailPanel />
      <SourcePopover />
    </div>
  );
}
