const fs = require('fs');
const path = require('path');

const PARAMS_FILE = path.join(__dirname, '../data/params.json');

const DEFAULT_PARAMS = {
  maxCreditsPerSemester: {
    value: 25,
    unit: '学分',
    min: 1,
    max: 40,
    formula: '单学期总学分 ≤ 参数值',
    description: '单学期最大允许选修学分上限',
    source: '教务处规定'
  },
  minCreditsPerSemester: {
    value: 12,
    unit: '学分',
    min: 1,
    max: 30,
    formula: '单学期总学分 ≥ 参数值',
    description: '单学期最低选修学分要求',
    source: '毕业要求'
  },
  maxCoursesPerDay: {
    value: 4,
    unit: '门',
    min: 1,
    max: 10,
    formula: '单日选课门数 ≤ 参数值',
    description: '单日最大选课门数',
    source: '学习负荷建议'
  },
  maxConcurrentEnrollmentRatio: {
    value: 0.95,
    unit: '%',
    min: 0.5,
    max: 1.0,
    formula: '已选人数 / 课程容量 ≤ 参数值',
    description: '课程选课率上限（超过视为热门预警）',
    source: '系统预警阈值'
  },
  timeConflictTolerance: {
    value: 0,
    unit: '分钟',
    min: 0,
    max: 30,
    formula: '课程时间重叠分钟数 > 参数值',
    description: '时间冲突容忍度（0表示完全不允许重叠）',
    source: '排课规则'
  },
  sameTeacherLimit: {
    value: 1,
    unit: '次',
    min: 1,
    max: 5,
    formula: '同一课程重复选课次数 > 参数值',
    description: '同一课程允许重复选课次数',
    source: '学籍管理规定'
  }
};

function getDefaultParams() {
  return JSON.parse(JSON.stringify(DEFAULT_PARAMS));
}

function loadParams() {
  try {
    if (fs.existsSync(PARAMS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(PARAMS_FILE, 'utf8'));
      const merged = { ...DEFAULT_PARAMS };
      
      for (const key in saved) {
        if (merged[key] && saved[key].value !== undefined) {
          merged[key].value = saved[key].value;
        }
      }
      
      return merged;
    }
  } catch (e) {
    console.error('Error loading params:', e);
  }
  
  return getDefaultParams();
}

function saveParams(params) {
  try {
    const toSave = {};
    
    for (const key in params) {
      toSave[key] = { value: params[key].value };
    }
    
    fs.writeFileSync(PARAMS_FILE, JSON.stringify(toSave, null, 2));
    
    return loadParams();
  } catch (e) {
    console.error('Error saving params:', e);
    throw e;
  }
}

module.exports = {
  loadParams,
  saveParams,
  getDefaultParams
};
