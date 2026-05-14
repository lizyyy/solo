import { v4 as uuidv4 } from 'uuid';
import {
  CsvTemplate,
  ApiMapping,
  SyncBatch,
  SyncRow,
  SyncStatus,
  RowStatus
} from '../types';

class MemoryStore {
  private templates: Map<string, CsvTemplate> = new Map();
  private mappings: Map<string, ApiMapping> = new Map();
  private batches: Map<string, SyncBatch> = new Map();
  private rows: Map<string, SyncRow> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const templateId = uuidv4();
    const now = new Date();

    this.templates.set(templateId, {
      id: templateId,
      name: '用户注册模板',
      description: '用于批量用户注册的CSV模板',
      columns: ['姓名', '邮箱', '手机号', '部门', '角色'],
      createdAt: now,
      updatedAt: now
    });

    const mappingId = uuidv4();
    this.mappings.set(mappingId, {
      id: mappingId,
      name: '用户注册API映射',
      templateId,
      endpoint: 'https://jsonplaceholder.typicode.com/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      fieldMappings: [
        { csvField: '姓名', apiField: 'name', required: true },
        { csvField: '邮箱', apiField: 'email', required: true },
        { csvField: '手机号', apiField: 'phone', required: true },
        { csvField: '部门', apiField: 'company.name' },
        { csvField: '角色', apiField: 'website' }
      ],
      validationRules: [
        { field: '邮箱', type: 'regex', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: '邮箱格式不正确' },
        { field: '手机号', type: 'regex', pattern: '^1[3-9]\\d{9}$', errorMessage: '手机号格式不正确' },
        { field: '角色', type: 'enum', values: ['管理员', '普通用户', '访客'], errorMessage: '角色必须是管理员、普通用户或访客' }
      ],
      batchSize: 10,
      createdAt: now,
      updatedAt: now
    });
  }

  getTemplate(id: string): CsvTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): CsvTemplate[] {
    return Array.from(this.templates.values());
  }

  createTemplate(template: Omit<CsvTemplate, 'id' | 'createdAt' | 'updatedAt'>): CsvTemplate {
    const id = uuidv4();
    const now = new Date();
    const newTemplate: CsvTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  getMapping(id: string): ApiMapping | undefined {
    return this.mappings.get(id);
  }

  getAllMappings(): ApiMapping[] {
    return Array.from(this.mappings.values());
  }

  createMapping(mapping: Omit<ApiMapping, 'id' | 'createdAt' | 'updatedAt'>): ApiMapping {
    const id = uuidv4();
    const now = new Date();
    const newMapping: ApiMapping = {
      ...mapping,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.mappings.set(id, newMapping);
    return newMapping;
  }

  getBatch(id: string): SyncBatch | undefined {
    return this.batches.get(id);
  }

  getBatches(options: {
    page?: number;
    pageSize?: number;
    status?: SyncStatus;
    mappingId?: string;
  }): { batches: SyncBatch[]; total: number } {
    let result = Array.from(this.batches.values());

    if (options.status) {
      result = result.filter(b => b.status === options.status);
    }
    if (options.mappingId) {
      result = result.filter(b => b.mappingId === options.mappingId);
    }

    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = result.length;
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      batches: result.slice(start, end),
      total
    };
  }

  createBatch(batch: Omit<SyncBatch, 'id' | 'createdAt' | 'updatedAt'>): SyncBatch {
    const id = uuidv4();
    const now = new Date();
    const newBatch: SyncBatch = {
      ...batch,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.batches.set(id, newBatch);
    return newBatch;
  }

  updateBatch(id: string, updates: Partial<SyncBatch>): SyncBatch | undefined {
    const batch = this.batches.get(id);
    if (!batch) return undefined;

    const updatedBatch = {
      ...batch,
      ...updates,
      updatedAt: new Date()
    };
    this.batches.set(id, updatedBatch);
    return updatedBatch;
  }

  getRowsByBatchId(batchId: string): SyncRow[] {
    return Array.from(this.rows.values())
      .filter(r => r.batchId === batchId)
      .sort((a, b) => a.rowNumber - b.rowNumber);
  }

  getRow(id: string): SyncRow | undefined {
    return this.rows.get(id);
  }

  createRows(rows: Omit<SyncRow, 'id' | 'createdAt' | 'updatedAt'>[]): SyncRow[] {
    const now = new Date();
    return rows.map(row => {
      const id = uuidv4();
      const newRow: SyncRow = {
        ...row,
        id,
        createdAt: now,
        updatedAt: now
      };
      this.rows.set(id, newRow);
      return newRow;
    });
  }

  updateRow(id: string, updates: Partial<SyncRow>): SyncRow | undefined {
    const row = this.rows.get(id);
    if (!row) return undefined;

    const updatedRow = {
      ...row,
      ...updates,
      updatedAt: new Date()
    };
    this.rows.set(id, updatedRow);
    return updatedRow;
  }
}

export const store = new MemoryStore();
