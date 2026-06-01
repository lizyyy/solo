const Utils = {
  generateId() {
    return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  },

  formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  },

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  },

  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  debounce(func, wait) {
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
};
