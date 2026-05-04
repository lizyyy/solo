import { db } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  IPAddressModel, 
  NetworkSegmentModel, 
  VLANModel, 
  DHCPLeaseModel,
  SwitchPortModel
} from '../models/NetworkModel.js';
import { FirewallRuleModel, RiskModel, AlertModel } from '../models/AlertChangeRiskModel.js';
import AssetModel from '../models/AssetModel.js';

class TopologyModel {
  static create(topologyData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO topology (
        id, parent_asset_id, child_asset_id, relationship_type,
        connection_details, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      topologyData.parent_asset_id,
      topologyData.child_asset_id,
      topologyData.relationship_type,
      topologyData.connection_details,
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare(`
      SELECT t.*,
             p.name as parent_name, p.type as parent_type,
             c.name as child_name, c.type as child_type
      FROM topology t
      LEFT JOIN assets p ON t.parent_asset_id = p.id
      LEFT JOIN assets c ON t.child_asset_id = c.id
      WHERE t.id = ?
    `).get(id);
  }

  static findAll(filters = {}) {
    let sql = `
      SELECT t.*,
             p.name as parent_name, p.type as parent_type, p.mac_address as parent_mac,
             c.name as child_name, c.type as child_type, c.mac_address as child_mac
      FROM topology t
      LEFT JOIN assets p ON t.parent_asset_id = p.id
      LEFT JOIN assets c ON t.child_asset_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.parent_asset_id) {
      sql += ' AND t.parent_asset_id = ?';
      params.push(filters.parent_asset_id);
    }
    if (filters.child_asset_id) {
      sql += ' AND t.child_asset_id = ?';
      params.push(filters.child_asset_id);
    }
    if (filters.relationship_type) {
      sql += ' AND t.relationship_type = ?';
      params.push(filters.relationship_type);
    }
    if (filters.asset_id) {
      sql += ' AND (t.parent_asset_id = ? OR t.child_asset_id = ?)';
      params.push(filters.asset_id, filters.asset_id);
    }

    return db.prepare(sql).all(...params);
  }

  static update(id, topologyData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    const allowedFields = [
      'parent_asset_id', 'child_asset_id', 'relationship_type', 'connection_details'
    ];

    allowedFields.forEach(field => {
      if (topologyData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(topologyData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(now, id);

    const stmt = db.prepare(`UPDATE topology SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM topology WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static getFullTopology() {
    const allRelations = this.findAll();
    
    const nodes = new Map();
    const edges = [];

    allRelations.forEach(rel => {
      if (!nodes.has(rel.parent_asset_id)) {
        nodes.set(rel.parent_asset_id, {
          id: rel.parent_asset_id,
          name: rel.parent_name,
          type: rel.parent_type,
          level: 0
        });
      }
      if (!nodes.has(rel.child_asset_id)) {
        nodes.set(rel.child_asset_id, {
          id: rel.child_asset_id,
          name: rel.child_name,
          type: rel.child_type,
          level: 0
        });
      }
      edges.push({
        id: rel.id,
        source: rel.parent_asset_id,
        target: rel.child_asset_id,
        relationship_type: rel.relationship_type,
        connection_details: rel.connection_details
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      edges
    };
  }

  static getHierarchy(assetId) {
    const getChildren = (parentId, level = 0) => {
      const children = this.findAll({ parent_asset_id: parentId });
      return children.map(child => ({
        ...child,
        level,
        children: getChildren(child.child_asset_id, level + 1)
      }));
    };

    const getParents = (childId) => {
      const parents = this.findAll({ child_asset_id: childId });
      return parents.map(parent => ({
        ...parent,
        parents: getParents(parent.parent_asset_id)
      }));
    };

    const asset = AssetModel.findById(assetId);
    if (!asset) return null;

    return {
      asset,
      parents: getParents(assetId),
      children: getChildren(assetId, 0)
    };
  }
}

class ServicePortModel {
  static create(portData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO service_ports (
        id, asset_id, port, protocol, service_name,
        is_exposed, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      portData.asset_id,
      portData.port,
      portData.protocol || 'tcp',
      portData.service_name,
      portData.is_exposed ? 1 : 0,
      portData.description,
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare(`
      SELECT sp.*,
             a.name as asset_name, a.type as asset_type
      FROM service_ports sp
      LEFT JOIN assets a ON sp.asset_id = a.id
      WHERE sp.id = ?
    `).get(id);
  }

  static findAll(filters = {}) {
    let sql = `
      SELECT sp.*,
             a.name as asset_name, a.type as asset_type
      FROM service_ports sp
      LEFT JOIN assets a ON sp.asset_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.asset_id) {
      sql += ' AND sp.asset_id = ?';
      params.push(filters.asset_id);
    }
    if (filters.port) {
      sql += ' AND sp.port = ?';
      params.push(filters.port);
    }
    if (filters.is_exposed !== undefined) {
      sql += ' AND sp.is_exposed = ?';
      params.push(filters.is_exposed ? 1 : 0);
    }

    sql += ' ORDER BY sp.asset_id, sp.port';

    return db.prepare(sql).all(...params);
  }

  static update(id, portData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    const allowedFields = [
      'port', 'protocol', 'service_name', 'is_exposed', 'description'
    ];

    allowedFields.forEach(field => {
      if (portData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(field === 'is_exposed' ? (portData[field] ? 1 : 0) : portData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(now, id);

    const stmt = db.prepare(`UPDATE service_ports SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM service_ports WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static findExposedServices() {
    return db.prepare(`
      SELECT sp.*,
             a.name as asset_name, a.type as asset_type, a.department,
             ip.ip as asset_ip
      FROM service_ports sp
      LEFT JOIN assets a ON sp.asset_id = a.id
      LEFT JOIN ip_addresses ip ON a.id = ip.asset_id
      WHERE sp.is_exposed = 1
      ORDER BY a.name, sp.port
    `).all();
  }
}

class RiskEngine {
  static RISK_TYPES = {
    IP_CONFLICT: 'ip_conflict',
    HIGH_UTILIZATION: 'high_utilization',
    STALE_DHCP: 'stale_dhcp',
    UNKNOWN_DEVICE: 'unknown_device',
    UNREGISTERED_PORT: 'unregistered_port',
    GUEST_TO_INTERNAL: 'guest_to_internal',
    OVERLY_PERMISSIVE: 'overly_permissive',
    EXPOSED_SERVICE: 'exposed_service'
  };

  static SEVERITY = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  };

  static runAllChecks() {
    const results = {
      timestamp: new Date().toISOString(),
      risks: [],
      summary: {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byType: {}
      }
    };

    results.risks.push(...this.checkIPConflicts());
    results.risks.push(...this.checkHighUtilization());
    results.risks.push(...this.checkStaleDHCP());
    results.risks.push(...this.checkUnknownDevices());
    results.risks.push(...this.checkUnregisteredPorts());
    results.risks.push(...this.checkGuestToInternal());
    results.risks.push(...this.checkOverlyPermissive());
    results.risks.push(...this.checkExposedServices());

    results.summary.total = results.risks.length;
    results.risks.forEach(risk => {
      results.summary.bySeverity[risk.severity] = (results.summary.bySeverity[risk.severity] || 0) + 1;
      results.summary.byType[risk.type] = (results.summary.byType[risk.type] || 0) + 1;
    });

    this.syncRisksToDB(results.risks);

    return results;
  }

  static checkIPConflicts() {
    const conflicts = IPAddressModel.findConflicts();
    return conflicts.map(conflict => ({
      type: this.RISK_TYPES.IP_CONFLICT,
      title: `IP地址冲突: ${conflict.ip}`,
      description: `IP地址 ${conflict.ip} 被 ${conflict.count} 个设备使用`,
      severity: this.SEVERITY.CRITICAL,
      ip_address: conflict.ip,
      details: {
        asset_ids: conflict.asset_ids,
        mac_addresses: conflict.mac_addresses,
        count: conflict.count
      }
    }));
  }

  static checkHighUtilization(threshold = 0.8) {
    const segments = NetworkSegmentModel.getHighUtilization(threshold);
    return segments.map(segment => {
      const utilization = (segment.utilization_rate * 100).toFixed(1);
      return {
        type: this.RISK_TYPES.HIGH_UTILIZATION,
        title: `网段利用率过高: ${segment.name} (${segment.cidr})`,
        description: `网段 ${segment.name} 利用率已达 ${utilization}%`,
        severity: segment.utilization_rate >= 0.95 ? this.SEVERITY.CRITICAL : 
                   segment.utilization_rate >= 0.9 ? this.SEVERITY.HIGH : this.SEVERITY.MEDIUM,
        details: {
          segment_id: segment.id,
          cidr: segment.cidr,
          total_ips: segment.total_ips,
          used_ips: segment.used_ips,
          utilization_rate: segment.utilization_rate
        }
      };
    });
  }

  static checkStaleDHCP(days = 7) {
    const staleLeases = DHCPLeaseModel.findStaleLeases(days);
    return staleLeases.map(lease => ({
      type: this.RISK_TYPES.STALE_DHCP,
      title: `DHCP租约长期未更新: ${lease.ip}`,
      description: `设备 ${lease.hostname || lease.mac_address} 的DHCP租约已超过 ${days} 天未更新`,
      severity: this.SEVERITY.LOW,
      ip_address: lease.ip,
      asset_id: lease.asset_id,
      details: {
        lease_id: lease.id,
        mac_address: lease.mac_address,
        hostname: lease.hostname,
        start_time: lease.start_time,
        expire_time: lease.expire_time
      }
    }));
  }

  static checkUnknownDevices() {
    const unknowns = DHCPLeaseModel.findUnknownDevices();
    return unknowns.map(unknown => ({
      type: this.RISK_TYPES.UNKNOWN_DEVICE,
      title: `未知设备接入: ${unknown.mac_address}`,
      description: `未在资产库中登记的设备 ${unknown.hostname || unknown.mac_address} (IP: ${unknown.ip})`,
      severity: this.SEVERITY.HIGH,
      ip_address: unknown.ip,
      details: {
        lease_id: unknown.id,
        mac_address: unknown.mac_address,
        hostname: unknown.hostname,
        start_time: unknown.start_time
      }
    }));
  }

  static checkUnregisteredPorts() {
    const ports = SwitchPortModel.findUnregisteredPorts();
    return ports.map(port => ({
      type: this.RISK_TYPES.UNREGISTERED_PORT,
      title: `端口未登记: ${port.switch_name} - ${port.port_number}`,
      description: `交换机 ${port.switch_name} 的端口 ${port.port_number} 状态为Up但未登记连接设备`,
      severity: this.SEVERITY.MEDIUM,
      details: {
        port_id: port.id,
        switch_name: port.switch_name,
        switch_location: port.switch_location,
        port_number: port.port_number,
        vlan_id: port.vlan_id,
        vlan_name: port.vlan_name
      }
    }));
  }

  static checkGuestToInternal() {
    const rules = FirewallRuleModel.findGuestToInternalRules();
    return rules.map(rule => ({
      type: this.RISK_TYPES.GUEST_TO_INTERNAL,
      title: `访客网误通内网: 规则 ${rule.name}`,
      description: `防火墙规则 ${rule.name} 允许访客网络访问内网服务`,
      severity: this.SEVERITY.CRITICAL,
      details: {
        rule_id: rule.id,
        rule_number: rule.rule_number,
        name: rule.name,
        action: rule.action,
        source: rule.source,
        destination: rule.destination,
        ports: rule.ports
      }
    }));
  }

  static checkOverlyPermissive() {
    const rules = FirewallRuleModel.findOverlyPermissive();
    return rules.map(rule => {
      const issues = [];
      if (rule.source === '0.0.0.0/0' || rule.source === 'any' || !rule.source) issues.push('源地址过宽');
      if (rule.destination === '0.0.0.0/0' || rule.destination === 'any' || !rule.destination) issues.push('目的地址过宽');
      if (rule.ports === 'any' || rule.ports === '0-65535' || !rule.ports) issues.push('端口范围过宽');
      if (rule.protocol === 'any' || !rule.protocol) issues.push('协议未限制');

      return {
        type: this.RISK_TYPES.OVERLY_PERMISSIVE,
        title: `防火墙规则过于宽松: ${rule.name}`,
        description: `规则 ${rule.name} 存在安全风险: ${issues.join('、')}`,
        severity: this.SEVERITY.HIGH,
        details: {
          rule_id: rule.id,
          rule_number: rule.rule_number,
          name: rule.name,
          action: rule.action,
          source: rule.source,
          destination: rule.destination,
          ports: rule.ports,
          protocol: rule.protocol,
          issues
        }
      };
    });
  }

  static checkExposedServices() {
    const services = ServicePortModel.findExposedServices();
    return services.map(service => ({
      type: this.RISK_TYPES.EXPOSED_SERVICE,
      title: `服务端口暴露: ${service.asset_name} - ${service.port}/${service.protocol}`,
      description: `设备 ${service.asset_name} 的 ${service.service_name || service.port} 端口对外暴露`,
      severity: service.port === 22 || service.port === 3389 ? this.SEVERITY.HIGH : 
                 service.port < 1024 ? this.SEVERITY.MEDIUM : this.SEVERITY.LOW,
      asset_id: service.asset_id,
      ip_address: service.asset_ip,
      details: {
        service_id: service.id,
        asset_name: service.asset_name,
        port: service.port,
        protocol: service.protocol,
        service_name: service.service_name,
        department: service.department
      }
    }));
  }

  static syncRisksToDB(risks) {
    const existingUnresolved = RiskModel.findAll({ is_resolved: false });
    const existingMap = new Map(existingUnresolved.map(r => [this.riskToKey(r), r]));
    const newKeys = new Set(risks.map(r => this.riskToKey(r)));

    risks.forEach(risk => {
      const key = this.riskToKey(risk);
      if (!existingMap.has(key)) {
        RiskModel.create(risk);
        AlertModel.create({
          title: risk.title,
          type: risk.type,
          severity: risk.severity,
          asset_id: risk.asset_id,
          ip_address: risk.ip_address,
          description: risk.description,
          raw_data: risk.details
        });
      }
    });

    existingUnresolved.forEach(risk => {
      const key = this.riskToKey(risk);
      if (!newKeys.has(key)) {
        RiskModel.resolve(risk.id, 'auto_resolve');
      }
    });
  }

  static riskToKey(risk) {
    return `${risk.type}:${risk.ip_address || risk.asset_id || JSON.stringify(risk.details)}`;
  }
}

export { 
  TopologyModel, 
  ServicePortModel, 
  RiskEngine 
};
