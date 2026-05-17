import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import {
  PriceList,
  PriceListStatus,
  StorePriceStatus,
  CreatePriceListRequest,
  UpdatePriceListRequest,
  ApproveRequest,
  ConflictInfo,
  PriceListStore,
  PriceListItem,
  PriceListHistory,
  Store
} from '../types';

export class PriceListService {
  private generateVersion(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `V${dateStr}-${random}`;
  }

  private recordHistory(
    priceListId: string,
    action: string,
    actionBy: string,
    actionByName: string,
    remark?: string,
    oldStatus?: string,
    newStatus?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO price_list_history (id, price_list_id, action, action_by, action_by_name, remark, old_status, new_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), priceListId, action, actionBy, actionByName, remark || null, oldStatus || null, newStatus || null],
        (err) => (err ? reject(err) : resolve())
      );
    });
  }

  private checkStoreConflicts(storeIds: string[], excludePriceListId?: string): Promise<ConflictInfo[]> {
    return new Promise((resolve, reject) => {
      const placeholders = storeIds.map(() => '?').join(',');
      const params = excludePriceListId
        ? [...storeIds, excludePriceListId]
        : storeIds;
      
      const sql = excludePriceListId
        ? `SELECT s.id as store_id, s.code as store_code, s.name as store_name
           FROM stores s
           INNER JOIN price_list_stores pls ON s.id = pls.store_id
           INNER JOIN price_lists pl ON pls.price_list_id = pl.id
           WHERE s.id IN (${placeholders}) 
           AND pl.status IN ('pending_effective', 'effective')
           AND pl.id != ?`
        : `SELECT s.id as store_id, s.code as store_code, s.name as store_name
           FROM stores s
           INNER JOIN price_list_stores pls ON s.id = pls.store_id
           INNER JOIN price_lists pl ON pls.price_list_id = pl.id
           WHERE s.id IN (${placeholders}) 
           AND pl.status IN ('pending_effective', 'effective')`;

      db.all(sql, params, (err, rows: any[]) => {
        if (err) return reject(err);
        
        const conflicts: ConflictInfo[] = rows.map(row => ({
          store_code: row.store_code,
          store_name: row.store_name,
          conflict_reason: `门店【${row.store_name}】已有生效中的价目表，存在价格冲突`,
          required_materials: [
            '门店价格调整审批单',
            '与原供应商终止合作协议',
            '价格差异说明文档'
          ]
        }));
        
        resolve(conflicts);
      });
    });
  }

  async createPriceList(req: CreatePriceListRequest): Promise<{ success: boolean; data?: PriceList; conflicts?: ConflictInfo[]; next_steps?: string[] }> {
    const id = uuidv4();
    const version = this.generateVersion();

    const conflicts = await this.checkStoreConflicts(req.store_ids);
    
    if (conflicts.length > 0) {
      return {
        success: false,
        conflicts,
        next_steps: [
          '请针对冲突门店补充所需材料后重新提交',
          '或移除冲突门店后单独创建价目表',
          '如需强制覆盖，请联系运营总监审批'
        ]
      };
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `INSERT INTO price_lists (id, version, name, description, status, effective_time, created_by, created_by_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, version, req.name, req.description || null, PriceListStatus.DRAFT, req.effective_time || null, req.created_by, req.created_by_name],
          async (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            try {
              for (const storeId of req.store_ids) {
                const store: any = await new Promise((res, rej) => {
                  db.get('SELECT id, code, name FROM stores WHERE id = ?', [storeId], (e, r) => e ? rej(e) : res(r));
                });
                
                db.run(
                  `INSERT INTO price_list_stores (id, price_list_id, store_id, store_code, store_name, status)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [uuidv4(), id, storeId, store.code, store.name, StorePriceStatus.PENDING]
                );
              }

              for (const item of req.items) {
                db.run(
                  `INSERT INTO price_list_items (id, price_list_id, sku_code, sku_name, original_price, sale_price)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [uuidv4(), id, item.sku_code, item.sku_name, item.original_price, item.sale_price]
                );
              }

              await this.recordHistory(id, '创建', req.created_by, req.created_by_name, '创建价目表草稿', undefined, PriceListStatus.DRAFT);

              db.run('COMMIT', async (commitErr) => {
                if (commitErr) {
                  db.run('ROLLBACK');
                  return reject(commitErr);
                }

                const created = await this.getPriceListById(id);
                resolve({ success: true, data: created });
              });
            } catch (e) {
              db.run('ROLLBACK');
              reject(e);
            }
          }
        );
      });
    });
  }

  async updatePriceList(id: string, req: UpdatePriceListRequest, operatorId: string, operatorName: string): Promise<{ success: boolean; data?: PriceList; conflicts?: ConflictInfo[]; next_steps?: string[] }> {
    const priceList = await this.getPriceListById(id);
    if (!priceList) {
      return { success: false };
    }

    if (priceList.status !== PriceListStatus.DRAFT) {
      return { success: false };
    }

    if (req.store_ids) {
      const conflicts = await this.checkStoreConflicts(req.store_ids, id);
      if (conflicts.length > 0) {
        return {
          success: false,
          conflicts,
          next_steps: [
            '请针对冲突门店补充所需材料后重新提交',
            '或移除冲突门店后单独创建价目表',
            '如需强制覆盖，请联系运营总监审批'
          ]
        };
      }
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const updates: string[] = [];
        const params: any[] = [];

        if (req.name !== undefined) { updates.push('name = ?'); params.push(req.name); }
        if (req.description !== undefined) { updates.push('description = ?'); params.push(req.description || null); }
        if (req.effective_time !== undefined) { updates.push('effective_time = ?'); params.push(req.effective_time || null); }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        db.run(
          `UPDATE price_lists SET ${updates.join(', ')} WHERE id = ?`,
          params,
          async (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            try {
              if (req.store_ids) {
                db.run('DELETE FROM price_list_stores WHERE price_list_id = ?', [id]);
                
                for (const storeId of req.store_ids) {
                  const store: any = await new Promise((res, rej) => {
                    db.get('SELECT id, code, name FROM stores WHERE id = ?', [storeId], (e, r) => e ? rej(e) : res(r));
                  });
                  
                  db.run(
                    `INSERT INTO price_list_stores (id, price_list_id, store_id, store_code, store_name, status)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), id, storeId, store.code, store.name, StorePriceStatus.PENDING]
                  );
                }
              }

              if (req.items) {
                db.run('DELETE FROM price_list_items WHERE price_list_id = ?', [id]);
                
                for (const item of req.items) {
                  db.run(
                    `INSERT INTO price_list_items (id, price_list_id, sku_code, sku_name, original_price, sale_price)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), id, item.sku_code, item.sku_name, item.original_price, item.sale_price]
                  );
                }
              }

              await this.recordHistory(id, '修改', operatorId, operatorName, '修改价目表信息');

              db.run('COMMIT', async (commitErr) => {
                if (commitErr) {
                  db.run('ROLLBACK');
                  return reject(commitErr);
                }

                const updated = await this.getPriceListById(id);
                resolve({ success: true, data: updated });
              });
            } catch (e) {
              db.run('ROLLBACK');
              reject(e);
            }
          }
        );
      });
    });
  }

  async submitForApproval(id: string, operatorId: string, operatorName: string): Promise<{ success: boolean; data?: PriceList }> {
    const priceList = await this.getPriceListById(id);
    if (!priceList || priceList.status !== PriceListStatus.DRAFT) {
      return { success: false };
    }

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE price_lists SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [PriceListStatus.PENDING_EFFECTIVE, id],
        async (err) => {
          if (err) return reject(err);
          
          await this.recordHistory(id, '提交审核', operatorId, operatorName, '提交审核，等待生效', PriceListStatus.DRAFT, PriceListStatus.PENDING_EFFECTIVE);
          
          const updated = await this.getPriceListById(id);
          resolve({ success: true, data: updated });
        }
      );
    });
  }

  async approvePriceList(id: string, req: ApproveRequest): Promise<{ success: boolean; data?: PriceList }> {
    const priceList = await this.getPriceListById(id);
    if (!priceList || priceList.status !== PriceListStatus.PENDING_EFFECTIVE) {
      return { success: false };
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE price_lists SET status = ?, approver_id = ?, approver_name = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [PriceListStatus.EFFECTIVE, req.approver_id, req.approver_name, id],
          async (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            db.run(
              `UPDATE price_list_stores SET status = ? WHERE price_list_id = ?`,
              [StorePriceStatus.EFFECTIVE, id]
            );

            await this.recordHistory(id, '审核通过', req.approver_id, req.approver_name, req.remark || '审核通过，价目表已生效', PriceListStatus.PENDING_EFFECTIVE, PriceListStatus.EFFECTIVE);

            db.run('COMMIT', async (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                return reject(commitErr);
              }

              const updated = await this.getPriceListById(id);
              resolve({ success: true, data: updated });
            });
          }
        );
      });
    });
  }

  async rollbackPriceList(id: string, operatorId: string, operatorName: string, remark?: string): Promise<{ success: boolean; data?: PriceList }> {
    const priceList = await this.getPriceListById(id);
    if (!priceList || priceList.status !== PriceListStatus.EFFECTIVE) {
      return { success: false };
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE price_lists SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [PriceListStatus.ROLLED_BACK, id],
          async (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            db.run(
              `UPDATE price_list_stores SET status = ? WHERE price_list_id = ?`,
              [StorePriceStatus.PENDING, id]
            );

            await this.recordHistory(id, '撤回', operatorId, operatorName, remark || '价目表已撤回', PriceListStatus.EFFECTIVE, PriceListStatus.ROLLED_BACK);

            db.run('COMMIT', async (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                return reject(commitErr);
              }

              const updated = await this.getPriceListById(id);
              resolve({ success: true, data: updated });
            });
          }
        );
      });
    });
  }

  getPriceListById(id: string): Promise<PriceList | undefined> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM price_lists WHERE id = ?', [id], (err, row: any) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  async getPriceListDetail(id: string): Promise<{ success: boolean; data?: any }> {
    const priceList = await this.getPriceListById(id);
    if (!priceList) {
      return { success: false };
    }
    const stores = await this.getPriceListStores(id);
    const items = await this.getPriceListItems(id);
    const history = await this.getPriceListHistory(id);
    return {
      success: true,
      data: { ...priceList, stores, items, history }
    };
  }

  getPriceListStores(priceListId: string): Promise<PriceListStore[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM price_list_stores WHERE price_list_id = ?', [priceListId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows as PriceListStore[]);
      });
    });
  }

  getPriceListItems(priceListId: string): Promise<PriceListItem[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM price_list_items WHERE price_list_id = ?', [priceListId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows as PriceListItem[]);
      });
    });
  }

  getPriceListHistory(priceListId: string): Promise<PriceListHistory[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM price_list_history WHERE price_list_id = ? ORDER BY created_at DESC', [priceListId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows as PriceListHistory[]);
      });
    });
  }

  getPriceListList(params: { status?: string; keyword?: string; page?: number; pageSize?: number }): Promise<{ list: PriceList[]; total: number }> {
    return new Promise((resolve, reject) => {
      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      if (params.status) {
        whereConditions.push('status = ?');
        queryParams.push(params.status);
      }

      if (params.keyword) {
        whereConditions.push('(name LIKE ? OR version LIKE ?)');
        queryParams.push(`%${params.keyword}%`, `%${params.keyword}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      db.get(`SELECT COUNT(*) as total FROM price_lists ${whereClause}`, queryParams, (err, countRow: any) => {
        if (err) return reject(err);

        const page = params.page || 1;
        const pageSize = params.pageSize || 20;
        const offset = (page - 1) * pageSize;

        db.all(
          `SELECT * FROM price_lists ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          [...queryParams, pageSize, offset],
          (err, rows) => {
            if (err) return reject(err);
            resolve({ list: rows as PriceList[], total: countRow.total });
          }
        );
      });
    });
  }

  getAllStores(): Promise<Store[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM stores ORDER BY code', (err, rows) => {
        if (err) return reject(err);
        resolve(rows as Store[]);
      });
    });
  }

  async initStores(): Promise<void> {
    const stores = [
      { id: 's001', code: 'BJ-001', name: '北京朝阳门店', region: '华北' },
      { id: 's002', code: 'BJ-002', name: '北京海淀门店', region: '华北' },
      { id: 's003', code: 'SH-001', name: '上海浦东门店', region: '华东' },
      { id: 's004', code: 'SH-002', name: '上海静安门店', region: '华东' },
      { id: 's005', code: 'GZ-001', name: '广州天河门店', region: '华南' },
    ];

    for (const store of stores) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO stores (id, code, name, region, status) VALUES (?, ?, ?, ?, 'active')`,
          [store.id, store.code, store.name, store.region],
          (err) => err ? reject(err) : resolve()
        );
      });
    }
  }

  async recordBadRow(batchId: string, rowNumber: number, rawData: string, errorMessage: string): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO import_bad_rows (id, batch_id, row_number, raw_data, error_message) VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), batchId, rowNumber, rawData, errorMessage],
        (err) => err ? reject(err) : resolve()
      );
    });
  }
}

export default new PriceListService();
