const API_BASE = 'http://localhost:3001/api';

// 通用的 fetch 包装
const request = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API 请求失败:', error);
    throw error;
  }
};

// 获取统计信息
export const getStatistics = () => {
  return request(`${API_BASE}/statistics`);
};

// 获取所有区域
export const getAreas = () => {
  return request(`${API_BASE}/areas`);
};

// 获取单个区域详情
export const getAreaDetail = (id) => {
  return request(`${API_BASE}/areas/${id}`);
};

// 更新区域
export const updateArea = (id, data) => {
  return request(`${API_BASE}/areas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

// 导入浇冰车作业记录
export const importResurfacing = (csvContent) => {
  return request(`${API_BASE}/import/resurfacing`, {
    method: 'POST',
    body: JSON.stringify({ csvContent }),
  });
};

// 导入温度传感器数据
export const importTemperature = (csvContent) => {
  return request(`${API_BASE}/import/temperature`, {
    method: 'POST',
    body: JSON.stringify({ csvContent }),
  });
};

// 导入压缩机告警
export const importAlarms = (csvContent) => {
  return request(`${API_BASE}/import/alarms`, {
    method: 'POST',
    body: JSON.stringify({ csvContent }),
  });
};

// 导入活动排期
export const importSchedule = (csvContent) => {
  return request(`${API_BASE}/import/schedule`, {
    method: 'POST',
    body: JSON.stringify({ csvContent }),
  });
};

// 获取设置
export const getSettings = () => {
  return request(`${API_BASE}/settings`);
};

// 更新设置
export const updateSettings = (data) => {
  return request(`${API_BASE}/settings`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

// 导出 Markdown 交班单
export const exportMarkdown = () => {
  window.open(`${API_BASE}/export/markdown`, '_blank');
};

// 导出 CSV 风险清单
export const exportRiskCSV = () => {
  window.open(`${API_BASE}/export/risk-csv`, '_blank');
};

// 导出 JSON 审计包
export const exportAuditJSON = () => {
  window.open(`${API_BASE}/export/audit-json`, '_blank');
};
