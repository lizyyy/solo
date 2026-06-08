const Storage = (function () {
  const PREFIX = 'vax_alert_';

  const KEYS = {
    DOGS: PREFIX + 'dogs',
    WEIGHTS: PREFIX + 'weights',
    VACCINES: PREFIX + 'vaccines',
    BOARDINGS: PREFIX + 'boardings',
    HOLIDAYS: PREFIX + 'holidays',
    ALERTS: PREFIX + 'alerts',
    ALERT_STATUSES: PREFIX + 'alert_statuses',
    NOTES: PREFIX + 'notes',
    SETTINGS: PREFIX + 'settings',
    INIT_FLAG: PREFIX + 'initialized_v1',
  };

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Storage read error', key, e);
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Storage write error', key, e);
      return false;
    }
  }

  function uid(prefix = 'id') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* ===== 数据访问层 ===== */
  const API = {
    KEYS,
    uid,

    isInitialized() {
      return !!localStorage.getItem(KEYS.INIT_FLAG);
    },
    markInitialized() {
      localStorage.setItem(KEYS.INIT_FLAG, '1');
    },
    resetAll() {
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    },

    /* 犬只 */
    getDogs() { return get(KEYS.DOGS, []); },
    setDogs(v) { return set(KEYS.DOGS, v); },
    getDog(id) { return API.getDogs().find(d => d.id === id); },

    /* 体重记录 */
    getWeights() { return get(KEYS.WEIGHTS, []); },
    setWeights(v) { return set(KEYS.WEIGHTS, v); },
    getWeightsByDog(dogId) {
      return API.getWeights()
        .filter(w => w.dogId === dogId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    getActiveWeightsByDog(dogId) {
      return API.getWeightsByDog(dogId).filter(w => !w.withdrawn);
    },

    /* 疫苗记录 */
    getVaccines() { return get(KEYS.VACCINES, []); },
    setVaccines(v) { return set(KEYS.VACCINES, v); },
    getVaccinesByDog(dogId) {
      return API.getVaccines()
        .filter(v => v.dogId === dogId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    /* 寄养记录 */
    getBoardings() { return get(KEYS.BOARDINGS, []); },
    setBoardings(v) { return set(KEYS.BOARDINGS, v); },
    getBoardingsByDog(dogId) {
      return API.getBoardings().filter(b => b.dogId === dogId);
    },

    /* 节假日 */
    getHolidays() { return get(KEYS.HOLIDAYS, []); },
    setHolidays(v) { return set(KEYS.HOLIDAYS, v); },

    /* 异常提醒结果（每次重新运行覆盖） */
    getAlerts() { return get(KEYS.ALERTS, []); },
    setAlerts(v) { return set(KEYS.ALERTS, v); },

    /* 提醒的处理状态 + 备注（单独存，重新检测不覆盖） */
    getAlertStatusMap() { return get(KEYS.ALERT_STATUSES, {}); },
    setAlertStatusMap(v) { return set(KEYS.ALERT_STATUSES, v); },
    getAlertStatus(alertId) {
      const map = API.getAlertStatusMap();
      return map[alertId] || { status: 'pending', note: '' };
    },
    setAlertStatus(alertId, statusObj) {
      const map = API.getAlertStatusMap();
      const prev = map[alertId] || { status: 'pending', note: '', history: [] };
      const history = prev.history || [];
      if (prev.note && prev.note !== statusObj.note) {
        history.unshift({
          time: new Date().toISOString(),
          status: prev.status,
          note: prev.note,
        });
      } else if (prev.status !== statusObj.status) {
        history.unshift({
          time: new Date().toISOString(),
          status: prev.status,
          note: '（状态变更）',
        });
      }
      map[alertId] = { ...statusObj, history };
      return set(KEYS.ALERT_STATUSES, map);
    },

    /* 设置（计算口径等） */
    getSettings() {
      return get(KEYS.SETTINGS, null);
    },
    setSettings(v) { return set(KEYS.SETTINGS, v); },
  };

  return API;
})();
