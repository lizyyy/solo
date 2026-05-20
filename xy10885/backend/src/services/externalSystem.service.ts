import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, allQuery } from '../database';
import { ExternalSystem } from '../models/types';
import { createOperationLog } from './operationLog.service';

export async function createExternalSystem(systemData: {
  name: string;
  code: string;
  config?: string;
}): Promise<ExternalSystem> {
  const id = uuidv4();
  
  try {
    await runQuery(
      `INSERT INTO external_systems (id, name, code, config, status) VALUES (?, ?, ?, ?, 'active')`,
      [id, systemData.name, systemData.code, systemData.config || null]
    );
    
    const system = await getQuery('SELECT * FROM external_systems WHERE id = ?', [id]);
    
    await createOperationLog({
      operation_type: 'create_external_system',
      entity_type: 'external_system',
      entity_id: id,
      after_state: system,
      result: 'success'
    });
    
    return system;
  } catch (error: any) {
    await createOperationLog({
      operation_type: 'create_external_system',
      entity_type: 'external_system',
      entity_id: id,
      result: 'failed',
      error_message: error.message
    });
    throw error;
  }
}

export async function getExternalSystemById(id: string): Promise<ExternalSystem | null> {
  return getQuery('SELECT * FROM external_systems WHERE id = ?', [id]);
}

export async function getExternalSystems(params: {
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  let whereConditions: string[] = [];
  let queryParams: any[] = [];
  
  if (params.status) {
    whereConditions.push('status = ?');
    queryParams.push(params.status);
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  const countResult = await getQuery(
    `SELECT COUNT(*) as total FROM external_systems ${whereClause}`,
    queryParams
  );
  
  const data = await allQuery(
    `SELECT * FROM external_systems ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );
  
  return {
    data,
    total: countResult.total,
    page,
    pageSize
  };
}

export async function updateExternalSystemStatus(id: string, status: 'active' | 'inactive', operator?: { id: string; name: string }) {
  const system = await getExternalSystemById(id);
  if (!system) throw new Error('外部系统不存在');
  
  const beforeState = { ...system };
  
  await runQuery(
    'UPDATE external_systems SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );
  
  const updatedSystem = await getExternalSystemById(id);
  
  await createOperationLog({
    operation_type: 'update_system_status',
    entity_type: 'external_system',
    entity_id: id,
    operator_id: operator?.id,
    operator_name: operator?.name,
    before_state: beforeState,
    after_state: updatedSystem,
    result: 'success'
  });
  
  return updatedSystem;
}
