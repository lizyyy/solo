import { CRDTState } from './crdt-state';
import { Client } from './types';

describe('CRDTState', () => {
  const clients = new Map<string, Client>([
    ['client1', { id: 'client1', name: 'Alice', color: '#ff0000' }],
    ['client2', { id: 'client2', name: 'Bob', color: '#00ff00' }]
  ]);

  it('should initialize with initial document', () => {
    const crdt = new CRDTState('Hello', clients);
    expect(crdt.getFinalDocument()).toBe('Hello');
  });

  it('should handle insert operations', () => {
    const crdt = new CRDTState('Hello', clients);
    
    crdt.applyOperation({
      id: 'op1',
      clientId: 'client1',
      timestamp: 1000,
      type: 'insert',
      position: 5,
      char: '!'
    });

    expect(crdt.getFinalDocument()).toBe('Hello!');
  });

  it('should handle delete operations', () => {
    const crdt = new CRDTState('Hello', clients);
    
    crdt.applyOperation({
      id: 'op1',
      clientId: 'client1',
      timestamp: 1000,
      type: 'delete',
      position: 4
    });

    expect(crdt.getFinalDocument()).toBe('Hell');
  });

  it('should detect concurrent insertions', () => {
    const crdt = new CRDTState('Hi', clients);
    
    crdt.applyOperation({
      id: 'op1',
      clientId: 'client1',
      timestamp: 1000,
      type: 'insert',
      position: 2,
      char: 'A'
    });
    
    crdt.applyOperation({
      id: 'op2',
      clientId: 'client2',
      timestamp: 1050,
      type: 'insert',
      position: 2,
      char: 'B'
    });

    const conflicts = crdt.getConflicts();
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.some(c => c.type === 'concurrent_insert')).toBe(true);
  });

  it('should detect invalid delete', () => {
    const crdt = new CRDTState('Hi', clients);
    
    crdt.applyOperation({
      id: 'op1',
      clientId: 'client1',
      timestamp: 1000,
      type: 'delete',
      position: 5
    });

    const conflicts = crdt.getConflicts();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe('invalid_delete');
  });

  it('should handle undo operations', () => {
    const crdt = new CRDTState('Hi', clients);
    
    crdt.applyOperation({
      id: 'op1',
      clientId: 'client1',
      timestamp: 1000,
      type: 'insert',
      position: 2,
      char: '!'
    });
    
    crdt.applyOperation({
      id: 'op2',
      clientId: 'client1',
      timestamp: 2000,
      type: 'undo',
      position: 0,
      targetOpId: 'op1'
    });

    expect(crdt.getFinalDocument()).toBe('Hi');
  });
});