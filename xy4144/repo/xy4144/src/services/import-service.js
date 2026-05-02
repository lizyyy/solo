const csvParser = require('csv-parser');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const { transaction } = require('../storage/database');
const planStateMachine = require('./plan-state-machine');
const topologyService = require('./topology-service');
const auditService = require('./audit-service');

/**
 * 导入服务
 * 支持从 CSV 和 JSON 格式导入施工申请
 */

/**
 * 解析 CSV 数据
 */
function parseCSV(csvContent) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * 解析 JSON 数据
 */
function parseJSON(jsonContent) {
  try {
    return JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`JSON 解析失败: ${error.message}`);
  }
}

/**
 * 标准化计划数据
 * 将导入的数据转换为统一的计划格式
 */
function normalizePlanData(rawData) {
  const errors = [];
  const warnings = [];
  
  // 必填字段检查
  const requiredFields = ['line_id', 'work_type', 'start_time', 'end_time', 'section_ids'];
  const missingFields = requiredFields.filter(field => !rawData[field]);
  
  if (missingFields.length > 0) {
    errors.push(`缺少必填字段: ${missingFields.join(', ')}`);
  }
  
  // 处理 section_ids - 支持逗号分隔的字符串或数组
  let sectionIds = [];
  if (rawData.section_ids) {
    if (typeof rawData.section_ids === 'string') {
      sectionIds = rawData.section_ids.split(',').map(s => s.trim()).filter(s => s);
    } else if (Array.isArray(rawData.section_ids)) {
      sectionIds = rawData.section_ids;
    }
  }
  
  // 处理 station_ids
  let stationIds = [];
  if (rawData.station_ids) {
    if (typeof rawData.station_ids === 'string') {
      stationIds = rawData.station_ids.split(',').map(s => s.trim()).filter(s => s);
    } else if (Array.isArray(rawData.station_ids)) {
      stationIds = rawData.station_ids;
    }
  }
  
  // 处理 catenary_zone_ids
  let catenaryZoneIds = [];
  if (rawData.catenary_zone_ids) {
    if (typeof rawData.catenary_zone_ids === 'string') {
      catenaryZoneIds = rawData.catenary_zone_ids.split(',').map(s => s.trim()).filter(s => s);
    } else if (Array.isArray(rawData.catenary_zone_ids)) {
      catenaryZoneIds = rawData.catenary_zone_ids;
    }
  }
  
  // 布尔字段处理
  const powerOffRequired = rawData.power_off_required === true || 
    rawData.power_off_required === 'true' || 
    rawData.power_off_required === '1' ||
    rawData.power_off_required === 1;
  
  const isEmergency = rawData.is_emergency === true || 
    rawData.is_emergency === 'true' || 
    rawData.is_emergency === '1' ||
    rawData.is_emergency === 1;
  
  // 数字字段处理
  const priority = parseInt(rawData.priority) || 0;
  
  // 构建标准化数据
  const normalized = {
    id: rawData.id || uuidv4(),
    plan_number: rawData.plan_number,
    line_id: rawData.line_id,
    work_type: rawData.work_type,
    work_content: rawData.work_content || '',
    construction_team_id: rawData.construction_team_id || null,
    priority: priority,
    is_emergency: isEmergency,
    start_time: rawData.start_time,
    end_time: rawData.end_time,
    first_train_time: rawData.first_train_time || null,
    clearance_time: rawData.clearance_time || null,
    power_off_required: powerOffRequired,
    catenary_zone_ids: catenaryZoneIds,
    section_ids: sectionIds,
    station_ids: stationIds,
    dispatch_command_id: rawData.dispatch_command_id || null,
    applicant_id: rawData.applicant_id || null,
    applicant_name: rawData.applicant_name || '',
    notes: rawData.notes || ''
  };
  
  // 验证时间格式
  try {
    const startTime = new Date(normalized.start_time);
    const endTime = new Date(normalized.end_time);
    
    if (isNaN(startTime.getTime())) {
      errors.push(`开始时间格式无效: ${normalized.start_time}`);
    }
    if (isNaN(endTime.getTime())) {
      errors.push(`结束时间格式无效: ${normalized.end_time}`);
    }
    if (startTime >= endTime) {
      errors.push('开始时间不能晚于或等于结束时间');
    }
  } catch (e) {
    errors.push(`时间解析失败: ${e.message}`);
  }
  
  return {
    data: normalized,
    errors: errors,
    warnings: warnings,
    is_valid: errors.length === 0
  };
}

/**
 * 从 CSV 导入计划
 */
async function importFromCSV(csvContent, operator = null) {
  const rawPlans = await parseCSV(csvContent);
  return importPlans(rawPlans, operator, 'CSV');
}

/**
 * 从 JSON 导入计划
 */
function importFromJSON(jsonContent, operator = null) {
  let rawPlans = parseJSON(jsonContent);
  
  // 支持单个计划或计划数组
  if (!Array.isArray(rawPlans)) {
    rawPlans = [rawPlans];
  }
  
  return importPlans(rawPlans, operator, 'JSON');
}

/**
 * 批量导入计划
 */
function importPlans(rawPlans, operator = null, sourceType = 'UNKNOWN') {
  const results = {
    total: rawPlans.length,
    success: 0,
    failed: 0,
    imported: [],
    errors: [],
    warnings: []
  };
  
  return transaction(() => {
    for (let i = 0; i < rawPlans.length; i++) {
      const rawData = rawPlans[i];
      const rowNumber = i + 1;
      
      try {
        // 标准化数据
        const normalized = normalizePlanData(rawData);
        
        if (!normalized.is_valid) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            errors: normalized.errors,
            data: rawData
          });
          continue;
        }
        
        // 创建计划
        const plan = planStateMachine.createPlan(normalized.data, operator);
        
        results.success++;
        results.imported.push({
          row: rowNumber,
          plan_id: plan.id,
          plan_number: plan.plan_number
        });
        
        // 收集警告
        if (normalized.warnings.length > 0) {
          results.warnings.push({
            row: rowNumber,
            plan_id: plan.id,
            warnings: normalized.warnings
          });
        }
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          error: error.message,
          data: rawData
        });
      }
    }
    
    // 记录审计日志
    auditService.logImport(
      auditService.ENTITY_TYPES.PLAN,
      results.success,
      operator
    );
    
    return results;
  });
}

/**
 * 从 CSV 导入拓扑数据（线路、车站、区间）
 */
async function importTopologyFromCSV(csvContent, operator = null) {
  const rawData = await parseCSV(csvContent);
  
  // 按类型分组
  const lines = [];
  const stations = [];
  const sections = [];
  
  rawData.forEach(row => {
    const type = row.type?.toLowerCase();
    
    if (type === 'line') {
      lines.push({
        id: row.id,
        name: row.name,
        color: row.color,
        description: row.description
      });
    } else if (type === 'station') {
      stations.push({
        id: row.id,
        line_id: row.line_id,
        name: row.name,
        sequence: parseInt(row.sequence) || 0,
        is_terminal: row.is_terminal === 'true' || row.is_terminal === '1'
      });
    } else if (type === 'section') {
      sections.push({
        id: row.id,
        line_id: row.line_id,
        start_station_id: row.start_station_id,
        end_station_id: row.end_station_id,
        name: row.name,
        length_km: parseFloat(row.length_km) || null,
        is_up_direction: row.is_up_direction === 'true' || row.is_up_direction === '1'
      });
    }
  });
  
  return transaction(() => {
    const results = {
      lines: [],
      stations: [],
      sections: [],
      errors: []
    };
    
    // 先创建线路
    lines.forEach(lineData => {
      try {
        const line = topologyService.createLine(lineData);
        results.lines.push(line);
      } catch (error) {
        results.errors.push({ type: 'line', data: lineData, error: error.message });
      }
    });
    
    // 再创建车站
    stations.forEach(stationData => {
      try {
        const station = topologyService.createStation(stationData);
        results.stations.push(station);
      } catch (error) {
        results.errors.push({ type: 'station', data: stationData, error: error.message });
      }
    });
    
    // 最后创建区间
    sections.forEach(sectionData => {
      try {
        const section = topologyService.createSection(sectionData);
        results.sections.push(section);
      } catch (error) {
        results.errors.push({ type: 'section', data: sectionData, error: error.message });
      }
    });
    
    return results;
  });
}

/**
 * 验证导入的计划数据（仅验证不保存）
 */
function validateImportData(rawPlans) {
  const results = {
    total: rawPlans.length,
    valid: 0,
    invalid: 0,
    validations: []
  };
  
  rawPlans.forEach((rawData, index) => {
    const rowNumber = index + 1;
    const normalized = normalizePlanData(rawData);
    
    results.validations.push({
      row: rowNumber,
      is_valid: normalized.is_valid,
      errors: normalized.errors,
      warnings: normalized.warnings,
      preview: normalized.data
    });
    
    if (normalized.is_valid) {
      results.valid++;
    } else {
      results.invalid++;
    }
  });
  
  return results;
}

/**
 * 获取 CSV 模板格式说明
 */
function getCSVTemplate() {
  return {
    description: '施工申请导入 CSV 模板',
    required_fields: [
      'line_id: 线路 ID',
      'work_type: 工作类型（如：轨道检修、接触网维护、信号调试）',
      'start_time: 开始时间（ISO 格式，如：2024-05-20 23:30:00）',
      'end_time: 结束时间（ISO 格式，如：2024-05-21 04:30:00）',
      'section_ids: 区间 ID 列表（逗号分隔，如：sec-001,sec-002）'
    ],
    optional_fields: [
      'id: 计划 ID（留空则自动生成）',
      'plan_number: 计划编号（留空则自动生成）',
      'work_content: 工作内容描述',
      'construction_team_id: 施工队 ID',
      'priority: 优先级（数字，越大越优先）',
      'is_emergency: 是否紧急（true/false）',
      'first_train_time: 首班车时间',
      'clearance_time: 撤场时间',
      'power_off_required: 是否需要停电（true/false）',
      'catenary_zone_ids: 接触网分区 ID 列表（逗号分隔）',
      'station_ids: 车站 ID 列表（逗号分隔）',
      'dispatch_command_id: 行车调度命令 ID',
      'applicant_id: 申请人 ID',
      'applicant_name: 申请人姓名',
      'notes: 备注'
    ],
    example: {
      line_id: 'line-001',
      work_type: '轨道检修',
      start_time: '2024-05-20 23:30:00',
      end_time: '2024-05-21 04:30:00',
      section_ids: 'sec-001,sec-002',
      work_content: '更换钢轨磨耗超标段',
      construction_team_id: 'team-001',
      priority: '1',
      is_emergency: 'false',
      power_off_required: 'true',
      applicant_name: '张三'
    }
  };
}

module.exports = {
  parseCSV,
  parseJSON,
  normalizePlanData,
  importFromCSV,
  importFromJSON,
  importPlans,
  importTopologyFromCSV,
  validateImportData,
  getCSVTemplate
};
