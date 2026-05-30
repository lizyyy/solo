import type {
  VersionSnapshot,
  OperationLog,
  RollbackRequest,
  RollbackResponse
} from '../../../shared/types.js';
import { versionRepository } from '../repositories/VersionRepository.js';
import { customerRepository } from '../repositories/CustomerRepository.js';
import { guaranteeRepository } from '../repositories/GuaranteeRepository.js';
import { creditRepository } from '../repositories/CreditRepository.js';
import { riskRepository } from '../repositories/RiskRepository.js';
import { v4 as uuidv4 } from 'uuid';

export class VersionControlService {
  listSnapshots(limit = 50): VersionSnapshot[] {
    return versionRepository.listSnapshots(limit);
  }

  getSnapshot(id: string): VersionSnapshot | null {
    return versionRepository.getSnapshot(id);
  }

  getActiveSnapshot(): VersionSnapshot | null {
    return versionRepository.getActiveSnapshot();
  }

  setActiveSnapshot(id: string, operator: string): boolean {
    const snapshot = versionRepository.getSnapshot(id);
    if (!snapshot) {
      throw new Error('版本不存在');
    }

    const currentActive = versionRepository.getActiveSnapshot();
    const success = versionRepository.setActiveSnapshot(id);

    if (success) {
      versionRepository.createOperationLog({
        operationType: 'switch_version',
        operator,
        description: `切换到版本: ${snapshot.name}`,
        affectedObjects: [id],
        previousSnapshotId: currentActive?.id,
        canUndo: true
      });
    }

    return success;
  }

  async rollback(request: RollbackRequest, operator: string): Promise<RollbackResponse> {
    const targetSnapshot = versionRepository.getSnapshot(request.snapshotId);
    if (!targetSnapshot) {
      throw new Error('目标版本不存在');
    }

    if (!targetSnapshot.canRollback) {
      throw new Error('该版本不支持撤回');
    }

    const currentActive = versionRepository.getActiveSnapshot();
    
    const newSnapshot = versionRepository.createSnapshot({
      name: `撤回至 ${targetSnapshot.name} - ${new Date().toLocaleString()}`,
      description: `撤回操作: ${request.reason}`,
      createdBy: operator,
      dataVersion: targetSnapshot.dataVersion,
      calculationVersion: targetSnapshot.calculationVersion,
      dataFiles: targetSnapshot.dataFiles,
      isActive: true,
      canRollback: true
    });

    const customers = customerRepository.list(request.snapshotId);
    const guarantees = guaranteeRepository.findAllContracts(request.snapshotId);
    const credits = creditRepository.findAllCreditLines(request.snapshotId);
    const counterGuarantees = guaranteeRepository.findAllCounterGuarantees(request.snapshotId);
    const riskResults = riskRepository.findAll(request.snapshotId);

    const newCustomers = customers.map(c => ({ ...c, version: newSnapshot.id, id: uuidv4() }));
    const newGuarantees = guarantees.map(g => ({ ...g, version: newSnapshot.id, id: uuidv4() }));
    const newCredits = credits.map(c => ({ ...c, version: newSnapshot.id, id: uuidv4() }));
    const newCG = counterGuarantees.map(cg => ({ ...cg, version: newSnapshot.id, id: uuidv4() }));
    const newRiskResults = riskResults.map(r => ({ ...r, version: newSnapshot.id, id: uuidv4() }));

    let affectedCount = 0;
    
    if (newCustomers.length > 0) {
      customerRepository.bulkCreate(newCustomers);
      affectedCount += newCustomers.length;
    }
    if (newGuarantees.length > 0) {
      guaranteeRepository.bulkCreateContracts(newGuarantees);
      affectedCount += newGuarantees.length;
    }
    if (newCredits.length > 0) {
      creditRepository.bulkCreateCreditLines(newCredits);
      affectedCount += newCredits.length;
    }
    if (newCG.length > 0) {
      guaranteeRepository.bulkCreateCounterGuarantees(newCG);
      affectedCount += newCG.length;
    }
    if (newRiskResults.length > 0) {
      riskRepository.bulkCreateResults(newRiskResults);
      affectedCount += newRiskResults.length;
    }

    versionRepository.setActiveSnapshot(newSnapshot.id);

    versionRepository.createOperationLog({
      operationType: 'rollback',
      operator,
      description: `撤回至版本 ${targetSnapshot.name}: ${request.reason}`,
      affectedObjects: [targetSnapshot.id, newSnapshot.id],
      previousSnapshotId: currentActive?.id,
      canUndo: true
    });

    return {
      success: true,
      newSnapshotId: newSnapshot.id,
      affectedCount
    };
  }

  undoOperation(operationLogId: string, operator: string): boolean {
    const log = versionRepository.getOperationLog(operationLogId);
    if (!log || !log.canUndo) {
      return false;
    }

    if (log.previousSnapshotId) {
      versionRepository.setActiveSnapshot(log.previousSnapshotId);
    }

    return versionRepository.undoOperation(operationLogId, log.previousSnapshotId || '');
  }

  listOperationLogs(limit = 100): OperationLog[] {
    return versionRepository.listOperationLogs(limit);
  }

  createSnapshot(
    name: string,
    description: string,
    operator: string
  ): VersionSnapshot {
    const activeSnapshot = versionRepository.getActiveSnapshot();
    const dataVersion = activeSnapshot?.dataVersion || 'v1.0.0';
    const calculationVersion = activeSnapshot?.calculationVersion || '1.0.0';

    const activeVersion = activeSnapshot?.id;
    const dataFiles: string[] = [];

    if (activeVersion) {
      const customers = customerRepository.list(activeVersion);
      const guarantees = guaranteeRepository.findAllContracts(activeVersion);
      
      if (customers.length > 0) {
        dataFiles.push(`客户数据_${customers.length}条`);
      }
      if (guarantees.length > 0) {
        dataFiles.push(`担保合同_${guarantees.length}条`);
      }
    }

    const snapshot = versionRepository.createSnapshot({
      name,
      description,
      createdBy: operator,
      dataVersion,
      calculationVersion,
      dataFiles,
      isActive: true,
      canRollback: true
    });

    versionRepository.createOperationLog({
      operationType: 'create_snapshot',
      operator,
      description: `创建快照: ${name}`,
      affectedObjects: [snapshot.id],
      previousSnapshotId: activeSnapshot?.id,
      canUndo: true
    });

    return snapshot;
  }

  compareVersions(versionId1: string, versionId2: string): {
    added: { type: string; items: any[] };
    removed: { type: string; items: any[] };
    modified: { type: string; items: any[] };
  } {
    const customers1 = new Map(customerRepository.list(versionId1).map(c => [c.id, c]));
    const customers2 = new Map(customerRepository.list(versionId2).map(c => [c.id, c]));
    const guarantees1 = new Map(guaranteeRepository.findAllContracts(versionId1).map(g => [g.id, g]));
    const guarantees2 = new Map(guaranteeRepository.findAllContracts(versionId2).map(g => [g.id, g]));

    const result = {
      added: { type: '', items: [] as any[] },
      removed: { type: '', items: [] as any[] },
      modified: { type: '', items: [] as any[] }
    };

    const allIds = new Set([
      ...customers1.keys(), ...customers2.keys(),
      ...guarantees1.keys(), ...guarantees2.keys()
    ]);

    for (const id of allIds) {
      const c1 = customers1.get(id);
      const c2 = customers2.get(id);
      const g1 = guarantees1.get(id);
      const g2 = guarantees2.get(id);

      if (c1 && !c2) {
        result.removed.items.push({ type: 'customer', item: c1 });
      } else if (!c1 && c2) {
        result.added.items.push({ type: 'customer', item: c2 });
      } else if (c1 && c2 && JSON.stringify(c1) !== JSON.stringify(c2)) {
        result.modified.items.push({ type: 'customer', old: c1, new: c2 });
      }

      if (g1 && !g2) {
        result.removed.items.push({ type: 'guarantee', item: g1 });
      } else if (!g1 && g2) {
        result.added.items.push({ type: 'guarantee', item: g2 });
      } else if (g1 && g2 && JSON.stringify(g1) !== JSON.stringify(g2)) {
        result.modified.items.push({ type: 'guarantee', old: g1, new: g2 });
      }
    }

    return result;
  }
}

export const versionControlService = new VersionControlService();
