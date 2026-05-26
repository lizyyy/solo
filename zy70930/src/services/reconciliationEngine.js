const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { generateExplanation } = require('./explanationEngine');

const DISCREPANCY_TYPES = {
  CROSS_STORE_REDEMPTION: 'cross_store_redemption',
  ITEM_REPLACEMENT: 'item_replacement',
  INVENTORY_SHORTAGE: 'inventory_shortage',
  PACKAGE_USAGE_MISMATCH: 'package_usage_mismatch',
  AMOUNT_MISMATCH: 'amount_mismatch',
  MISSING_WORK_ORDER: 'missing_work_order',
  MISSING_PACKAGE: 'missing_package',
  QUANTITY_MISMATCH: 'quantity_mismatch',
  INVENTORY_SURPLUS: 'inventory_surplus',
  PRICE_MISMATCH: 'price_mismatch'
};

const SEVERITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

class ReconciliationEngine {
  constructor(batchId) {
    this.batchId = batchId;
    this.discrepancies = [];
    this.stats = {
      matched: 0,
      discrepancies: 0,
      crossStore: 0,
      replacements: 0,
      inventoryIssues: 0
    };
  }

  async runReconciliation() {
    await this.clearPreviousResults();
    
    const packages = await this.getBatchPackages();
    const workOrders = await this.getBatchWorkOrders();
    const inventory = await this.getBatchInventory();

    await this.reconcilePackagesWithWorkOrders(packages, workOrders);
    await this.reconcileInventoryUsage(workOrders, inventory);
    await this.checkOrphanRecords(packages, workOrders);
    await this.updateBatchStats();
    
    return {
      success: true,
      stats: this.stats,
      discrepancies: this.discrepancies.length
    };
  }

  async clearPreviousResults() {
    await db.run('DELETE FROM reconciliation_records WHERE batch_id = ?', [this.batchId]);
    await db.run('DELETE FROM reconciliation_discrepancies WHERE batch_id = ?', [this.batchId]);
  }

  async getBatchPackages() {
    return await db.all(`
      SELECT p.*, s.name as store_name, s.code as store_code
      FROM packages p
      LEFT JOIN stores s ON p.purchase_store_id = s.id
      WHERE p.reconciliation_batch_id = ?
    `, [this.batchId]);
  }

  async getBatchWorkOrders() {
    const workOrders = await db.all(`
      SELECT wo.*, s.name as store_name, s.code as store_code
      FROM work_orders wo
      LEFT JOIN stores s ON wo.store_id = s.id
      WHERE wo.reconciliation_batch_id = ?
    `, [this.batchId]);

    for (const wo of workOrders) {
      wo.items = await db.all(`
        SELECT * FROM work_order_items WHERE work_order_id = ?
      `, [wo.id]);
    }
    return workOrders;
  }

  async getBatchInventory() {
    return await db.all(`
      SELECT i.*, s.name as store_name
      FROM inventory i
      LEFT JOIN stores s ON i.store_id = s.id
      WHERE i.reconciliation_batch_id = ?
    `, [this.batchId]);
  }

  async reconcilePackagesWithWorkOrders(packages, workOrders) {
    const packageMap = new Map(packages.map(p => [p.package_code, p]));
    
    for (const wo of workOrders) {
      let hasPackageItems = false;
      let woStatus = 'matched';
      const woDiscrepancies = [];

      for (const item of wo.items) {
        if (item.is_package_item && item.related_package_id) {
          hasPackageItems = true;
          const pkg = packages.find(p => p.id === item.related_package_id) || 
                       packageMap.get(item.related_package_id);
          
          if (!pkg) {
            woStatus = 'discrepancy';
            woDiscrepancies.push(await this.createDiscrepancy(
              DISCREPANCY_TYPES.MISSING_PACKAGE,
              SEVERITY.HIGH,
              null,
              item.related_package_id,
              '工单引用了不存在的套餐ID',
              { workOrderNo: wo.order_no, itemCode: item.item_code }
            ));
            continue;
          }

          if (pkg.purchase_store_id !== wo.store_id) {
            woStatus = 'discrepancy';
            this.stats.crossStore++;
            woDiscrepancies.push(await this.createDiscrepancy(
              DISCREPANCY_TYPES.CROSS_STORE_REDEMPTION,
              SEVERITY.MEDIUM,
              pkg.store_name,
              wo.store_name,
              `跨店核销: 套餐在${pkg.store_name}购买，但在${wo.store_name}使用`,
              {
                packageCode: pkg.package_code,
                purchaseStore: pkg.store_code,
                redeemStore: wo.store_code,
                workOrderNo: wo.order_no,
                customerName: pkg.customer_name
              }
            ));
          }

          if (item.replaced_from_item_code) {
            woStatus = 'discrepancy';
            this.stats.replacements++;
            woDiscrepancies.push(await this.createDiscrepancy(
              DISCREPANCY_TYPES.ITEM_REPLACEMENT,
              SEVERITY.MEDIUM,
              item.replaced_from_item_code,
              item.item_code,
              `项目替换: ${item.replaced_from_item_code} 替换为 ${item.item_code}`,
              {
                workOrderNo: wo.order_no,
                originalItem: item.replaced_from_item_code,
                newItem: item.item_code,
                reason: item.replacement_reason || '未填写原因'
              }
            ));
          }

          const pkgItems = await db.all(`
            SELECT * FROM package_items WHERE package_id = ? AND item_code = ?
          `, [pkg.id, item.item_code]);

          if (pkgItems.length === 0) {
            woStatus = 'discrepancy';
            woDiscrepancies.push(await this.createDiscrepancy(
              DISCREPANCY_TYPES.PACKAGE_USAGE_MISMATCH,
              SEVERITY.HIGH,
              '套餐不包含此项目',
              item.item_name,
              `工单项目不在套餐范围内: ${item.item_name}`,
              {
                packageCode: pkg.package_code,
                workOrderNo: wo.order_no,
                itemCode: item.item_code
              }
            ));
          } else {
            const pkgItem = pkgItems[0];
            if (item.quantity > (pkgItem.remaining_quantity + pkgItem.used_quantity)) {
              woStatus = 'discrepancy';
              woDiscrepancies.push(await this.createDiscrepancy(
                DISCREPANCY_TYPES.QUANTITY_MISMATCH,
                SEVERITY.HIGH,
                pkgItem.quantity.toString(),
                item.quantity.toString(),
                `使用数量超出套餐包含数量`,
                {
                  packageCode: pkg.package_code,
                  workOrderNo: wo.order_no,
                  itemCode: item.item_code,
                  packageQty: pkgItem.quantity,
                  usedQty: item.quantity
                }
              ));
            }
          }
        }
      }

      if (hasPackageItems) {
        await this.createReconciliationRecord(
          'work_order',
          wo.id,
          wo.order_no,
          woStatus,
          woDiscrepancies
        );
      }
    }
  }

  async reconcileInventoryUsage(workOrders, inventory) {
    const inventoryMap = new Map();
    for (const inv of inventory) {
      const key = `${inv.store_id}_${inv.part_code}`;
      inventoryMap.set(key, inv);
    }

    const partUsage = new Map();
    for (const wo of workOrders) {
      for (const item of wo.items) {
        if (item.item_type === 'part') {
          const key = `${wo.store_id}_${item.item_code}`;
          if (!partUsage.has(key)) {
            partUsage.set(key, { quantity: 0, orders: [] });
          }
          partUsage.get(key).quantity += item.quantity;
          partUsage.get(key).orders.push({
            orderNo: wo.order_no,
            quantity: item.quantity,
            itemName: item.item_name
          });
        }
      }
    }

    for (const [key, usage] of partUsage) {
      const [storeId, partCode] = key.split('_');
      const inv = inventoryMap.get(key);
      const invDiscrepancies = [];
      let invStatus = 'matched';

      if (!inv) {
        invStatus = 'discrepancy';
        invDiscrepancies.push(await this.createDiscrepancy(
          DISCREPANCY_TYPES.INVENTORY_SHORTAGE,
          SEVERITY.HIGH,
          usage.quantity.toString(),
          '0',
          `配件库存记录缺失: ${partCode}`,
          {
            storeId,
            partCode,
            usedQuantity: usage.quantity,
            relatedOrders: usage.orders
          }
        ));
        this.stats.inventoryIssues++;
      } else {
        const expectedClosing = inv.opening_quantity + inv.purchased_quantity - usage.quantity + inv.adjusted_quantity;
        if (Math.abs(inv.closing_quantity - expectedClosing) > 0) {
          this.stats.inventoryIssues++;
          invStatus = 'discrepancy';
          const diff = inv.closing_quantity - expectedClosing;
          const type = diff > 0 ? DISCREPANCY_TYPES.INVENTORY_SURPLUS : DISCREPANCY_TYPES.INVENTORY_SHORTAGE;
          
          invDiscrepancies.push(await this.createDiscrepancy(
            type,
            SEVERITY.HIGH,
            expectedClosing.toString(),
            inv.closing_quantity.toString(),
            diff > 0 ? `库存盘盈: 多${diff}件` : `库存盘亏: 少${Math.abs(diff)}件`,
            {
              storeId,
              storeName: inv.store_name,
              partCode,
              partName: inv.part_name,
              openingQty: inv.opening_quantity,
              purchasedQty: inv.purchased_quantity,
              usedQty: usage.quantity,
              adjustedQty: inv.adjusted_quantity,
              expectedClosing,
              actualClosing: inv.closing_quantity,
              difference: diff,
              relatedOrders: usage.orders
            }
          ));
        }

        if (inv.unit_price) {
          for (const order of usage.orders) {
            const orderItem = workOrders
              .flatMap(wo => wo.items)
              .find(item => item.item_code === partCode && item.item_name === order.itemName);
            
            if (orderItem && Math.abs(orderItem.unit_price - inv.unit_price) > 0.01) {
              invStatus = 'discrepancy';
              invDiscrepancies.push(await this.createDiscrepancy(
                DISCREPANCY_TYPES.PRICE_MISMATCH,
                SEVERITY.MEDIUM,
                inv.unit_price.toString(),
                orderItem.unit_price.toString(),
                `单价不一致: 库存价${inv.unit_price} vs 工单价${orderItem.unit_price}`,
                {
                  partCode,
                  partName: inv.part_name,
                  inventoryPrice: inv.unit_price,
                  orderPrice: orderItem.unit_price,
                  workOrderNo: order.orderNo
                }
              ));
            }
          }
        }
      }

      await this.createReconciliationRecord(
        'inventory',
        inv ? inv.id : key,
        inv ? inv.part_code : partCode,
        invStatus,
        invDiscrepancies
      );
    }
  }

  async checkOrphanRecords(packages, workOrders) {
    for (const pkg of packages) {
      const relatedOrders = workOrders.filter(wo => 
        wo.items.some(item => item.related_package_id === pkg.id)
      );
      
      if (relatedOrders.length === 0 && pkg.status !== 'active') {
        const discrepancyId = await this.createDiscrepancy(
          DISCREPANCY_TYPES.MISSING_WORK_ORDER,
          SEVERITY.MEDIUM,
          '应有核销工单',
          '无',
          `套餐已使用但无对应工单记录`,
          {
            packageCode: pkg.package_code,
            customerName: pkg.customer_name,
            totalAmount: pkg.total_amount
          }
        );

        await this.createReconciliationRecord(
          'package',
          pkg.id,
          pkg.package_code,
          'discrepancy',
          [discrepancyId]
        );
      }
    }
  }

  async createDiscrepancy(type, severity, expected, actual, explanation, sourceDetails) {
    const id = uuidv4();
    const detailedExplanation = generateExplanation(type, expected, actual, sourceDetails);

    this.discrepancies.push({
      id,
      type,
      severity,
      expected,
      actual,
      explanation: detailedExplanation,
      sourceDetails
    });

    await db.run(`
      INSERT INTO reconciliation_discrepancies 
      (id, batch_id, record_id, discrepancy_type, discrepancy_code, severity, 
       expected_value, actual_value, difference, explanation, source_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      this.batchId,
      null,
      type,
      type,
      severity,
      expected,
      actual,
      this.calculateDifference(expected, actual),
      detailedExplanation,
      JSON.stringify(sourceDetails)
    ]);

    this.stats.discrepancies++;
    return id;
  }

  async createReconciliationRecord(recordType, referenceId, referenceNo, status, discrepancyIds) {
    const id = uuidv4();
    
    await db.run(`
      INSERT INTO reconciliation_records
      (id, batch_id, record_type, reference_id, reference_no, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, this.batchId, recordType, referenceId, referenceNo, status]);

    if (discrepancyIds.length > 0) {
      await db.run(`
        UPDATE reconciliation_discrepancies 
        SET record_id = ? 
        WHERE id IN (${discrepancyIds.map(() => '?').join(',')})
      `, [id, ...discrepancyIds]);
    }

    if (status === 'matched') {
      this.stats.matched++;
    }
  }

  calculateDifference(expected, actual) {
    const numExpected = parseFloat(expected);
    const numActual = parseFloat(actual);
    
    if (!isNaN(numExpected) && !isNaN(numActual)) {
      return (numActual - numExpected).toString();
    }
    return null;
  }

  async updateBatchStats() {
    const totalRecords = await db.get(`
      SELECT COUNT(*) as count FROM reconciliation_records WHERE batch_id = ?
    `, [this.batchId]);

    const matchedRecords = await db.get(`
      SELECT COUNT(*) as count FROM reconciliation_records WHERE batch_id = ? AND status = 'matched'
    `, [this.batchId]);

    const discrepancyCount = this.discrepancies.length;

    await db.run(`
      UPDATE reconciliation_batches 
      SET status = 'reconciled',
          matched_count = ?,
          discrepancy_count = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [matchedRecords.count, discrepancyCount, this.batchId]);
  }
}

module.exports = {
  ReconciliationEngine,
  DISCREPANCY_TYPES,
  SEVERITY
};
