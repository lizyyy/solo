import { LogParser } from './log-parser';
import * as fs from 'fs';

describe('LogParser', () => {
  const tempDir = '/tmp/crdt-test';

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('parseClients', () => {
    it('should parse valid clients.json', () => {
      const clientsPath = `${tempDir}/clients.json`;
      fs.writeFileSync(clientsPath, JSON.stringify([
        { id: 'client1', name: 'Alice', color: '#ff0000' },
        { id: 'client2', name: 'Bob', color: '#00ff00' }
      ]));

      const clients = LogParser.parseClients(clientsPath);

      expect(clients.length).toBe(2);
      expect(clients[0].id).toBe('client1');
      expect(clients[0].name).toBe('Alice');
      expect(clients[1].id).toBe('client2');
      expect(clients[1].name).toBe('Bob');
    });

    it('should throw error for invalid JSON', () => {
      const clientsPath = `${tempDir}/invalid-clients.json`;
      fs.writeFileSync(clientsPath, 'invalid json');

      expect(() => LogParser.parseClients(clientsPath)).toThrow();
    });

    it('should throw error for duplicate client ids', () => {
      const clientsPath = `${tempDir}/duplicate-clients.json`;
      fs.writeFileSync(clientsPath, JSON.stringify([
        { id: 'client1', name: 'Alice', color: '#ff0000' },
        { id: 'client1', name: 'Bob', color: '#00ff00' }
      ]));

      expect(() => LogParser.parseClients(clientsPath)).toThrow('Duplicate client id');
    });
  });

  describe('parseOperations', () => {
    it('should parse valid ops.jsonl', () => {
      const opsPath = `${tempDir}/ops.jsonl`;
      fs.writeFileSync(opsPath, [
        JSON.stringify({ id: 'op1', clientId: 'client1', timestamp: 1000, type: 'insert', position: 0, char: 'a' }),
        JSON.stringify({ id: 'op2', clientId: 'client2', timestamp: 2000, type: 'delete', position: 0 })
      ].join('\n'));

      const ops = LogParser.parseOperations(opsPath);

      expect(ops.length).toBe(2);
      expect(ops[0].id).toBe('op1');
      expect(ops[0].type).toBe('insert');
      expect(ops[1].id).toBe('op2');
      expect(ops[1].type).toBe('delete');
    });

    it('should sort operations by timestamp', () => {
      const opsPath = `${tempDir}/unsorted-ops.jsonl`;
      fs.writeFileSync(opsPath, [
        JSON.stringify({ id: 'op2', clientId: 'client1', timestamp: 2000, type: 'insert', position: 0, char: 'b' }),
        JSON.stringify({ id: 'op1', clientId: 'client1', timestamp: 1000, type: 'insert', position: 0, char: 'a' })
      ].join('\n'));

      const ops = LogParser.parseOperations(opsPath);

      expect(ops[0].timestamp).toBe(1000);
      expect(ops[1].timestamp).toBe(2000);
    });

    it('should throw error for invalid operation type', () => {
      const opsPath = `${tempDir}/invalid-type.jsonl`;
      fs.writeFileSync(opsPath, JSON.stringify({ id: 'op1', clientId: 'client1', timestamp: 1000, type: 'unknown', position: 0 }));

      expect(() => LogParser.parseOperations(opsPath)).toThrow('Invalid operation type');
    });
  });

  describe('readInitialDocument', () => {
    it('should read initial document content', () => {
      const docPath = `${tempDir}/initial.txt`;
      fs.writeFileSync(docPath, 'Hello World');

      const content = LogParser.readInitialDocument(docPath);

      expect(content).toBe('Hello World');
    });
  });
});