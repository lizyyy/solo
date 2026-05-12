import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';

export const recordBusinessHistory = (
  businessType: string,
  businessId: string,
  action: string,
  operatorId: string,
  operatorName: string,
  beforeData?: any,
  afterData?: any,
  remark?: string
) => {
  return new Promise<void>((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.run(
      `INSERT INTO business_history (id, business_type, business_id, action, operator_id, operator_name, before_data, after_data, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        businessType,
        businessId,
        action,
        operatorId,
        operatorName,
        beforeData ? JSON.stringify(beforeData) : null,
        afterData ? JSON.stringify(afterData) : null,
        remark || null,
        now
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};
