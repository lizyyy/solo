import csv from 'csv-parser';
import { Readable } from 'stream';
import AssetModel from '../models/AssetModel.js';
import { 
  IPAddressModel, 
  NetworkSegmentModel, 
  VLANModel, 
  DHCPLeaseModel,
  SwitchPortModel 
} from '../models/NetworkModel.js';
import { FirewallRuleModel } from '../models/AlertChangeRiskModel.js';
import { TopologyModel, ServicePortModel } from '../models/TopologyRiskModel.js';

class ImportService {
  static async importAssets(csvContent) {
    const results = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(csvContent);
      
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          results.forEach((row, index) => {
            try {
              const assetData = this.parseAssetRow(row);
              const existing = AssetModel.findByMac(assetData.mac_address);
              
              if (existing) {
                AssetModel.update(existing.id, assetData);
              } else {
                AssetModel.create(assetData);
              }
              successCount++;
            } catch (error) {
              errorCount++;
              errors.push({
                row: index + 1,
                data: row,
                error: error.message
              });
            }
          });

          resolve({
            success: true,
            total: results.length,
            successCount,
            errorCount,
            errors
          });
        });
    });
  }

  static parseAssetRow(row) {
    const required = ['name', 'type'];
    required.forEach(field => {
      if (!row[field] && !row[field.toLowerCase()]) {
        throw new Error(`缺少必要字段: ${field}`);
      }
    });

    const mac = row.mac_address || row.mac || row['MAC地址'] || '';
    if (mac && !this.validateMAC(mac)) {
      throw new Error(`无效的MAC地址: ${mac}`);
    }

    return {
      name: row.name || row['设备名称'] || row['Name'],
      type: row.type || row['设备类型'] || row['Type'],
      mac_address: mac || null,
      serial_number: row.serial_number || row.serial || row['序列号'] || null,
      department: row.department || row['部门'] || null,
      owner: row.owner || row['负责人'] || row['责任人'] || null,
      location: row.location || row['位置'] || row['地点'] || null,
      purchase_date: row.purchase_date || row['采购日期'] || null,
      status: row.status || row['状态'] || 'active',
      notes: row.notes || row['备注'] || null
    };
  }

  static async importTopology(jsonContent) {
    try {
      const topology = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      const results = {
        nodes: 0,
        edges: 0,
        errors: []
      };

      if (topology.nodes && Array.isArray(topology.nodes)) {
        topology.nodes.forEach(node => {
          try {
            const existing = AssetModel.findByMac(node.mac_address) || 
                           (node.id ? AssetModel.findById(node.id) : null);
            
            const assetData = {
              name: node.name || node.label,
              type: node.type || 'unknown',
              mac_address: node.mac_address || null,
              location: node.location || null
            };

            if (existing) {
              AssetModel.update(existing.id, assetData);
            } else {
              AssetModel.create(assetData);
            }
            results.nodes++;
          } catch (error) {
            results.errors.push({ type: 'node', data: node, error: error.message });
          }
        });
      }

      if (topology.edges && Array.isArray(topology.edges)) {
        topology.edges.forEach(edge => {
          try {
            const topologyData = {
              parent_asset_id: edge.source || edge.from || edge.parent,
              child_asset_id: edge.target || edge.to || edge.child,
              relationship_type: edge.type || edge.relationship || 'connected',
              connection_details: edge.details || edge.description || null
            };

            if (topologyData.parent_asset_id && topologyData.child_asset_id) {
              TopologyModel.create(topologyData);
              results.edges++;
            }
          } catch (error) {
            results.errors.push({ type: 'edge', data: edge, error: error.message });
          }
        });
      }

      return {
        success: true,
        nodes: results.nodes,
        edges: results.edges,
        errors: results.errors
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async importDHCPLeases(csvContent) {
    const results = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(csvContent);
      
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          results.forEach((row, index) => {
            try {
              const leaseData = this.parseDHCPLeaseRow(row);
              DHCPLeaseModel.create(leaseData);
              successCount++;
            } catch (error) {
              errorCount++;
              errors.push({
                row: index + 1,
                data: row,
                error: error.message
              });
            }
          });

          resolve({
            success: true,
            total: results.length,
            successCount,
            errorCount,
            errors
          });
        });
    });
  }

  static parseDHCPLeaseRow(row) {
    const ip = row.ip || row.ip_address || row['IP地址'] || '';
    const mac = row.mac_address || row.mac || row['MAC地址'] || '';

    if (!ip) throw new Error('缺少IP地址');
    if (!this.validateIP(ip)) throw new Error(`无效的IP地址: ${ip}`);
    if (mac && !this.validateMAC(mac)) throw new Error(`无效的MAC地址: ${mac}`);

    return {
      ip: ip,
      mac_address: mac || null,
      hostname: row.hostname || row['主机名'] || null,
      start_time: row.start_time || row.lease_start || row['开始时间'] || new Date().toISOString(),
      expire_time: row.expire_time || row.lease_end || row['到期时间'] || null,
      server_id: row.server_id || row.dhcp_server || null,
      status: row.status || 'active'
    };
  }

  static async importFirewallRules(csvContent) {
    const results = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(csvContent);
      
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          results.forEach((row, index) => {
            try {
              const ruleData = this.parseFirewallRow(row);
              FirewallRuleModel.create(ruleData);
              successCount++;
            } catch (error) {
              errorCount++;
              errors.push({
                row: index + 1,
                data: row,
                error: error.message
              });
            }
          });

          resolve({
            success: true,
            total: results.length,
            successCount,
            errorCount,
            errors
          });
        });
    });
  }

  static parseFirewallRow(row) {
    const name = row.name || row.rule_name || row['规则名称'] || '';
    if (!name) throw new Error('缺少规则名称');

    return {
      rule_number: row.rule_number ? parseInt(row.rule_number) : null,
      name: name,
      action: row.action || row['动作'] || 'allow',
      source: row.source || row.src || row['源地址'] || null,
      destination: row.destination || row.dst || row['目的地址'] || null,
      protocol: row.protocol || row['协议'] || 'any',
      ports: row.ports || row.port || row['端口'] || null,
      description: row.description || row.desc || row['描述'] || null,
      is_enabled: row.enabled !== undefined ? row.enabled === 'true' || row.enabled === true : true
    };
  }

  static async importAlerts(jsonlContent) {
    const lines = jsonlContent.split('\n').filter(line => line.trim());
    const results = {
      total: lines.length,
      successCount: 0,
      errorCount: 0,
      errors: []
    };

    lines.forEach((line, index) => {
      try {
        const alert = JSON.parse(line);
        const alertData = this.parseAlertJSON(alert);
        import { AlertModel } from '../models/AlertChangeRiskModel.js';
        AlertModel.create(alertData);
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        results.errors.push({
          line: index + 1,
          content: line,
          error: error.message
        });
      }
    });

    return results;
  }

  static parseAlertJSON(alert) {
    return {
      title: alert.title || alert.message || '未命名告警',
      type: alert.type || alert.category || 'unknown',
      severity: alert.severity || alert.level || 'info',
      asset_id: alert.asset_id || null,
      ip_address: alert.ip || alert.ip_address || null,
      description: alert.description || alert.message || null,
      raw_data: alert
    };
  }

  static validateIP(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipv4Regex.test(ip)) return false;
    
    const parts = ip.split('/')[0].split('.');
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  }

  static validateMAC(mac) {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  static importNetworkSegments(csvContent) {
    const results = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(csvContent);
      
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          results.forEach((row, index) => {
            try {
              const cidr = row.cidr || row.network || row['网段'] || '';
              if (!cidr || !this.validateIP(cidr)) {
                throw new Error(`无效的CIDR: ${cidr}`);
              }

              const vlanId = row.vlan_id || row.vlan || row['VLAN'];
              let vlanRecord = null;
              if (vlanId) {
                vlanRecord = VLANModel.findByVLANId(parseInt(vlanId));
                if (!vlanRecord && row.vlan_name) {
                  vlanRecord = VLANModel.create({
                    vlan_id: parseInt(vlanId),
                    name: row.vlan_name,
                    type: row.vlan_type || 'data'
                  });
                }
              }

              const segmentData = {
                name: row.name || row['名称'] || cidr,
                cidr: cidr,
                gateway: row.gateway || row['网关'] || null,
                dns_servers: row.dns || row.dns_servers || row['DNS服务器'] || null,
                vlan_id: vlanRecord ? vlanRecord.id : null,
                description: row.description || row.desc || row['描述'] || null
              };

              const existing = NetworkSegmentModel.findByCIDR(cidr);
              if (existing) {
                NetworkSegmentModel.update(existing.id, segmentData);
              } else {
                NetworkSegmentModel.create(segmentData);
              }
              successCount++;
            } catch (error) {
              errorCount++;
              errors.push({
                row: index + 1,
                data: row,
                error: error.message
              });
            }
          });

          resolve({
            success: true,
            total: results.length,
            successCount,
            errorCount,
            errors
          });
        });
    });
  }

  static importVLANs(csvContent) {
    const results = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(csvContent);
      
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          results.forEach((row, index) => {
            try {
              const vlanId = row.vlan_id || row.id || row['VLAN ID'];
              if (!vlanId) throw new Error('缺少VLAN ID');

              const vlanData = {
                vlan_id: parseInt(vlanId),
                name: row.name || row['名称'] || `VLAN${vlanId}`,
                type: row.type || row['类型'] || 'data',
                description: row.description || row.desc || row['描述'] || null,
                is_guest: row.is_guest === 'true' || row.is_guest === true || row['访客VLAN'] === '是'
              };

              const existing = VLANModel.findByVLANId(vlanData.vlan_id);
              if (existing) {
                VLANModel.update(existing.id, vlanData);
              } else {
                VLANModel.create(vlanData);
              }
              successCount++;
            } catch (error) {
              errorCount++;
              errors.push({
                row: index + 1,
                data: row,
                error: error.message
              });
            }
          });

          resolve({
            success: true,
            total: results.length,
            successCount,
            errorCount,
            errors
          });
        });
    });
  }
}

export default ImportService;
