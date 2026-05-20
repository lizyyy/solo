import fs from 'fs';
import csv from 'csv-parser';
import { runQuery, getQuery } from '../database';
import { createOperationLog } from './operationLog.service';

export async function importSlotsFromCsv(filePath: string, operator?: { id: string; name: string }) {
  const results: any[] = [];
  const errors: any[] = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let successCount = 0;
          
          for (const row of results) {
            try {
              const existing = await getQuery(
                'SELECT * FROM department_slots WHERE department_id = ? AND external_system_id = ? AND date = ? AND time_slot = ?',
                [row.department_id, row.external_system_id, row.date, row.time_slot]
              );
              
              if (existing) {
                await runQuery(
                  'UPDATE department_slots SET total_count = ?, available_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  [parseInt(row.total_count), parseInt(row.total_count) - existing.locked_count, existing.id]
                );
              } else {
                const { v4: uuidv4 } = await import('uuid');
                const id = uuidv4();
                await runQuery(
                  `INSERT INTO department_slots (
                    id, department_id, department_name, external_system_id, date, time_slot,
                    total_count, available_count, locked_count, status
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'available')`,
                  [
                    id,
                    row.department_id,
                    row.department_name,
                    row.external_system_id,
                    row.date,
                    row.time_slot,
                    parseInt(row.total_count),
                    parseInt(row.total_count)
                  ]
                );
              }
              successCount++;
            } catch (error: any) {
              errors.push({ row, error: error.message });
            }
          }
          
          await createOperationLog({
            operation_type: 'import_slots',
            entity_type: 'slot',
            entity_id: 'batch',
            operator_id: operator?.id,
            operator_name: operator?.name,
            after_state: { imported: successCount, failed: errors.length },
            result: 'success'
          });
          
          resolve({ success: successCount, failed: errors.length, errors });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}
