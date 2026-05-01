import * as fs from 'fs';
import { Client, Operation } from './types';

export class LogParser {
  static parseClients(filePath: string): Client[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const clients = JSON.parse(content) as Client[];
      
      this.validateClients(clients);
      return clients;
    } catch (error) {
      throw new Error(`Failed to parse clients.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static parseOperations(filePath: string): Operation[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const operations: Operation[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        try {
          const op = JSON.parse(lines[i]) as Operation;
          this.validateOperation(op, i + 1);
          operations.push(op);
        } catch (error) {
          throw new Error(`Invalid JSON on line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      return operations.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      throw new Error(`Failed to parse ops.jsonl: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static readInitialDocument(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read initial document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static validateClients(clients: Client[]): void {
    if (!Array.isArray(clients)) {
      throw new Error('clients.json must contain an array');
    }
    
    const ids = new Set<string>();
    for (const client of clients) {
      if (!client.id || typeof client.id !== 'string') {
        throw new Error('Client must have a valid id');
      }
      if (ids.has(client.id)) {
        throw new Error(`Duplicate client id: ${client.id}`);
      }
      ids.add(client.id);
    }
  }

  private static validateOperation(op: Operation, lineNumber: number): void {
    if (!op.id || typeof op.id !== 'string') {
      throw new Error(`Line ${lineNumber}: Operation must have a valid id`);
    }
    if (!op.clientId || typeof op.clientId !== 'string') {
      throw new Error(`Line ${lineNumber}: Operation must have a valid clientId`);
    }
    if (typeof op.timestamp !== 'number') {
      throw new Error(`Line ${lineNumber}: Operation must have a valid timestamp`);
    }
    if (!['insert', 'delete', 'undo'].includes(op.type)) {
      throw new Error(`Line ${lineNumber}: Invalid operation type: ${op.type}`);
    }
    if (typeof op.position !== 'number' || op.position < 0) {
      throw new Error(`Line ${lineNumber}: Invalid position: ${op.position}`);
    }
    if (op.type === 'insert' && (!op.char || typeof op.char !== 'string' || op.char.length !== 1)) {
      throw new Error(`Line ${lineNumber}: Insert operation must have a single character`);
    }
    if (op.type === 'undo' && !op.targetOpId) {
      throw new Error(`Line ${lineNumber}: Undo operation must have a targetOpId`);
    }
  }
}