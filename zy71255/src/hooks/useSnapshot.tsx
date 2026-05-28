import { useState, useCallback } from 'react';
import { useDataStore } from '@/store/useDataStore';
import { compareSnapshots } from '@/utils/versionDiff';
import type { Snapshot, DiffResult } from '@/types';
import type { Snapshot as UtilsSnapshot } from '@/utils/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface UseSnapshotReturn {
  showCreateDialog: boolean;
  showDeleteDialog: boolean;
  showCompareDialog: boolean;
  snapshotToDelete: Snapshot | null;
  compareSnapshotA: Snapshot | null;
  compareSnapshotB: Snapshot | null;
  compareResult: DiffResult | null;
  isCreating: boolean;
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  openDeleteDialog: (snapshot: Snapshot) => void;
  closeDeleteDialog: () => void;
  openCompareDialog: (snapshotA: Snapshot, snapshotB: Snapshot) => void;
  closeCompareDialog: () => void;
  createSnapshot: (description: string) => Promise<Snapshot | null>;
  loadSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  CreateSnapshotDialog: React.FC;
  DeleteSnapshotDialog: React.FC;
  CompareSnapshotDialog: React.FC;
}

export function useSnapshot(): UseSnapshotReturn {
  const {
    snapshots,
    createSnapshot: storeCreateSnapshot,
    loadSnapshot: storeLoadSnapshot,
    deleteSnapshot: storeDeleteSnapshot,
  } = useDataStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [snapshotToDelete, setSnapshotToDelete] = useState<Snapshot | null>(null);
  const [compareSnapshotA, setCompareSnapshotA] = useState<Snapshot | null>(null);
  const [compareSnapshotB, setCompareSnapshotB] = useState<Snapshot | null>(null);
  const [compareResult, setCompareResult] = useState<DiffResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [description, setDescription] = useState('');

  const openCreateDialog = useCallback(() => {
    setDescription('');
    setShowCreateDialog(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setShowCreateDialog(false);
    setDescription('');
    setIsCreating(false);
  }, []);

  const openDeleteDialog = useCallback((snapshot: Snapshot) => {
    setSnapshotToDelete(snapshot);
    setShowDeleteDialog(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false);
    setSnapshotToDelete(null);
  }, []);

  const openCompareDialog = useCallback((snapshotA: Snapshot, snapshotB: Snapshot) => {
    setCompareSnapshotA(snapshotA);
    setCompareSnapshotB(snapshotB);
    const utilsSnapshotA: UtilsSnapshot = {
      version: snapshotA.id,
      timestamp: snapshotA.timestamp,
      data: snapshotA.data as unknown as Record<string, unknown>,
    };
    const utilsSnapshotB: UtilsSnapshot = {
      version: snapshotB.id,
      timestamp: snapshotB.timestamp,
      data: snapshotB.data as unknown as Record<string, unknown>,
    };
    const result = compareSnapshots(utilsSnapshotA, utilsSnapshotB);
    setCompareResult(result as unknown as DiffResult);
    setShowCompareDialog(true);
  }, []);

  const closeCompareDialog = useCallback(() => {
    setShowCompareDialog(false);
    setCompareSnapshotA(null);
    setCompareSnapshotB(null);
    setCompareResult(null);
  }, []);

  const createSnapshot = useCallback(
    async (desc: string): Promise<Snapshot | null> => {
      try {
        setIsCreating(true);
        const snapshot = storeCreateSnapshot(desc || `快照 ${new Date().toLocaleString('zh-CN')}`);
        closeCreateDialog();
        return snapshot;
      } catch (error) {
        console.error('创建快照失败:', error);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [storeCreateSnapshot, closeCreateDialog]
  );

  const loadSnapshot = useCallback(
    (id: string) => {
      storeLoadSnapshot(id);
    },
    [storeLoadSnapshot]
  );

  const deleteSnapshot = useCallback(
    (id: string) => {
      storeDeleteSnapshot(id);
      closeDeleteDialog();
    },
    [storeDeleteSnapshot, closeDeleteDialog]
  );

  const CreateSnapshotDialog: React.FC = () => (
    <Modal
      isOpen={showCreateDialog}
      onClose={closeCreateDialog}
      title="创建快照"
      size="md"
    >
      <div className="p-6">
        <p className="text-white/70 mb-4">
          为当前数据状态创建一个快照，用于后续对比或恢复。
        </p>
        <div className="mb-6">
          <label className="block text-white/80 text-sm font-medium mb-2">
            快照描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="输入快照描述..."
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-accent-cyan/50 focus:ring-2 focus:ring-accent-cyan/20 resize-none"
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={closeCreateDialog}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() => createSnapshot(description)}
            loading={isCreating}
          >
            创建
          </Button>
        </div>
      </div>
    </Modal>
  );

  const DeleteSnapshotDialog: React.FC = () => (
    <Modal
      isOpen={showDeleteDialog}
      onClose={closeDeleteDialog}
      title="删除快照"
      size="md"
    >
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(255, 107, 107, 0.2)' }}
          >
            <span className="text-2xl">⚠️</span>
          </div>
          <div>
            <p className="text-white font-medium">
              确定要删除此快照吗？
            </p>
            <p className="text-white/60 text-sm mt-1">
              {snapshotToDelete?.description}
            </p>
          </div>
        </div>
        <p className="text-white/70 mb-6 text-sm">
          此操作不可撤销，删除后将无法恢复该快照。
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={closeDeleteDialog}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={() => snapshotToDelete && deleteSnapshot(snapshotToDelete.id)}
          >
            删除
          </Button>
        </div>
      </div>
    </Modal>
  );

  const CompareSnapshotDialog: React.FC = () => {
    if (!compareResult || !compareSnapshotA || !compareSnapshotB) return null;

    const formatDate = (timestamp: number) =>
      new Date(timestamp).toLocaleString('zh-CN');

    const countChanges = (obj: Record<string, unknown>) => Object.keys(obj).length;

    return (
      <Modal
        isOpen={showCompareDialog}
        onClose={closeCompareDialog}
        title="版本对比"
        size="xl"
      >
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)' }}
            >
              <div className="text-accent-red text-sm font-medium mb-1">旧版本</div>
              <div className="text-white font-medium">{compareSnapshotA.description}</div>
              <div className="text-white/50 text-sm mt-1">{formatDate(compareSnapshotA.timestamp)}</div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'rgba(0, 255, 157, 0.1)', border: '1px solid rgba(0, 255, 157, 0.3)' }}
            >
              <div className="text-accent-green text-sm font-medium mb-1">新版本</div>
              <div className="text-white font-medium">{compareSnapshotB.description}</div>
              <div className="text-white/50 text-sm mt-1">{formatDate(compareSnapshotB.timestamp)}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div
              className="p-4 rounded-xl text-center"
              style={{ backgroundColor: 'rgba(0, 255, 157, 0.1)', border: '1px solid rgba(0, 255, 157, 0.2)' }}
            >
              <div className="text-accent-green text-2xl font-bold font-orbitron">
                {countChanges(compareResult.added as unknown as Record<string, unknown>)}
              </div>
              <div className="text-white/60 text-sm">新增</div>
            </div>
            <div
              className="p-4 rounded-xl text-center"
              style={{ backgroundColor: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.2)' }}
            >
              <div className="text-accent-red text-2xl font-bold font-orbitron">
                {countChanges(compareResult.removed as unknown as Record<string, unknown>)}
              </div>
              <div className="text-white/60 text-sm">删除</div>
            </div>
            <div
              className="p-4 rounded-xl text-center"
              style={{ backgroundColor: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.2)' }}
            >
              <div className="text-accent-cyan text-2xl font-bold font-orbitron">
                {countChanges(compareResult.modified as unknown as Record<string, unknown>)}
              </div>
              <div className="text-white/60 text-sm">修改</div>
            </div>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {countChanges(compareResult.added as unknown as Record<string, unknown>) > 0 && (
              <div>
                <h4 className="text-accent-green font-medium mb-2">新增项</h4>
                <div
                  className="rounded-xl p-4"
                  style={{ backgroundColor: 'rgba(0, 255, 157, 0.05)', border: '1px solid rgba(0, 255, 157, 0.2)' }}
                >
                  {Object.keys(compareResult.added as unknown as Record<string, unknown>).map((key) => (
                    <div key={key} className="py-2 border-b border-white/5 last:border-b-0">
                      <span className="text-accent-green font-medium">+ {key}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {countChanges(compareResult.removed as unknown as Record<string, unknown>) > 0 && (
              <div>
                <h4 className="text-accent-red font-medium mb-2">删除项</h4>
                <div
                  className="rounded-xl p-4"
                  style={{ backgroundColor: 'rgba(255, 107, 107, 0.05)', border: '1px solid rgba(255, 107, 107, 0.2)' }}
                >
                  {Object.keys(compareResult.removed as unknown as Record<string, unknown>).map((key) => (
                    <div key={key} className="py-2 border-b border-white/5 last:border-b-0">
                      <span className="text-accent-red font-medium">- {key}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {countChanges(compareResult.modified as unknown as Record<string, unknown>) > 0 && (
              <div>
                <h4 className="text-accent-cyan font-medium mb-2">修改项</h4>
                <div
                  className="rounded-xl p-4"
                  style={{ backgroundColor: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.2)' }}
                >
                  {Object.entries(compareResult.modified as unknown as Record<string, { oldValue: unknown; newValue: unknown }>).map(([key, value]) => (
                    <div key={key} className="py-3 border-b border-white/5 last:border-b-0">
                      <div className="text-accent-cyan font-medium mb-2">~ {key}</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-white/50">旧值: </span>
                          <span className="text-accent-red">{String(value.oldValue)}</span>
                        </div>
                        <div>
                          <span className="text-white/50">新值: </span>
                          <span className="text-accent-green">{String(value.newValue)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {countChanges(compareResult.added as unknown as Record<string, unknown>) === 0 &&
             countChanges(compareResult.removed as unknown as Record<string, unknown>) === 0 &&
             countChanges(compareResult.modified as unknown as Record<string, unknown>) === 0 && (
              <div className="text-center py-8 text-white/50">
                两个版本完全相同，无差异
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <Button variant="primary" onClick={closeCompareDialog}>
              关闭
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  return {
    showCreateDialog,
    showDeleteDialog,
    showCompareDialog,
    snapshotToDelete,
    compareSnapshotA,
    compareSnapshotB,
    compareResult,
    isCreating,
    openCreateDialog,
    closeCreateDialog,
    openDeleteDialog,
    closeDeleteDialog,
    openCompareDialog,
    closeCompareDialog,
    createSnapshot,
    loadSnapshot,
    deleteSnapshot,
    CreateSnapshotDialog,
    DeleteSnapshotDialog,
    CompareSnapshotDialog,
  };
}
