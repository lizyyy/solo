const FACILITY_TYPES = [
  { value: 'halfpipe', label: 'U池 (Halfpipe)', riskMultiplier: 2.0 },
  { value: 'bowl', label: '碗池 (Bowl)', riskMultiplier: 1.8 },
  { value: 'rail', label: '栏杆 (Rail)', riskMultiplier: 1.5 },
  { value: 'ramp', label: '斜坡 (Ramp)', riskMultiplier: 1.2 },
  { value: 'platform', label: '平台 (Platform)', riskMultiplier: 1.0 },
  { value: 'flatbar', label: '平杆 (Flatbar)', riskMultiplier: 1.1 },
  { value: 'quarterpipe', label: '四分之一管 (Quarterpipe)', riskMultiplier: 1.6 },
  { value: 'manualpad', label: 'Manual垫 (Manual Pad)', riskMultiplier: 0.9 },
  { value: 'resting', label: '休息区 (Resting Area)', riskMultiplier: 0.3 },
  { value: 'other', label: '其他 (Other)', riskMultiplier: 1.0 }
];

const DAMAGE_LEVELS = [
  { value: 1, label: '轻微 (Minor)', score: 4, description: '表面划痕、小磨损，不影响正常使用' },
  { value: 2, label: '中等 (Moderate)', score: 8, description: '明显凹陷、松动，使用时需注意' },
  { value: 3, label: '严重 (Severe)', score: 12, description: '结构变形、大面积破损，建议限制使用' },
  { value: 4, label: '危险 (Dangerous)', score: 16, description: '有断裂、脱落风险，必须立即关闭' }
];

const DAMAGE_CATEGORIES = [
  '结构破损',
  '表面磨损',
  '连接件松动',
  '安全设施损坏',
  '排水堵塞',
  '其他'
];

const TASK_STATUSES = [
  { value: 'pending', label: '待评估', next: 'assessing' },
  { value: 'assessing', label: '评估中', next: 'in-progress' },
  { value: 'in-progress', label: '维修中', next: 'done' },
  { value: 'done', label: '已完成', next: null }
];

const PRIORITY_WEIGHTS = {
  damage: 0.40,
  popularity: 0.30,
  risk: 0.30
};

function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

const Storage = {
  KEYS: {
    FACILITIES: 'skatepark_facilities',
    DAMAGE_REPORTS: 'skatepark_damage_reports',
    POPULARITY_RECORDS: 'skatepark_popularity_records',
    REPAIR_TASKS: 'skatepark_repair_tasks',
    PROBLEMS: 'skatepark_problems'
  },

  get(key, defaultValue = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      console.error('Storage.get error:', e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage.set error:', e);
      return false;
    }
  },

  clearAll() {
    Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
  }
};

const DataStore = {
  getFacilities() {
    return Storage.get(Storage.KEYS.FACILITIES);
  },

  getFacilityById(id) {
    return this.getFacilities().find(f => f.id === id);
  },

  addFacility(facility) {
    const facilities = this.getFacilities();
    const newFacility = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...facility
    };
    facilities.push(newFacility);
    Storage.set(Storage.KEYS.FACILITIES, facilities);
    return newFacility;
  },

  updateFacility(id, updates) {
    const facilities = this.getFacilities();
    const index = facilities.findIndex(f => f.id === id);
    if (index === -1) return null;
    facilities[index] = { ...facilities[index], ...updates, updatedAt: new Date().toISOString() };
    Storage.set(Storage.KEYS.FACILITIES, facilities);
    return facilities[index];
  },

  getDamageReports() {
    return Storage.get(Storage.KEYS.DAMAGE_REPORTS);
  },

  getDamageReportById(id) {
    return this.getDamageReports().find(d => d.id === id);
  },

  getDamageReportsByFacility(facilityId) {
    return this.getDamageReports().filter(d => d.facilityId === facilityId);
  },

  getActiveDamageReportByFacility(facilityId) {
    const reports = this.getDamageReportsByFacility(facilityId)
      .filter(d => d.status !== 'resolved')
      .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
    return reports[0] || null;
  },

  addDamageReport(report) {
    const reports = this.getDamageReports();
    const newReport = {
      id: generateId(),
      status: 'active',
      reportedAt: new Date().toISOString(),
      ...report
    };
    reports.push(newReport);
    Storage.set(Storage.KEYS.DAMAGE_REPORTS, reports);
    return newReport;
  },

  resolveDamageReport(id) {
    const reports = this.getDamageReports();
    const index = reports.findIndex(r => r.id === id);
    if (index === -1) return null;
    reports[index] = { ...reports[index], status: 'resolved', resolvedAt: new Date().toISOString() };
    Storage.set(Storage.KEYS.DAMAGE_REPORTS, reports);
    return reports[index];
  },

  getPopularityRecords() {
    return Storage.get(Storage.KEYS.POPULARITY_RECORDS);
  },

  getPopularityByFacility(facilityId, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return this.getPopularityRecords()
      .filter(p => p.facilityId === facilityId && new Date(p.date) >= cutoff)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  addPopularityRecord(record) {
    const records = this.getPopularityRecords();
    const newRecord = {
      id: generateId(),
      recordedAt: new Date().toISOString(),
      ...record
    };
    records.push(newRecord);
    Storage.set(Storage.KEYS.POPULARITY_RECORDS, records);
    return newRecord;
  },

  getRepairTasks() {
    return Storage.get(Storage.KEYS.REPAIR_TASKS);
  },

  getRepairTaskById(id) {
    return this.getRepairTasks().find(t => t.id === id);
  },

  getRepairTaskByDamageId(damageId) {
    return this.getRepairTasks().find(t => t.damageId === damageId);
  },

  addRepairTask(task) {
    const tasks = this.getRepairTasks();
    const newTask = {
      id: generateId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...task
    };
    tasks.push(newTask);
    Storage.set(Storage.KEYS.REPAIR_TASKS, tasks);
    return newTask;
  },

  updateRepairTask(id, updates) {
    const tasks = this.getRepairTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return null;
    tasks[index] = { ...tasks[index], ...updates, updatedAt: new Date().toISOString() };
    Storage.set(Storage.KEYS.REPAIR_TASKS, tasks);
    return tasks[index];
  },

  getProblems() {
    return Storage.get(Storage.KEYS.PROBLEMS);
  },

  addProblem(problem) {
    const problems = this.getProblems();
    const newProblem = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...problem
    };
    problems.push(newProblem);
    Storage.set(Storage.KEYS.PROBLEMS, problems);
    return newProblem;
  },

  clearProblem(id) {
    const problems = this.getProblems().filter(p => p.id !== id);
    Storage.set(Storage.KEYS.PROBLEMS, problems);
  },

  clearAllProblems() {
    Storage.set(Storage.KEYS.PROBLEMS, []);
  },

  exportAll() {
    return {
      exportDate: new Date().toISOString(),
      facilities: this.getFacilities(),
      damageReports: this.getDamageReports(),
      popularityRecords: this.getPopularityRecords(),
      repairTasks: this.getRepairTasks(),
      problems: this.getProblems()
    };
  },

  importAll(data, source = 'manual_import') {
    const result = {
      success: [],
      errors: [],
      stats: {
        facilities: { imported: 0, failed: 0 },
        damageReports: { imported: 0, failed: 0 },
        popularityRecords: { imported: 0, failed: 0 },
        repairTasks: { imported: 0, failed: 0 }
      }
    };

    if (data.facilities && Array.isArray(data.facilities)) {
      const valid = Validator.validateFacilities(data.facilities);
      valid.valid.forEach(f => {
        this.addFacility({ ...f, id: undefined });
        result.stats.facilities.imported++;
      });
      valid.invalid.forEach(p => {
        this.addProblem({
          type: 'INVALID_FACILITY',
          source,
          message: p.message,
          rawData: p.rawData
        });
        result.stats.facilities.failed++;
        result.errors.push({ type: 'facility', message: p.message });
      });
    }

    if (data.damageReports && Array.isArray(data.damageReports)) {
      const valid = Validator.validateDamageReports(data.damageReports, this.getFacilities());
      valid.valid.forEach(r => {
        this.addDamageReport({ ...r, id: undefined });
        result.stats.damageReports.imported++;
      });
      valid.invalid.forEach(p => {
        this.addProblem({
          type: 'INVALID_DAMAGE_REPORT',
          source,
          message: p.message,
          rawData: p.rawData
        });
        result.stats.damageReports.failed++;
        result.errors.push({ type: 'damageReport', message: p.message });
      });
    }

    if (data.popularityRecords && Array.isArray(data.popularityRecords)) {
      const valid = Validator.validatePopularityRecords(data.popularityRecords, this.getFacilities());
      valid.valid.forEach(p => {
        this.addPopularityRecord({ ...p, id: undefined });
        result.stats.popularityRecords.imported++;
      });
      valid.invalid.forEach(p => {
        this.addProblem({
          type: 'INVALID_POPULARITY',
          source,
          message: p.message,
          rawData: p.rawData
        });
        result.stats.popularityRecords.failed++;
        result.errors.push({ type: 'popularity', message: p.message });
      });
    }

    if (data.repairTasks && Array.isArray(data.repairTasks)) {
      const valid = Validator.validateRepairTasks(data.repairTasks, this.getDamageReports());
      valid.valid.forEach(t => {
        this.addRepairTask({ ...t, id: undefined });
        result.stats.repairTasks.imported++;
      });
      valid.invalid.forEach(p => {
        this.addProblem({
          type: 'INVALID_TASK',
          source,
          message: p.message,
          rawData: p.rawData
        });
        result.stats.repairTasks.failed++;
        result.errors.push({ type: 'task', message: p.message });
      });
    }

    return result;
  }
};

const Validator = {
  errors: [],

  reset() {
    this.errors = [];
  },

  addError(field, message, value, rawData) {
    this.errors.push({ field, message, value, rawData });
  },

  validateFacility(f, index = null) {
    const errors = [];
    const raw = JSON.stringify(f);

    if (!f.name || typeof f.name !== 'string' || f.name.trim() === '') {
      errors.push({ field: 'name', message: '设施名称不能为空', rawData: raw });
    }

    if (!f.type || !FACILITY_TYPES.some(t => t.value === f.type)) {
      errors.push({ field: 'type', message: `无效的设施类型: ${f.type}`, rawData: raw });
    }

    if (!f.location || typeof f.location !== 'string' || f.location.trim() === '') {
      errors.push({ field: 'location', message: '设施位置不能为空', rawData: raw });
    }

    if (f.installDate) {
      const date = new Date(f.installDate);
      if (isNaN(date.getTime())) {
        errors.push({ field: 'installDate', message: `无效的安装日期: ${f.installDate}`, rawData: raw });
      }
    }

    if (f.baseRisk !== undefined) {
      if (typeof f.baseRisk !== 'number' || f.baseRisk < 0) {
        errors.push({ field: 'baseRisk', message: `基础风险系数必须为非负数字: ${f.baseRisk}`, rawData: raw });
      }
    }

    return errors;
  },

  validateFacilities(facilities) {
    const valid = [];
    const invalid = [];

    facilities.forEach((f, i) => {
      const errors = this.validateFacility(f, i);
      if (errors.length === 0) {
        valid.push(f);
      } else {
        errors.forEach(e => invalid.push(e));
      }
    });

    return { valid, invalid };
  },

  validateDamageReport(r, facilities, index = null) {
    const errors = [];
    const raw = JSON.stringify(r);

    if (!r.facilityId) {
      errors.push({ field: 'facilityId', message: '破损记录必须关联设施ID', rawData: raw });
    } else if (!facilities.some(f => f.id === r.facilityId)) {
      errors.push({ field: 'facilityId', message: `关联的设施不存在: ${r.facilityId}`, rawData: raw });
    }

    if (r.level === undefined) {
      errors.push({ field: 'level', message: '破损等级不能为空', rawData: raw });
    } else if (!DAMAGE_LEVELS.some(l => l.value === r.level)) {
      errors.push({ field: 'level', message: `无效的破损等级: ${r.level} (有效值: 1-4)`, rawData: raw });
    }

    if (!r.category || typeof r.category !== 'string') {
      errors.push({ field: 'category', message: '破损类别不能为空', rawData: raw });
    }

    if (r.description && typeof r.description !== 'string') {
      errors.push({ field: 'description', message: '描述必须是字符串', rawData: raw });
    }

    return errors;
  },

  validateDamageReports(reports, facilities) {
    const valid = [];
    const invalid = [];

    reports.forEach((r, i) => {
      const errors = this.validateDamageReport(r, facilities, i);
      if (errors.length === 0) {
        valid.push(r);
      } else {
        errors.forEach(e => invalid.push(e));
      }
    });

    return { valid, invalid };
  },

  validatePopularityRecord(p, facilities, index = null) {
    const errors = [];
    const raw = JSON.stringify(p);

    if (!p.facilityId) {
      errors.push({ field: 'facilityId', message: '热度记录必须关联设施ID', rawData: raw });
    } else if (!facilities.some(f => f.id === p.facilityId)) {
      errors.push({ field: 'facilityId', message: `关联的设施不存在: ${p.facilityId}`, rawData: raw });
    }

    if (!p.date) {
      errors.push({ field: 'date', message: '记录日期不能为空', rawData: raw });
    } else {
      const d = new Date(p.date);
      if (isNaN(d.getTime())) {
        errors.push({ field: 'date', message: `无效的日期格式: ${p.date}`, rawData: raw });
      }
    }

    if (p.usageCount === undefined) {
      errors.push({ field: 'usageCount', message: '使用次数不能为空', rawData: raw });
    } else if (typeof p.usageCount !== 'number' || p.usageCount < 0 || !Number.isInteger(p.usageCount)) {
      errors.push({ field: 'usageCount', message: `使用次数必须为非负整数: ${p.usageCount}`, rawData: raw });
    }

    if (p.peakRatio !== undefined) {
      if (typeof p.peakRatio !== 'number' || p.peakRatio < 0 || p.peakRatio > 1) {
        errors.push({ field: 'peakRatio', message: `高峰时段比例必须在0-1之间: ${p.peakRatio}`, rawData: raw });
      }
    }

    return errors;
  },

  validatePopularityRecords(records, facilities) {
    const valid = [];
    const invalid = [];

    records.forEach((r, i) => {
      const errors = this.validatePopularityRecord(r, facilities, i);
      if (errors.length === 0) {
        valid.push(r);
      } else {
        errors.forEach(e => invalid.push(e));
      }
    });

    return { valid, invalid };
  },

  validateRepairTask(t, damageReports, index = null) {
    const errors = [];
    const raw = JSON.stringify(t);

    if (!t.damageId) {
      errors.push({ field: 'damageId', message: '维修任务必须关联破损记录ID', rawData: raw });
    } else if (!damageReports.some(d => d.id === t.damageId)) {
      errors.push({ field: 'damageId', message: `关联的破损记录不存在: ${t.damageId}`, rawData: raw });
    }

    if (t.status && !TASK_STATUSES.some(s => s.value === t.status)) {
      errors.push({ field: 'status', message: `无效的任务状态: ${t.status}`, rawData: raw });
    }

    if (t.priority !== undefined && (typeof t.priority !== 'number' || t.priority < 0)) {
      errors.push({ field: 'priority', message: `优先级必须为非负数字: ${t.priority}`, rawData: raw });
    }

    return errors;
  },

  validateRepairTasks(tasks, damageReports) {
    const valid = [];
    const invalid = [];

    tasks.forEach((t, i) => {
      const errors = this.validateRepairTask(t, damageReports, i);
      if (errors.length === 0) {
        valid.push(t);
      } else {
        errors.forEach(e => invalid.push(e));
      }
    });

    return { valid, invalid };
  }
};

function seedSampleData() {
  if (DataStore.getFacilities().length > 0) return;

  const f1 = DataStore.addFacility({
    name: '主U池',
    type: 'halfpipe',
    location: '公园北区',
    installDate: '2020-03-15',
    notes: '核心设施，金属框架'
  });

  const f2 = DataStore.addFacility({
    name: '东区栏杆群',
    type: 'rail',
    location: '公园东区',
    installDate: '2021-07-20',
    notes: '包含3根不同高度栏杆'
  });

  const f3 = DataStore.addFacility({
    name: '碗池A区',
    type: 'bowl',
    location: '公园南区',
    installDate: '2019-11-01',
    notes: '深碗池，专业区域'
  });

  const f4 = DataStore.addFacility({
    name: '新手斜坡',
    type: 'ramp',
    location: '公园西区',
    installDate: '2022-05-10',
    notes: '低难度，入门区域'
  });

  const f5 = DataStore.addFacility({
    name: '休息长椅区',
    type: 'resting',
    location: '公园中心',
    installDate: '2020-06-01',
    notes: '休息等候区'
  });

  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    DataStore.addPopularityRecord({
      facilityId: f1.id,
      date: dateStr,
      usageCount: isWeekend ? Math.floor(Math.random() * 50) + 60 : Math.floor(Math.random() * 30) + 30,
      peakRatio: isWeekend ? 0.7 + Math.random() * 0.3 : 0.4 + Math.random() * 0.3,
      isWeekend
    });

    DataStore.addPopularityRecord({
      facilityId: f2.id,
      date: dateStr,
      usageCount: isWeekend ? Math.floor(Math.random() * 40) + 40 : Math.floor(Math.random() * 25) + 20,
      peakRatio: isWeekend ? 0.6 + Math.random() * 0.3 : 0.3 + Math.random() * 0.3,
      isWeekend
    });

    DataStore.addPopularityRecord({
      facilityId: f3.id,
      date: dateStr,
      usageCount: isWeekend ? Math.floor(Math.random() * 35) + 30 : Math.floor(Math.random() * 20) + 15,
      peakRatio: isWeekend ? 0.75 + Math.random() * 0.25 : 0.35 + Math.random() * 0.25,
      isWeekend
    });

    DataStore.addPopularityRecord({
      facilityId: f4.id,
      date: dateStr,
      usageCount: isWeekend ? Math.floor(Math.random() * 30) + 25 : Math.floor(Math.random() * 20) + 15,
      peakRatio: isWeekend ? 0.5 + Math.random() * 0.4 : 0.3 + Math.random() * 0.2,
      isWeekend
    });

    DataStore.addPopularityRecord({
      facilityId: f5.id,
      date: dateStr,
      usageCount: isWeekend ? Math.floor(Math.random() * 15) + 10 : Math.floor(Math.random() * 10) + 5,
      peakRatio: isWeekend ? 0.4 + Math.random() * 0.3 : 0.2 + Math.random() * 0.2,
      isWeekend
    });
  }

  const d1 = DataStore.addDamageReport({
    facilityId: f1.id,
    level: 4,
    category: '结构破损',
    description: 'U池过渡区金属板出现30cm裂纹，雨天漏水',
    reporter: '巡逻员张三',
    reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  });

  const d2 = DataStore.addDamageReport({
    facilityId: f2.id,
    level: 3,
    category: '连接件松动',
    description: '中间栏杆固定螺丝缺失2颗，栏杆晃动',
    reporter: '用户李华',
    reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  });

  const d3 = DataStore.addDamageReport({
    facilityId: f3.id,
    level: 2,
    category: '表面磨损',
    description: '碗池边缘表层脱落约20处',
    reporter: '管理员',
    reportedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  });

  const d4 = DataStore.addDamageReport({
    facilityId: f4.id,
    level: 1,
    category: '表面磨损',
    description: '斜坡底部有轻微划痕',
    reporter: '用户王五',
    reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  });

  [d1, d2, d3, d4].forEach(damage => {
    const facility = DataStore.getFacilityById(damage.facilityId);
    const breakdown = PriorityEngine.calculatePriorityBreakdown(facility, damage, DataStore);
    DataStore.addRepairTask({
      facilityId: damage.facilityId,
      damageId: damage.id,
      priority: breakdown.total,
      priorityBreakdown: breakdown,
      status: 'pending'
    });
  });

  DataStore.addProblem({
    type: 'IMPORT_TEST',
    source: 'seed_sample',
    message: '示例问题数据 - 用于展示问题列表功能',
    rawData: JSON.stringify({ test: 'data', invalid: true })
  });
}
