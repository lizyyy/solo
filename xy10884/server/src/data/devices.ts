import { Device } from '../types';

export const mockDevices: Device[] = [
  { id: 'dev-001', name: '产线机器人A1', group: 'factory-a', status: 'online', currentCertExpiry: '2026-05-20', ipAddress: '192.168.1.101', location: '一楼车间' },
  { id: 'dev-002', name: '产线机器人A2', group: 'factory-a', status: 'online', currentCertExpiry: '2026-05-21', ipAddress: '192.168.1.102', location: '一楼车间' },
  { id: 'dev-003', name: 'AGV小车A3', group: 'factory-a', status: 'offline', currentCertExpiry: '2026-05-22', ipAddress: '192.168.1.103', location: '仓库区域' },
  { id: 'dev-004', name: '质检设备A4', group: 'factory-a', status: 'online', currentCertExpiry: '2026-05-18', ipAddress: '192.168.1.104', location: '质检室' },
  { id: 'dev-005', name: '包装机A5', group: 'factory-a', status: 'offline', currentCertExpiry: '2026-05-25', ipAddress: '192.168.1.105', location: '包装区' },
  
  { id: 'dev-006', name: '焊接机器人B1', group: 'factory-b', status: 'online', currentCertExpiry: '2026-05-19', ipAddress: '192.168.2.101', location: '焊接车间' },
  { id: 'dev-007', name: '冲压机B2', group: 'factory-b', status: 'online', currentCertExpiry: '2026-05-23', ipAddress: '192.168.2.102', location: '冲压车间' },
  { id: 'dev-008', name: '喷涂设备B3', group: 'factory-b', status: 'offline', currentCertExpiry: '2026-05-17', ipAddress: '192.168.2.103', location: '喷涂车间' },
  { id: 'dev-009', name: '检测设备B4', group: 'factory-b', status: 'online', currentCertExpiry: '2026-06-01', ipAddress: '192.168.2.104', location: '检测室' },
  { id: 'dev-010', name: '装配线B5', group: 'factory-b', status: 'online', currentCertExpiry: '2026-05-28', ipAddress: '192.168.2.105', location: '装配车间' },
  
  { id: 'dev-011', name: '叉车W1', group: 'warehouse', status: 'online', currentCertExpiry: '2026-05-24', ipAddress: '192.168.3.101', location: 'A库区' },
  { id: 'dev-012', name: '分拣系统W2', group: 'warehouse', status: 'offline', currentCertExpiry: '2026-05-16', ipAddress: '192.168.3.102', location: '分拣区' },
  { id: 'dev-013', name: '货架扫描器W3', group: 'warehouse', status: 'online', currentCertExpiry: '2026-05-30', ipAddress: '192.168.3.103', location: 'B库区' },
  
  { id: 'dev-014', name: 'POS机R1', group: 'retail', status: 'online', currentCertExpiry: '2026-05-26', ipAddress: '192.168.4.101', location: '门店1' },
  { id: 'dev-015', name: '自助结账机R2', group: 'retail', status: 'online', currentCertExpiry: '2026-05-27', ipAddress: '192.168.4.102', location: '门店2' },
  
  { id: 'dev-016', name: 'GPS追踪器L1', group: 'logistics', status: 'offline', currentCertExpiry: '2026-05-15', ipAddress: '192.168.5.101', location: '运输中' },
  { id: 'dev-017', name: '温湿度传感器L2', group: 'logistics', status: 'online', currentCertExpiry: '2026-05-29', ipAddress: '192.168.5.102', location: '冷链车1' },
  { id: 'dev-018', name: '门锁控制器L3', group: 'logistics', status: 'online', currentCertExpiry: '2026-06-02', ipAddress: '192.168.5.103', location: '集装箱1' },
];