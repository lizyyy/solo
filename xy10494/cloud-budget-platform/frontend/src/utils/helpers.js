export function formatCurrency(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return '¥0.00';
  }
  return `¥${Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  return `${Number(value).toFixed(decimals)}%`;
}

export function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getMonthList(months = 12) {
  const list = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    list.push({
      value: `${year}-${month}`,
      label: `${year}年${date.getMonth() + 1}月`,
    });
  }
  return list;
}

export function getBudgetUsageColor(usage) {
  if (usage >= 100) return '#ff4d4f';
  if (usage >= 70) return '#faad14';
  return '#52c41a';
}

export function getBudgetStatus(usage) {
  if (usage >= 100) return 'over';
  if (usage >= 70) return 'warning';
  return 'normal';
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function hasPermission(userRole, requiredRoles) {
  if (!userRole) return false;
  if (!requiredRoles || requiredRoles.length === 0) return true;
  return requiredRoles.includes(userRole);
}

export function isAdmin(role) {
  return role === 'admin';
}

export function isFinance(role) {
  return role === 'admin' || role === 'finance';
}

export function isDeveloper(role) {
  return role === 'admin' || role === 'finance' || role === 'developer';
}

export function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'object') {
    return Object.entries(tags).map(([key, value]) => ({ key, value }));
  }
  return [];
}

export function generateRandomId() {
  return Math.random().toString(36).substring(2, 15);
}
