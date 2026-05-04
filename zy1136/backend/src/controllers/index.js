import AssetModel from '../models/AssetModel.js';
import { 
  IPAddressModel, 
  NetworkSegmentModel, 
  VLANModel, 
  SwitchPortModel,
  DHCPLeaseModel 
} from '../models/NetworkModel.js';
import { 
  AlertModel, 
  FirewallRuleModel, 
  ChangeOrderModel, 
  RiskModel 
} from '../models/AlertChangeRiskModel.js';
import { 
  TopologyModel, 
  ServicePortModel, 
  RiskEngine 
} from '../models/TopologyRiskModel.js';
import ImportService from '../services/ImportService.js';
import ReportService from '../services/ReportService.js';
import { body, param, query, validationResult } from 'express-validator';

export const validationRules = {
  idParam: [
    param('id').isString().notEmpty().withMessage('ID参数无效')
  ],
  assetCreate: [
    body('name').isString().notEmpty().withMessage('名称不能为空'),
    body('type').isString().notEmpty().withMessage('类型不能为空'),
    body('mac_address').optional().matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).withMessage('MAC地址格式无效')
  ],
  ipCreate: [
    body('ip').isIP().withMessage('IP地址格式无效')
  ],
  vlanCreate: [
    body('vlan_id').isInt({ min: 1, max: 4094 }).withMessage('VLAN ID必须在1-4094之间'),
    body('name').isString().notEmpty().withMessage('名称不能为空')
  ],
  changeStatus: [
    body('status').isIn([
      'pending_evaluation', 'approved', 'rejected', 'executing',
      'executed', 'rolling_back', 'rolled_back', 'completed'
    ]).withMessage('无效的状态值')
  ]
};

export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array().map(e => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

export const assetController = {
  getAll: async (req, res) => {
    try {
      const filters = {
        type: req.query.type,
        department: req.query.department,
        status: req.query.status,
        owner: req.query.owner,
        search: req.query.search
      };
      const assets = AssetModel.findAll(filters);
      res.json({ success: true, data: assets });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const asset = AssetModel.findById(req.params.id);
      if (!asset) {
        return res.status(404).json({ success: false, error: '资产不存在' });
      }
      
      const ips = IPAddressModel.findAll({ asset_id: req.params.id });
      const ports = SwitchPortModel.findAll({ connected_asset_id: req.params.id });
      const services = ServicePortModel.findAll({ asset_id: req.params.id });
      const risks = RiskModel.findAll({ asset_id: req.params.id, is_resolved: false });
      const topology = TopologyModel.getHierarchy(req.params.id);

      res.json({ 
        success: true, 
        data: {
          ...asset,
          ips,
          ports,
          services,
          risks,
          topology
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const asset = AssetModel.create(req.body);
      res.status(201).json({ success: true, data: asset });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ 
          success: false, 
          error: 'MAC地址或序列号已存在' 
        });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const existing = AssetModel.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ success: false, error: '资产不存在' });
      }
      
      const asset = AssetModel.update(req.params.id, req.body);
      res.json({ success: true, data: asset });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ 
          success: false, 
          error: 'MAC地址或序列号已存在' 
        });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  },

  delete: async (req, res) => {
    try {
      const existing = AssetModel.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ success: false, error: '资产不存在' });
      }
      
      const deleted = AssetModel.delete(req.params.id);
      res.json({ success: true, data: { deleted } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getStats: async (req, res) => {
    try {
      const stats = AssetModel.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const networkController = {
  getIPs: async (req, res) => {
    try {
      const filters = {
        asset_id: req.query.asset_id,
        network_segment_id: req.query.network_segment_id,
        vlan_id: req.query.vlan_id,
        status: req.query.status,
        search: req.query.search
      };
      const ips = IPAddressModel.findAll(filters);
      res.json({ success: true, data: ips });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getIPById: async (req, res) => {
    try {
      const ip = IPAddressModel.findById(req.params.id);
      if (!ip) {
        return res.status(404).json({ success: false, error: 'IP地址不存在' });
      }
      res.json({ success: true, data: ip });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  createIP: async (req, res) => {
    try {
      const ip = IPAddressModel.create(req.body);
      res.status(201).json({ success: true, data: ip });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ 
          success: false, 
          error: 'IP地址已存在' 
        });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  },

  updateIP: async (req, res) => {
    try {
      const ip = IPAddressModel.update(req.params.id, req.body);
      res.json({ success: true, data: ip });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteIP: async (req, res) => {
    try {
      const deleted = IPAddressModel.delete(req.params.id);
      res.json({ success: true, data: { deleted } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getSegments: async (req, res) => {
    try {
      const filters = {
        vlan_id: req.query.vlan_id,
        search: req.query.search
      };
      const segments = NetworkSegmentModel.findAll(filters);
      res.json({ success: true, data: segments });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getSegmentById: async (req, res) => {
    try {
      const segment = NetworkSegmentModel.findById(req.params.id);
      if (!segment) {
        return res.status(404).json({ success: false, error: '网段不存在' });
      }
      
      const ips = IPAddressModel.findAll({ network_segment_id: req.params.id });
      res.json({ 
        success: true, 
        data: {
          ...segment,
          ips
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  createSegment: async (req, res) => {
    try {
      const segment = NetworkSegmentModel.create(req.body);
      res.status(201).json({ success: true, data: segment });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ 
          success: false, 
          error: 'CIDR已存在' 
        });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getVLANs: async (req, res) => {
    try {
      const filters = {
        type: req.query.type,
        is_guest: req.query.is_guest,
        search: req.query.search
      };
      const vlans = VLANModel.findAll(filters);
      res.json({ success: true, data: vlans });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getVLANById: async (req, res) => {
    try {
      const vlan = VLANModel.findById(req.params.id);
      if (!vlan) {
        return res.status(404).json({ success: false, error: 'VLAN不存在' });
      }
      
      const segments = NetworkSegmentModel.findAll({ vlan_id: req.params.id });
      const ips = IPAddressModel.findAll({ vlan_id: req.params.id });
      
      res.json({ 
        success: true, 
        data: {
          ...vlan,
          segments,
          ips
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  createVLAN: async (req, res) => {
    try {
      const vlan = VLANModel.create(req.body);
      res.status(201).json({ success: true, data: vlan });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ 
          success: false, 
          error: 'VLAN ID已存在' 
        });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  },

  updateVLAN: async (req, res) => {
    try {
      const vlan = VLANModel.update(req.params.id, req.body);
      res.json({ success: true, data: vlan });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getSwitchPorts: async (req, res) => {
    try {
      const filters = {
        switch_id: req.query.switch_id,
        status: req.query.status,
        connected_asset_id: req.query.connected_asset_id
      };
      const ports = SwitchPortModel.findAll(filters);
      res.json({ success: true, data: ports });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getDHCPLeases: async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        search: req.query.search
      };
      const leases = DHCPLeaseModel.findAll(filters);
      res.json({ success: true, data: leases });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const alertController = {
  getAll: async (req, res) => {
    try {
      const filters = {
        type: req.query.type,
        severity: req.query.severity,
        is_acknowledged: req.query.is_acknowledged,
        asset_id: req.query.asset_id,
        search: req.query.search
      };
      const alerts = AlertModel.findAll(filters);
      res.json({ success: true, data: alerts });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getGrouped: async (req, res) => {
    try {
      const filters = {
        is_acknowledged: req.query.is_acknowledged,
        severity: req.query.severity
      };
      const grouped = AlertModel.getGrouped(filters);
      res.json({ success: true, data: grouped });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const alert = AlertModel.findById(req.params.id);
      if (!alert) {
        return res.status(404).json({ success: false, error: '告警不存在' });
      }
      res.json({ success: true, data: alert });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  acknowledge: async (req, res) => {
    try {
      const alert = AlertModel.acknowledge(req.params.id, req.body.acknowledged_by);
      res.json({ success: true, data: alert });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  acknowledgeGroup: async (req, res) => {
    try {
      const count = AlertModel.acknowledgeGroup(req.params.groupKey, req.body.acknowledged_by);
      res.json({ success: true, data: { acknowledged_count: count } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getStats: async (req, res) => {
    try {
      const stats = AlertModel.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const firewallController = {
  getAll: async (req, res) => {
    try {
      const filters = {
        action: req.query.action,
        is_enabled: req.query.is_enabled,
        search: req.query.search
      };
      const rules = FirewallRuleModel.findAll(filters);
      res.json({ success: true, data: rules });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const rule = FirewallRuleModel.findById(req.params.id);
      if (!rule) {
        return res.status(404).json({ success: false, error: '规则不存在' });
      }
      res.json({ success: true, data: rule });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const rule = FirewallRuleModel.create(req.body);
      res.status(201).json({ success: true, data: rule });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const rule = FirewallRuleModel.update(req.params.id, req.body);
      res.json({ success: true, data: rule });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  delete: async (req, res) => {
    try {
      const deleted = FirewallRuleModel.delete(req.params.id);
      res.json({ success: true, data: { deleted } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const changeController = {
  getAll: async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        type: req.query.type,
        search: req.query.search
      };
      const changes = ChangeOrderModel.findAll(filters);
      res.json({ success: true, data: changes });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const change = ChangeOrderModel.findById(req.params.id);
      if (!change) {
        return res.status(404).json({ success: false, error: '变更单不存在' });
      }
      res.json({ success: true, data: change });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const analysis = ChangeOrderModel.analyzeImpact(req.body);
      const changeData = {
        ...req.body,
        impact_analysis: analysis.summary
      };
      if (analysis.affected_assets && analysis.affected_assets.length > 0) {
        changeData.affected_assets = analysis.affected_assets;
      }
      
      const change = ChangeOrderModel.create(changeData);
      res.status(201).json({ success: true, data: change, impact_analysis: analysis });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  transition: async (req, res) => {
    try {
      const change = ChangeOrderModel.transition(
        req.params.id,
        req.body.status,
        req.body.actor,
        req.body.details
      );
      res.json({ success: true, data: change });
    } catch (error) {
      if (error.message.includes('不允许')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  },

  analyzeImpact: async (req, res) => {
    try {
      const analysis = ChangeOrderModel.analyzeImpact(req.body);
      res.json({ success: true, data: analysis });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getStats: async (req, res) => {
    try {
      const stats = ChangeOrderModel.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const riskController = {
  getAll: async (req, res) => {
    try {
      const filters = {
        type: req.query.type,
        severity: req.query.severity,
        is_resolved: req.query.is_resolved,
        asset_id: req.query.asset_id
      };
      const risks = RiskModel.findAll(filters);
      res.json({ success: true, data: risks });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const risk = RiskModel.findById(req.params.id);
      if (!risk) {
        return res.status(404).json({ success: false, error: '风险项不存在' });
      }
      res.json({ success: true, data: risk });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  resolve: async (req, res) => {
    try {
      const risk = RiskModel.resolve(req.params.id, req.body.resolved_by);
      res.json({ success: true, data: risk });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  runChecks: async (req, res) => {
    try {
      const results = RiskEngine.runAllChecks();
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getStats: async (req, res) => {
    try {
      const stats = RiskModel.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const topologyController = {
  getAll: async (req, res) => {
    try {
      const filters = {
        parent_asset_id: req.query.parent_asset_id,
        child_asset_id: req.query.child_asset_id,
        asset_id: req.query.asset_id,
        relationship_type: req.query.relationship_type
      };
      const topology = TopologyModel.findAll(filters);
      res.json({ success: true, data: topology });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getFullTopology: async (req, res) => {
    try {
      const topology = TopologyModel.getFullTopology();
      res.json({ success: true, data: topology });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getHierarchy: async (req, res) => {
    try {
      const hierarchy = TopologyModel.getHierarchy(req.params.assetId);
      if (!hierarchy) {
        return res.status(404).json({ success: false, error: '资产不存在' });
      }
      res.json({ success: true, data: hierarchy });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const topology = TopologyModel.create(req.body);
      res.status(201).json({ success: true, data: topology });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ 
          success: false, 
          error: '拓扑关系已存在' 
        });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  },

  delete: async (req, res) => {
    try {
      const deleted = TopologyModel.delete(req.params.id);
      res.json({ success: true, data: { deleted } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const importController = {
  importAssets: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择要上传的文件' });
      }
      
      const result = await ImportService.importAssets(req.file.buffer.toString());
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  importTopology: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择要上传的文件' });
      }
      
      const result = await ImportService.importTopology(req.file.buffer.toString());
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  importDHCPLeases: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择要上传的文件' });
      }
      
      const result = await ImportService.importDHCPLeases(req.file.buffer.toString());
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  importFirewallRules: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择要上传的文件' });
      }
      
      const result = await ImportService.importFirewallRules(req.file.buffer.toString());
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  importAlerts: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择要上传的文件' });
      }
      
      const result = await ImportService.importAlerts(req.file.buffer.toString());
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  importNetworkSegments: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择要上传的文件' });
      }
      
      const result = await ImportService.importNetworkSegments(req.file.buffer.toString());
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  importVLANs: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择要上传的文件' });
      }
      
      const result = await ImportService.importVLANs(req.file.buffer.toString());
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const reportController = {
  generate: async (req, res) => {
    try {
      const format = req.query.format || 'markdown';
      const report = ReportService.generateReport(format);
      
      let contentType = 'text/plain';
      let filename = `network-report-${Date.now()}`;
      
      switch (format.toLowerCase()) {
        case 'html':
          contentType = 'text/html';
          filename += '.html';
          break;
        case 'csv':
          contentType = 'text/csv';
          filename += '.csv';
          break;
        default:
          contentType = 'text/markdown';
          filename += '.md';
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(report);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getPreview: async (req, res) => {
    try {
      const data = ReportService.collectReportData();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const dashboardController = {
  getOverview: async (req, res) => {
    try {
      const assetStats = AssetModel.getStats();
      const alertStats = AlertModel.getStats();
      const changeStats = ChangeOrderModel.getStats();
      const riskStats = RiskModel.getStats();
      
      const segments = NetworkSegmentModel.findAll();
      const totalIPs = segments.reduce((sum, s) => sum + (s.total_ips || 0), 0);
      const usedIPs = segments.reduce((sum, s) => sum + (s.used_ips || 0), 0);
      
      res.json({
        success: true,
        data: {
          assets: assetStats,
          alerts: alertStats,
          changes: changeStats,
          risks: riskStats,
          network: {
            totalIPs,
            usedIPs,
            utilization: totalIPs > 0 ? ((usedIPs / totalIPs) * 100).toFixed(1) : 0,
            segmentCount: segments.length
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
