import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Package,
  Clock,
  History,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useWorkbenchStore } from '@/store';
import type { ActiveTab } from '@/shared/types';
import Scene3D from '@/components/Scene3D';
import TopBar from '@/components/TopBar';
import MaterialsTab from '@/components/MaterialsTab';
import PendingTab from '@/components/PendingTab';
import HistoryTab from '@/components/HistoryTab';
import BottomPanel from '@/components/BottomPanel';
import ReconciliationModal from '@/components/ReconciliationModal';
import { useState, useMemo } from 'react';

const TABS: Array<{
  id: ActiveTab;
  label: string;
  icon: any;
}> = [
  { id: 'materials', label: '材料送审', icon: Package },
  { id: 'pending', label: '待确认', icon: Clock },
  { id: 'history', label: '历史', icon: History },
  { id: 'reconciliation', label: '对账', icon: FileText },
];

export default function Workbench() {
  const { id = 'PRJ-DEMO' } = useParams<{ id: string }>();
  const fetchRecord = useWorkbenchStore((s) => s.fetchRecord);
  const createDemoRecord = useWorkbenchStore((s) => s.createDemoRecord);
  const record = useWorkbenchStore((s) => s.record);
  const loading = useWorkbenchStore((s) => s.loading);
  const activeTab = useWorkbenchStore((s) => s.activeTab);
  const setActiveTab = useWorkbenchStore((s) => s.setActiveTab);
  const [showReconciliation, setShowReconciliation] = useState(false);

  const pendingCount = useMemo(
    () => (record?.pending_queue || []).filter((p) => !p.resolved_at).length,
    [record?.pending_queue]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchRecord(id);
      if (cancelled) return;
      if (!useWorkbenchStore.getState().record) {
        await createDemoRecord();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchRecord, createDemoRecord]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
      <TopBar />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="w-3/5 min-w-0 flex flex-col p-3 gap-3">
          {loading && !record ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-white flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-slate-400 text-sm">
                  正在加载方案记录...
                </div>
              </div>
            </div>
          ) : (
            <Scene3D />
          )}
        </div>

        <div className="w-2/5 min-w-0 flex flex-col border-l border-slate-700 bg-slate-850">
          <div className="flex border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const showBadge =
                tab.id === 'pending' && pendingCount > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'reconciliation') {
                      setShowReconciliation(true);
                    }
                    setActiveTab(tab.id);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-all relative ${
                    isActive
                      ? 'text-white bg-slate-800'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                  {showBadge && (
                    <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-amber-900 text-[10px] font-bold flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden bg-slate-900">
            {activeTab === 'materials' && <MaterialsTab />}
            {activeTab === 'pending' && <PendingTab />}
            {activeTab === 'history' && <HistoryTab />}
            {activeTab === 'reconciliation' && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <FileText size={48} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400 mb-3">
                    对账面板已在弹窗中打开
                  </p>
                  <button
                    onClick={() => setShowReconciliation(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
                  >
                    重新打开对账弹窗
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomPanel />

      {showReconciliation && (
        <ReconciliationModal onClose={() => setShowReconciliation(false)} />
      )}
    </div>
  );
}
