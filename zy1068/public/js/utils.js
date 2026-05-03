const Utils = {
  generateId: () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  formatTime: (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false
    });
  },

  formatTimeMs: (timestamp) => {
    const date = new Date(timestamp);
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false
    })}.${ms}`;
  },

  deepClone: (obj) => {
    return JSON.parse(JSON.stringify(obj));
  },

  debounce: (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  },

  throttle: (fn, limit) => {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  randomInt: (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  randomFloat: (min, max) => {
    return Math.random() * (max - min) + min;
  },

  gaussianRandom: (mean = 0, stdev = 1) => {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdev + mean;
  },

  clamp: (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  },

  showToast: (message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  downloadFile: (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  readFileAsText: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  },

  copyToClipboard: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  },

  getPayloadSummary: (type, payload) => {
    switch (type) {
      case 'cursor':
        return `(${payload.x}, ${payload.y}) | 页面: ${payload.pageId || 'unknown'}`;
      case 'annotation':
        return `${payload.type} | 内容: ${(payload.text || '').substring(0, 30)}`;
      case 'stroke':
        return `${payload.points?.length || 0} 个点 | 颜色: ${payload.color || '#000'}`;
      case 'patch':
        return `路径: ${payload.path} | 版本: ${payload.from} -> ${payload.to}`;
      case 'text':
        return (payload.text || '').substring(0, 50) + ((payload.text || '').length > 50 ? '...' : '');
      default:
        return JSON.stringify(payload).substring(0, 50);
    }
  }
};

const WEAKNET_PROFILES = {
  custom: {
    name: '自定义',
    latency: 0,
    jitter: 0,
    loss: 0,
    reorder: 0,
    duplicate: 0,
    disconnect: 0
  },
  subway: {
    name: '地铁网络',
    description: '高延迟、高抖动、偶发丢包',
    latency: 300,
    jitter: 200,
    loss: 5,
    reorder: 10,
    duplicate: 2,
    disconnect: 2
  },
  cafe: {
    name: '咖啡店 Wi-Fi',
    description: '中等延迟、偶发丢包',
    latency: 100,
    jitter: 50,
    loss: 2,
    reorder: 3,
    duplicate: 1,
    disconnect: 0
  },
  overseas: {
    name: '海外会议',
    description: '高延迟、稳定但较慢',
    latency: 500,
    jitter: 100,
    loss: 1,
    reorder: 5,
    duplicate: 0,
    disconnect: 1
  },
  satellite: {
    name: '卫星网络',
    description: '极高延迟、偶发断线',
    latency: 800,
    jitter: 300,
    loss: 3,
    reorder: 8,
    duplicate: 1,
    disconnect: 5
  }
};
