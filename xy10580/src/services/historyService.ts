import { dbPrepare, generateId } from '../db/database';
import { AppealHistory, AppealStatus } from '../types';

export async function addHistory(
  orderNo: string,
  appealId: string,
  action: string,
  details?: string,
  operator?: string,
  fromStatus?: AppealStatus,
  toStatus?: AppealStatus
): Promise<void> {
  const history: AppealHistory = {
    id: generateId(),
    orderNo,
    appealId,
    action,
    operator,
    fromStatus,
    toStatus,
    details,
    createTime: Date.now(),
  };

  const stmt = await dbPrepare(`
    INSERT INTO appeal_histories (
      id, order_no, appeal_id, action, operator,
      from_status, to_status, details, create_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  await stmt.run(
    history.id,
    history.orderNo,
    history.appealId,
    history.action,
    history.operator,
    history.fromStatus,
    history.toStatus,
    history.details,
    history.createTime
  );
}

export async function getHistoryByOrderNo(orderNo: string): Promise<AppealHistory[]> {
  const stmt = await dbPrepare(`
    SELECT 
      id, order_no as orderNo, appeal_id as appealId,
      action, operator, from_status as fromStatus,
      to_status as toStatus, details, create_time as createTime
    FROM appeal_histories
    WHERE order_no = ?
    ORDER BY create_time ASC
  `);
  
  const rows = await stmt.all(orderNo);
  return rows as AppealHistory[];
}

export async function getHistoryByAppealId(appealId: string): Promise<AppealHistory[]> {
  const stmt = await dbPrepare(`
    SELECT 
      id, order_no as orderNo, appeal_id as appealId,
      action, operator, from_status as fromStatus,
      to_status as toStatus, details, create_time as createTime
    FROM appeal_histories
    WHERE appeal_id = ?
    ORDER BY create_time ASC
  `);
  
  const rows = await stmt.all(appealId);
  return rows as AppealHistory[];
}
