import { Operation, RGACharacter, Conflict, Client } from './types';

export class CRDTState {
  private characters: RGACharacter[] = [];
  private charIdMap: Map<string, RGACharacter> = new Map();
  private operationMap: Map<string, Operation> = new Map();
  private undoMap: Map<string, string> = new Map();
  private conflicts: Conflict[] = [];
  private clients: Map<string, Client>;

  constructor(initialDocument: string, clients: Map<string, Client>) {
    this.clients = clients;
    this.initializeFromDocument(initialDocument);
  }

  private initializeFromDocument(document: string): void {
    for (let i = 0; i < document.length; i++) {
      const char: RGACharacter = {
        id: `init-${i}`,
        char: document[i],
        prevId: i === 0 ? null : `init-${i - 1}`,
        nextId: i === document.length - 1 ? null : `init-${i + 1}`,
        deleted: false,
        clientId: 'initial',
        timestamp: 0
      };
      this.characters.push(char);
      this.charIdMap.set(char.id, char);
    }
  }

  applyOperation(op: Operation): void {
    this.operationMap.set(op.id, op);
    
    switch (op.type) {
      case 'insert':
        this.applyInsert(op);
        break;
      case 'delete':
        this.applyDelete(op);
        break;
      case 'undo':
        this.applyUndo(op);
        break;
    }
  }

  private applyInsert(op: Operation): void {
    if (!op.char) return;
    
    const targetIndex = this.findVisibleIndex(op.position);
    const prevChar = targetIndex === 0 ? null : this.getNthVisibleCharacter(targetIndex - 1);
    const nextChar = targetIndex < this.getVisibleLength() ? this.getNthVisibleCharacter(targetIndex) : null;
    
    const newChar: RGACharacter = {
      id: op.id,
      char: op.char,
      prevId: prevChar?.id || null,
      nextId: nextChar?.id || null,
      deleted: false,
      clientId: op.clientId,
      timestamp: op.timestamp
    };
    
    if (prevChar) {
      prevChar.nextId = op.id;
    }
    if (nextChar) {
      nextChar.prevId = op.id;
    }
    
    this.characters.push(newChar);
    this.charIdMap.set(op.id, newChar);
    
    const concurrentOps = this.findConcurrentInsertions(op.position, op.timestamp);
    if (concurrentOps.length > 0) {
      this.conflicts.push({
        type: 'concurrent_insert',
        op,
        description: `Concurrent insertion at position ${op.position} with operations: ${concurrentOps.map(o => o.id).join(', ')}`,
        affectedClients: [op.clientId, ...concurrentOps.map(o => o.clientId)]
      });
    }
  }

  private applyDelete(op: Operation): void {
    const targetIndex = this.findVisibleIndex(op.position);
    
    if (targetIndex >= this.getVisibleLength()) {
      this.conflicts.push({
        type: 'invalid_delete',
        op,
        description: `Invalid delete at position ${op.position} - position exceeds document length`,
        affectedClients: [op.clientId]
      });
      return;
    }
    
    const targetChar = this.getNthVisibleCharacter(targetIndex);
    if (!targetChar) {
      this.conflicts.push({
        type: 'invalid_delete',
        op,
        description: `Character not found at position ${op.position}`,
        affectedClients: [op.clientId]
      });
      return;
    }
    
    if (targetChar.deleted) {
      this.conflicts.push({
        type: 'invalid_delete',
        op,
        description: `Attempted to delete already deleted character at position ${op.position}`,
        affectedClients: [op.clientId]
      });
      return;
    }
    
    targetChar.deleted = true;
    
    const prevChar = targetChar.prevId ? this.charIdMap.get(targetChar.prevId) : null;
    const nextChar = targetChar.nextId ? this.charIdMap.get(targetChar.nextId) : null;
    
    if (prevChar) {
      prevChar.nextId = targetChar.nextId;
    }
    if (nextChar) {
      nextChar.prevId = targetChar.prevId;
    }
  }

  private applyUndo(op: Operation): void {
    if (!op.targetOpId) return;
    
    const targetOp = this.operationMap.get(op.targetOpId);
    if (!targetOp) {
      this.conflicts.push({
        type: 'undo_not_found',
        op,
        description: `Undo target operation ${op.targetOpId} not found`,
        affectedClients: [op.clientId]
      });
      return;
    }
    
    if (this.undoMap.has(op.targetOpId)) {
      return;
    }
    
    this.undoMap.set(op.targetOpId, op.id);
    
    switch (targetOp.type) {
      case 'insert':
        const insertedChar = this.charIdMap.get(targetOp.id);
        if (insertedChar && !insertedChar.deleted) {
          insertedChar.deleted = true;
          const prevChar = insertedChar.prevId ? this.charIdMap.get(insertedChar.prevId) : null;
          const nextChar = insertedChar.nextId ? this.charIdMap.get(insertedChar.nextId) : null;
          if (prevChar) prevChar.nextId = insertedChar.nextId;
          if (nextChar) nextChar.prevId = insertedChar.prevId;
        }
        break;
      case 'delete':
        const deletedChar = this.charIdMap.get(targetOp.id);
        if (deletedChar && deletedChar.deleted) {
          deletedChar.deleted = false;
          const prevChar = deletedChar.prevId ? this.charIdMap.get(deletedChar.prevId) : null;
          const nextChar = deletedChar.nextId ? this.charIdMap.get(deletedChar.nextId) : null;
          if (prevChar) prevChar.nextId = deletedChar.id;
          if (nextChar) nextChar.prevId = deletedChar.id;
        }
        break;
    }
  }

  private findVisibleIndex(position: number): number {
    let count = 0;
    for (const char of this.characters) {
      if (!char.deleted) {
        if (count === position) return this.characters.indexOf(char);
        count++;
      }
    }
    return this.characters.length;
  }

  private getNthVisibleCharacter(n: number): RGACharacter | undefined {
    let count = 0;
    for (const char of this.characters) {
      if (!char.deleted) {
        if (count === n) return char;
        count++;
      }
    }
    return undefined;
  }

  private getVisibleLength(): number {
    return this.characters.filter(c => !c.deleted).length;
  }

  private findConcurrentInsertions(position: number, timestamp: number): Operation[] {
    const concurrentOps: Operation[] = [];
    let tolerance = 100;
    
    for (const [, op] of this.operationMap) {
      if (op.type === 'insert' && 
          op.id !== this.operationMap.keys().next().value &&
          Math.abs(op.timestamp - timestamp) < tolerance) {
        const opIndex = this.findVisibleIndex(op.position);
        if (Math.abs(opIndex - position) <= 1) {
          concurrentOps.push(op);
        }
      }
    }
    
    return concurrentOps;
  }

  getFinalDocument(): string {
    return this.characters
      .filter(c => !c.deleted)
      .sort((a, b) => {
        if (!a.prevId) return -1;
        if (!b.prevId) return 1;
        return a.timestamp - b.timestamp;
      })
      .map(c => c.char)
      .join('');
  }

  getConflicts(): Conflict[] {
    return this.conflicts;
  }
}