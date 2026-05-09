const { db } = require('../db/database');

class ReportService {
  static getDormOccupancyReport() {
    const buildings = db.prepare(`
      SELECT 
        b.id as building_id,
        b.building_code,
        b.building_name,
        COUNT(DISTINCT dr.id) as total_rooms,
        SUM(dr.bed_count) as total_beds,
        SUM(CASE WHEN be.status = 'occupied' THEN 1 ELSE 0 END) as occupied_beds,
        SUM(CASE WHEN be.status = 'available' THEN 1 ELSE 0 END) as available_beds
      FROM buildings b
      LEFT JOIN dorm_rooms dr ON b.id = dr.building_id AND dr.is_active = 1
      LEFT JOIN beds be ON dr.id = be.room_id
      GROUP BY b.id
      ORDER BY b.building_code
    `).all();
    
    const total = {
      total_buildings: buildings.length,
      total_rooms: buildings.reduce((sum, b) => sum + b.total_rooms, 0),
      total_beds: buildings.reduce((sum, b) => sum + b.total_beds, 0),
      occupied_beds: buildings.reduce((sum, b) => sum + b.occupied_beds, 0),
      available_beds: buildings.reduce((sum, b) => sum + b.available_beds, 0)
    };
    
    return {
      summary: {
        ...total,
        occupancy_rate: total.total_beds > 0 
          ? Math.round((total.occupied_beds / total.total_beds) * 10000) / 100 
          : 0
      },
      buildings: buildings.map(b => ({
        ...b,
        occupancy_rate: b.total_beds > 0 
          ? Math.round((b.occupied_beds / b.total_beds) * 10000) / 100 
          : 0
      }))
    };
  }
  
  static getTransferStatistics(period = 'month') {
    let dateCondition = '';
    const now = new Date();
    
    if (period === 'week') {
      dateCondition = "datetime(ta.created_at) >= datetime('now', '-7 days')";
    } else if (period === 'month') {
      dateCondition = "datetime(ta.created_at) >= datetime('now', '-30 days')";
    } else if (period === 'quarter') {
      dateCondition = "datetime(ta.created_at) >= datetime('now', '-90 days')";
    }
    
    const stats = db.prepare(`
      SELECT 
        ta.status,
        COUNT(*) as count
      FROM transfer_applications ta
      ${dateCondition ? `WHERE ${dateCondition}` : ''}
      GROUP BY ta.status
    `).all();
    
    const statusMap = {};
    stats.forEach(s => { statusMap[s.status] = s.count; });
    
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM transfer_applications 
      ${dateCondition ? `WHERE ${dateCondition}` : ''}
    `).get();
    
    return {
      period: period,
      total_applications: total.count,
      by_status: {
        pending: statusMap.pending || 0,
        approved: statusMap.approved || 0,
        completed: statusMap.completed || 0,
        rejected: statusMap.rejected || 0,
        withdrawn: statusMap.withdrawn || 0,
        reversed: statusMap.reversed || 0
      }
    };
  }
  
  static getFeeReport() {
    const currentPeriod = this.getCurrentPeriod();
    
    const fees = db.prepare(`
      SELECT 
        f.status,
        COUNT(*) as count,
        SUM(f.amount) as total_amount
      FROM fees f
      WHERE f.bill_period = ?
      GROUP BY f.status
    `).all(currentPeriod);
    
    const statusMap = {};
    fees.forEach(f => { statusMap[f.status] = f; });
    
    const adjustments = db.prepare(`
      SELECT 
        SUM(CASE WHEN fa.adjustment_amount > 0 THEN fa.adjustment_amount ELSE 0 END) as total_additions,
        SUM(CASE WHEN fa.adjustment_amount < 0 THEN ABS(fa.adjustment_amount) ELSE 0 END) as total_deductions,
        COUNT(*) as adjustment_count
      FROM fee_adjustments fa
      WHERE datetime(fa.created_at) >= datetime('now', 'start of month')
    `).get();
    
    return {
      bill_period: currentPeriod,
      summary: {
        unpaid: {
          count: statusMap.unpaid?.count || 0,
          amount: statusMap.unpaid?.total_amount || 0
        },
        paid: {
          count: statusMap.paid?.count || 0,
          amount: statusMap.paid?.total_amount || 0
        }
      },
      monthly_adjustments: {
        count: adjustments.adjustment_count || 0,
        total_additions: adjustments.total_additions || 0,
        total_deductions: adjustments.total_deductions || 0,
        net: (adjustments.total_additions || 0) - (adjustments.total_deductions || 0)
      }
    };
  }
  
  static getAccessSyncReport(period = 'month') {
    let dateCondition = '';
    if (period === 'week') {
      dateCondition = "datetime(synced_at) >= datetime('now', '-7 days')";
    } else if (period === 'month') {
      dateCondition = "datetime(synced_at) >= datetime('now', '-30 days')";
    }
    
    const syncs = db.prepare(`
      SELECT 
        sync_status,
        COUNT(*) as count
      FROM access_sync_logs
      ${dateCondition ? `WHERE ${dateCondition}` : ''}
      GROUP BY sync_status
    `).all();
    
    const map = {};
    syncs.forEach(s => { map[s.sync_status] = s.count; });
    
    const cardsWithIssues = db.prepare(`
      SELECT 
        COUNT(DISTINCT ac.id) as cards_need_attention
      FROM access_cards ac
      WHERE ac.status = 'active'
      AND ac.last_sync_at IS NULL 
      OR datetime(ac.last_sync_at) < datetime('now', '-30 days')
    `).get();
    
    return {
      period: period,
      sync_summary: {
        success: map.success || 0,
        failed: map.failed || 0
      },
      cards_needing_attention: cardsWithIssues.cards_need_attention || 0
    };
  }
  
  static getStudentDormDetails(studentId) {
    const student = db.prepare(`
      SELECT 
        s.*,
        b.bed_code, b.bed_number, b.status as bed_status, b.assigned_at,
        dr.room_code, dr.floor_number, dr.room_number, dr.fee_per_semester,
        bd.building_code, bd.building_name
      FROM students s
      LEFT JOIN beds b ON s.current_bed_id = b.id
      LEFT JOIN dorm_rooms dr ON b.room_id = dr.id
      LEFT JOIN buildings bd ON dr.building_id = bd.id
      WHERE s.id = ?
    `).get(studentId);
    
    if (!student) return null;
    
    const transfers = db.prepare(`
      SELECT 
        ta.*,
        ob.bed_code as original_bed_code, orr.room_code as original_room_code, obd.building_name as original_building,
        tb.bed_code as target_bed_code, trr.room_code as target_room_code, tbd.building_name as target_building
      FROM transfer_applications ta
      LEFT JOIN beds ob ON ta.original_bed_id = ob.id
      LEFT JOIN dorm_rooms orr ON ob.room_id = orr.id
      LEFT JOIN buildings obd ON orr.building_id = obd.id
      LEFT JOIN beds tb ON ta.target_bed_id = tb.id
      LEFT JOIN dorm_rooms trr ON tb.room_id = trr.id
      LEFT JOIN buildings tbd ON trr.building_id = tbd.id
      WHERE ta.student_id = ?
      ORDER BY ta.created_at DESC
    `).all(studentId);
    
    const fees = db.prepare(`
      SELECT f.*, b.bed_code, dr.room_code
      FROM fees f
      JOIN beds b ON f.bed_id = b.id
      JOIN dorm_rooms dr ON b.room_id = dr.id
      WHERE f.student_id = ?
      ORDER BY f.created_at DESC
    `).all(studentId);
    
    const accessCard = db.prepare(`
      SELECT * FROM access_cards 
      WHERE student_id = ? AND status = 'active'
    `).get(studentId);
    
    const cardWithParsedBeds = accessCard ? {
      ...accessCard,
      authorized_bed_ids: JSON.parse(accessCard.authorized_bed_ids || '[]')
    } : null;
    
    return {
      student: {
        id: student.id,
        student_no: student.student_no,
        name: student.name,
        gender: student.gender,
        class_name: student.class_name,
        major: student.major
      },
      current_dorm: student.current_bed_id ? {
        building: {
          code: student.building_code,
          name: student.building_name
        },
        room: {
          code: student.room_code,
          floor: student.floor_number,
          number: student.room_number,
          fee_per_semester: student.fee_per_semester
        },
        bed: {
          code: student.bed_code,
          number: student.bed_number,
          assigned_at: student.assigned_at
        }
      } : null,
      transfer_history: transfers,
      fees: fees,
      access_card: cardWithParsedBeds
    };
  }
  
  static getCurrentPeriod() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    if (month >= 2 && month <= 7) {
      return `${year}-春季`;
    } else {
      return `${year}-秋季`;
    }
  }
  
  static getComprehensiveReport() {
    return {
      generated_at: new Date().toISOString(),
      dorm_occupancy: this.getDormOccupancyReport(),
      transfer_statistics: this.getTransferStatistics('month'),
      fee_summary: this.getFeeReport(),
      access_sync: this.getAccessSyncReport('month')
    };
  }
}

module.exports = ReportService;