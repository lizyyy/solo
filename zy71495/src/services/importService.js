const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const Joi = require('joi');
const { getDb } = require('../db/connection');
const config = require('../config');
const { calculateUsageDuration } = require('./expenseAllocator');

const generateBatchId = (type) => {
  const dateStr = moment().format(config.reports.dateFormat);
  const seq = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${config.batch.prefix}${config.batch.separator}${type}${config.batch.separator}${dateStr}${config.batch.separator}${seq}`;
};

const memberSchema = Joi.object({
  member_id: Joi.string().required(),
  name: Joi.string().required(),
  role: Joi.string().allow(null, ''),
  phone: Joi.string().allow(null, ''),
  email: Joi.string().email().allow(null, '')
});

const equipmentSchema = Joi.object({
  equipment_id: Joi.string().required(),
  name: Joi.string().required(),
  category: Joi.string().required().valid('SPEAKER', 'DRUM_KIT', 'MICROPHONE', 'AMPLIFIER', 'CABLE', 'OTHER'),
  brand: Joi.string().allow(null, ''),
  model: Joi.string().allow(null, ''),
  hourly_rate: Joi.number().min(0).required(),
  deposit_amount: Joi.number().min(0).required(),
  description: Joi.string().allow(null, '')
});

const usageRecordSchema = Joi.object({
  usage_id: Joi.string().required(),
  member_id: Joi.string().required(),
  start_time: Joi.string().isoDate().required(),
  end_time: Joi.string().isoDate().required()
});

const rentalItemSchema = Joi.object({
  item_id: Joi.string().required(),
  equipment_id: Joi.string().required(),
  planned_start_date: Joi.string().isoDate().required(),
  planned_end_date: Joi.string().isoDate().required(),
  actual_start_date: Joi.string().isoDate().allow(null, ''),
  actual_end_date: Joi.string().isoDate().allow(null, ''),
  hourly_rate: Joi.number().min(0).required(),
  deposit_amount: Joi.number().min(0).required(),
  usage_records: Joi.array().items(usageRecordSchema).required()
});

const damageRecordSchema = Joi.object({
  damage_id: Joi.string().required(),
  equipment_id: Joi.string().required(),
  damage_description: Joi.string().required(),
  repair_cost: Joi.number().min(0).required(),
  reported_by: Joi.string().allow(null, ''),
  reported_at: Joi.string().isoDate().allow(null, '')
});

const rentalOrderSchema = Joi.object({
  order_id: Joi.string().required(),
  order_date: Joi.string().isoDate().required(),
  start_date: Joi.string().isoDate().required(),
  end_date: Joi.string().isoDate().allow(null, ''),
  remarks: Joi.string().allow(null, ''),
  items: Joi.array().items(rentalItemSchema).required().min(1),
  damages: Joi.array().items(damageRecordSchema).optional()
});

const importMembers = async (members, options = {}) => {
  const db = await getDb();
  const batchId = generateBatchId('MEM');
  const results = { success: 0, failed: 0, errors: [], batchId };

  await db.transaction(async () => {
    await db.prepare(`
      INSERT INTO batch_records (batch_id, batch_type, description, imported_by, record_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(batchId, 'MEMBER_IMPORT', options.description || '成员批量导入', options.importedBy || 'system', members.length);

    const insertStmt = await db.prepare(`
      INSERT INTO members (member_id, name, role, phone, email)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(member_id) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        phone = excluded.phone,
        email = excluded.email,
        updated_at = datetime('now')
    `);

    for (let i = 0; i < members.length; i++) {
      const { error, value } = memberSchema.validate(members[i]);
      if (error) {
        results.failed++;
        results.errors.push({ index: i, error: error.details[0].message, data: members[i] });
        continue;
      }

      try {
        await insertStmt.run(value.member_id, value.name, value.role || null, value.phone || null, value.email || null);
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push({ index: i, error: e.message, data: members[i] });
      }
    }

    await db.prepare('UPDATE batch_records SET record_count = ? WHERE batch_id = ?').run(results.success, batchId);
  });

  return results;
};

const importEquipment = async (equipmentList, options = {}) => {
  const db = await getDb();
  const batchId = generateBatchId('EQP');
  const results = { success: 0, failed: 0, errors: [], batchId };

  await db.transaction(async () => {
    await db.prepare(`
      INSERT INTO batch_records (batch_id, batch_type, description, imported_by, record_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(batchId, 'EQUIPMENT_IMPORT', options.description || '设备批量导入', options.importedBy || 'system', equipmentList.length);

    const insertStmt = await db.prepare(`
      INSERT INTO equipment (equipment_id, name, category, brand, model, hourly_rate, deposit_amount, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(equipment_id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        brand = excluded.brand,
        model = excluded.model,
        hourly_rate = excluded.hourly_rate,
        deposit_amount = excluded.deposit_amount,
        description = excluded.description,
        updated_at = datetime('now')
    `);

    for (let i = 0; i < equipmentList.length; i++) {
      const { error, value } = equipmentSchema.validate(equipmentList[i]);
      if (error) {
        results.failed++;
        results.errors.push({ index: i, error: error.details[0].message, data: equipmentList[i] });
        continue;
      }

      try {
        await insertStmt.run(
          value.equipment_id,
          value.name,
          value.category,
          value.brand || null,
          value.model || null,
          value.hourly_rate,
          value.deposit_amount,
          value.description || null
        );
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push({ index: i, error: e.message, data: equipmentList[i] });
      }
    }

    await db.prepare('UPDATE batch_records SET record_count = ? WHERE batch_id = ?').run(results.success, batchId);
  });

  return results;
};

const importRentalOrders = async (orders, options = {}) => {
  const db = await getDb();
  const batchId = generateBatchId('ORD');
  const results = { success: 0, failed: 0, errors: [], batchId, orderResults: [] };

  await db.transaction(async () => {
    await db.prepare(`
      INSERT INTO batch_records (batch_id, batch_type, description, imported_by, record_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(batchId, 'ORDER_IMPORT', options.description || '租赁单批量导入', options.importedBy || 'system', orders.length);

    const insertOrderStmt = await db.prepare(`
      INSERT INTO rental_orders (order_id, batch_id, order_date, start_date, end_date, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertItemStmt = await db.prepare(`
      INSERT INTO rental_items 
      (item_id, order_id, equipment_id, planned_start_date, planned_end_date, 
       actual_start_date, actual_end_date, hourly_rate, deposit_amount, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertUsageStmt = await db.prepare(`
      INSERT INTO usage_records (usage_id, item_id, member_id, start_time, end_time, duration_hours)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertDepositStmt = await db.prepare(`
      INSERT INTO deposits 
      (deposit_id, order_id, item_id, equipment_id, collected_amount, status, collected_at)
      VALUES (?, ?, ?, ?, ?, 'COLLECTED', datetime('now'))
    `);

    const insertDamageStmt = await db.prepare(`
      INSERT INTO damage_records 
      (damage_id, order_id, item_id, equipment_id, reported_by, reported_at, 
       damage_description, repair_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < orders.length; i++) {
      const orderData = orders[i];
      const orderResult = { order_id: orderData.order_id, success: false, errors: [] };

      const { error: orderError, value: orderValue } = rentalOrderSchema.validate(orderData);
      if (orderError) {
        orderResult.errors.push(orderError.details[0].message);
        results.failed++;
        results.errors.push({ index: i, errors: orderResult.errors, data: orderData });
        results.orderResults.push(orderResult);
        continue;
      }

      const existingOrder = await db.prepare('SELECT 1 FROM rental_orders WHERE order_id = ?').get(orderValue.order_id);
      if (existingOrder && !options.overwrite) {
        orderResult.errors.push(`Order ${orderValue.order_id} already exists`);
        results.failed++;
        results.errors.push({ index: i, errors: orderResult.errors, data: orderData });
        results.orderResults.push(orderResult);
        continue;
      }

      try {
        if (existingOrder) {
          await db.prepare('DELETE FROM expense_allocations WHERE order_id = ?').run(orderValue.order_id);
          await db.prepare('DELETE FROM usage_records WHERE item_id IN (SELECT item_id FROM rental_items WHERE order_id = ?)').run(orderValue.order_id);
          await db.prepare('DELETE FROM deposits WHERE order_id = ?').run(orderValue.order_id);
          await db.prepare('DELETE FROM damage_records WHERE order_id = ?').run(orderValue.order_id);
          await db.prepare('DELETE FROM rental_items WHERE order_id = ?').run(orderValue.order_id);
          await db.prepare('DELETE FROM rental_orders WHERE order_id = ?').run(orderValue.order_id);
        }

        await insertOrderStmt.run(
          orderValue.order_id,
          batchId,
          orderValue.order_date,
          orderValue.start_date,
          orderValue.end_date || null,
          orderValue.remarks || null
        );

        let totalAmount = 0;
        let totalDeposit = 0;

        for (const item of orderValue.items) {
          const equipment = await db.prepare('SELECT * FROM equipment WHERE equipment_id = ?').get(item.equipment_id);
          if (!equipment) {
            throw new Error(`Equipment not found: ${item.equipment_id}`);
          }

          let itemSubtotal = 0;
          for (const usage of item.usage_records) {
            const member = await db.prepare('SELECT 1 FROM members WHERE member_id = ?').get(usage.member_id);
            if (!member) {
              throw new Error(`Member not found: ${usage.member_id}`);
            }
          }

          await insertItemStmt.run(
            item.item_id,
            orderValue.order_id,
            item.equipment_id,
            item.planned_start_date,
            item.planned_end_date,
            item.actual_start_date || null,
            item.actual_end_date || null,
            item.hourly_rate,
            item.deposit_amount,
            0
          );

          for (const usage of item.usage_records) {
            const duration = calculateUsageDuration(usage.start_time, usage.end_time);
            await insertUsageStmt.run(
              usage.usage_id,
              item.item_id,
              usage.member_id,
              usage.start_time,
              usage.end_time,
              duration
            );
            itemSubtotal += duration * item.hourly_rate;
          }

          itemSubtotal = Number(itemSubtotal.toFixed(2));
          await db.prepare('UPDATE rental_items SET subtotal = ? WHERE item_id = ?').run(itemSubtotal, item.item_id);
          totalAmount += itemSubtotal;

          if (item.deposit_amount > 0) {
            await insertDepositStmt.run(
              uuidv4(),
              orderValue.order_id,
              item.item_id,
              item.equipment_id,
              item.deposit_amount
            );
            totalDeposit += item.deposit_amount;
          }
        }

        if (orderValue.damages && orderValue.damages.length > 0) {
          for (const damage of orderValue.damages) {
            const item = orderValue.items.find(i => i.equipment_id === damage.equipment_id);
            if (!item) {
              throw new Error(`Damage references equipment ${damage.equipment_id} not in order items`);
            }

            await insertDamageStmt.run(
              damage.damage_id,
              orderValue.order_id,
              item.item_id,
              damage.equipment_id,
              damage.reported_by || null,
              damage.reported_at || null,
              damage.damage_description,
              damage.repair_cost
            );
          }
        }

        await db.prepare(`
          UPDATE rental_orders 
          SET total_amount = ?, total_deposit = ? 
          WHERE order_id = ?
        `).run(totalAmount, totalDeposit, orderValue.order_id);

        orderResult.success = true;
        results.success++;
        results.orderResults.push(orderResult);
      } catch (e) {
        orderResult.errors.push(e.message);
        results.failed++;
        results.errors.push({ index: i, errors: orderResult.errors, data: orderData });
        results.orderResults.push(orderResult);
      }
    }

    await db.prepare('UPDATE batch_records SET record_count = ? WHERE batch_id = ?').run(results.success, batchId);
  });

  return results;
};

const getBatchInfo = async (batchId) => {
  const db = await getDb();
  const batch = await db.prepare('SELECT * FROM batch_records WHERE batch_id = ?').get(batchId);
  if (!batch) return null;

  const orders = await db.prepare('SELECT * FROM rental_orders WHERE batch_id = ?').all(batchId);
  
  return {
    batch,
    relatedOrders: orders
  };
};

const listBatches = async (batchType = null) => {
  const db = await getDb();
  let sql = 'SELECT * FROM batch_records';
  const params = [];
  
  if (batchType) {
    sql += ' WHERE batch_type = ?';
    params.push(batchType);
  }
  sql += ' ORDER BY created_at DESC';
  
  return await db.prepare(sql).all(...params);
};

module.exports = {
  generateBatchId,
  importMembers,
  importEquipment,
  importRentalOrders,
  getBatchInfo,
  listBatches,
  schemas: {
    memberSchema,
    equipmentSchema,
    rentalOrderSchema
  }
};
