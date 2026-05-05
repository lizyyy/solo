const fs = require('fs');
const path = require('path');

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../../data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 数据文件
const FILES = {
  gondolas: path.join(DATA_DIR, 'gondolas.json'),
  workers: path.join(DATA_DIR, 'workers.json'),
  facades: path.join(DATA_DIR, 'facades.json'),
  windForecast: path.join(DATA_DIR, 'windForecast.json'),
  noiseRestrictions: path.join(DATA_DIR, 'noiseRestrictions.json'),
  schedules: path.join(DATA_DIR, 'schedules.json'),
  reviews: path.join(DATA_DIR, 'reviews.json')
};

// 初始化数据文件（如果不存在）
function initializeFiles() {
  Object.values(FILES).forEach(file => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([], null, 2));
    }
  });
}

// 读取数据
function readData(type) {
  const file = FILES[type];
  if (!file) return [];
  
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf-8');
      return JSON.parse(data) || [];
    }
    return [];
  } catch (error) {
    console.error(`读取数据失败 ${type}:`, error);
    return [];
  }
}

// 保存数据
function saveData(type, data) {
  const file = FILES[type];
  if (!file) return false;
  
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`保存数据失败 ${type}:`, error);
    return false;
  }
}

// 示例数据
const SAMPLE_DATA = {
  gondolas: [
    { id: 'G001', name: '吊篮1', status: 'available', capacity: 2, maxWindSpeed: 8, facades: ['N1', 'N2'] },
    { id: 'G002', name: '吊篮2', status: 'available', capacity: 2, maxWindSpeed: 8, facades: ['N3', 'E1'] },
    { id: 'G003', name: '吊篮3', status: 'maintenance', capacity: 2, maxWindSpeed: 8, facades: ['E2', 'E3'] },
    { id: 'G004', name: '吊篮4', status: 'available', capacity: 3, maxWindSpeed: 10, facades: ['S1', 'S2', 'S3'] },
    { id: 'G005', name: '吊篮5', status: 'available', capacity: 2, maxWindSpeed: 8, facades: ['W1', 'W2', 'W3'] }
  ],
  workers: [
    { id: 'W001', name: '张三', certifications: ['高空作业', '电气检修', '幕墙安装'], experience: 5, status: 'available' },
    { id: 'W002', name: '李四', certifications: ['高空作业', '幕墙安装'], experience: 3, status: 'available' },
    { id: 'W003', name: '王五', certifications: ['高空作业', '电气检修'], experience: 4, status: 'available' },
    { id: 'W004', name: '赵六', certifications: ['高空作业'], experience: 2, status: 'leave' },
    { id: 'W005', name: '钱七', certifications: ['高空作业', '幕墙安装', '防水处理'], experience: 6, status: 'available' }
  ],
  facades: [
    { id: 'N1', name: '北立面1区', direction: 'N', floors: '1-5', area: 500, specialRequirements: ['幕墙安装'] },
    { id: 'N2', name: '北立面2区', direction: 'N', floors: '6-10', area: 500, specialRequirements: ['电气检修'] },
    { id: 'N3', name: '北立面3区', direction: 'N', floors: '11-15', area: 500, specialRequirements: [] },
    { id: 'E1', name: '东立面1区', direction: 'E', floors: '1-5', area: 600, specialRequirements: ['防水处理'] },
    { id: 'E2', name: '东立面2区', direction: 'E', floors: '6-10', area: 600, specialRequirements: ['幕墙安装'] },
    { id: 'E3', name: '东立面3区', direction: 'E', floors: '11-15', area: 600, specialRequirements: [] },
    { id: 'S1', name: '南立面1区', direction: 'S', floors: '1-5', area: 500, specialRequirements: ['电气检修'] },
    { id: 'S2', name: '南立面2区', direction: 'S', floors: '6-10', area: 500, specialRequirements: [] },
    { id: 'S3', name: '南立面3区', direction: 'S', floors: '11-15', area: 500, specialRequirements: ['幕墙安装'] },
    { id: 'W1', name: '西立面1区', direction: 'W', floors: '1-5', area: 400, specialRequirements: ['防水处理'] },
    { id: 'W2', name: '西立面2区', direction: 'W', floors: '6-10', area: 400, specialRequirements: [] },
    { id: 'W3', name: '西立面3区', direction: 'W', floors: '11-15', area: 400, specialRequirements: ['电气检修'] }
  ],
  windForecast: [
    { date: '2026-05-05', direction: 'N', speed: 6, maxSpeed: 9, riskLevel: 'medium' },
    { date: '2026-05-06', direction: 'E', speed: 4, maxSpeed: 6, riskLevel: 'low' },
    { date: '2026-05-07', direction: 'S', speed: 10, maxSpeed: 14, riskLevel: 'high' }
  ],
  noiseRestrictions: [
    { date: '2026-05-05', startTime: '08:00', endTime: '12:00', reason: '上午办公时间' },
    { date: '2026-05-05', startTime: '14:00', endTime: '18:00', reason: '下午办公时间' },
    { date: '2026-05-06', startTime: '09:00', endTime: '17:00', reason: '全天办公时间' }
  ]
};

// 导入示例数据
function importSampleData() {
  Object.keys(SAMPLE_DATA).forEach(type => {
    saveData(type, SAMPLE_DATA[type]);
  });
  return true;
}

// 获取所有数据
function getAllData() {
  return {
    gondolas: readData('gondolas'),
    workers: readData('workers'),
    facades: readData('facades'),
    windForecast: readData('windForecast'),
    noiseRestrictions: readData('noiseRestrictions'),
    schedules: readData('schedules'),
    reviews: readData('reviews')
  };
}

module.exports = {
  initializeFiles,
  readData,
  saveData,
  importSampleData,
  getAllData,
  SAMPLE_DATA
};
