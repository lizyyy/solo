import express from 'express';
import multer from 'multer';
import {
  assetController,
  networkController,
  alertController,
  firewallController,
  changeController,
  riskController,
  topologyController,
  importController,
  reportController,
  dashboardController,
  validationRules,
  handleValidation
} from '../controllers/index.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 健康检查
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// 仪表板
router.get('/dashboard/overview', dashboardController.getOverview);

// 资产路由
router.get('/assets', assetController.getAll);
router.get('/assets/stats', assetController.getStats);
router.get('/assets/:id', validationRules.idParam, handleValidation, assetController.getById);
router.post('/assets', validationRules.assetCreate, handleValidation, assetController.create);
router.put('/assets/:id', validationRules.idParam, handleValidation, assetController.update);
router.delete('/assets/:id', validationRules.idParam, handleValidation, assetController.delete);

// IP地址路由
router.get('/ips', networkController.getIPs);
router.get('/ips/:id', validationRules.idParam, handleValidation, networkController.getIPById);
router.post('/ips', validationRules.ipCreate, handleValidation, networkController.createIP);
router.put('/ips/:id', validationRules.idParam, handleValidation, networkController.updateIP);
router.delete('/ips/:id', validationRules.idParam, handleValidation, networkController.deleteIP);

// 网段路由
router.get('/segments', networkController.getSegments);
router.get('/segments/:id', validationRules.idParam, handleValidation, networkController.getSegmentById);
router.post('/segments', networkController.createSegment);

// VLAN路由
router.get('/vlans', networkController.getVLANs);
router.get('/vlans/:id', validationRules.idParam, handleValidation, networkController.getVLANById);
router.post('/vlans', validationRules.vlanCreate, handleValidation, networkController.createVLAN);
router.put('/vlans/:id', validationRules.idParam, handleValidation, networkController.updateVLAN);

// 交换机端口路由
router.get('/switch-ports', networkController.getSwitchPorts);

// DHCP租约路由
router.get('/dhcp-leases', networkController.getDHCPLeases);

// 告警路由
router.get('/alerts', alertController.getAll);
router.get('/alerts/grouped', alertController.getGrouped);
router.get('/alerts/stats', alertController.getStats);
router.get('/alerts/:id', validationRules.idParam, handleValidation, alertController.getById);
router.post('/alerts/:id/acknowledge', validationRules.idParam, handleValidation, alertController.acknowledge);
router.post('/alerts/group/:groupKey/acknowledge', alertController.acknowledgeGroup);

// 防火墙规则路由
router.get('/firewall-rules', firewallController.getAll);
router.get('/firewall-rules/:id', validationRules.idParam, handleValidation, firewallController.getById);
router.post('/firewall-rules', firewallController.create);
router.put('/firewall-rules/:id', validationRules.idParam, handleValidation, firewallController.update);
router.delete('/firewall-rules/:id', validationRules.idParam, handleValidation, firewallController.delete);

// 变更单路由
router.get('/changes', changeController.getAll);
router.get('/changes/stats', changeController.getStats);
router.get('/changes/:id', validationRules.idParam, handleValidation, changeController.getById);
router.post('/changes', changeController.create);
router.post('/changes/:id/transition', 
  validationRules.idParam, 
  validationRules.changeStatus, 
  handleValidation, 
  changeController.transition
);
router.post('/changes/analyze', changeController.analyzeImpact);

// 风险路由
router.get('/risks', riskController.getAll);
router.get('/risks/stats', riskController.getStats);
router.get('/risks/:id', validationRules.idParam, handleValidation, riskController.getById);
router.post('/risks/run-checks', riskController.runChecks);
router.post('/risks/:id/resolve', validationRules.idParam, handleValidation, riskController.resolve);

// 拓扑路由
router.get('/topology', topologyController.getAll);
router.get('/topology/full', topologyController.getFullTopology);
router.get('/topology/hierarchy/:assetId', topologyController.getHierarchy);
router.post('/topology', topologyController.create);
router.delete('/topology/:id', validationRules.idParam, handleValidation, topologyController.delete);

// 导入路由
router.post('/import/assets', upload.single('file'), importController.importAssets);
router.post('/import/topology', upload.single('file'), importController.importTopology);
router.post('/import/dhcp-leases', upload.single('file'), importController.importDHCPLeases);
router.post('/import/firewall-rules', upload.single('file'), importController.importFirewallRules);
router.post('/import/alerts', upload.single('file'), importController.importAlerts);
router.post('/import/segments', upload.single('file'), importController.importNetworkSegments);
router.post('/import/vlans', upload.single('file'), importController.importVLANs);

// 报告路由
router.get('/reports', reportController.generate);
router.get('/reports/preview', reportController.getPreview);

export default router;
