import { Conflict, Operation, Client } from './types';

export class ConflictDiagnostic {
  private conflicts: Conflict[] = [];
  private clients: Map<string, Client>;

  constructor(clients: Map<string, Client>) {
    this.clients = clients;
  }

  analyzeConflicts(operations: Operation[]): Conflict[] {
    this.conflicts = [];
    
    this.detectConcurrentInsertions(operations);
    this.detectInvalidDeletes(operations);
    
    return this.conflicts;
  }

  private detectConcurrentInsertions(operations: Operation[]): void {
    const insertGroups: Map<number, Operation[]> = new Map();
    
    for (const op of operations) {
      if (op.type === 'insert') {
        if (!insertGroups.has(op.position)) {
          insertGroups.set(op.position, []);
        }
        insertGroups.get(op.position)!.push(op);
      }
    }
    
    for (const [position, ops] of insertGroups) {
      if (ops.length >= 2) {
        const concurrentGroups = this.groupByTimestamp(ops);
        
        for (const group of concurrentGroups) {
          if (group.length >= 2) {
            for (const op of group) {
              const otherOps = group.filter(o => o.id !== op.id);
              this.conflicts.push({
                type: 'concurrent_insert',
                op,
                description: `Concurrent insert at position ${position} with ${otherOps.length} other operation(s): ${otherOps.map(o => o.id).join(', ')}`,
                affectedClients: [...new Set([op.clientId, ...otherOps.map(o => o.clientId)])]
              });
            }
          }
        }
      }
    }
  }

  private groupByTimestamp(ops: Operation[]): Operation[][] {
    const groups: Operation[][] = [];
    const tolerance = 100;
    
    const sortedOps = [...ops].sort((a, b) => a.timestamp - b.timestamp);
    
    let currentGroup: Operation[] = [];
    for (const op of sortedOps) {
      if (currentGroup.length === 0) {
        currentGroup.push(op);
      } else {
        const firstTimestamp = currentGroup[0].timestamp;
        if (Math.abs(op.timestamp - firstTimestamp) < tolerance) {
          currentGroup.push(op);
        } else {
          groups.push(currentGroup);
          currentGroup = [op];
        }
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  private detectInvalidDeletes(operations: Operation[]): void {
    const deletedPositions = new Set<string>();
    
    for (const op of operations) {
      if (op.type === 'delete') {
        const key = `${op.clientId}-${op.position}-${op.timestamp}`;
        
        if (deletedPositions.has(key)) {
          this.conflicts.push({
            type: 'invalid_delete',
            op,
            description: `Attempted to delete character at position ${op.position} which was already deleted`,
            affectedClients: [op.clientId]
          });
        }
        
        deletedPositions.add(key);
      }
    }
  }

  getConflictDetails(conflict: Conflict): string {
    const clientNames = conflict.affectedClients
      .map(id => this.clients.get(id)?.name || id)
      .join(', ');
    
    switch (conflict.type) {
      case 'concurrent_insert':
        return `**冲突类型**: 并发插入\n**描述**: ${conflict.description}\n**涉及客户端**: ${clientNames}\n**操作ID**: ${conflict.op.id}`;
      case 'invalid_delete':
        return `**冲突类型**: 无效删除\n**描述**: ${conflict.description}\n**涉及客户端**: ${clientNames}\n**操作ID**: ${conflict.op.id}`;
      case 'undo_not_found':
        return `**冲突类型**: 撤销目标不存在\n**描述**: ${conflict.description}\n**涉及客户端**: ${clientNames}\n**操作ID**: ${conflict.op.id}`;
      default:
        return `**冲突类型**: 未知\n**描述**: ${conflict.description}`;
    }
  }

  getConflictSummary(): { concurrentInsert: number; invalidDelete: number; undoNotFound: number } {
    return {
      concurrentInsert: this.conflicts.filter(c => c.type === 'concurrent_insert').length,
      invalidDelete: this.conflicts.filter(c => c.type === 'invalid_delete').length,
      undoNotFound: this.conflicts.filter(c => c.type === 'undo_not_found').length
    };
  }
}