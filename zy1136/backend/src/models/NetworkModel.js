import { db } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class IPAddressModel {
  static create(ipData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO ip_addresses (
        id, ip, asset_id, network_segment_id, vlan_id,
        status, is_static, last_seen, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      ipData.ip,
      ipData.asset_id,
      ipData.network_segment_id,
      ipData.vlan_id,
      ipData.status || 'assigned',
      ipData.is_static ? 1 : 0,
      ipData.last_seen,
      ipData.notes,
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare(`
      SELECT ip.*, 
             a.name as asset_name, a.type as asset_type,
             ns.name as segment_name, ns.cidr as segment_cidr,
             v.vlan_id, v.name as vlan_name
      FROM ip_addresses ip
      LEFT JOIN assets a ON ip.asset_id = a.id
      LEFT JOIN network_segments ns ON ip.network_segment_id = ns.id
      LEFT JOIN vlans v ON ip.vlan_id = v.id
      WHERE ip.id = ?
    `).get(id);
  }

  static findByIP(ip) {
    return db.prepare(`
      SELECT ip.*, 
             a.name as asset_name, a.type as asset_type,
             ns.name as segment_name, ns.cidr as segment_cidr,
             v.vlan_id, v.name as vlan_name
      FROM ip_addresses ip
      LEFT JOIN assets a ON ip.asset_id = a.id
      LEFT JOIN network_segments ns ON ip.network_segment_id = ns.id
      LEFT JOIN vlans v ON ip.vlan_id = v.id
      WHERE ip.ip = ?
    `).get(ip);
  }

  static findAll(filters = {}) {
    let sql = `
      SELECT ip.*, 
             a.name as asset_name, a.type as asset_type,
             ns.name as segment_name, ns.cidr as segment_cidr,
             v.vlan_id, v.name as vlan_name
      FROM ip_addresses ip
      LEFT JOIN assets a ON ip.asset_id = a.id
      LEFT JOIN network_segments ns ON ip.network_segment_id = ns.id
      LEFT JOIN vlans v ON ip.vlan_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.asset_id) {
      sql += ' AND ip.asset_id = ?';
      params.push(filters.asset_id);
    }
    if (filters.network_segment_id) {
      sql += ' AND ip.network_segment_id = ?';
      params.push(filters.network_segment_id);
    }
    if (filters.vlan_id) {
      sql += ' AND ip.vlan_id = ?';
      params.push(filters.vlan_id);
    }
    if (filters.status) {
      sql += ' AND ip.status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      sql += ' AND (ip.ip LIKE ? OR a.name LIKE ?)';
      const search = `%${filters.search}%`;
      params.push(search, search);
    }

    sql += ' ORDER BY ip.created_at DESC';

    return db.prepare(sql).all(...params);
  }

  static update(id, ipData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    const allowedFields = [
      'ip', 'asset_id', 'network_segment_id', 'vlan_id',
      'status', 'is_static', 'last_seen', 'notes'
    ];

    allowedFields.forEach(field => {
      if (ipData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(field === 'is_static' ? (ipData[field] ? 1 : 0) : ipData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(now, id);

    const stmt = db.prepare(`UPDATE ip_addresses SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM ip_addresses WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static findConflicts() {
    return db.prepare(`
      SELECT ip, COUNT(*) as count,
             GROUP_CONCAT(DISTINCT asset_id) as asset_ids,
             GROUP_CONCAT(DISTINCT mac_address) as mac_addresses
      FROM (
        SELECT ip.ip, ip.asset_id, a.mac_address
        FROM ip_addresses ip
        LEFT JOIN assets a ON ip.asset_id = a.id
        WHERE ip.status IN ('assigned', 'used')
        UNION ALL
        SELECT ip as ip, NULL as asset_id, mac_address
        FROM dhcp_leases
        WHERE status = 'active'
      ) combined
      GROUP BY ip
      HAVING count > 1
      ORDER BY count DESC
    `).all();
  }
}

class NetworkSegmentModel {
  static create(segmentData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO network_segments (
        id, name, cidr, gateway, dns_servers, vlan_id,
        description, total_ips, used_ips,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      segmentData.name,
      segmentData.cidr,
      segmentData.gateway,
      segmentData.dns_servers,
      segmentData.vlan_id,
      segmentData.description,
      segmentData.total_ips || this.calculateTotalIPs(segmentData.cidr),
      segmentData.used_ips || 0,
      now,
      now
    );
    
    return this.findById(id);
  }

  static calculateTotalIPs(cidr) {
    try {
      const [, prefix] = cidr.split('/');
      const prefixLen = parseInt(prefix);
      return Math.pow(2, 32 - prefixLen) - 2;
    } catch {
      return 0;
    }
  }

  static findById(id) {
    return db.prepare(`
      SELECT ns.*, v.vlan_id, v.name as vlan_name, v.is_guest
      FROM network_segments ns
      LEFT JOIN vlans v ON ns.vlan_id = v.id
      WHERE ns.id = ?
    `).get(id);
  }

  static findByCIDR(cidr) {
    return db.prepare(`
      SELECT ns.*, v.vlan_id, v.name as vlan_name, v.is_guest
      FROM network_segments ns
      LEFT JOIN vlans v ON ns.vlan_id = v.id
      WHERE ns.cidr = ?
    `).get(cidr);
  }

  static findAll(filters = {}) {
    let sql = `
      SELECT ns.*, v.vlan_id, v.name as vlan_name, v.is_guest,
             (SELECT COUNT(*) FROM ip_addresses ip WHERE ip.network_segment_id = ns.id) as ip_count
      FROM network_segments ns
      LEFT JOIN vlans v ON ns.vlan_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.vlan_id) {
      sql += ' AND ns.vlan_id = ?';
      params.push(filters.vlan_id);
    }
    if (filters.search) {
      sql += ' AND (ns.name LIKE ? OR ns.cidr LIKE ?)';
      const search = `%${filters.search}%`;
      params.push(search, search);
    }

    sql += ' ORDER BY ns.created_at DESC';

    return db.prepare(sql).all(...params);
  }

  static update(id, segmentData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    const allowedFields = [
      'name', 'cidr', 'gateway', 'dns_servers', 'vlan_id',
      'description', 'total_ips', 'used_ips'
    ];

    allowedFields.forEach(field => {
      if (segmentData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(segmentData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(now, id);

    const stmt = db.prepare(`UPDATE network_segments SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static updateUsage(id) {
    const used = db.prepare(`
      SELECT COUNT(*) as count FROM ip_addresses 
      WHERE network_segment_id = ? AND status IN ('assigned', 'used')
    `).get(id);

    return this.update(id, { used_ips: used.count });
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM network_segments WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static getHighUtilization(threshold = 0.8) {
    return db.prepare(`
      SELECT ns.*, 
             v.vlan_id, v.name as vlan_name,
             (ns.used_ips * 1.0 / ns.total_ips) as utilization_rate
      FROM network_segments ns
      LEFT JOIN vlans v ON ns.vlan_id = v.id
      WHERE ns.total_ips > 0 
        AND (ns.used_ips * 1.0 / ns.total_ips) >= ?
      ORDER BY utilization_rate DESC
    `).all(threshold);
  }
}

class VLANModel {
  static create(vlanData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO vlans (
        id, vlan_id, name, type, description, is_guest,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      vlanData.vlan_id,
      vlanData.name,
      vlanData.type || 'data',
      vlanData.description,
      vlanData.is_guest ? 1 : 0,
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM vlans WHERE id = ?').get(id);
  }

  static findByVLANId(vlanId) {
    return db.prepare('SELECT * FROM vlans WHERE vlan_id = ?').get(vlanId);
  }

  static findAll(filters = {}) {
    let sql = `
      SELECT v.*,
             (SELECT COUNT(*) FROM ip_addresses ip WHERE ip.vlan_id = v.id) as ip_count,
             (SELECT COUNT(*) FROM network_segments ns WHERE ns.vlan_id = v.id) as segment_count
      FROM vlans v
      WHERE 1=1
    `;
    const params = [];

    if (filters.type) {
      sql += ' AND v.type = ?';
      params.push(filters.type);
    }
    if (filters.is_guest !== undefined) {
      sql += ' AND v.is_guest = ?';
      params.push(filters.is_guest ? 1 : 0);
    }
    if (filters.search) {
      sql += ' AND (v.name LIKE ? OR CAST(v.vlan_id AS TEXT) LIKE ?)';
      const search = `%${filters.search}%`;
      params.push(search, search);
    }

    sql += ' ORDER BY v.vlan_id';

    return db.prepare(sql).all(...params);
  }

  static update(id, vlanData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    const allowedFields = [
      'vlan_id', 'name', 'type', 'description', 'is_guest'
    ];

    allowedFields.forEach(field => {
      if (vlanData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(field === 'is_guest' ? (vlanData[field] ? 1 : 0) : vlanData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(now, id);

    const stmt = db.prepare(`UPDATE vlans SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM vlans WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static getGuestVLANs() {
    return this.findAll({ is_guest: true });
  }
}

class SwitchPortModel {
  static create(portData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO switch_ports (
        id, switch_id, port_number, port_type, vlan_id,
        status, connected_asset_id, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      portData.switch_id,
      portData.port_number,
      portData.port_type || 'access',
      portData.vlan_id,
      portData.status || 'up',
      portData.connected_asset_id,
      portData.notes,
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare(`
      SELECT sp.*,
             s.name as switch_name, s.serial_number as switch_serial,
             v.vlan_id, v.name as vlan_name,
             ca.name as connected_asset_name, ca.type as connected_asset_type,
             ca.mac_address as connected_mac
      FROM switch_ports sp
      LEFT JOIN assets s ON sp.switch_id = s.id
      LEFT JOIN vlans v ON sp.vlan_id = v.id
      LEFT JOIN assets ca ON sp.connected_asset_id = ca.id
      WHERE sp.id = ?
    `).get(id);
  }

  static findBySwitchAndPort(switchId, portNumber) {
    return db.prepare(`
      SELECT sp.*,
             s.name as switch_name,
             v.vlan_id, v.name as vlan_name,
             ca.name as connected_asset_name
      FROM switch_ports sp
      LEFT JOIN assets s ON sp.switch_id = s.id
      LEFT JOIN vlans v ON sp.vlan_id = v.id
      LEFT JOIN assets ca ON sp.connected_asset_id = ca.id
      WHERE sp.switch_id = ? AND sp.port_number = ?
    `).get(switchId, portNumber);
  }

  static findAll(filters = {}) {
    let sql = `
      SELECT sp.*,
             s.name as switch_name, s.serial_number as switch_serial,
             v.vlan_id, v.name as vlan_name,
             ca.name as connected_asset_name, ca.type as connected_asset_type
      FROM switch_ports sp
      LEFT JOIN assets s ON sp.switch_id = s.id
      LEFT JOIN vlans v ON sp.vlan_id = v.id
      LEFT JOIN assets ca ON sp.connected_asset_id = ca.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.switch_id) {
      sql += ' AND sp.switch_id = ?';
      params.push(filters.switch_id);
    }
    if (filters.status) {
      sql += ' AND sp.status = ?';
      params.push(filters.status);
    }
    if (filters.connected_asset_id) {
      sql += ' AND sp.connected_asset_id = ?';
      params.push(filters.connected_asset_id);
    }

    sql += ' ORDER BY sp.switch_id, sp.port_number';

    return db.prepare(sql).all(...params);
  }

  static update(id, portData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    const allowedFields = [
      'port_number', 'port_type', 'vlan_id',
      'status', 'connected_asset_id', 'notes'
    ];

    allowedFields.forEach(field => {
      if (portData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(portData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(now, id);

    const stmt = db.prepare(`UPDATE switch_ports SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM switch_ports WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static findUnregisteredPorts() {
    return db.prepare(`
      SELECT sp.*,
             s.name as switch_name, s.location as switch_location,
             v.vlan_id, v.name as vlan_name
      FROM switch_ports sp
      LEFT JOIN assets s ON sp.switch_id = s.id
      LEFT JOIN vlans v ON sp.vlan_id = v.id
      WHERE sp.status = 'up'
        AND (sp.connected_asset_id IS NULL OR sp.notes IS NULL OR sp.notes = '')
      ORDER BY s.name, sp.port_number
    `).all();
  }
}

class DHCPLeaseModel {
  static create(leaseData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO dhcp_leases (
        id, ip, mac_address, hostname, start_time, expire_time,
        server_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      leaseData.ip,
      leaseData.mac_address,
      leaseData.hostname,
      leaseData.start_time,
      leaseData.expire_time,
      leaseData.server_id,
      leaseData.status || 'active',
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM dhcp_leases WHERE id = ?').get(id);
  }

  static findByIP(ip) {
    return db.prepare('SELECT * FROM dhcp_leases WHERE ip = ? ORDER BY start_time DESC').all(ip);
  }

  static findByMAC(macAddress) {
    return db.prepare('SELECT * FROM dhcp_leases WHERE mac_address = ? ORDER BY start_time DESC').all(macAddress);
  }

  static findAll(filters = {}) {
    let sql = 'SELECT * FROM dhcp_leases WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      sql += ' AND (ip LIKE ? OR mac_address LIKE ? OR hostname LIKE ?)';
      const search = `%${filters.search}%`;
      params.push(search, search, search);
    }

    sql += ' ORDER BY start_time DESC';

    return db.prepare(sql).all(...params);
  }

  static update(id, leaseData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    const allowedFields = [
      'ip', 'mac_address', 'hostname', 'start_time', 'expire_time',
      'server_id', 'status'
    ];

    allowedFields.forEach(field => {
      if (leaseData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(leaseData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(now, id);

    const stmt = db.prepare(`UPDATE dhcp_leases SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM dhcp_leases WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static findStaleLeases(days = 7) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    
    return db.prepare(`
      SELECT dl.*,
             a.name as asset_name, a.mac_address as registered_mac,
             a.department, a.owner
      FROM dhcp_leases dl
      LEFT JOIN assets a ON dl.mac_address = a.mac_address
      WHERE dl.status = 'active'
        AND (dl.expire_time < ? OR dl.start_time < ?)
      ORDER BY dl.start_time
    `).all(threshold.toISOString(), threshold.toISOString());
  }

  static findUnknownDevices() {
    return db.prepare(`
      SELECT dl.*
      FROM dhcp_leases dl
      LEFT JOIN assets a ON dl.mac_address = a.mac_address
      WHERE dl.status = 'active'
        AND a.id IS NULL
      ORDER BY dl.start_time DESC
    `).all();
  }
}

export { 
  IPAddressModel, 
  NetworkSegmentModel, 
  VLANModel, 
  SwitchPortModel,
  DHCPLeaseModel 
};
