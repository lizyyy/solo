const { getDatabase } = require('../database');
const { getRiskLabel, getRiskColor, RISK_LEVELS } = require('./riskCalculator');

function getAllRopesWithLatestAssessment() {
  const db = getDatabase();
  
  const ropesResult = db.exec(`
    SELECT r.*,
           ra.id as assessment_id,
           ra.assessment_date,
           ra.total_energy_kj,
           ra.service_days,
           ra.current_wear_level,
           ra.overall_risk_level,
           ra.risk_factors
    FROM ropes r
    LEFT JOIN risk_assessments ra ON ra.id = (
      SELECT id FROM risk_assessments 
      WHERE rope_id = r.id 
      ORDER BY assessment_date DESC 
      LIMIT 1
    )
    ORDER BY 
      CASE 
        WHEN ra.overall_risk_level = 'scrap' THEN 1
        WHEN ra.overall_risk_level = 'critical' THEN 2
        WHEN ra.overall_risk_level = 'warning' THEN 3
        WHEN ra.overall_risk_level = 'caution' THEN 4
        ELSE 5
      END,
      r.rope_number
  `);
  
  const ropes = [];
  
  if (ropesResult.length > 0) {
    const columns = ropesResult[0].columns;
    for (const row of ropesResult[0].values) {
      const rope = {};
      columns.forEach((col, index) => {
        rope[col] = row[index];
      });
      
      if (rope.risk_factors) {
        try {
          rope.risk_factors = JSON.parse(rope.risk_factors);
        } catch (e) {
          rope.risk_factors = [];
        }
      }
      
      if (rope.assessment_id) {
        const reviewResult = db.exec(`
          SELECT * FROM review_decisions
          WHERE risk_assessment_id = ?
          ORDER BY review_date DESC
          LIMIT 1
        `, [rope.assessment_id]);
        
        if (reviewResult.length > 0 && reviewResult[0].values.length > 0) {
          const reviewColumns = reviewResult[0].columns;
          const reviewRow = reviewResult[0].values[0];
          rope.review_decision = {};
          reviewColumns.forEach((col, index) => {
            rope.review_decision[col] = reviewRow[index];
          });
          rope.effective_risk_level = rope.review_decision.new_risk_level;
        } else {
          rope.effective_risk_level = rope.overall_risk_level;
        }
      }
      
      ropes.push(rope);
    }
  }
  
  return ropes;
}

function getScrappedRopes() {
  const db = getDatabase();
  
  const result = db.exec(`
    SELECT r.*,
           sd.decision_date,
           sd.reason,
           sd.reviewer_name,
           sd.notes as scrap_notes
    FROM ropes r
    JOIN scrap_decisions sd ON r.id = sd.rope_id
    ORDER BY sd.decision_date DESC
  `);
  
  const ropes = [];
  
  if (result.length > 0) {
    const columns = result[0].columns;
    for (const row of result[0].values) {
      const rope = {};
      columns.forEach((col, index) => {
        rope[col] = row[index];
      });
      ropes.push(rope);
    }
  }
  
  return ropes;
}

function generateMarkdownReport() {
  const ropes = getAllRopesWithLatestAssessment();
  const scrappedRopes = getScrappedRopes();
  const today = new Date().toISOString().split('T')[0];
  
  const highRiskRopes = ropes.filter(r => 
    r.effective_risk_level === RISK_LEVELS.CRITICAL || 
    r.effective_risk_level === RISK_LEVELS.WARNING
  );
  
  const scrapRopes = ropes.filter(r => r.effective_risk_level === RISK_LEVELS.SCRAP);
  const cautionRopes = ropes.filter(r => r.effective_risk_level === RISK_LEVELS.CAUTION);
  const normalRopes = ropes.filter(r => !r.effective_risk_level || r.effective_risk_level === RISK_LEVELS.NORMAL);
  
  let md = `# 攀岩馆绳索安全评估报告\n\n`;
  md += `**报告日期**: ${today}\n\n`;
  md += `---\n\n`;
  
  md += `## 概览\n\n`;
  md += `| 状态 | 数量 |\n`;
  md += `|------|------|\n`;
  md += `| 报废 | ${scrapRopes.length} |\n`;
  md += `| 严重风险 | ${highRiskRopes.filter(r => r.effective_risk_level === RISK_LEVELS.CRITICAL).length} |\n`;
  md += `| 警告 | ${highRiskRopes.filter(r => r.effective_risk_level === RISK_LEVELS.WARNING).length} |\n`;
  md += `| 注意 | ${cautionRopes.length} |\n`;
  md += `| 正常 | ${normalRopes.length} |\n`;
  md += `| 总计 | ${ropes.length} |\n\n`;
  
  md += `---\n\n`;
  
  if (scrapRopes.length > 0) {
    md += `## 立即报废建议\n\n`;
    md += `以下绳索风险等级为 **报废**，建议立即更换：\n\n`;
    
    for (const rope of scrapRopes) {
      md += `### ${rope.rope_number}\n\n`;
      md += `- **品牌/型号**: ${rope.brand || '-'} / ${rope.model || '-'}\n`;
      md += `- **购买日期**: ${rope.purchase_date || '-'}\n`;
      md += `- **累计冲坠能量**: ${rope.total_energy_kj ? rope.total_energy_kj.toFixed(2) : 0} kJ\n`;
      md += `- **使用天数**: ${rope.service_days || 0} 天\n`;
      md += `- **磨损等级**: ${rope.current_wear_level || 0}\n`;
      
      if (rope.risk_factors && rope.risk_factors.length > 0) {
        md += `- **风险因素**:\n`;
        for (const factor of rope.risk_factors) {
          md += `  - ${factor.label}: ${factor.value}${factor.unit} (${getRiskLabel(factor.level)})\n`;
        }
      }
      
      if (rope.review_decision) {
        md += `- **复核记录**:\n`;
        md += `  - 复核人: ${rope.review_decision.reviewer_name || '-'}\n`;
        md += `  - 复核日期: ${rope.review_decision.review_date || '-'}\n`;
        if (rope.review_decision.review_notes) {
          md += `  - 备注: ${rope.review_decision.review_notes}\n`;
        }
      }
      
      md += `\n> **建议**: 立即报废该绳索并更换新绳索。\n\n`;
    }
  }
  
  if (highRiskRopes.length > 0) {
    md += `## 高风险绳索 - 建议优先更换\n\n`;
    md += `以下绳索风险等级较高，建议优先检查和更换：\n\n`;
    
    for (const rope of highRiskRopes) {
      md += `### ${rope.rope_number}\n\n`;
      md += `- **风险等级**: ${getRiskLabel(rope.effective_risk_level)}\n`;
      md += `- **品牌/型号**: ${rope.brand || '-'} / ${rope.model || '-'}\n`;
      md += `- **累计冲坠能量**: ${rope.total_energy_kj ? rope.total_energy_kj.toFixed(2) : 0} kJ\n`;
      md += `- **使用天数**: ${rope.service_days || 0} 天\n`;
      md += `- **磨损等级**: ${rope.current_wear_level || 0}\n`;
      
      if (rope.risk_factors && rope.risk_factors.length > 0) {
        md += `- **风险因素**:\n`;
        for (const factor of rope.risk_factors) {
          md += `  - ${factor.label}: ${factor.value}${factor.unit} (${getRiskLabel(factor.level)})\n`;
        }
      }
      
      md += `\n> **建议**: 建议在近期内更换该绳索，并在使用前进行详细检查。\n\n`;
    }
  }
  
  if (cautionRopes.length > 0) {
    md += `## 注意监测的绳索\n\n`;
    md += `以下绳索风险等级为"注意"，建议增加监测频率：\n\n`;
    
    md += `| 绳索编号 | 品牌/型号 | 风险因素 |\n`;
    md += `|----------|-----------|----------|\n`;
    
    for (const rope of cautionRopes) {
      const factors = rope.risk_factors?.map(f => `${f.label}:${f.value}${f.unit}`).join(', ') || '-';
      md += `| ${rope.rope_number} | ${rope.brand || '-'}/${rope.model || '-'} | ${factors} |\n`;
    }
    
    md += `\n`;
  }
  
  if (scrappedRopes.length > 0) {
    md += `## 已报废绳索记录\n\n`;
    md += `| 绳索编号 | 品牌/型号 | 报废日期 | 原因 |\n`;
    md += `|----------|-----------|----------|------|\n`;
    
    for (const rope of scrappedRopes) {
      md += `| ${rope.rope_number} | ${rope.brand || '-'}/${rope.model || '-'} | ${rope.decision_date || '-'} | ${rope.reason || '-'} |\n`;
    }
    
    md += `\n`;
  }
  
  md += `---\n\n`;
  md += `## 风险等级说明\n\n`;
  md += `| 等级 | 含义 | 建议动作 |\n`;
  md += `|------|------|----------|\n`;
  md += `| 报废 | 已达到或超过报废阈值 | 立即停止使用，更换新绳索 |\n`;
  md += `| 严重 | 接近报废阈值 | 优先检查，近期更换 |\n`;
  md += `| 警告 | 使用量较高 | 增加检查频率，制定更换计划 |\n`;
  md += `| 注意 | 接近警告阈值 | 持续监测 |\n`;
  md += `| 正常 | 在安全范围内 | 正常使用 |\n\n`;
  
  md += `---\n\n`;
  md += `*报告生成时间: ${new Date().toISOString()}*\n`;
  
  return md;
}

function generateScrapListCSV() {
  const ropes = getAllRopesWithLatestAssessment();
  const scrapRopes = ropes.filter(r => 
    r.effective_risk_level === RISK_LEVELS.SCRAP || 
    r.effective_risk_level === RISK_LEVELS.CRITICAL ||
    r.status === 'scrapped'
  );
  
  let csv = '绳索编号,品牌,型号,购买日期,风险等级,累计冲坠能量(kJ),使用天数,磨损等级,风险因素,建议\n';
  
  for (const rope of scrapRopes) {
    const factors = rope.risk_factors?.map(f => `${f.label}:${f.value}${f.unit}`).join('; ') || '';
    const suggestion = rope.effective_risk_level === RISK_LEVELS.SCRAP ? '立即报废' : 
                       rope.effective_risk_level === RISK_LEVELS.CRITICAL ? '优先更换' : 
                       rope.status === 'scrapped' ? '已报废' : '';
    
    csv += `"${rope.rope_number || ''}",`;
    csv += `"${rope.brand || ''}",`;
    csv += `"${rope.model || ''}",`;
    csv += `"${rope.purchase_date || ''}",`;
    csv += `"${getRiskLabel(rope.effective_risk_level) || ''}",`;
    csv += `${rope.total_energy_kj ? rope.total_energy_kj.toFixed(2) : 0},`;
    csv += `${rope.service_days || 0},`;
    csv += `${rope.current_wear_level || 0},`;
    csv += `"${factors}",`;
    csv += `"${suggestion}"\n`;
  }
  
  return csv;
}

function generateRopeSummaryCSV() {
  const ropes = getAllRopesWithLatestAssessment();
  
  let csv = '绳索编号,品牌,型号,购买日期,状态,风险等级,累计冲坠能量(kJ),使用天数,磨损等级,风险因素,最近评估日期\n';
  
  for (const rope of ropes) {
    const factors = rope.risk_factors?.map(f => `${f.label}:${f.value}${f.unit}(${getRiskLabel(f.level)})`).join('; ') || '';
    
    csv += `"${rope.rope_number || ''}",`;
    csv += `"${rope.brand || ''}",`;
    csv += `"${rope.model || ''}",`;
    csv += `"${rope.purchase_date || ''}",`;
    csv += `"${rope.status === 'scrapped' ? '已报废' : rope.status === 'active' ? '使用中' : rope.status || '使用中'}",`;
    csv += `"${getRiskLabel(rope.effective_risk_level) || getRiskLabel(rope.overall_risk_level) || ''}",`;
    csv += `${rope.total_energy_kj ? rope.total_energy_kj.toFixed(2) : 0},`;
    csv += `${rope.service_days || 0},`;
    csv += `${rope.current_wear_level || 0},`;
    csv += `"${factors}",`;
    csv += `"${rope.assessment_date || ''}"\n`;
  }
  
  return csv;
}

module.exports = {
  getAllRopesWithLatestAssessment,
  getScrappedRopes,
  generateMarkdownReport,
  generateScrapListCSV,
  generateRopeSummaryCSV
};
