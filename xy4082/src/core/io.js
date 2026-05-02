/**
 * 导入导出模块
 * 支持 JSON session、Markdown 定线说明、CSV 岩点清单
 */

import { Session, Wall, Hold, Route, HoldColors } from './dataModels.js';
import { calculateSpan, calculateLandingZone, analyzeRouteReachability, estimateDifficulty } from './geometry.js';

// ========== JSON 导入导出 ==========

/**
 * 导出 Session 为 JSON
 */
export function exportSessionToJSON(session) {
  if (!session) {
    throw new Error('Session 不能为空');
  }
  
  return JSON.stringify(session.toJSON(), null, 2);
}

/**
 * 从 JSON 导入 Session
 */
export function importSessionFromJSON(jsonString) {
  try {
    const json = JSON.parse(jsonString);
    return Session.fromJSON(json);
  } catch (e) {
    throw new Error(`解析 JSON 失败: ${e.message}`);
  }
}

/**
 * 导出墙面为 JSON
 */
export function exportWallToJSON(wall) {
  if (!wall) {
    throw new Error('Wall 不能为空');
  }
  return JSON.stringify(wall.toJSON(), null, 2);
}

/**
 * 从 JSON 导入墙面
 */
export function importWallFromJSON(jsonString) {
  try {
    const json = JSON.parse(jsonString);
    return Wall.fromJSON(json);
  } catch (e) {
    throw new Error(`解析墙面 JSON 失败: ${e.message}`);
  }
}

/**
 * 导出岩点列表为 JSON
 */
export function exportHoldsToJSON(holds) {
  return JSON.stringify(holds.map(h => h.toJSON()), null, 2);
}

/**
 * 从 JSON 导入岩点列表
 */
export function importHoldsFromJSON(jsonString) {
  try {
    const json = JSON.parse(jsonString);
    const holds = Array.isArray(json) ? json : [json];
    return holds.map(h => Hold.fromJSON(h));
  } catch (e) {
    throw new Error(`解析岩点 JSON 失败: ${e.message}`);
  }
}

// ========== Markdown 定线说明导出 ==========

/**
 * 导出定线说明为 Markdown
 */
export function exportRouteSetToMarkdown(session, options = {}) {
  if (!session || !session.wall) {
    throw new Error('Session 或 Wall 不能为空');
  }
  
  const wall = session.wall;
  const routes = session.routes || [];
  const wallHolds = wall.holds || [];
  
  const holdMap = new Map();
  wallHolds.forEach(h => holdMap.set(h.id, h));
  
  const lines = [];
  
  // 标题
  lines.push(`# ${session.name || '定线方案'}`);
  lines.push('');
  lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');
  
  // 墙面信息
  lines.push('## 墙面信息');
  lines.push('');
  lines.push(`| 属性 | 值 |`);
  lines.push(`|------|-----|`);
  lines.push(`| 名称 | ${wall.name || '未命名墙面'} |`);
  lines.push(`| 尺寸 | ${wall.width}m × ${wall.height}m |`);
  lines.push(`| 类型 | ${_getWallTypeLabel(wall.type)} |`);
  lines.push(`| 仰角 | ${wall.angle}° |`);
  lines.push(`| 儿童区 | ${wall.isKidsZone ? '是' : '否'} |`);
  lines.push(`| 岩点数量 | ${wallHolds.length} |`);
  lines.push('');
  
  // 线路概览
  lines.push('## 线路概览');
  lines.push('');
  
  if (routes.length === 0) {
    lines.push('> 暂无线路');
    lines.push('');
  } else {
    lines.push(`| # | 线路名称 | 难度 | 颜色 | 岩点数 | 起步 | 结束 | 估算难度 |`);
    lines.push(`|---|----------|------|------|--------|------|------|----------|`);
    
    routes.forEach((route, index) => {
      const routeHolds = route.holdIds.map(id => holdMap.get(id)).filter(h => h);
      const startHold = route.startHoldId ? holdMap.get(route.startHoldId) : null;
      const endHold = route.endHoldId ? holdMap.get(route.endHoldId) : null;
      const difficulty = estimateDifficulty(route, wallHolds);
      
      lines.push(`| ${index + 1} | ${route.name} | ${route.difficulty} | ${_formatColor(route.color, route.colorName)} | ${routeHolds.length} | ${startHold ? `(${startHold.x.toFixed(1)}m, ${startHold.y.toFixed(1)}m)` : '-'} | ${endHold ? `(${endHold.x.toFixed(1)}m, ${endHold.y.toFixed(1)}m)` : '-'} | ${difficulty.estimatedLevel || '-'} |`);
    });
    lines.push('');
  }
  
  // 各线路详情
  routes.forEach((route, routeIndex) => {
    lines.push(`---`);
    lines.push('');
    lines.push(`## 线路 ${routeIndex + 1}: ${route.name}`);
    lines.push('');
    
    // 基本信息
    lines.push('### 基本信息');
    lines.push('');
    lines.push(`- **难度**: ${route.difficulty}`);
    lines.push(`- **颜色**: ${_formatColor(route.color, route.colorName)}`);
    lines.push(`- **类型**: ${route.type === 'boulder' ? '抱石' : route.type}`);
    lines.push(`- **儿童线路**: ${route.isKidsRoute ? '是' : '否'}`);
    lines.push('');
    
    // 岩点列表
    const routeHolds = route.holdIds
      .map(id => holdMap.get(id))
      .filter(h => h)
      .sort((a, b) => a.y - b.y);
    
    lines.push('### 岩点列表');
    lines.push('');
    lines.push(`| # | 位置 | 类型 | 颜色 | 状态 |`);
    lines.push(`|---|------|------|------|------|`);
    
    routeHolds.forEach((hold, index) => {
      let status = [];
      if (hold.id === route.startHoldId) status.push('起步');
      if (hold.id === route.endHoldId) status.push('结束');
      
      lines.push(`| ${index + 1} | (${hold.x.toFixed(2)}m, ${hold.y.toFixed(2)}m) | ${_getHoldTypeLabel(hold.type)} | ${_formatColor(hold.color, hold.colorName)} | ${status.join(', ') || '-'} |`);
    });
    lines.push('');
    
    // 动作序列分析
    if (routeHolds.length >= 2) {
      lines.push('### 动作序列分析');
      lines.push('');
      lines.push(`| 动作 | 从位置 | 到位置 | 水平跨度 | 垂直跨度 | 距离 | 描述 |`);
      lines.push(`|------|--------|--------|----------|----------|------|------|`);
      
      for (let i = 0; i < routeHolds.length - 1; i++) {
        const fromHold = routeHolds[i];
        const toHold = routeHolds[i + 1];
        const span = calculateSpan(fromHold, toHold);
        
        lines.push(`| ${i + 1} | (${fromHold.x.toFixed(2)}m, ${fromHold.y.toFixed(2)}m) | (${toHold.x.toFixed(2)}m, ${toHold.y.toFixed(2)}m) | ${(span.horizontalSpan * 100).toFixed(0)}cm | ${(span.verticalSpan * 100).toFixed(0)}cm | ${(span.distance2D * 100).toFixed(0)}cm | ${span.description} |`);
      }
      lines.push('');
    }
    
    // 可达性分析
    const reachability = analyzeRouteReachability(route, wallHolds);
    lines.push('### 身高分段可达性');
    lines.push('');
    lines.push(`| 身高分段 | 可达性 | 问题数 |`);
    lines.push(`|----------|--------|--------|`);
    
    Object.entries(reachability).forEach(([key, result]) => {
      lines.push(`| ${result.segment.label} | ${result.reachable ? '✓ 可达' : '✗ 可能有问题'} | ${result.issues?.length || 0} |`);
    });
    lines.push('');
    
    // 落地区域
    const landingZone = calculateLandingZone(wall, route, wallHolds);
    if (landingZone.valid) {
      lines.push('### 落地区域要求');
      lines.push('');
      lines.push(`- **最高岩点高度**: ${(landingZone.highestPoint * 100).toFixed(0)}cm`);
      lines.push(`- **需要前方深度**: ${(landingZone.bounds.frontDepth).toFixed(1)}m`);
      lines.push(`- **区域宽度**: ${(landingZone.requirements.width).toFixed(1)}m`);
      lines.push(`- **儿童区域**: ${landingZone.isKidsZone ? '是' : '否'}`);
      lines.push('');
    }
    
    // 备注
    if (route.notes) {
      lines.push('### 备注');
      lines.push('');
      lines.push(route.notes);
      lines.push('');
    }
  });
  
  // 岩点统计
  lines.push('---');
  lines.push('');
  lines.push('## 岩点统计');
  lines.push('');
  
  // 按颜色统计
  const colorStats = new Map();
  wallHolds.forEach(hold => {
    const key = hold.colorName || hold.color;
    if (!colorStats.has(key)) {
      colorStats.set(key, { color: hold.color, name: key, count: 0, used: 0 });
    }
    colorStats.get(key).count++;
    
    // 检查是否被使用
    const isUsed = routes.some(r => r.holdIds.includes(hold.id));
    if (isUsed) {
      colorStats.get(key).used++;
    }
  });
  
  lines.push(`| 颜色 | 总数 | 已使用 | 使用率 |`);
  lines.push(`|------|------|--------|--------|`);
  
  colorStats.forEach((stat, key) => {
    const usageRate = stat.count > 0 ? (stat.used / stat.count * 100).toFixed(0) : 0;
    lines.push(`| ${_formatColor(stat.color, stat.name)} | ${stat.count} | ${stat.used} | ${usageRate}% |`);
  });
  lines.push('');
  
  // 按类型统计
  const typeStats = new Map();
  wallHolds.forEach(hold => {
    const key = hold.type;
    if (!typeStats.has(key)) {
      typeStats.set(key, 0);
    }
    typeStats.set(key, typeStats.get(key) + 1);
  });
  
  lines.push('### 按类型统计');
  lines.push('');
  lines.push(`| 类型 | 数量 |`);
  lines.push(`|------|------|`);
  
  typeStats.forEach((count, type) => {
    lines.push(`| ${_getHoldTypeLabel(type)} | ${count} |`);
  });
  lines.push('');
  
  // 整体备注
  if (session.notes) {
    lines.push('---');
    lines.push('');
    lines.push('## 方案备注');
    lines.push('');
    lines.push(session.notes);
    lines.push('');
  }
  
  return lines.join('\n');
}

// ========== CSV 岩点清单导出 ==========

/**
 * 导出岩点清单为 CSV
 */
export function exportHoldsToCSV(wall, routes = [], options = {}) {
  if (!wall) {
    throw new Error('Wall 不能为空');
  }
  
  const holds = wall.holds || [];
  const holdRouteMap = new Map();
  
  // 建立岩点到线路的映射
  routes.forEach(route => {
    route.holdIds.forEach(holdId => {
      if (!holdRouteMap.has(holdId)) {
        holdRouteMap.set(holdId, []);
      }
      holdRouteMap.get(holdId).push(route.name);
    });
  });
  
  const rows = [];
  
  // 表头
  const headers = [
    'ID',
    'X坐标 (m)',
    'Y坐标 (m)',
    'Z坐标 (m)',
    '类型',
    '颜色',
    '颜色名称',
    '宽度 (m)',
    '高度 (m)',
    '深度 (m)',
    '可用',
    '所属线路',
    '备注'
  ];
  rows.push(headers.map(h => `"${h}"`).join(','));
  
  // 数据行
  holds.forEach(hold => {
    const routeNames = holdRouteMap.get(hold.id) || [];
    const row = [
      hold.id,
      hold.x.toFixed(3),
      hold.y.toFixed(3),
      (hold.z || 0).toFixed(3),
      _getHoldTypeLabel(hold.type),
      hold.color,
      hold.colorName || '',
      (hold.size?.width || 0).toFixed(3),
      (hold.size?.height || 0).toFixed(3),
      (hold.size?.depth || 0).toFixed(3),
      hold.usable ? '是' : '否',
      routeNames.join(';'),
      hold.notes || ''
    ];
    rows.push(row.map(v => `"${v}"`).join(','));
  });
  
  return rows.join('\n');
}

/**
 * 导出线路统计为 CSV
 */
export function exportRoutesToCSV(session, options = {}) {
  if (!session || !session.wall) {
    throw new Error('Session 或 Wall 不能为空');
  }
  
  const wall = session.wall;
  const routes = session.routes || [];
  const wallHolds = wall.holds || [];
  
  const holdMap = new Map();
  wallHolds.forEach(h => holdMap.set(h.id, h));
  
  const rows = [];
  
  // 表头
  const headers = [
    '序号',
    '线路名称',
    '难度',
    '颜色',
    '岩点数',
    '起步X (m)',
    '起步Y (m)',
    '结束X (m)',
    '结束Y (m)',
    '最高岩点 (m)',
    '估算难度',
    '儿童线路',
    '备注'
  ];
  rows.push(headers.map(h => `"${h}"`).join(','));
  
  // 数据行
  routes.forEach((route, index) => {
    const routeHolds = route.holdIds.map(id => holdMap.get(id)).filter(h => h);
    const startHold = route.startHoldId ? holdMap.get(route.startHoldId) : null;
    const endHold = route.endHoldId ? holdMap.get(route.endHoldId) : null;
    const maxY = routeHolds.length > 0 ? Math.max(...routeHolds.map(h => h.y)) : 0;
    const difficulty = estimateDifficulty(route, wallHolds);
    
    const row = [
      index + 1,
      route.name,
      route.difficulty,
      route.color,
      routeHolds.length,
      startHold ? startHold.x.toFixed(2) : '',
      startHold ? startHold.y.toFixed(2) : '',
      endHold ? endHold.x.toFixed(2) : '',
      endHold ? endHold.y.toFixed(2) : '',
      maxY.toFixed(2),
      difficulty.estimatedLevel || '',
      route.isKidsRoute ? '是' : '否',
      route.notes || ''
    ];
    rows.push(row.map(v => `"${v}"`).join(','));
  });
  
  return rows.join('\n');
}

// ========== 文件下载辅助函数 ==========

/**
 * 触发文件下载
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * 下载 JSON
 */
export function downloadJSON(content, filename) {
  downloadFile(content, filename, 'application/json');
}

/**
 * 下载 Markdown
 */
export function downloadMarkdown(content, filename) {
  downloadFile(content, filename, 'text/markdown');
}

/**
 * 下载 CSV
 */
export function downloadCSV(content, filename) {
  // 添加 BOM 以支持中文
  const contentWithBOM = '\uFEFF' + content;
  downloadFile(contentWithBOM, filename, 'text/csv;charset=utf-8');
}

/**
 * 读取文件内容
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

// ========== 辅助函数 ==========

function _getWallTypeLabel(type) {
  const labels = {
    flat: '平板墙',
    vertical: '垂直墙',
    overhanging: '仰角墙',
    slab: '俯角墙'
  };
  return labels[type] || type || '未知';
}

function _getHoldTypeLabel(type) {
  const labels = {
    jug: '大把手 (Jug)',
    crimp: '小抠点 (Crimp)',
    sloper: '斜坡点 (Sloper)',
    pocket: '指洞点 (Pocket)',
    pinch: '捏点 (Pinch)',
    foot: '脚点 (Foot)',
    volume: '造型大岩点 (Volume)'
  };
  return labels[type] || type || '未知';
}

function _formatColor(color, name) {
  if (name) {
    return name;
  }
  // 尝试从 HoldColors 反向查找
  for (const [n, c] of Object.entries(HoldColors)) {
    if (c.toLowerCase() === color?.toLowerCase()) {
      return n;
    }
  }
  return color || '-';
}
