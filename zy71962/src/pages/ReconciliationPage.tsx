import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/store";
import FilterPanel from "@/components/FilterPanel";
import FeatureTable from "@/components/FeatureTable";
import ImportModal from "@/components/ImportModal";
import CorrectModal from "@/components/CorrectModal";
import ConfirmModal from "@/components/ConfirmModal";
import LeakAlertBanner from "@/components/LeakAlertBanner";
import type { FeatureSpec } from "../../shared/types";

export default function ReconciliationPage() {
  const { fetchFeatures, fetchAuditLogs, fetchLeakAlerts, fetchEvaluation, rollbackFeature } =
    useStore();
  const [importOpen, setImportOpen] = useState(false);
  const [correctTarget, setCorrectTarget] = useState<FeatureSpec | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<FeatureSpec | null>(null);

  useEffect(() => {
    fetchFeatures();
    fetchAuditLogs();
    fetchLeakAlerts();
    fetchEvaluation();
  }, []);

  async function handleRollback() {
    if (!rollbackTarget) return;
    const operator = prompt("请输入操作人姓名");
    if (!operator) return;
    await rollbackFeature(rollbackTarget.id, operator.trim());
    setRollbackTarget(null);
  }

  return (
    <div className="flex flex-col h-full">
      <LeakAlertBanner />
      <FilterPanel />
      <div className="flex-1 overflow-auto">
        <FeatureTable
          onCorrect={(f) => setCorrectTarget(f)}
          onRollback={(f) => setRollbackTarget(f)}
        />
      </div>

      <button
        onClick={() => setImportOpen(true)}
        className="fixed bottom-8 right-8 w-12 h-12 bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-full shadow-lg shadow-amber-500/20 flex items-center justify-center transition-all hover:scale-105 z-10"
      >
        <Plus className="w-6 h-6" />
      </button>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <CorrectModal feature={correctTarget} onClose={() => setCorrectTarget(null)} />
      <ConfirmModal
        open={!!rollbackTarget}
        title="确认撤回"
        message={`确定要撤回特征「${rollbackTarget?.featureName}」的最近一次修正吗？此操作将恢复至上一个版本。`}
        confirmLabel="确认撤回"
        onConfirm={handleRollback}
        onCancel={() => setRollbackTarget(null)}
      />
    </div>
  );
}
