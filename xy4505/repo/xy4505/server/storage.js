const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');
const dayjs = require('dayjs');
const storage = require('node-persist');

let isInitialized = false;

// 辅助函数：安全获取数组
async function getArray(key) {
  const data = await storage.getItem(key);
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

// 初始化存储
async function init() {
  if (isInitialized) return;
  
  // 确保data目录存在
  const dataDir = path.join(__dirname, '../data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  
  // 初始化node-persist
  await storage.init({
    dir: dataDir,
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: 'utf8',
    logging: false,
    ttl: false, // 永不过期
    expiredInterval: 24 * 60 * 60 * 1000,
  });
  
  isInitialized = true;
}

// 解析CSV文件
async function parseCSV(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });
  
  if (result.errors.length > 0) {
    console.warn('CSV解析警告:', result.errors);
  }
  
  // 删除临时文件
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.warn('删除临时文件失败:', err);
  }
  
  return result.data;
}

// 解析日志文件
async function parseLog(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  const logs = [];
  
  // 尝试解析日志格式，支持多种常见格式
  for (const line of lines) {
    const logEntry = {};
    
    // 格式1: 时间 灯杆ID 电流值
    const match1 = line.match(/(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([\d.]+)/);
    if (match1) {
      logEntry.timestamp = match1[1];
      logEntry.poleId = match1[2];
      logEntry.current = parseFloat(match1[3]);
    } else {
      // 格式2: 逗号分隔
      const parts = line.split(/[,;\t]/);
      if (parts.length >= 3) {
        logEntry.timestamp = parts[0].trim();
        logEntry.poleId = parts[1].trim();
        logEntry.current = parseFloat(parts[2].trim());
      }
    }
    
    if (logEntry.poleId && !isNaN(logEntry.current)) {
      logs.push(logEntry);
    }
  }
  
  // 删除临时文件
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.warn('删除临时文件失败:', err);
  }
  
  return logs;
}

// 解析文本文件
async function parseText(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const entries = [];
  
  // 尝试按段落或日期分隔
  const blocks = content.split(/\n\s*\n/).filter(block => block.trim());
  
  for (const block of blocks) {
    const entry = {};
    
    // 提取日期
    const dateMatch = block.match(/(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/);
    if (dateMatch) {
      entry.date = dateMatch[1];
    }
    
    // 提取地址/道路
    const roadMatch = block.match(/([^\s]+路|[^\s]+街|[^\s]+道|[^\s]+巷|[^\s]+大道)/);
    if (roadMatch) {
      entry.road = roadMatch[1];
    }
    
    // 提取灯杆号
    const poleMatch = block.match(/灯杆[#\s]?(\d+)|杆[#\s]?(\d+)/);
    if (poleMatch) {
      entry.poleId = poleMatch[1] || poleMatch[2];
    }
    
    // 提取描述
    entry.description = block.trim();
    
    // 提取关键词
    const keywords = ['不亮', '闪烁', '变暗', '损坏', '故障', '维修'];
    entry.keywords = keywords.filter(kw => block.includes(kw));
    
    entries.push(entry);
  }
  
  // 删除临时文件
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.warn('删除临时文件失败:', err);
  }
  
  return entries;
}

// 保存照度数据
async function saveIlluminationData(data) {
  const existingData = await getArray('illumination');
  
  // 标准化字段名
  const standardizedData = data.map(item => ({
    id: `ill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    road: item.道路 || item.road || item.路段 || item.Road || '',
    poleId: item.灯杆号 || item.poleId || item.灯杆 || item.Pole || '',
    illumination: item.照度 || item.illumination || item.亮度 || item.Illumination || 0,
    timestamp: item.时间 || item.timestamp || item.Time || dayjs().format('YYYY-MM-DD HH:mm:ss'),
    rawData: item,
    importedAt: dayjs().toISOString()
  }));
  
  const merged = [...existingData, ...standardizedData];
  await storage.setItem('illumination', merged);
  
  return { count: standardizedData.length };
}

// 保存电流日志数据
async function saveCurrentLogData(data) {
  const existingData = await getArray('currentLogs');
  
  const standardizedData = data.map(item => ({
    id: `curr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    poleId: item.poleId || item.灯杆号 || item.Pole || '',
    current: item.current || item.电流 || item.Current || 0,
    timestamp: item.timestamp || item.时间 || item.Time || dayjs().format('YYYY-MM-DD HH:mm:ss'),
    rawData: item,
    importedAt: dayjs().toISOString()
  }));
  
  const merged = [...existingData, ...standardizedData];
  await storage.setItem('currentLogs', merged);
  
  return { count: standardizedData.length };
}

// 保存报修数据
async function saveComplaintsData(data) {
  const existingData = await getArray('complaints');
  
  const standardizedData = data.map(item => ({
    id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    road: item.road || item.道路 || item.Road || '',
    poleId: item.poleId || item.灯杆号 || item.Pole || '',
    description: item.description || item.描述 || item.Description || '',
    keywords: item.keywords || [],
    date: item.date || item.日期 || item.Date || dayjs().format('YYYY-MM-DD'),
    rawData: item,
    importedAt: dayjs().toISOString()
  }));
  
  const merged = [...existingData, ...standardizedData];
  await storage.setItem('complaints', merged);
  
  return { count: standardizedData.length };
}

// 保存工单数据
async function saveWorkOrdersData(data) {
  const existingData = await getArray('workOrders');
  
  const standardizedData = data.map(item => ({
    id: `wo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    orderNo: item.工单号 || item.orderNo || item.OrderNo || '',
    road: item.道路 || item.road || item.Road || '',
    poleId: item.灯杆号 || item.poleId || item.Pole || '',
    issueType: item.问题类型 || item.issueType || item.IssueType || '',
    solution: item.解决方案 || item.solution || item.Solution || '',
    status: item.状态 || item.status || item.Status || '已完成',
    date: item.日期 || item.date || item.Date || dayjs().format('YYYY-MM-DD'),
    rawData: item,
    importedAt: dayjs().toISOString()
  }));
  
  const merged = [...existingData, ...standardizedData];
  await storage.setItem('workOrders', merged);
  
  return { count: standardizedData.length };
}

// 获取所有风险数据
async function getAllRisks() {
  return await getArray('risks');
}

// 按道路获取风险
async function getRisksByRoad(roadName) {
  const allRisks = await getAllRisks();
  return allRisks.filter(risk => 
    risk.road && roadName && 
    risk.road.includes(roadName)
  );
}

// 获取所有道路列表
async function getAllRoads() {
  const [illumination, complaints, workOrders, risks] = await Promise.all([
    getArray('illumination'),
    getArray('complaints'),
    getArray('workOrders'),
    getArray('risks')
  ]);
  
  const roads = new Set();
  
  [...illumination, ...complaints, ...workOrders, ...risks].forEach(item => {
    if (item.road) {
      roads.add(item.road);
    }
  });
  
  return Array.from(roads).sort();
}

// 获取相似历史记录
async function getSimilarHistory(riskType) {
  const workOrders = await getArray('workOrders');
  
  // 根据风险类型查找相似历史
  const typeKeywords = {
    '灯具衰减': ['变暗', '衰减', '亮度低', '老化'],
    '线路故障': ['不亮', '线路', '短路', '断路', '跳闸'],
    '误报': ['误报', '正常', '误判', '无故障']
  };
  
  const keywords = typeKeywords[riskType] || [];
  
  const similar = workOrders.filter(wo => {
    if (wo.issueType && riskType.includes(wo.issueType)) return true;
    const combinedText = `${wo.issueType || ''} ${wo.solution || ''} ${wo.rawData || ''}`;
    return keywords.some(kw => combinedText.includes(kw));
  });
  
  return similar.slice(0, 10);
}

// 保存人工复核备注
async function saveRemarks(riskId, remarks, status) {
  const risks = await getArray('risks');
  
  const riskIndex = risks.findIndex(r => r.id === riskId);
  if (riskIndex !== -1) {
    risks[riskIndex].remarks = remarks || risks[riskIndex].remarks;
    risks[riskIndex].status = status || risks[riskIndex].status || '待复核';
    risks[riskIndex].reviewedAt = dayjs().toISOString();
  }
  
  await storage.setItem('risks', risks);
}

// 保存风险数据
async function saveRisks(risks) {
  // 获取现有数据，保留已有的备注和状态
  const existingRisks = await getArray('risks');
  
  const existingMap = new Map();
  existingRisks.forEach(r => {
    const key = `${r.road}_${r.poleId}_${r.riskType}`;
    existingMap.set(key, {
      remarks: r.remarks,
      status: r.status,
      reviewedAt: r.reviewedAt
    });
  });
  
  // 合并新数据，保留备注
  const mergedRisks = risks.map(r => {
    const key = `${r.road}_${r.poleId}_${r.riskType}`;
    const existing = existingMap.get(key);
    return {
      ...r,
      remarks: existing?.remarks,
      status: existing?.status || '待复核',
      reviewedAt: existing?.reviewedAt
    };
  });
  
  await storage.setItem('risks', mergedRisks);
}

// 获取统计数据
async function getStatistics() {
  const [illumination, currentLogs, complaints, workOrders, risks] = await Promise.all([
    getArray('illumination'),
    getArray('currentLogs'),
    getArray('complaints'),
    getArray('workOrders'),
    getArray('risks')
  ]);
  
  const typeStats = {
    '灯具衰减': 0,
    '线路故障': 0,
    '误报': 0
  };
  
  const priorityStats = {
    '高': 0,
    '中': 0,
    '低': 0
  };
  
  const statusStats = {
    '待复核': 0,
    '已确认': 0,
    '已派工': 0,
    '已完成': 0
  };
  
  risks.forEach(r => {
    if (typeStats[r.riskType] !== undefined) {
      typeStats[r.riskType]++;
    }
    if (priorityStats[r.priority] !== undefined) {
      priorityStats[r.priority]++;
    }
    if (statusStats[r.status] !== undefined) {
      statusStats[r.status]++;
    }
  });
  
  return {
    totalRisks: risks.length,
    illuminationCount: illumination.length,
    currentLogsCount: currentLogs.length,
    complaintsCount: complaints.length,
    workOrdersCount: workOrders.length,
    typeStats,
    priorityStats,
    statusStats
  };
}

// 获取所有原始数据（用于导出）
async function getAllData() {
  const [illumination, currentLogs, complaints, workOrders, risks] = await Promise.all([
    getArray('illumination'),
    getArray('currentLogs'),
    getArray('complaints'),
    getArray('workOrders'),
    getArray('risks')
  ]);
  
  return {
    illumination,
    currentLogs,
    complaints,
    workOrders,
    risks,
    exportTime: dayjs().toISOString()
  };
}

module.exports = {
  init,
  parseCSV,
  parseLog,
  parseText,
  saveIlluminationData,
  saveCurrentLogData,
  saveComplaintsData,
  saveWorkOrdersData,
  getAllRisks,
  getRisksByRoad,
  getAllRoads,
  getSimilarHistory,
  saveRemarks,
  saveRisks,
  getStatistics,
  getAllData
};
