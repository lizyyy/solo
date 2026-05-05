const db = require('../database');
const dayjs = require('dayjs');

const getAssessmentDetails = (assessmentDate) => {
  return db.prepare(`
    SELECT 
      da.*,
      pb.plant_name, pb.variety, pb.batch_number, pb.quantity,
      pb.planting_date, pb.expected_flowering_start, pb.expected_flowering_end,
      s.code as seedbed_code, s.name as seedbed_name,
      g.name as greenhouse_name
    FROM daily_assessments da
    JOIN plant_batches pb ON da.plant_batch_id = pb.id
    JOIN seedbeds s ON pb.seedbed_id = s.id
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE da.assessment_date = ?
    ORDER BY g.name, s.code, pb.plant_name
  `).all(assessmentDate);
};

const getRiskTypeLabel = (riskType) => {
  const labels = {
    'suitable': '适合授粉',
    'temperature_risk': '温度风险',
    'humidity_risk': '湿度风险',
    'cross_pollination': '串粉风险',
    'before_flowering': '未到花期',
    'missed_flowering': '花期已过',
    'isolation_open': '隔离开放',
    'no_operator': '无操作员',
    'multiple_risks': '多重风险'
  };
  return labels[riskType] || riskType;
};

const getRiskIcon = (riskType, isSuitable) => {
  if (isSuitable) return '✅';
  const icons = {
    'temperature_risk': '🌡️',
    'humidity_risk': '💧',
    'cross_pollination': '🐝',
    'before_flowering': '🌱',
    'missed_flowering': '🍂',
    'isolation_open': '🚪',
    'no_operator': '👤',
    'multiple_risks': '⚠️'
  };
  return icons[riskType] || '❓';
};

const exportMarkdownWorksheet = (assessmentDate) => {
  const assessments = getAssessmentDetails(assessmentDate);
  
  if (assessments.length === 0) {
    return `# ${assessmentDate} 授粉工作单\n\n**无评估数据，请先运行评估或导入数据。**`;
  }
  
  const groupedByGreenhouse = {};
  assessments.forEach(a => {
    if (!groupedByGreenhouse[a.greenhouse_name]) {
      groupedByGreenhouse[a.greenhouse_name] = {};
    }
    if (!groupedByGreenhouse[a.greenhouse_name][a.seedbed_code]) {
      groupedByGreenhouse[a.greenhouse_name][a.seedbed_code] = [];
    }
    groupedByGreenhouse[a.greenhouse_name][a.seedbed_code].push(a);
  });
  
  const suitableCount = assessments.filter(a => a.is_suitable_pollination).length;
  const atRiskCount = assessments.filter(a => !a.is_suitable_pollination).length;
  const manualOverrideCount = assessments.filter(a => a.manual_override).length;
  
  let md = `# 🌿 温室授粉工作单\n\n`;
  md += `**日期:** ${assessmentDate}\n\n`;
  
  md += `## 📊 今日概览\n\n`;
  md += `| 指标 | 数量 |\n`;
  md += `|------|------|\n`;
  md += `| 评估批次 | ${assessments.length} |\n`;
  md += `| ✅ 适合授粉 | ${suitableCount} |\n`;
  md += `| ⚠️ 存在风险 | ${atRiskCount} |\n`;
  md += `| ✏️ 人工改判 | ${manualOverrideCount} |\n\n`;
  
  md += `---\n\n`;
  
  for (const [greenhouse, seedbeds] of Object.entries(groupedByGreenhouse)) {
    md += `## 🏠 温室: ${greenhouse}\n\n`;
    
    for (const [seedbedCode, items] of Object.entries(seedbeds)) {
      const seedbedName = items[0].seedbed_name || seedbedCode;
      md += `### 🌱 苗床 ${seedbedCode}${seedbedName !== seedbedCode ? ` - ${seedbedName}` : ''}\n\n`;
      
      items.forEach(item => {
        const icon = getRiskIcon(item.risk_type, item.is_suitable_pollination);
        const status = item.is_suitable_pollination ? '适合授粉' : '存在风险';
        
        md += `#### ${icon} ${item.plant_name}${item.variety ? ` (${item.variety})` : ''}\n\n`;
        md += `- **批次号:** ${item.batch_number || '未知'}\n`;
        md += `- **状态:** ${status}\n`;
        md += `- **风险类型:** ${getRiskTypeLabel(item.risk_type)}\n`;
        if (item.risk_reason && item.risk_reason !== '无风险') {
          md += `- **风险原因:** ${item.risk_reason}\n`;
        }
        
        if (item.manual_override) {
          md += `- **⚠️ 人工改判:** 是\n`;
          if (item.override_reason) {
            md += `- **改判原因:** ${item.override_reason}\n`;
          }
        }
        
        md += `- **花期状态:** ${item.flowering_stage}\n`;
        md += `- **温度评估:** ${item.temperature_risk}\n`;
        md += `- **湿度评估:** ${item.humidity_risk}\n`;
        md += `- **串粉风险:** ${item.cross_pollination_risk}\n`;
        md += `- **隔离状态:** ${item.isolation_status}\n`;
        md += `- **操作员:** ${item.operator_available}\n`;
        
        if (item.notes) {
          md += `- **备注:** ${item.notes}\n`;
        }
        
        md += `\n`;
      });
    }
    
    md += `---\n\n`;
  }
  
  md += `## 📝 工作记录\n\n`;
  md += `| 时间 | 操作人 | 工作内容 | 备注 |\n`;
  md += `|------|--------|----------|------|\n`;
  md += `| | | | |\n\n`;
  
  md += `---\n\n`;
  md += `*此工作单由系统自动生成，生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}*\n`;
  
  return md;
};

const exportJSONAudit = (assessmentDate, includeHistory = false) => {
  const assessments = getAssessmentDetails(assessmentDate);
  
  const auditData = {
    exportInfo: {
      exportDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      assessmentDate: assessmentDate,
      type: 'audit_trail'
    },
    summary: {
      totalAssessments: assessments.length,
      suitableForPollination: assessments.filter(a => a.is_suitable_pollination).length,
      atRisk: assessments.filter(a => !a.is_suitable_pollination).length,
      manualOverrides: assessments.filter(a => a.manual_override).length
    },
    assessments: assessments.map(a => ({
      id: a.id,
      assessmentDate: a.assessment_date,
      greenhouse: a.greenhouse_name,
      seedbed: {
        code: a.seedbed_code,
        name: a.seedbed_name
      },
      plant: {
        name: a.plant_name,
        variety: a.variety,
        batchNumber: a.batch_number,
        quantity: a.quantity,
        plantingDate: a.planting_date,
        expectedFloweringStart: a.expected_flowering_start,
        expectedFloweringEnd: a.expected_flowering_end
      },
      assessment: {
        isSuitable: a.is_suitable_pollination === 1,
        riskType: a.risk_type,
        riskTypeLabel: getRiskTypeLabel(a.risk_type),
        riskReason: a.risk_reason,
        temperatureAssessment: a.temperature_risk,
        humidityAssessment: a.humidity_risk,
        crossPollinationRisk: a.cross_pollination_risk,
        floweringStage: a.flowering_stage,
        isolationStatus: a.isolation_status,
        operatorAvailable: a.operator_available
      },
      manualOverride: {
        hasOverride: a.manual_override === 1,
        overrideReason: a.override_reason,
        notes: a.notes
      },
      timestamps: {
        createdAt: a.created_at,
        updatedAt: a.updated_at
      }
    })),
    riskBreakdown: {}
  };
  
  assessments.forEach(a => {
    const key = a.risk_type;
    if (!auditData.riskBreakdown[key]) {
      auditData.riskBreakdown[key] = {
        count: 0,
        label: getRiskTypeLabel(key)
      };
    }
    auditData.riskBreakdown[key].count++;
  });
  
  return auditData;
};

const getPollinationPlansForExport = (date) => {
  return db.prepare(`
    SELECT 
      pp.*,
      pb.plant_name, pb.variety, pb.batch_number,
      s.code as seedbed_code,
      g.name as greenhouse_name
    FROM pollination_plans pp
    JOIN plant_batches pb ON pp.plant_batch_id = pb.id
    JOIN seedbeds s ON pb.seedbed_id = s.id
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE pp.plan_date = ?
    ORDER BY g.name, s.code, pp.priority
  `).all(date);
};

const getEmployeeShiftsForExport = (date) => {
  return db.prepare(`
    SELECT * FROM employee_shifts WHERE shift_date = ?
    ORDER BY shift_type, start_time
  `).all(date);
};

const exportFullDailyReport = (date) => {
  const assessments = getAssessmentDetails(date);
  const plans = getPollinationPlansForExport(date);
  const shifts = getEmployeeShiftsForExport(date);
  
  return {
    date,
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    pollinationAssessments: {
      summary: {
        total: assessments.length,
        suitable: assessments.filter(a => a.is_suitable_pollination).length,
        atRisk: assessments.filter(a => !a.is_suitable_pollination).length
      },
      details: assessments
    },
    pollinationPlans: {
      total: plans.length,
      details: plans
    },
    employeeShifts: {
      total: shifts.length,
      details: shifts
    }
  };
};

module.exports = {
  exportMarkdownWorksheet,
  exportJSONAudit,
  exportFullDailyReport,
  getAssessmentDetails
};
