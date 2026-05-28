import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useDataStore } from '@/store/useDataStore';
import { useFilterStore } from '@/store/useFilterStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useUIStore } from '@/store/useUIStore';
import { generateInitialData } from '@/data/dataGenerator';
import { detectAllAnomalies } from '@/utils/anomalyDetection';
import Scene from '@/components/three/Scene';
import TopBar from '@/components/panels/TopBar';
import FilterPanel from '@/components/panels/FilterPanel';
import DetailPanel from '@/components/panels/DetailPanel';
import StatusBar from '@/components/panels/StatusBar';
import ReportGenerator from '@/components/export/ReportGenerator';
import Modal from '@/components/ui/Modal';
import { useSnapshot } from '@/hooks/useSnapshot';
import type { Enterprise, Transaction, Gap } from '@/types';

export default function App() {
  const {
    enterprises,
    transactions,
    gaps,
    issues,
    periods,
    snapshots,
    isCompareMode,
    compareSnapshotId,
    setData,
    toggleCompareMode,
  } = useDataStore();

  const {
    selectedEnterprises,
    selectedPeriod,
    showOnlyWithGap,
    gapThreshold,
    showFlows,
    timePosition,
    isPlaying,
    setTimePosition,
    selectAllEnterprises,
  } = useFilterStore();

  const {
    selectedEnterpriseId,
    selectedTransactionId,
    highlightedTransactionIds,
    selectEnterprise,
    selectTransaction,
    focusOnEnterprise,
    clearSelection,
  } = useSelectionStore();

  const {
    leftPanelCollapsed,
    rightPanelCollapsed,
    showVersionCompareModal,
    setShowVersionCompareModal,
  } = useUIStore();

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const {
    CreateSnapshotDialog,
    DeleteSnapshotDialog,
    CompareSnapshotDialog,
    openCreateDialog,
    openDeleteDialog,
    openCompareDialog,
    loadSnapshot,
    createSnapshot,
  } = useSnapshot();

  useEffect(() => {
    const initialData = generateInitialData();

    const detectionData = {
      transactions: initialData.transactions.map((tx) => ({
        id: tx.id,
        date: tx.timestamp,
        amount: tx.amount,
        enterpriseId: tx.fromEnterpriseId,
        enterpriseName: initialData.enterprises.find((e) => e.id === tx.fromEnterpriseId)?.name || '',
        fromEnterpriseId: tx.fromEnterpriseId,
        toEnterpriseId: tx.toEnterpriseId,
        periodId: tx.periodId,
      })),
      periods: initialData.periods.map((p) => ({
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
      })),
      enterprises: initialData.enterprises.map((e) => ({
        id: e.id,
        name: e.name,
        industry: e.industry,
        quota: (e as unknown as { totalQuota: number }).totalQuota,
        usedQuota: (e as unknown as { usedQuota: number }).usedQuota,
        position: e.position,
      })),
    };

    const detectedIssues = detectAllAnomalies(detectionData);

    const gaps: Gap[] = initialData.quotas.map((q) => ({
      id: `gap_${q.enterpriseId}_${q.periodId}`,
      enterpriseId: q.enterpriseId,
      periodId: q.periodId,
      required: q.totalQuota,
      actual: q.usedQuota,
      gap: q.gap,
    }));

    const allIssues = [
      ...initialData.issues.map((issue) => ({
        id: issue.id,
        type: issue.type as 'duplicate_deduction' | 'period_misalignment' | 'flow_occlusion',
        description: issue.description,
        severity: issue.severity as 'low' | 'medium' | 'high',
        status: issue.status as 'open' | 'explained' | 'fixed',
        enterpriseId: issue.enterpriseId,
        transactionId: issue.relatedTransactionId,
      })),
      ...detectedIssues.map((anomaly, index) => ({
        id: `detected_${Date.now()}_${index}`,
        type: anomaly.type,
        description: anomaly.description,
        severity: anomaly.severity,
        status: 'open' as const,
        enterpriseId: anomaly.details.enterpriseId as string | undefined,
        transactionId: anomaly.details.transactionId as string | undefined,
      })),
    ];

    const typedEnterprises: Enterprise[] = initialData.enterprises.map((e) => ({
      id: e.id,
      name: e.name,
      industry: e.industry,
      position: [e.position.x, e.position.y, e.position.z] as [number, number, number],
      color: e.color,
      totalQuota: (e as unknown as { totalQuota: number }).totalQuota,
      usedQuota: (e as unknown as { usedQuota: number }).usedQuota,
    }));

    const typedTransactions: Transaction[] = initialData.transactions.map((tx) => ({
      id: tx.id,
      fromId: tx.fromEnterpriseId,
      toId: tx.toEnterpriseId,
      amount: tx.amount,
      price: tx.price,
      date: tx.timestamp,
      periodId: tx.periodId,
    }));

    setData({
      periods: initialData.periods.map((p) => ({
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        status: 'completed' as const,
      })),
      enterprises: typedEnterprises,
      transactions: typedTransactions,
      gaps,
      issues: allIssues,
    });

    selectAllEnterprises(typedEnterprises);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [setData, selectAllEnterprises]);

  useEffect(() => {
    if (isPlaying) {
      const animate = (currentTime: number) => {
        if (currentTime - lastTimeRef.current >= 50) {
          setTimePosition((prev) => {
            const next = prev + 1;
            if (next >= 100) return 0;
            return next;
          });
          lastTimeRef.current = currentTime;
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, setTimePosition]);

  const filteredEnterprises = useMemo(() => {
    return enterprises.filter((enterprise) => {
      const matchesEnterpriseFilter =
        selectedEnterprises.length === 0 || selectedEnterprises.includes(enterprise.id);

      const enterpriseGap = gaps.find(
        (g) => g.enterpriseId === enterprise.id && g.periodId === selectedPeriod
      );
      const hasGap = enterpriseGap && enterpriseGap.gap > 0;
      const meetsGapThreshold = !enterpriseGap || enterpriseGap.gap >= gapThreshold;

      const passesFilters =
        matchesEnterpriseFilter &&
        (!showOnlyWithGap || hasGap) &&
        (!showOnlyWithGap || gapThreshold === 0 || meetsGapThreshold);

      return passesFilters;
    });
  }, [enterprises, gaps, selectedEnterprises, selectedPeriod, showOnlyWithGap, gapThreshold]);

  const filteredTransactions = useMemo(() => {
    if (!showFlows) return [];

    return transactions.filter((tx) => {
      const matchesPeriod = !selectedPeriod || tx.periodId === selectedPeriod;
      const matchesEnterprises =
        selectedEnterprises.length === 0 ||
        selectedEnterprises.includes(tx.fromId) ||
        selectedEnterprises.includes(tx.toId);

      return matchesPeriod && matchesEnterprises;
    });
  }, [transactions, showFlows, selectedPeriod, selectedEnterprises]);

  const handleSelectEnterprise = useCallback(
    (id: string) => {
      selectEnterprise(id, transactions);
    },
    [selectEnterprise, transactions]
  );

  const handleFocusEnterprise = useCallback(
    (id: string) => {
      focusOnEnterprise(id);
    },
    [focusOnEnterprise]
  );

  const handleSelectTransaction = useCallback(
    (id: string) => {
      selectTransaction(id);
    },
    [selectTransaction]
  );

  const handleExport = useCallback(
    (type: 'pdf' | 'excel' | 'json' | 'screenshot') => {
      console.log('Export:', type);
    },
    []
  );

  const handleCreateSnapshot = useCallback(
    async (description: string) => {
      const result = await createSnapshot(description);
      return result!;
    },
    [createSnapshot]
  );

  const handleCloseVersionCompare = useCallback(() => {
    setShowVersionCompareModal(false);
    if (isCompareMode) {
      toggleCompareMode();
    }
  }, [setShowVersionCompareModal, isCompareMode, toggleCompareMode]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-primary-400">
      <div id="scene-container" className="scene-container">
        <Scene
          enterprises={filteredEnterprises}
          transactions={filteredTransactions}
          gaps={gaps}
          issues={issues}
          selectedEnterpriseId={selectedEnterpriseId}
          selectedTransactionId={selectedTransactionId}
          highlightedTransactions={highlightedTransactionIds}
          timeProgress={timePosition / 100}
          onSelectEnterprise={handleSelectEnterprise}
          onFocusEnterprise={handleFocusEnterprise}
          onSelectTransaction={handleSelectTransaction}
        />
      </div>

      <div className="top-bar">
        <TopBar
          enterprises={enterprises}
          periods={periods}
          snapshots={snapshots}
          onCreateSnapshot={handleCreateSnapshot}
          onExport={handleExport}
        />
      </div>

      <div className={`filter-panel ${leftPanelCollapsed ? 'collapsed' : ''}`}>
        <FilterPanel
          enterprises={enterprises}
          gaps={gaps}
          transactions={transactions}
          selectedPeriod={selectedPeriod}
        />
      </div>

      <div className={`detail-panel ${rightPanelCollapsed ? 'collapsed' : ''}`}>
        <DetailPanel
          enterprises={enterprises}
          transactions={transactions}
          issues={issues}
          gaps={gaps}
          selectedPeriod={selectedPeriod}
        />
      </div>

      <div className="status-bar">
        <StatusBar />
      </div>

      <ReportGenerator hidden />

      <CreateSnapshotDialog />
      <DeleteSnapshotDialog />
      <CompareSnapshotDialog />

      <Modal
        isOpen={showVersionCompareModal}
        onClose={handleCloseVersionCompare}
        title="版本对比"
        size="xl"
      >
        <div className="p-6">
          <p className="text-white/70 mb-4">
            选择两个快照进行对比，查看数据变更。
          </p>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {snapshots.length < 2 ? (
              <div className="text-center py-8 text-white/50">
                需要至少两个快照才能进行对比
              </div>
            ) : (
              <div className="space-y-2">
                {snapshots.map((snapshot, index) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-white">{snapshot.description}</div>
                      <div className="text-sm text-white/50">
                        {new Date(snapshot.timestamp).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadSnapshot(snapshot.id)}
                        className="px-3 py-1.5 text-sm bg-accent-cyan/20 text-accent-cyan rounded-lg hover:bg-accent-cyan/30 transition-colors"
                      >
                        加载
                      </button>
                      <button
                        onClick={() => openDeleteDialog(snapshot)}
                        className="px-3 py-1.5 text-sm bg-accent-red/20 text-accent-red rounded-lg hover:bg-accent-red/30 transition-colors"
                      >
                        删除
                      </button>
                      {index > 0 && (
                        <button
                          onClick={() => openCompareDialog(snapshots[index - 1], snapshot)}
                          className="px-3 py-1.5 text-sm bg-accent-green/20 text-accent-green rounded-lg hover:bg-accent-green/30 transition-colors"
                        >
                          对比
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={openCreateDialog}
              className="px-4 py-2 bg-accent-cyan/20 text-accent-cyan rounded-xl hover:bg-accent-cyan/30 transition-colors"
            >
              创建新快照
            </button>
            <button
              onClick={handleCloseVersionCompare}
              className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
