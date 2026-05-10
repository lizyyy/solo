const express = require('express');
const { getDB } = require('../config/database');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  try {
    const db = getDB();
    
    const totalAnimals = db.prepare('SELECT COUNT(*) as count FROM animals').get().count;
    const totalCages = db.prepare('SELECT COUNT(*) as count FROM cages').get().count;
    const availableCages = db.prepare("SELECT COUNT(*) as count FROM cages WHERE status = 'available'").get().count;
    const occupiedCages = db.prepare("SELECT COUNT(*) as count FROM cages WHERE status = 'occupied'").get().count;
    
    const totalAllocations = db.prepare('SELECT COUNT(*) as count FROM allocations').get().count;
    const pendingAllocations = db.prepare("SELECT COUNT(*) as count FROM allocations WHERE status = 'pending'").get().count;
    const validatingAllocations = db.prepare("SELECT COUNT(*) as count FROM allocations WHERE status = 'validating'").get().count;
    const approvedAllocations = db.prepare("SELECT COUNT(*) as count FROM allocations WHERE status = 'approved'").get().count;
    const allocatedAllocations = db.prepare("SELECT COUNT(*) as count FROM allocations WHERE status IN ('allocated', 'in_transit', 'completed')").get().count;
    const cancelledAllocations = db.prepare("SELECT COUNT(*) as count FROM allocations WHERE status IN ('cancelled', 'rejected')").get().count;
    
    const transferCount = db.prepare("SELECT COUNT(*) as count FROM allocations WHERE action IN ('transfer', 'temporary_move')").get().count;
    const releaseCount = db.prepare("SELECT COUNT(*) as count FROM allocations WHERE action = 'release'").get().count;
    
    const cagesByRoom = db.prepare(`
      SELECT room, 
             COUNT(*) as total,
             SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
             SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
             SUM(current_occupancy) as total_animals
      FROM cages
      GROUP BY room
      ORDER BY room
    `).all();
    
    const strainsStats = db.prepare(`
      SELECT s.id, s.code, s.name,
             COUNT(a.id) as animal_count,
             COUNT(DISTINCT c.id) as cage_count
      FROM strains s
      LEFT JOIN animals a ON s.id = a.strain_id
      LEFT JOIN cages c ON s.id = c.strain_id
      WHERE s.is_active = 1
      GROUP BY s.id, s.code, s.name
      ORDER BY animal_count DESC
    `).all();
    
    const genderDistribution = db.prepare(`
      SELECT gender, COUNT(*) as count
      FROM animals
      GROUP BY gender
    `).all();
    
    const recentActivities = db.prepare(`
      SELECT a.id, a.request_id, a.action, a.status, a.created_at,
             an.animal_id as animal_identifier,
             s.name as strain_name,
             c.code as cage_code
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN cages c ON a.cage_id = c.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all();
    
    const utilizationRate = totalCages > 0 ? ((occupiedCages / totalCages) * 100).toFixed(1) : 0;
    const allocationSuccessRate = (allocatedAllocations + cancelledAllocations) > 0 
      ? ((allocatedAllocations / (allocatedAllocations + cancelledAllocations)) * 100).toFixed(1) 
      : 0;
    
    res.json({
      success: true,
      data: {
        overview: {
          totalAnimals,
          totalCages,
          availableCages,
          occupiedCages,
          utilizationRate: `${utilizationRate}%`
        },
        allocations: {
          total: totalAllocations,
          pending: pendingAllocations,
          validating: validatingAllocations,
          approved: approvedAllocations,
          allocated: allocatedAllocations,
          cancelled: cancelledAllocations,
          successRate: `${allocationSuccessRate}%`
        },
        operations: {
          transfers: transferCount,
          releases: releaseCount
        },
        cagesByRoom,
        strainsStats,
        genderDistribution,
        recentActivities
      }
    });
  } catch (error) {
    console.error('获取看板数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取看板数据失败',
      error: error.message
    });
  }
});

router.get('/allocation-summary', (req, res) => {
  try {
    const { start_date, end_date, strain_id, action } = req.query;
    const db = getDB();
    
    let query = `
      SELECT 
        a.id, a.request_id, a.action, a.status, a.reason, a.operator,
        a.created_at, a.updated_at,
        an.animal_id as animal_identifier, an.gender, an.birth_date,
        s.id as strain_id, s.code as strain_code, s.name as strain_name,
        c.id as cage_id, c.code as cage_code, c.room as cage_room,
        c.rack as cage_rack, c.position as cage_position,
        ir.code as isolation_code, ir.name as isolation_name,
        pc.code as previous_cage_code,
        ah.from_status, ah.to_status, ah.action as history_action,
        ah.created_at as history_time
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN cages c ON a.cage_id = c.id
      LEFT JOIN isolation_rules ir ON an.isolation_rule_id = ir.id
      LEFT JOIN cages pc ON a.previous_cage_id = pc.id
      LEFT JOIN allocation_history ah ON a.id = ah.allocation_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (start_date) {
      query += ' AND a.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND a.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    if (strain_id) {
      query += ' AND an.strain_id = ?';
      params.push(strain_id);
    }
    if (action) {
      query += ' AND a.action = ?';
      params.push(action);
    }
    
    query += ' ORDER BY a.created_at DESC';
    
    const records = db.prepare(query).all(...params);
    
    const groupedRecords = {};
    records.forEach(record => {
      if (!groupedRecords[record.id]) {
        groupedRecords[record.id] = {
          id: record.id,
          request_id: record.request_id,
          action: record.action,
          status: record.status,
          reason: record.reason,
          operator: record.operator,
          created_at: record.created_at,
          updated_at: record.updated_at,
          animal: {
            id: record.animal_id,
            animal_id: record.animal_identifier,
            gender: record.gender,
            birth_date: record.birth_date
          },
          strain: {
            id: record.strain_id,
            code: record.strain_code,
            name: record.strain_name
          },
          cage: record.cage_id ? {
            id: record.cage_id,
            code: record.cage_code,
            room: record.cage_room,
            rack: record.cage_rack,
            position: record.cage_position
          } : null,
          isolation: record.isolation_code ? {
            code: record.isolation_code,
            name: record.isolation_name
          } : null,
          previous_cage: record.previous_cage_code ? {
            code: record.previous_cage_code
          } : null,
          history: []
        };
      }
      
      if (record.from_status || record.to_status) {
        groupedRecords[record.id].history.push({
          from_status: record.from_status,
          to_status: record.to_status,
          action: record.history_action,
          time: record.history_time
        });
      }
    });
    
    const summary = Object.values(groupedRecords);
    
    const stats = {
      total: summary.length,
      byAction: {},
      byStatus: {},
      byStrain: {}
    };
    
    summary.forEach(record => {
      stats.byAction[record.action] = (stats.byAction[record.action] || 0) + 1;
      stats.byStatus[record.status] = (stats.byStatus[record.status] || 0) + 1;
      const strainKey = record.strain?.code || 'unknown';
      stats.byStrain[strainKey] = (stats.byStrain[strainKey] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        summary,
        stats,
        total: summary.length
      }
    });
  } catch (error) {
    console.error('获取分配汇总报表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分配汇总报表失败',
      error: error.message
    });
  }
});

router.get('/cage-utilization', (req, res) => {
  try {
    const { room } = req.query;
    const db = getDB();
    
    let query = `
      SELECT 
        c.id, c.code, c.room, c.rack, c.position,
        c.max_capacity, c.current_occupancy, c.status,
        s.code as strain_code, s.name as strain_name,
        c.gender,
        ir.code as isolation_code, ir.name as isolation_name,
        c.notes, c.created_at, c.updated_at
      FROM cages c
      LEFT JOIN strains s ON c.strain_id = s.id
      LEFT JOIN isolation_rules ir ON c.isolation_rule_id = ir.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (room) {
      query += ' AND c.room = ?';
      params.push(room);
    }
    
    query += ' ORDER BY c.room, c.rack, c.position';
    
    const cages = db.prepare(query).all(...params);
    
    const detailedCages = cages.map(cage => {
      const animalsInCage = db.prepare(`
        SELECT an.id, an.animal_id, an.gender, an.birth_date, an.health_status,
               s.code as strain_code, s.name as strain_name
        FROM allocations al
        LEFT JOIN animals an ON al.animal_id = an.id
        LEFT JOIN strains s ON an.strain_id = s.id
        WHERE al.cage_id = ? AND al.status IN ('allocated', 'in_transit', 'completed')
      `).all(cage.id);
      
      const utilizationRate = cage.max_capacity > 0 
        ? ((cage.current_occupancy / cage.max_capacity) * 100).toFixed(1) 
        : 0;
      
      return {
        ...cage,
        animals: animalsInCage,
        utilizationRate: `${utilizationRate}%`,
        availableSlots: cage.max_capacity - cage.current_occupancy
      };
    });
    
    const stats = {
      total: detailedCages.length,
      available: detailedCages.filter(c => c.status === 'available').length,
      occupied: detailedCages.filter(c => c.status === 'occupied').length,
      maintenance: detailedCages.filter(c => c.status === 'maintenance').length,
      totalAnimals: detailedCages.reduce((sum, c) => sum + c.current_occupancy, 0),
      totalCapacity: detailedCages.reduce((sum, c) => sum + c.max_capacity, 0)
    };
    stats.overallUtilization = stats.totalCapacity > 0 
      ? ((stats.totalAnimals / stats.totalCapacity) * 100).toFixed(1) 
      : 0;
    
    res.json({
      success: true,
      data: {
        cages: detailedCages,
        stats
      }
    });
  } catch (error) {
    console.error('获取笼位利用率报表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取笼位利用率报表失败',
      error: error.message
    });
  }
});

router.get('/strain-isolation-compliance', (req, res) => {
  try {
    const db = getDB();
    
    const allocations = db.prepare(`
      SELECT 
        a.id, a.request_id, a.action, a.status,
        an.animal_id as animal_identifier, an.gender,
        s.id as strain_id, s.code as strain_code, s.name as strain_name,
        ir_animal.code as animal_isolation_code, ir_animal.name as animal_isolation_name,
        c.id as cage_id, c.code as cage_code, c.room as cage_room,
        s_cage.code as cage_strain_code, s_cage.name as cage_strain_name,
        ir_cage.code as cage_isolation_code, ir_cage.name as cage_isolation_name,
        a.validation_rules,
        a.created_at
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN isolation_rules ir_animal ON an.isolation_rule_id = ir_animal.id
      LEFT JOIN cages c ON a.cage_id = c.id
      LEFT JOIN strains s_cage ON c.strain_id = s_cage.id
      LEFT JOIN isolation_rules ir_cage ON c.isolation_rule_id = ir_cage.id
      WHERE a.status IN ('allocated', 'in_transit', 'completed')
      ORDER BY a.created_at DESC
    `).all();
    
    const complianceChecks = allocations.map(alloc => {
      const issues = [];
      let strainCompliant = true;
      let genderCompliant = true;
      let isolationCompliant = true;
      
      if (alloc.cage_strain_code && alloc.cage_strain_code !== alloc.strain_code) {
        strainCompliant = false;
        issues.push({
          type: 'strain_mismatch',
          severity: 'high',
          message: `动物品系(${alloc.strain_code})与笼位品系(${alloc.cage_strain_code})不匹配`
        });
      }
      
      if (alloc.cage_isolation_code && alloc.animal_isolation_code && 
          alloc.cage_isolation_code !== alloc.animal_isolation_code) {
        isolationCompliant = false;
        issues.push({
          type: 'isolation_mismatch',
          severity: 'high',
          message: `动物隔离级别(${alloc.animal_isolation_name})与笼位隔离级别(${alloc.cage_isolation_name})不匹配`
        });
      }
      
      return {
        allocation: {
          id: alloc.id,
          request_id: alloc.request_id,
          action: alloc.action,
          status: alloc.status
        },
        animal: {
          id: alloc.animal_identifier,
          gender: alloc.gender,
          strain: { code: alloc.strain_code, name: alloc.strain_name },
          isolation: alloc.animal_isolation_code ? {
            code: alloc.animal_isolation_code,
            name: alloc.animal_isolation_name
          } : null
        },
        cage: {
          id: alloc.cage_id,
          code: alloc.cage_code,
          room: alloc.cage_room,
          strain: alloc.cage_strain_code ? {
            code: alloc.cage_strain_code,
            name: alloc.cage_strain_name
          } : null,
          isolation: alloc.cage_isolation_code ? {
            code: alloc.cage_isolation_code,
            name: alloc.cage_isolation_name
          } : null
        },
        compliance: {
          strainCompliant,
          genderCompliant,
          isolationCompliant,
          overallCompliant: strainCompliant && genderCompliant && isolationCompliant
        },
        issues,
        validationRules: alloc.validation_rules ? JSON.parse(alloc.validation_rules) : null,
        allocatedAt: alloc.created_at
      };
    });
    
    const stats = {
      total: complianceChecks.length,
      compliant: complianceChecks.filter(c => c.compliance.overallCompliant).length,
      withIssues: complianceChecks.filter(c => !c.compliance.overallCompliant).length,
      strainIssues: complianceChecks.filter(c => !c.compliance.strainCompliant).length,
      isolationIssues: complianceChecks.filter(c => !c.compliance.isolationCompliant).length
    };
    stats.complianceRate = stats.total > 0 
      ? ((stats.compliant / stats.total) * 100).toFixed(1) 
      : 0;
    
    res.json({
      success: true,
      data: {
        checks: complianceChecks,
        stats,
        summary: {
          totalAllocations: stats.total,
          compliantAllocations: stats.compliant,
          complianceRate: `${stats.complianceRate}%`,
          issuesFound: stats.withIssues
        }
      }
    });
  } catch (error) {
    console.error('获取品系隔离合规性报表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取品系隔离合规性报表失败',
      error: error.message
    });
  }
});

module.exports = router;
