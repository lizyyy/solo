import { getAll, getOne } from '../database/db.js';
import { RulesEngine } from './rulesEngine.js';

export const ExportService = {
  exportMarkdownDutySheet() {
    const status = this._getStatusData();
    const batches = getAll(`
      SELECT eb.*, s.name as ship_name
      FROM evacuation_batches eb
      LEFT JOIN ships s ON eb.ship_id = s.id
      ORDER BY eb.batch_number
    `);
    
    const guestsByBatch = this._getGuestsByBatch();
    const pendingGuests = getAll(`
      SELECT g.*, r.room_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      WHERE g.is_evacuated = 0 AND g.evacuation_batch_id IS NULL
      ORDER BY 
        CASE WHEN g.is_elderly = 1 THEN 1 
             WHEN g.is_child = 1 THEN 2 
             WHEN g.has_disability = 1 THEN 3 
             ELSE 4 END
    `);

    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    let md = `# 台风撤房值班单\n\n`;
    md += `> 生成时间：${now}\n\n`;
    md += `---\n\n`;

    md += `## 一、撤离进度概览\n\n`;
    md += `| 类别 | 统计 | 状态 |\n`;
    md += `|------|------|------|\n`;
    md += `| 住客 | ${status.guests.evacuated}/${status.guests.total} | ${status.guests.percentage}% 完成 |\n`;
    md += `| 房间 | ${status.rooms.evacuated}/${status.rooms.occupied} | ${status.rooms.sealed} 间已封窗 |\n`;
    md += `| 批次 | ${status.batches.completed}/${status.batches.total} | ${status.batches.inProgress} 个进行中 |\n\n`;

    md += `## 二、物资状态\n\n`;
    const supplies = status.supplies;
    for (const [type, data] of Object.entries(supplies.byType)) {
      const typeNames = { fuel: '燃油', water: '饮水', food: '食品', medicine: '药品' };
      md += `### ${typeNames[type]}\n\n`;
      for (const supply of data.supplies) {
        const statusIcon = supply.status === 'critical' ? '⚠️' : '✅';
        md += `- ${statusIcon} **${supply.name}**: ${supply.quantity}${supply.unit} `;
        md += `(底线 ${supply.minThreshold}${supply.unit}, ${supply.percentage}%)\n`;
      }
      md += `\n`;
    }

    md += `## 三、撤离批次安排\n\n`;
    for (const batch of batches) {
      const batchGuests = guestsByBatch[batch.id] || [];
      const statusColor = {
        completed: '✅ 已完成',
        in_progress: '🚢 进行中',
        planned: '📋 计划中'
      }[batch.status] || '❓ 未知';

      md += `### 第 ${batch.batch_number} 批次 (${statusColor})\n\n`;
      md += `- **船班**: ${batch.ship_name || '待定'}\n`;
      md += `- **人数**: ${batch.guest_count}/${batch.max_capacity || '不限'}\n`;
      md += `- **优先级**: ${batch.priority === 'high' ? '高优先级(含特殊需求)' : '普通'}\n\n`;

      if (batchGuests.length > 0) {
        md += `| 房间 | 姓名 | 年龄 | 特殊需求 | 状态 |\n`;
        md += `|------|------|------|----------|------|\n`;
        for (const guest of batchGuests) {
          const tags = RulesEngine.validatePriority(guest).tags.join('、') || '-';
          const evacStatus = guest.is_evacuated === 1 ? '✅ 已撤离' : '⏳ 待撤离';
          md += `| ${guest.room_number || '-'} | ${guest.name} | ${guest.age || '-'} | ${tags} | ${evacStatus} |\n`;
        }
        md += `\n`;
      }
    }

    if (pendingGuests.length > 0) {
      md += `## 四、待分配住客\n\n`;
      md += `| 房间 | 姓名 | 年龄 | 特殊需求 |\n`;
      md += `|------|------|------|----------|\n`;
      for (const guest of pendingGuests) {
        const tags = RulesEngine.validatePriority(guest).tags.join('、') || '-';
        md += `| ${guest.room_number || '-'} | ${guest.name} | ${guest.age || '-'} | ${tags} |\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
    md += `*值班人：__________  确认时间：__________*\n`;

    return {
      content: md,
      filename: `台风撤房值班单_${new Date().toISOString().split('T')[0]}.md`
    };
  },

  exportCsvShipList(batchId = null) {
    let query = `
      SELECT 
        eb.batch_number,
        s.name as ship_name,
        r.room_number,
        g.name,
        g.age,
        g.gender,
        g.phone,
        g.id_number,
        CASE WHEN g.is_elderly = 1 THEN '是' ELSE '否' END as is_elderly,
        CASE WHEN g.is_child = 1 THEN '是' ELSE '否' END as is_child,
        CASE WHEN g.has_disability = 1 THEN '是' ELSE '否' END as has_disability,
        CASE WHEN g.is_evacuated = 1 THEN '已撤离' ELSE '待撤离' END as status
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      LEFT JOIN evacuation_batches eb ON g.evacuation_batch_id = eb.id
      LEFT JOIN ships s ON eb.ship_id = s.id
    `;
    
    const params = [];
    if (batchId) {
      query += ' WHERE eb.id = ?';
      params.push(batchId);
    } else {
      query += ' WHERE g.evacuation_batch_id IS NOT NULL';
    }
    query += ' ORDER BY eb.batch_number, r.room_number';

    const guests = getAll(query, params);

    if (guests.length === 0) {
      return {
        content: '',
        filename: '船班名单.csv',
        message: '没有待导出的船班名单'
      };
    }

    const headers = [
      '批次', '船班', '房间号', '姓名', '年龄', '性别', '手机号',
      '身份证号', '老人', '儿童', '行动不便', '状态'
    ];

    let csv = headers.join(',') + '\n';
    
    for (const guest of guests) {
      const row = [
        guest.batch_number || '',
        guest.ship_name || '',
        guest.room_number || '',
        `"${guest.name || ''}"`,
        guest.age || '',
        guest.gender || '',
        guest.phone || '',
        guest.id_number || '',
        guest.is_elderly,
        guest.is_child,
        guest.has_disability,
        guest.status
      ];
      csv += row.join(',') + '\n';
    }

    const batchName = batchId ? `第${guests[0].batch_number}批次` : '全部';
    return {
      content: csv,
      filename: `船班名单_${batchName}_${new Date().toISOString().split('T')[0]}.csv`
    };
  },

  exportJsonAuditPackage() {
    const auditLogs = getAll(`
      SELECT * FROM audit_logs 
      ORDER BY created_at DESC
      LIMIT 500
    `);

    const status = this._getStatusData();
    
    const guests = getAll(`
      SELECT g.*, r.room_number, eb.batch_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      LEFT JOIN evacuation_batches eb ON g.evacuation_batch_id = eb.id
      ORDER BY g.created_at
    `);

    const rooms = getAll('SELECT * FROM rooms ORDER BY room_number');
    const batches = getAll(`
      SELECT eb.*, s.name as ship_name 
      FROM evacuation_batches eb 
      LEFT JOIN ships s ON eb.ship_id = s.id
      ORDER BY eb.batch_number
    `);
    const supplies = getAll('SELECT * FROM supplies');
    const ships = getAll('SELECT * FROM ships');
    const sandbags = getAll('SELECT * FROM sandbags');

    const auditPackage = {
      packageId: `audit_${Date.now()}`,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      
      status: {
        guests: status.guests,
        rooms: status.rooms,
        batches: status.batches,
        suppliesStatus: status.supplies
      },
      
      data: {
        guests: guests.map(g => ({
          id: g.id,
          name: g.name,
          roomNumber: g.room_number,
          age: g.age,
          gender: g.gender,
          phone: g.phone,
          isElderly: g.is_elderly === 1,
          isChild: g.is_child === 1,
          hasDisability: g.has_disability === 1,
          isEvacuated: g.is_evacuated === 1,
          batchNumber: g.batch_number,
          checkinDate: g.checkin_date,
          checkoutDate: g.checkout_date
        })),
        rooms: rooms.map(r => ({
          id: r.id,
          roomNumber: r.room_number,
          floor: r.floor,
          capacity: r.capacity,
          isOccupied: r.is_occupied === 1,
          isEvacuated: r.is_evacuated === 1,
          isWindowSealed: r.is_window_sealed === 1
        })),
        batches: batches.map(b => ({
          id: b.id,
          batchNumber: b.batch_number,
          shipName: b.ship_name,
          priority: b.priority,
          status: b.status,
          guestCount: b.guest_count,
          maxCapacity: b.max_capacity
        })),
        supplies: supplies.map(s => ({
          id: s.id,
          type: s.type,
          name: s.name,
          quantity: s.quantity,
          unit: s.unit,
          minThreshold: s.min_threshold,
          status: s.status
        })),
        ships: ships.map(s => ({
          id: s.id,
          name: s.name,
          capacity: s.capacity,
          currentLoad: s.current_load,
          status: s.status
        })),
        sandbags: sandbags.map(s => ({
          id: s.id,
          location: s.location,
          quantity: s.quantity,
          needed: s.needed,
          status: s.status
        }))
      },
      
      auditLogs: auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        details: JSON.parse(log.details || '{}'),
        createdBy: log.created_by,
        createdAt: log.created_at
      }))
    };

    return {
      content: JSON.stringify(auditPackage, null, 2),
      filename: `审计包_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      data: auditPackage
    };
  },

  _getStatusData() {
    const guests = getAll('SELECT * FROM guests');
    const evacuated = guests.filter(g => g.is_evacuated === 1);
    
    const rooms = getAll('SELECT * FROM rooms');
    const occupied = rooms.filter(r => r.is_occupied === 1);
    const evacuatedRooms = rooms.filter(r => r.is_evacuated === 1);
    const sealedRooms = rooms.filter(r => r.is_window_sealed === 1);

    const batches = getAll('SELECT * FROM evacuation_batches');

    return {
      guests: {
        total: guests.length,
        evacuated: evacuated.length,
        percentage: guests.length > 0 ? Math.round((evacuated.length / guests.length) * 100) : 0
      },
      rooms: {
        occupied: occupied.length,
        evacuated: evacuatedRooms.length,
        sealed: sealedRooms.length
      },
      batches: {
        total: batches.length,
        completed: batches.filter(b => b.status === 'completed').length,
        inProgress: batches.filter(b => b.status === 'in_progress').length
      },
      supplies: RulesEngine.validateAllSupplies()
    };
  },

  _getGuestsByBatch() {
    const guests = getAll(`
      SELECT g.*, r.room_number, g.evacuation_batch_id as batch_id
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      WHERE g.evacuation_batch_id IS NOT NULL
    `);

    const byBatch = {};
    for (const guest of guests) {
      if (!byBatch[guest.batch_id]) {
        byBatch[guest.batch_id] = [];
      }
      byBatch[guest.batch_id].push(guest);
    }

    return byBatch;
  }
};

export default ExportService;
