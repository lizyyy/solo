import { initDatabase, getDatabase } from './main/database'
import { createUser } from './main/services/userService'
import { createDevice, lendDevice, returnDevice } from './main/services/deviceService'
import { UserRole, DeviceCategory, DeviceStatus } from './shared/types'

console.log('开始生成种子数据...')

initDatabase()

const db = getDatabase()

db.exec('DELETE FROM device_history')
db.exec('DELETE FROM borrow_records')
db.exec('DELETE FROM devices')
db.exec('DELETE FROM system_logs')
db.exec('DELETE FROM failed_operations')
db.exec('DELETE FROM batch_operations')
db.exec('DELETE FROM users')

console.log('清理现有数据完成')

const admin = createUser('admin', 'admin123', '系统管理员', UserRole.ADMIN)
console.log('创建管理员用户:', admin.username)

const operator = createUser('operator', 'operator123', '设备操作员', UserRole.OPERATOR)
console.log('创建操作员用户:', operator.username)

const user1 = createUser('zhangsan', '123456', '张三', UserRole.USER)
const user2 = createUser('lisi', '123456', '李四', UserRole.USER)
console.log('创建普通用户:', user1.username, user2.username)

const laptops: any[] = [
  { code: 'LAP-001', name: 'MacBook Pro 14" M3', model: 'A2992', serial: 'C02XYZ001', location: '3楼设备柜A1' },
  { code: 'LAP-002', name: 'MacBook Pro 16" M3 Pro', model: 'A2991', serial: 'C02XYZ002', location: '3楼设备柜A2' },
  { code: 'LAP-003', name: 'ThinkPad X1 Carbon Gen 11', model: '21HM', serial: 'PF3XYZ003', location: '3楼设备柜A3' },
  { code: 'LAP-004', name: 'Dell XPS 13 Plus', model: '9320', serial: '8ZTXYZ004', location: '3楼设备柜A4' },
  { code: 'LAP-005', name: 'MacBook Air M2', model: 'A2681', serial: 'C02XYZ005', location: '3楼设备柜A5' }
]

const phones: any[] = [
  { code: 'PHN-001', name: 'iPhone 15 Pro Max', model: 'A3108', serial: 'F2LXYZ001', location: '3楼设备柜B1' },
  { code: 'PHN-002', name: 'Samsung Galaxy S24 Ultra', model: 'SM-S9280', serial: 'R5CXYZ002', location: '3楼设备柜B2' },
  { code: 'PHN-003', name: 'iPhone 14 Pro', model: 'A2890', serial: 'F17XYZ003', location: '3楼设备柜B3' },
  { code: 'PHN-004', name: 'Huawei Mate 60 Pro', model: 'ALN-AL00', serial: '8TXYZ004', location: '3楼设备柜B4' },
  { code: 'PHN-005', name: 'Google Pixel 8 Pro', model: 'GC3VE', serial: 'GA0XYZ005', location: '3楼设备柜B5' }
]

const tablets: any[] = [
  { code: 'TAB-001', name: 'iPad Pro 12.9" M2', model: 'A2437', serial: 'DLFXYZ001', location: '3楼设备柜C1' },
  { code: 'TAB-002', name: 'iPad Air 5', model: 'A2588', serial: 'DLHXYZ002', location: '3楼设备柜C2' },
  { code: 'TAB-003', name: 'Samsung Galaxy Tab S9 Ultra', model: 'SM-X910', serial: 'R5CXXYZ003', location: '3楼设备柜C3' }
]

const cameras: any[] = [
  { code: 'CAM-001', name: 'Sony A7 IV', model: 'ILCE-7M4', serial: '658XYZ001', location: '3楼设备柜D1' },
  { code: 'CAM-002', name: 'Canon EOS R5', model: 'EOS R5', serial: '318XYZ002', location: '3楼设备柜D2' },
  { code: 'CAM-003', name: 'DJI Pocket 2', model: 'OP2CP1', serial: 'O3XYZ003', location: '3楼设备柜D3' }
]

const audio: any[] = [
  { code: 'AUD-001', name: 'Apple AirPods Pro 2', model: 'A2699', serial: 'JK2XYZ001', location: '3楼设备柜E1' },
  { code: 'AUD-002', name: 'Sony WH-1000XM5', model: 'WH-1000XM5', serial: '502XYZ002', location: '3楼设备柜E2' },
  { code: 'AUD-003', name: 'Shure SM7B', model: 'SM7B', serial: '145XYZ003', location: '3楼设备柜E3' },
  { code: 'AUD-004', name: 'Rode Wireless GO II', model: 'WIGO II', serial: '602XYZ004', location: '3楼设备柜E4' }
]

const devices: any[] = []

for (const item of laptops) {
  devices.push(createDevice(item.code, item.name, DeviceCategory.LAPTOP, admin, {
    model: item.model,
    serialNumber: item.serial,
    location: item.location
  }))
}

for (const item of phones) {
  devices.push(createDevice(item.code, item.name, DeviceCategory.PHONE, admin, {
    model: item.model,
    serialNumber: item.serial,
    location: item.location
  }))
}

for (const item of tablets) {
  devices.push(createDevice(item.code, item.name, DeviceCategory.TABLET, admin, {
    model: item.model,
    serialNumber: item.serial,
    location: item.location
  }))
}

for (const item of cameras) {
  devices.push(createDevice(item.code, item.name, DeviceCategory.CAMERA, admin, {
    model: item.model,
    serialNumber: item.serial,
    location: item.location
  }))
}

for (const item of audio) {
  devices.push(createDevice(item.code, item.name, DeviceCategory.AUDIO, admin, {
    model: item.model,
    serialNumber: item.serial,
    location: item.location
  }))
}

console.log(`创建设备完成: ${devices.length} 台`)

const now = new Date()
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

const lend1 = lendDevice(devices[0].id, user1.id, user1.displayName, operator, nextWeek.toISOString(), '项目开发测试')
console.log(`借出设备: ${lend1.device.deviceCode} -> ${user1.displayName}`)

const lend2 = lendDevice(devices[5].id, user2.id, user2.displayName, operator, tomorrow.toISOString(), '客户演示')
console.log(`借出设备: ${lend2.device.deviceCode} -> ${user2.displayName}`)

const lend3 = lendDevice(devices[10].id, user1.id, user1.displayName, operator, undefined, 'UI适配测试')
console.log(`借出设备: ${lend3.device.deviceCode} -> ${user1.displayName}`)

const tempLend = lendDevice(devices[15].id, user2.id, user2.displayName, operator)
returnDevice(tempLend.device.id, operator, '设备完好归还')
console.log(`借出并归还: ${tempLend.device.deviceCode}`)

console.log('')
console.log('='.repeat(50))
console.log('种子数据生成完成！')
console.log('='.repeat(50))
console.log('')
console.log('默认账户:')
console.log('  管理员: admin / admin123')
console.log('  操作员: operator / operator123')
console.log('  普通用户: zhangsan / 123456, lisi / 123456')
console.log('')
console.log(`设备总数: ${devices.length} 台`)
console.log(`  可用: ${devices.filter(d => d.status === DeviceStatus.AVAILABLE).length} 台`)
console.log(`  借出: ${devices.filter(d => d.status === DeviceStatus.BORROWED).length} 台`)
console.log('')
