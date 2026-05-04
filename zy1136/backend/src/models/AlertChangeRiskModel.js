import { db } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class AlertModel {
  static create(alertData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const groupKey = this.generateGroupKey(alertData);
    
    const stmt = db.prepare(`
      INSERT INTO alerts (
        id, title, type, severity, asset_id, ip_address,
        description, raw_data, is_acknowledged, acknowledged_by,
        acknowledged_at, group_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      alertData.title,
      alertData.type,
      alertData.severity || 'info',
      alertData.asset_id,
      alertData.ip_address,
      alertData.description,
      alertData.raw_data ? JSON.stringify(alertData.raw_data) : null,
      0,
      null,
      null,
      groupKey,
      now
    );
    
    return this.findById(id);
  }

  static generateGroupKey(alertData) {
    const parts = [];
    if (alertData.asset_id) parts.push(`asset:${alertData.asset_id}`);
    if (alertData.ip_address) parts.push(`ip:${alertData.ip_address}`);
    if (alertData.type) parts.push(`type:${alertData.type}`);
    if (alertData.group_key_override) return alertData.group_key_override;
    return parts.join('|') || `alert:${Date.now()}`;
  }

  static findById(id) {
    return db.prepare(`
      SELECT a.*,
             asset.name as asset_name, asset.type as asset_type,
             asset.department, asset.owner
      FROM alerts a
      LEFT JOIN assets asset ON a.asset_id = asset.id
      WHERE a.id = ?
    `).get(id);
  }

  static findAll(filters = {}) {
    let sql = `
      SELECT a.*,
             asset.name as asset_name, asset.type as asset_type,
             asset.department, asset.owner,
             (SELECT COUNT(*) FROM alerts a2 WHERE a2.group_key = a.group_key AND a2.created_at <= a.created_at) as occurrence
      FROM alerts a
      LEFT JOIN assets asset ON a.asset_id = asset.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.type) {
      sql += ' AND a.type = ?';
      params.push(filters.type);
    }
    if (filters.severity) {
      sql += ' AND a.severity = ?';
      params.push(filters.severity);
    }
    if (filters.is_acknowledged !== undefined) {
      sql += ' AND a.is_acknowledged = ?';
      params.push(filters.is_acknowledged ? 1 : 0);
    }
    if (filters.asset_id) {
      sql += ' AND a.asset_id = ?';
      params.push(filters.asset_id);
    }
    if (filters.search) {
      sql += ' AND (a.title LIKE ? OR a.description LIKE ?)';
      const search = `%${filters.search}%`;
      params.push(search, search);
    }

    sql += ' ORDER BY a.created_at DESC';

    return db.prepare(sql).all(...params);
  }

  static getGrouped(filters = {}) {
    let sql = `
      SELECT 
        group_key,
        type,
        severity,
        asset_id,
        ip_address,
        COUNT(*) as count,
        MIN(created_at) as first_occurrence,
        MAX(created_at) as last_occurrence,
        GROUP_CONCAT(DISTINCT title) as titles
      FROM alerts
      WHERE 1=1
    `;
    const params = [];

    if (filters.is_acknowledged !== undefined) {
      sql += ' AND is_acknowledged = ?';
      params.push(filters.is_acknowledged ? 1 : 0);
    }
    if (filters.severity) {
      sql += ' AND severity = ?';
      params.push(filters.severity);
    }

    sql += ' GROUP BY group_key, type, severity, asset_id, ip_address';
    sql += ' ORDER BY last_occurrence DESC';

    return db.prepare(sql).all(...params);
  }

  static acknowledge(id, acknowledgedBy) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE alerts 
      SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
      WHERE id = ?
    `);
    stmt.run(acknowledgedBy || 'system', now, id);
    return this.findById(id);
  }

  static acknowledgeGroup(groupKey, acknowledgedBy) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE alerts 
      SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
      WHERE group_key = ? AND is_acknowledged = 0
    `);
    const result = stmt.run(acknowledgedBy || 'system', now, groupKey);
    return result.changes;
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM alerts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count;
    const unacknowledged = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_acknowledged = 0').get().count;
    const bySeverity = db.prepare(`
      SELECT severity, COUNT(*) as count 
      FROM alerts 
      WHERE is_acknowledged = 0 
      GROUP BY severity
    `).all();
    const byType = db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM alerts 
      WHERE is_acknowledged = 0 
      GROUP BY type
      LIMIT 10
    `).all();

    return {
      total,
      unacknowledged,
      bySeverity,
      byType
    };
  }
}

class FirewallRuleModel {
  static create(ruleData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO firewall_rules (
        id, rule_number, name, action, source, destination,
        protocol, ports, description, is_enabled,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      ruleData.rule_number,
      ruleData.name,
      ruleData.action || 'allow',
      ruleData.source,
      ruleData.destination,
      ruleData.protocol || 'any',
      ruleData.ports,
      ruleData.description,
      ruleData.is_enabled !== false ? 1 : 0,
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM firewall_rules WHERE id = ?').get(id);
  }

  static findAll(filters = {}) {
    let sql = 'SELECT * FROM firewall_rules WHERE 1=1';
    const params = [];

    if (filters.action) {
      sql += ' AND action = ?';
      params.push(filters.action);
    }
    if (filters.is_enabled !== undefined) {
      sql += ' AND is_enabled = ?';
      params.push(filters.is_enabled ? 1 : 0);
    }
    if (filters.search) {
      sql += ' AND (name LIKE ? OR source LIKE ? OR destination LIKE ?)';
      const search = `%${filters.search}%`;
      params.push(search, search, search);
    }

    sql += ' ORDER BY rule_number, created_at';

    return db.prepare(sql).all(...params);
  }

  static update(id, ruleData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    const allowedFields = [
      'rule_number', 'name', 'action', 'source', 'destination',
      'protocol', 'ports', 'description', 'is_enabled'
    ];

    allowedFields.forEach(field => {
      if (ruleData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(field === 'is_enabled' ? (ruleData[field] ? 1 : 0) : ruleData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(now, id);

    const stmt = db.prepare(`UPDATE firewall_rules SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM firewall_rules WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static findOverlyPermissive() {
    return db.prepare(`
      SELECT * FROM firewall_rules
      WHERE is_enabled = 1
        AND (
          source = '0.0.0.0/0' OR source = 'any' OR source IS NULL
          OR destination = '0.0.0.0/0' OR destination = 'any' OR destination IS NULL
          OR ports = 'any' OR ports = '0-65535' OR ports IS NULL
          OR protocol = 'any' OR protocol IS NULL
        )
      ORDER BY rule_number
    `).all();
  }

  static findGuestToInternalRules() {
    const guestSegments = db.prepare(`
      SELECT cidr FROM network_segments ns
      JOIN vlans v ON ns.vlan_id = v.id
      WHERE v.is_guest = 1
    `).all();

    if (guestSegments.length === 0) return [];

    const internalSegments = db.prepare(`
      SELECT cidr FROM network_segments ns
      JOIN vlans v ON ns.vlan_id = v.id
      WHERE v.is_guest = 0
    `).all();

    if (internalSegments.length === 0) return [];

    return this.findAll({ is_enabled: true, action: 'allow' }).filter(rule => {
      const isSourceGuest = guestSegments.some(gs => 
        rule.source && (rule.source.includes(gs.cidr.split('/')[0]) || rule.source === 'any')
      );
      const isDestInternal = internalSegments.some(is => 
        rule.destination && (rule.destination.includes(is.cidr.split('/')[0]) || rule.destination === 'any')
      );
      return isSourceGuest && isDestInternal;
    });
  }
}

class ChangeOrderModel {
  static STATUS_FLOW = {
    pending_evaluation: ['approved', 'rejected'],
    approved: ['executing'],
    executing: ['executed', 'rolled_back'],
    executed: ['completed', 'rolling_back'],
    rolling_back: ['rolled_back'],
    rolled_back: ['completed'],
    rejected: [],
    completed: []
  };

  static create(changeData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO change_orders (
        id, title, type, description, status,
        requested_by, approved_by, executed_by, rolled_back_by,
        impact_analysis, change_details, rollback_plan,
        requested_at, approved_at, executed_at, rolled_back_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      changeData.title,
      changeData.type,
      changeData.description,
      changeData.status || 'pending_evaluation',
      changeData.requested_by || 'system',
      null,
      null,
      null,
      changeData.impact_analysis,
      changeData.change_details,
      changeData.rollback_plan,
      now,
      null,
      null,
      null,
      null
    );
    
    if (changeData.affected_assets && changeData.affected_assets.length > 0) {
      changeData.affected_assets.forEach(asset => {
        this.addAffectedAsset(id, asset.asset_id, asset.impact_type, asset.notes);
      });
    }
    
    return this.findById(id);
  }

  static addAffectedAsset(changeId, assetId, impactType, notes) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO change_affected_assets 
      (change_order_id, asset_id, impact_type, notes)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(changeId, assetId, impactType, notes);
  }

  static findById(id) {
    const change = db.prepare(`
      SELECT co.*,
             GROUP_CONCAT(DISTINCT caa.asset_id) as affected_asset_ids
      FROM change_orders co
      LEFT JOIN change_affected_assets caa ON co.id = caa.change_order_id
      WHERE co.id = ?
      GROUP BY co.id
    `).get(id);

    if (!change) return null;

    if (change.affected_asset_ids) {
      change.affected_assets = db.prepare(`
        SELECT caa.*, a.name as asset_name, a.type as asset_type, a.department
        FROM change_affected_assets caa
        JOIN assets a ON caa.asset_id = a.id
        WHERE caa.change_order_id = ?
      `).all(id);
    } else {
      change.affected_assets = [];
    }

    return change;
  }

  static findAll(filters = {}) {
    let sql = `
      SELECT co.*,
             (SELECT COUNT(*) FROM change_affected_assets caa WHERE caa.change_order_id = co.id) as affected_count
      FROM change_orders co
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ' AND co.status = ?';
      params.push(filters.status);
    }
    if (filters.type) {
      sql += ' AND co.type = ?';
      params.push(filters.type);
    }
    if (filters.search) {
      sql += ' AND (co.title LIKE ? OR co.description LIKE ?)';
      const search = `%${filters.search}%`;
      params.push(search, search);
    }

    sql += ' ORDER BY co.requested_at DESC';

    return db.prepare(sql).all(...params);
  }

  static canTransition(fromStatus, toStatus) {
    const allowed = this.STATUS_FLOW[fromStatus];
    return allowed ? allowed.includes(toStatus) : false;
  }

  static transition(id, toStatus, actor, details = {}) {
    const current = this.findById(id);
    if (!current) throw new Error('变更单不存在');
    
    if (!this.canTransition(current.status, toStatus)) {
      throw new Error(`不允许从 ${current.status} 转换到 ${toStatus}`);
    }

    const now = new Date().toISOString();
    const updates = { status: toStatus };

    switch (toStatus) {
      case 'approved':
        updates.approved_by = actor || 'system';
        updates.approved_at = now;
        if (details.impact_analysis) updates.impact_analysis = details.impact_analysis;
        break;
      case 'executed':
        updates.executed_by = actor || 'system';
        updates.executed_at = now;
        break;
      case 'rolled_back':
        updates.rolled_back_by = actor || 'system';
        updates.rolled_back_at = now;
        break;
      case 'completed':
        updates.completed_at = now;
        break;
    }

    return this.update(id, updates);
  }

  static update(id, changeData) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'title', 'type', 'description', 'status',
      'requested_by', 'approved_by', 'executed_by', 'rolled_back_by',
      'impact_analysis', 'change_details', 'rollback_plan',
      'approved_at', 'executed_at', 'rolled_back_at', 'completed_at'
    ];

    allowedFields.forEach(field => {
      if (changeData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(changeData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    values.push(id);

    const stmt = db.prepare(`UPDATE change_orders SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    db.prepare('DELETE FROM change_affected_assets WHERE change_order_id = ?').run(id);
    const stmt = db.prepare('DELETE FROM change_orders WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM change_orders').get().count;
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM change_orders 
      GROUP BY status
    `).all();
    const pending = db.prepare(`
      SELECT COUNT(*) as count FROM change_orders 
      WHERE status IN ('pending_evaluation', 'approved', 'executing')
    `).get().count;

    return {
      total,
      byStatus,
      pending
    };
  }

  static analyzeImpact(changeData) {
    const impacts = [];
    const affectedAssets = [];

    if (changeData.type === 'vlan' || changeData.vlan_id) {
      const vlanAssets = db.prepare(`
        SELECT a.*, ip.ip, sp.port_number, s.name as switch_name
        FROM assets a
        LEFT JOIN ip_addresses ip ON a.id = ip.asset_id
        LEFT JOIN switch_ports sp ON a.id = sp.connected_asset_id
        LEFT JOIN assets s ON sp.switch_id = s.id
        WHERE ip.vlan_id = ? OR sp.vlan_id = ?
      `).all(changeData.vlan_id, changeData.vlan_id);

      vlanAssets.forEach(asset => {
        affectedAssets.push({
          asset_id: asset.id,
          impact_type: 'network_disruption',
          notes: `VLAN变更可能影响 ${asset.name} (${asset.ip || asset.mac_address})`
        });
        impacts.push(`设备 ${asset.name} 可能受到网络中断影响`);
      });
    }

    if (changeData.type === 'firewall' || changeData.firewall_rule_id) {
      const rule = FirewallRuleModel.findById(changeData.firewall_rule_id);
      if (rule) {
        impacts.push(`防火墙规则变更: ${rule.name} (${rule.action} ${rule.source} -> ${rule.destination})`);
        
        const relatedAssets = db.prepare(`
          SELECT DISTINCT a.*, ip.ip
          FROM assets a
          JOIN ip_addresses ip ON a.id = ip.asset_id
          WHERE ip.ip LIKE ? OR ip.ip LIKE ?
        `).all(
          `%${rule.source ? rule.source.split('/')[0] : ''}%`,
          `%${rule.destination ? rule.destination.split('/')[0] : ''}%`
        );

        relatedAssets.forEach(asset => {
          affectedAssets.push({
            asset_id: asset.id,
            impact_type: 'access_change',
            notes: `防火墙规则变更可能影响 ${asset.name} 的网络访问`
          });
        });
      }
    }

    if (changeData.type === 'ip' || changeData.ip_address) {
      const ipAsset = db.prepare(`
        SELECT a.*, ip.ip
        FROM assets a
        JOIN ip_addresses ip ON a.id = ip.asset_id
        WHERE ip.ip = ?
      `).get(changeData.ip_address);

      if (ipAsset) {
        affectedAssets.push({
          asset_id: ipAsset.id,
          impact_type: 'ip_change',
          notes: `IP地址从 ${ipAsset.ip} 变更`
        });
        impacts.push(`设备 ${ipAsset.name} 的IP地址将变更`);
      }
    }

    return {
      summary: impacts.length > 0 ? impacts.join('; ') : '未检测到直接影响的设备',
      affected_assets: affectedAssets,
      risk_level: affectedAssets.length > 10 ? 'high' : affectedAssets.length > 0 ? 'medium' : 'low'
    };
  }
}

class RiskModel {
  static create(riskData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO risks (
        id, type, title, description, severity,
        asset_id, ip_address, details,
        is_resolved, resolved_at, resolved_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      riskData.type,
      riskData.title,
      riskData.description,
      riskData.severity || 'medium',
      riskData.asset_id,
      riskData.ip_address,
      riskData.details ? JSON.stringify(riskData.details) : null,
      0,
      null,
      null,
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare(`
      SELECT r.*,
             a.name as asset_name, a.type as asset_type, a.department, a.owner
      FROM risks r
      LEFT JOIN assets a ON r.asset_id = a.id
      WHERE r.id = ?
    `).get(id);
  }

  static findAll(filters = {}) {
    let sql = `
      SELECT r.*,
             a.name as asset_name, a.type as asset_type, a.department, a.owner
      FROM risks r
      LEFT JOIN assets a ON r.asset_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.type) {
      sql += ' AND r.type = ?';
      params.push(filters.type);
    }
    if (filters.severity) {
      sql += ' AND r.severity = ?';
      params.push(filters.severity);
    }
    if (filters.is_resolved !== undefined) {
      sql += ' AND r.is_resolved = ?';
      params.push(filters.is_resolved ? 1 : 0);
    }
    if (filters.asset_id) {
      sql += ' AND r.asset_id = ?';
      params.push(filters.asset_id);
    }

    sql += ' ORDER BY r.created_at DESC';

    return db.prepare(sql).all(...params);
  }

  static resolve(id, resolvedBy) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE risks 
      SET is_resolved = 1, resolved_at = ?, resolved_by = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, resolvedBy || 'system', now, id);
    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM risks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM risks').get().count;
    const unresolved = db.prepare('SELECT COUNT(*) as count FROM risks WHERE is_resolved = 0').get().count;
    const bySeverity = db.prepare(`
      SELECT severity, COUNT(*) as count 
      FROM risks 
      WHERE is_resolved = 0 
      GROUP BY severity
    `).all();
    const byType = db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM risks 
      WHERE is_resolved = 0 
      GROUP BY type
    `).all();
    const highRisk = db.prepare(`
      SELECT COUNT(*) as count FROM risks 
      WHERE is_resolved = 0 AND severity = 'high'
    `).get().count;

    return {
      total,
      unresolved,
      bySeverity,
      byType,
      highRisk
    };
  }

  static findByType(type) {
    return this.findAll({ type, is_resolved: false });
  }
}

export { 
  AlertModel, 
  FirewallRuleModel, 
  ChangeOrderModel, 
  RiskModel 
};
