import request from 'supertest';
import { db, initTables } from '../src/config/database.js';
import AssetModel from '../src/models/AssetModel.js';
import { 
  IPAddressModel, 
  NetworkSegmentModel, 
  VLANModel 
} from '../src/models/NetworkModel.js';
import { RiskEngine } from '../src/models/TopologyRiskModel.js';

let app;

beforeAll(async () => {
  initTables();
  const { default: appModule } = await import('../src/app.js');
  app = appModule;
});

afterAll(() => {
  db.close();
});

describe('AssetModel Tests', () => {
  let testAsset;

  beforeEach(() => {
    db.exec('DELETE FROM assets');
  });

  test('should create a new asset', () => {
    const asset = AssetModel.create({
      name: '测试电脑',
      type: 'computer',
      mac_address: '00:11:22:33:44:55',
      department: '测试部门',
      owner: '测试用户'
    });

    expect(asset).toBeDefined();
    expect(asset.name).toBe('测试电脑');
    expect(asset.type).toBe('computer');
    testAsset = asset;
  });

  test('should find asset by id', () => {
    const created = AssetModel.create({
      name: '查找测试',
      type: 'server',
      mac_address: '00:11:22:33:44:66'
    });

    const found = AssetModel.findById(created.id);
    expect(found).toBeDefined();
    expect(found.name).toBe('查找测试');
  });

  test('should find asset by mac', () => {
    const mac = 'AA:BB:CC:DD:EE:FF';
    AssetModel.create({
      name: 'MAC查找测试',
      type: 'printer',
      mac_address: mac
    });

    const found = AssetModel.findByMac(mac);
    expect(found).toBeDefined();
    expect(found.mac_address).toBe(mac);
  });

  test('should update asset', () => {
    const asset = AssetModel.create({
      name: '更新前',
      type: 'computer',
      mac_address: '00:11:22:33:44:77',
      status: 'active'
    });

    const updated = AssetModel.update(asset.id, {
      name: '更新后',
      status: 'inactive'
    });

    expect(updated.name).toBe('更新后');
    expect(updated.status).toBe('inactive');
  });

  test('should delete asset', () => {
    const asset = AssetModel.create({
      name: '删除测试',
      type: 'computer',
      mac_address: '00:11:22:33:44:88'
    });

    const deleted = AssetModel.delete(asset.id);
    expect(deleted).toBe(true);

    const found = AssetModel.findById(asset.id);
    expect(found).toBeUndefined();
  });

  test('should get stats', () => {
    AssetModel.create({ name: '电脑1', type: 'computer', status: 'active' });
    AssetModel.create({ name: '电脑2', type: 'computer', status: 'active' });
    AssetModel.create({ name: '服务器1', type: 'server', status: 'active' });

    const stats = AssetModel.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.byType).toBeDefined();
  });

  test('should validate mac address uniqueness', () => {
    const mac = 'FF:EE:DD:CC:BB:AA';
    AssetModel.create({
      name: '唯一MAC测试1',
      type: 'computer',
      mac_address: mac
    });

    expect(() => {
      AssetModel.create({
        name: '唯一MAC测试2',
        type: 'computer',
        mac_address: mac
      });
    }).toThrow();
  });
});

describe('NetworkModel Tests', () => {
  beforeEach(() => {
    db.exec('DELETE FROM ip_addresses');
    db.exec('DELETE FROM network_segments');
    db.exec('DELETE FROM vlans');
  });

  test('should create and find VLAN', () => {
    const vlan = VLANModel.create({
      vlan_id: 100,
      name: '测试VLAN',
      type: 'data',
      is_guest: false
    });

    expect(vlan).toBeDefined();
    expect(vlan.vlan_id).toBe(100);

    const found = VLANModel.findByVLANId(100);
    expect(found).toBeDefined();
    expect(found.name).toBe('测试VLAN');
  });

  test('should create network segment', () => {
    const vlan = VLANModel.create({
      vlan_id: 200,
      name: '网段VLAN',
      type: 'data'
    });

    const segment = NetworkSegmentModel.create({
      name: '测试网段',
      cidr: '10.0.0.0/24',
      gateway: '10.0.0.1',
      vlan_id: vlan.id
    });

    expect(segment).toBeDefined();
    expect(segment.cidr).toBe('10.0.0.0/24');
  });

  test('should calculate total IPs from CIDR', () => {
    const total = NetworkSegmentModel.calculateTotalIPs('192.168.1.0/24');
    expect(total).toBe(254);

    const total24 = NetworkSegmentModel.calculateTotalIPs('10.0.0.0/16');
    expect(total24).toBe(65534);
  });

  test('should create IP address', () => {
    const ip = IPAddressModel.create({
      ip: '192.168.100.10',
      status: 'assigned',
      is_static: true
    });

    expect(ip).toBeDefined();
    expect(ip.ip).toBe('192.168.100.10');

    const found = IPAddressModel.findByIP('192.168.100.10');
    expect(found).toBeDefined();
  });
});

describe('RiskEngine Tests', () => {
  beforeEach(() => {
    db.exec('DELETE FROM risks');
    db.exec('DELETE FROM ip_addresses');
    db.exec('DELETE FROM network_segments');
    db.exec('DELETE FROM dhcp_leases');
    db.exec('DELETE FROM firewall_rules');
    db.exec('DELETE FROM switch_ports');
  });

  test('should detect high utilization', () => {
    const segment = NetworkSegmentModel.create({
      name: '高利用率测试网段',
      cidr: '172.16.0.0/29',
      total_ips: 6,
      used_ips: 6
    });

    const highUtil = NetworkSegmentModel.getHighUtilization(0.8);
    const hasHigh = highUtil.some(s => s.id === segment.id);
    expect(hasHigh).toBe(true);
  });

  test('should generate risk key consistently', () => {
    const risk1 = { type: 'ip_conflict', ip_address: '192.168.1.100' };
    const risk2 = { type: 'ip_conflict', ip_address: '192.168.1.100' };
    
    const key1 = RiskEngine.riskToKey(risk1);
    const key2 = RiskEngine.riskToKey(risk2);
    
    expect(key1).toBe(key2);
  });

  test('SEVERITY_COLORS should have correct mapping', () => {
    expect(RiskEngine.SEVERITY.CRITICAL).toBe('critical');
    expect(RiskEngine.SEVERITY.HIGH).toBe('high');
    expect(RiskEngine.SEVERITY.MEDIUM).toBe('medium');
    expect(RiskEngine.SEVERITY.LOW).toBe('low');
  });

  test('RISK_TYPES should be defined', () => {
    expect(RiskEngine.RISK_TYPES.IP_CONFLICT).toBe('ip_conflict');
    expect(RiskEngine.RISK_TYPES.HIGH_UTILIZATION).toBe('high_utilization');
    expect(RiskEngine.RISK_TYPES.UNKNOWN_DEVICE).toBe('unknown_device');
  });
});

describe('API Endpoint Tests', () => {
  test('GET /api/health should return ok', async () => {
    const response = await request('http://localhost:3001').get('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('GET /api/assets should return array', async () => {
    const response = await request('http://localhost:3001').get('/api/assets');
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('POST /api/assets should validate required fields', async () => {
    const response = await request('http://localhost:3001')
      .post('/api/assets')
      .send({ type: 'computer' });

    expect(response.statusCode).toBe(400);
  });
});

describe('Validation Tests', () => {
  test('should validate MAC address format', () => {
    const validMACs = [
      '00:1A:2B:3C:4D:5E',
      '00-1A-2B-3C-4D-5E',
      'aa:bb:cc:dd:ee:ff'
    ];

    const invalidMACs = [
      '00:1A:2B:3C:4D',
      '00:1A:2B:3C:4D:5E:6F',
      'invalid-mac',
      '00:1A:2B:3C:4D:GG'
    ];

    const ImportService = require('../src/services/ImportService.js').default;
    
    validMACs.forEach(mac => {
      expect(ImportService.validateMAC(mac)).toBe(true);
    });

    invalidMACs.forEach(mac => {
      expect(ImportService.validateMAC(mac)).toBe(false);
    });
  });

  test('should validate IP address format', () => {
    const ImportService = require('../src/services/ImportService.js').default;
    
    expect(ImportService.validateIP('192.168.1.1')).toBe(true);
    expect(ImportService.validateIP('192.168.1.0/24')).toBe(true);
    expect(ImportService.validateIP('255.255.255.255')).toBe(true);
    expect(ImportService.validateIP('10.0.0.1')).toBe(true);
    
    expect(ImportService.validateIP('256.256.256.256')).toBe(false);
    expect(ImportService.validateIP('192.168.1')).toBe(false);
    expect(ImportService.validateIP('invalid-ip')).toBe(false);
    expect(ImportService.validateIP('192.168.1.300')).toBe(false);
  });
});
