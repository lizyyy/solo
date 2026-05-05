const db = require('../database');
const conflictChecker = require('./conflictChecker');

class ReportGenerator {
  constructor() {}

  async generateRiskReport() {
    const reportSections = [];
    
    const summary = await this.getSummary();
    reportSections.push(this.generateSummarySection(summary));
    
    const exclusivityConflicts = await this.getExclusivityConflicts();
    if (exclusivityConflicts.length > 0) {
      reportSections.push(this.generateExclusivitySection(exclusivityConflicts));
    }
    
    const frequencyIssues = await this.getFrequencyIssues();
    if (frequencyIssues.length > 0) {
      reportSections.push(this.generateFrequencySection(frequencyIssues));
    }
    
    const inventoryIssues = await this.getInventoryIssues();
    if (inventoryIssues.length > 0) {
      reportSections.push(this.generateInventorySection(inventoryIssues));
    }
    
    const makegoodIssues = await this.getMakegoodIssues();
    if (makegoodIssues.length > 0) {
      reportSections.push(this.generateMakegoodSection(makegoodIssues));
    }
    
    const contractStatus = await this.getContractStatus();
    reportSections.push(this.generateContractStatusSection(contractStatus));
    
    const fullReport = this.generateHeader() + reportSections.join('\n\n') + this.generateFooter();
    return fullReport;
  }

  getSummary() {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as total_sponsors FROM sponsors',
        'SELECT COUNT(*) as total_episodes FROM episodes',
        'SELECT COUNT(*) as total_contracts FROM contracts',
        'SELECT COUNT(*) as total_slots FROM ad_slots',
        'SELECT COUNT(*) as fulfilled_slots FROM ad_slots WHERE is_fulfilled = 1',
        'SELECT COUNT(*) as broadcast_slots FROM ad_slots WHERE is_broadcast = 1'
      ];
      
      const results = {};
      let completed = 0;
      
      queries.forEach((query, index) => {
        db.get(query, (err, row) => {
          if (err) return reject(err);
          
          Object.assign(results, row);
          completed++;
          
          if (completed === queries.length) {
            resolve(results);
          }
        });
      });
    });
  }

  generateSummarySection(summary) {
    return `## 📊 排期概览

| 指标 | 数量 |
|------|------|
| 赞助商总数 | ${summary.total_sponsors} |
| 节目期数总数 | ${summary.total_episodes} |
| 合同总数 | ${summary.total_contracts} |
| 广告位总数 | ${summary.total_slots} |
| 已履行广告位 | ${summary.fulfilled_slots} |
| 已播出广告位 | ${summary.broadcast_slots} |
`;
  }

  getExclusivityConflicts() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          e.episode_number,
          e.title as episode_title,
          s1.name as sponsor1_name,
          s2.name as sponsor2_name,
          s1.category as category
        FROM ad_slots a1
        JOIN ad_slots a2 ON a1.episode_id = a2.episode_id AND a1.id != a2.id
        JOIN sponsors s1 ON a1.sponsor_id = s1.id
        JOIN sponsors s2 ON a2.sponsor_id = s2.id
        JOIN episodes e ON a1.episode_id = e.id
        WHERE s1.category = s2.category
        GROUP BY e.id, s1.category, s1.name, s2.name
        HAVING s1.name < s2.name
        ORDER BY e.episode_number
      `;
      
      db.all(query, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  generateExclusivitySection(conflicts) {
    let section = `## 🔴 品类排他冲突

以下节目期数存在同品类赞助商冲突：

| 节目期数 | 节目标题 | 冲突品类 | 赞助商1 | 赞助商2 |
|----------|----------|----------|---------|---------|
`;
    
    conflicts.forEach(conflict => {
      section += `| ${conflict.episode_number} | ${conflict.episode_title} | ${conflict.category} | ${conflict.sponsor1_name} | ${conflict.sponsor2_name} |\n`;
    });
    
    section += `
### 风险说明
- 同品类赞助商在同一期节目中投放广告可能导致品牌辨识度下降
- 建议与赞助商协商调整排期或更换广告位置
`;
    
    return section;
  }

  getFrequencyIssues() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.name as sponsor_name,
          s.category,
          e.episode_number,
          e.title as episode_title,
          COUNT(a.id) as slot_count
        FROM ad_slots a
        JOIN sponsors s ON a.sponsor_id = s.id
        JOIN episodes e ON a.episode_id = e.id
        GROUP BY e.id, s.id
        HAVING COUNT(a.id) >= 2
        ORDER BY slot_count DESC, e.episode_number
      `;
      
      db.all(query, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  generateFrequencySection(issues) {
    let section = `## 🟡 频次过高问题

以下赞助商在同一期节目中投放了多个广告位：

| 节目期数 | 节目标题 | 赞助商 | 品类 | 广告位数量 |
|----------|----------|--------|------|------------|
`;
    
    issues.forEach(issue => {
      section += `| ${issue.episode_number} | ${issue.episode_title} | ${issue.sponsor_name} | ${issue.category} | ${issue.slot_count} |\n`;
    });
    
    section += `
### 风险说明
- 同一期节目中过多投放同一赞助商广告可能引起听众反感
- 建议分散到不同期数或调整广告形式
`;
    
    return section;
  }

  getInventoryIssues() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          e.episode_number,
          e.title as episode_title,
          e.inventory,
          COUNT(a.id) as used_slots,
          (e.inventory - COUNT(a.id)) as available_slots
        FROM episodes e
        LEFT JOIN ad_slots a ON e.id = a.episode_id
        GROUP BY e.id
        HAVING COUNT(a.id) >= e.inventory
        ORDER BY e.episode_number
      `;
      
      db.all(query, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  generateInventorySection(issues) {
    let section = `## 🔴 库存超卖问题

以下节目期数广告位已全部售罄：

| 节目期数 | 节目标题 | 总库存 | 已售 | 可用 |
|----------|----------|--------|------|------|
`;
    
    issues.forEach(issue => {
      section += `| ${issue.episode_number} | ${issue.episode_title} | ${issue.inventory} | ${issue.used_slots} | ${issue.available_slots} |\n`;
    });
    
    section += `
### 风险说明
- 库存已全部售出，无法接受新的广告预订
- 建议与客户协商安排到其他期数或增加库存
`;
    
    return section;
  }

  getMakegoodIssues() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.name as sponsor_name,
          s.category,
          e.episode_number,
          e.title as episode_title,
          COUNT(a.id) as unfulfilled_count
        FROM ad_slots a
        JOIN sponsors s ON a.sponsor_id = s.id
        JOIN episodes e ON a.episode_id = e.id
        WHERE a.is_fulfilled = 0
        GROUP BY s.id, e.id
        ORDER BY e.episode_number
      `;
      
      db.all(query, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  generateMakegoodSection(issues) {
    let section = `## 🟠 未履行广告位

以下广告位尚未履行，需要安排补播：

| 节目期数 | 节目标题 | 赞助商 | 品类 | 未履行数量 |
|----------|----------|--------|------|------------|
`;
    
    issues.forEach(issue => {
      section += `| ${issue.episode_number} | ${issue.episode_title} | ${issue.sponsor_name} | ${issue.category} | ${issue.unfulfilled_count} |\n`;
    });
    
    section += `
### 风险说明
- 未履行的广告位需要尽快安排补播
- 建议与赞助商协商补播时间，避免违约
`;
    
    return section;
  }

  getContractStatus() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          c.contract_number,
          s.name as sponsor_name,
          s.category,
          c.total_slots,
          c.used_slots,
          (c.total_slots - c.used_slots) as remaining_slots,
          c.start_date,
          c.end_date,
          c.max_frequency,
          c.makegood_allowed
        FROM contracts c
        JOIN sponsors s ON c.sponsor_id = s.id
        ORDER BY c.end_date
      `;
      
      db.all(query, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  generateContractStatusSection(contracts) {
    let section = `## 📋 合同状态一览

| 合同编号 | 赞助商 | 品类 | 总广告位 | 已使用 | 剩余 | 开始日期 | 结束日期 | 最大频次 | 允许补播 |
|----------|--------|------|----------|--------|------|----------|----------|----------|----------|
`;
    
    contracts.forEach(contract => {
      section += `| ${contract.contract_number} | ${contract.sponsor_name} | ${contract.category} | ${contract.total_slots} | ${contract.used_slots} | ${contract.remaining_slots} | ${contract.start_date || '-'} | ${contract.end_date || '-'} | ${contract.max_frequency} | ${contract.makegood_allowed ? '是' : '否'} |\n`;
    });
    
    return section;
  }

  generateHeader() {
    const today = new Date().toISOString().split('T')[0];
    return `# 播客广告排期风险报告

**生成日期**: ${today}

---

`;
  }

  generateFooter() {
    return `

---

*此报告由播客广告排期系统自动生成*
`;
  }
}

module.exports = new ReportGenerator();
