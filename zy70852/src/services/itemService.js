const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const db = require('../models/database');
const importService = require('./importService');

class ItemService {
  async getItemById(itemId) {
    const item = await db.get('SELECT * FROM lost_items WHERE id = ?', [itemId]);
    if (item) {
      item.history = await this.getItemHistory(itemId);
    }
    return item;
  }

  async getItemByNo(itemNo) {
    const item = await db.get('SELECT * FROM lost_items WHERE item_no = ?', [itemNo]);
    if (item) {
      item.history = await this.getItemHistory(item.id);
    }
    return item;
  }

  async getItemHistory(itemId) {
    return await db.all(
      `SELECT * FROM processing_history 
       WHERE item_id = ? 
       ORDER BY operator_time ASC`,
      [itemId]
    );
  }

  async listItems(params = {}) {
    const {
      page = 1,
      pageSize = 20,
      status,
      routeNo,
      shiftNo,
      driverName,
      pickupVoucherNo,
      startDate,
      endDate,
      isOverdue
    } = params;

    let whereClauses = [];
    let queryParams = [];

    if (status) {
      whereClauses.push('status = ?');
      queryParams.push(status);
    }
    if (routeNo) {
      whereClauses.push('route_no = ?');
      queryParams.push(routeNo);
    }
    if (shiftNo) {
      whereClauses.push('shift_no = ?');
      queryParams.push(shiftNo);
    }
    if (driverName) {
      whereClauses.push('driver_name LIKE ?');
      queryParams.push(`%${driverName}%`);
    }
    if (pickupVoucherNo) {
      whereClauses.push('pickup_voucher_no = ?');
      queryParams.push(pickupVoucherNo);
    }
    if (startDate) {
      whereClauses.push('found_time >= ?');
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClauses.push('found_time <= ?');
      queryParams.push(endDate);
    }
    if (isOverdue !== undefined) {
      whereClauses.push('is_overdue = ?');
      queryParams.push(isOverdue ? 1 : 0);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const list = await db.all(
      `SELECT * FROM lost_items ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, pageSize, offset]
    );

    const totalResult = await db.get(
      `SELECT COUNT(*) as count FROM lost_items ${whereSql}`,
      queryParams
    );

    return { list, total: totalResult.count, page, pageSize };
  }

  async processItem(itemId, action, reason, operator, remark = '') {
    const item = await db.get('SELECT * FROM lost_items WHERE id = ?', [itemId]);
    if (!item) {
      throw new Error('物品不存在');
    }

    const oldStatus = item.status;
    let newStatus = oldStatus;

    switch (action) {
      case 'process':
        newStatus = 'processing';
        break;
      case 'complete':
        newStatus = 'completed';
        break;
      case 'return':
        newStatus = 'returned';
        break;
      case 'pending':
        newStatus = 'pending';
        break;
      case 'pickup':
        newStatus = 'picked_up';
        break;
      default:
        throw new Error('不支持的操作类型');
    }

    await db.beginTransaction();

    try {
      await db.run(
        `UPDATE lost_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newStatus, itemId]
      );

      await importService.addProcessingHistory(
        itemId,
        action,
        reason,
        operator,
        oldStatus,
        newStatus,
        remark
      );

      await db.commit();

      return { itemId, oldStatus, newStatus, action, reason, operator };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async returnForModification(itemId, reason, operator) {
    return await this.processItem(itemId, 'return', reason, operator);
  }

  async markProcessed(itemId, reason, operator) {
    return await this.processItem(itemId, 'process', reason, operator);
  }

  async markCompleted(itemId, reason, operator) {
    return await this.processItem(itemId, 'complete', reason, operator);
  }

  async issuePickupVoucher(itemId, issuer, expireDays = 7) {
    const item = await db.get('SELECT * FROM lost_items WHERE id = ?', [itemId]);
    if (!item) {
      throw new Error('物品不存在');
    }
    if (item.pickup_voucher_no) {
      throw new Error('该物品已生成领取凭证');
    }

    const voucherNo = `VOU${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
    const expireTime = moment().add(expireDays, 'days').format('YYYY-MM-DD HH:mm:ss');

    await db.beginTransaction();

    try {
      await db.run(
        `INSERT INTO pickup_vouchers 
         (voucher_no, item_id, item_name, issuer, expire_time)
         VALUES (?, ?, ?, ?, ?)`,
        [voucherNo, itemId, item.item_name, issuer, expireTime]
      );

      await db.run(
        `UPDATE lost_items SET pickup_voucher_no = ?, status = 'processing' WHERE id = ?`,
        [voucherNo, itemId]
      );

      await importService.addProcessingHistory(
        itemId,
        'issue_voucher',
        `生成领取凭证: ${voucherNo}`,
        issuer,
        item.status,
        'processing',
        `有效期至: ${expireTime}`
      );

      await db.commit();

      return { voucherNo, itemId, itemName: item.item_name, expireTime, issuer };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async getVoucherByNo(voucherNo) {
    const voucher = await db.get('SELECT * FROM pickup_vouchers WHERE voucher_no = ?', [voucherNo]);
    if (voucher) {
      const item = await db.get('SELECT * FROM lost_items WHERE id = ?', [voucher.item_id]);
      voucher.item = item;
      if (item) {
        voucher.itemHistory = await this.getItemHistory(item.id);
      }
    }
    return voucher;
  }

  async pickupItem(voucherNo, receiverName, receiverPhone, receiverIdCard, operator) {
    const voucher = await db.get('SELECT * FROM pickup_vouchers WHERE voucher_no = ?', [voucherNo]);
    if (!voucher) {
      throw new Error('领取凭证不存在');
    }
    if (voucher.status !== 'valid') {
      throw new Error('领取凭证已使用或已失效');
    }
    if (moment(voucher.expire_time).isBefore(moment())) {
      throw new Error('领取凭证已过期');
    }

    const item = await db.get('SELECT * FROM lost_items WHERE id = ?', [voucher.item_id]);
    if (!item) {
      throw new Error('关联物品不存在');
    }

    await db.beginTransaction();

    try {
      const pickupTime = moment().format('YYYY-MM-DD HH:mm:ss');

      await db.run(
        `UPDATE pickup_vouchers 
         SET status = 'used', used_time = ? 
         WHERE voucher_no = ?`,
        [pickupTime, voucherNo]
      );

      await db.run(
        `UPDATE lost_items 
         SET status = 'picked_up', pickup_time = ?, receiver_name = ?, receiver_phone = ?, receiver_id_card = ?
         WHERE id = ?`,
        [pickupTime, receiverName, receiverPhone, receiverIdCard, voucher.item_id]
      );

      await importService.addProcessingHistory(
        voucher.item_id,
        'pickup',
        `物品已领取，领取凭证: ${voucherNo}`,
        operator,
        item.status,
        'picked_up',
        `领取人: ${receiverName}, 电话: ${this.maskPhone(receiverPhone)}`
      );

      await db.commit();

      return { voucherNo, pickupTime, receiverName };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  maskPhone(phone) {
    if (!phone || phone.length < 7) return phone;
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
  }

  maskIdCard(idCard) {
    if (!idCard || idCard.length < 10) return idCard;
    return idCard.substring(0, 6) + '********' + idCard.substring(idCard.length - 4);
  }

  async checkOverdueItems(overdueDays = 30) {
    const cutoffDate = moment().subtract(overdueDays, 'days').format('YYYY-MM-DD HH:mm:ss');
    
    const items = await db.all(
      `SELECT * FROM lost_items 
       WHERE status IN ('pending', 'processing') 
       AND found_time < ? 
       AND is_overdue = 0`,
      [cutoffDate]
    );

    await db.beginTransaction();

    try {
      for (const item of items) {
        await db.run(
          `UPDATE lost_items SET is_overdue = 1, overdue_days = ? WHERE id = ?`,
          [overdueDays, item.id]
        );

        await importService.addProcessingHistory(
          item.id,
          'mark_overdue',
          `物品逾期${overdueDays}天无人领取`,
          'system',
          item.status,
          item.status,
          `超期时间: ${cutoffDate}`
        );
      }

      await db.commit();

      return { processed: items.length, overdueDays };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async checkSameNameItems() {
    const items = await db.all(
      `SELECT item_name, COUNT(*) as count 
       FROM lost_items 
       GROUP BY item_name 
       HAVING count > 1`
    );

    await db.beginTransaction();

    try {
      for (const group of items) {
        await db.run(
          `UPDATE lost_items SET has_same_name = 1 WHERE item_name = ?`,
          [group.item_name]
        );
      }

      await db.commit();

      return { sameNameGroups: items.length, totalItems: items.reduce((sum, g) => sum + g.count, 0) };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async exportItems(params = {}) {
    const result = await this.listItems({ ...params, pageSize: 10000, page: 1 });
    
    const exportData = result.list.map(item => ({
      物品编号: item.item_no,
      物品名称: item.item_name,
      物品描述: item.item_description,
      物品分类: item.item_category,
      发现时间: item.found_time,
      发现地点: item.found_location,
      线路号: item.route_no,
      班次号: item.shift_no,
      司机姓名: item.driver_name,
      司机电话: this.maskPhone(item.driver_phone),
      上交人: item.finder_name,
      状态: this.getStatusText(item.status),
      是否逾期: item.is_overdue ? '是' : '否',
      领取凭证号: item.pickup_voucher_no || '',
      领取时间: item.pickup_time || '',
      领取人: item.receiver_name ? this.maskName(item.receiver_name) : '',
      领取人电话: this.maskPhone(item.receiver_phone),
      创建时间: item.created_at
    }));

    const json2csvParser = new Parser({ fields: Object.keys(exportData[0] || {}) });
    return json2csvParser.parse(exportData);
  }

  getStatusText(status) {
    const statusMap = {
      'pending': '待处理',
      'processing': '处理中',
      'completed': '已完成',
      'returned': '已退回',
      'picked_up': '已领取'
    };
    return statusMap[status] || status;
  }

  maskName(name) {
    if (!name || name.length <= 1) return name;
    return name.substring(0, 1) + '*'.repeat(name.length - 1);
  }

  async getItemsByRoute(routeNo, shiftNo) {
    const whereClauses = ['route_no = ?'];
    const params = [routeNo];
    
    if (shiftNo) {
      whereClauses.push('shift_no = ?');
      params.push(shiftNo);
    }

    const items = await db.all(
      `SELECT * FROM lost_items WHERE ${whereClauses.join(' AND ')} ORDER BY found_time DESC`,
      params
    );

    const schedule = await db.get(
      `SELECT * FROM route_schedules WHERE route_no = ? AND shift_no = ? ORDER BY departure_time DESC LIMIT 1`,
      [routeNo, shiftNo || '']
    );

    return { items, schedule };
  }

  async getItemsByDriver(driverName) {
    return await db.all(
      `SELECT * FROM lost_items WHERE driver_name LIKE ? ORDER BY found_time DESC`,
      [`%${driverName}%`]
    );
  }

  async traceVoucherSource(voucherNo) {
    const voucher = await this.getVoucherByNo(voucherNo);
    if (!voucher) {
      return null;
    }

    const batch = voucher.item ? 
      await db.get('SELECT * FROM batches WHERE id = ?', [voucher.item.batch_id]) : 
      null;

    const history = voucher.item ? await this.getItemHistory(voucher.item.id) : [];

    return {
      voucher,
      item: voucher.item,
      batch,
      history,
      traceChain: this.buildTraceChain(voucher, batch, history)
    };
  }

  buildTraceChain(voucher, batch, history) {
    const chain = [];
    
    if (batch) {
      chain.push({
        type: 'batch_import',
        time: batch.created_at,
        operator: batch.created_by,
        description: `批次导入: ${batch.batch_no}, 文件: ${batch.source_file}`
      });
    }

    history.forEach(h => {
      chain.push({
        type: h.action,
        time: h.operator_time,
        operator: h.operator,
        description: `${h.action_reason}, 状态: ${h.old_status} -> ${h.new_status}`
      });
    });

    if (voucher) {
      chain.push({
        type: 'voucher_issue',
        time: voucher.issue_time,
        operator: voucher.issuer,
        description: `生成领取凭证: ${voucher.voucher_no}, 有效期至: ${voucher.expire_time}`
      });
    }

    return chain.sort((a, b) => new Date(a.time) - new Date(b.time));
  }
}

module.exports = new ItemService();
