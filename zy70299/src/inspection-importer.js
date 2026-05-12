const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csv-parse/sync');

class InspectionImporter {
  constructor(manager) {
    this.manager = manager;
  }

  async importSigns(filePath) {
    const data = await this._loadFile(filePath);
    const signs = this._parseSigns(data, filePath);
    
    console.log(`\n📥 准备导入广告牌档案`);
    console.log('='.repeat(60));
    console.log(`文件: ${filePath}`);
    console.log(`解析到 ${signs.length} 条记录`);
    
    const validation = this._validateSigns(signs);
    
    if (validation.errors.length > 0) {
      console.log(`\n❌ 发现 ${validation.errors.length} 条无效记录：`);
      validation.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. 第${err.lineNum}行: ${err.reason}`);
        console.log(`     数据: ${JSON.stringify(err.data)}`);
      });
    }
    
    const validSigns = validation.valid;
    console.log(`\n✅ 有效记录: ${validSigns.length} 条`);
    
    if (validSigns.length > 0) {
      await this.manager.saveSigns(validSigns);
      console.log(`💾 已保存 ${validSigns.length} 个广告牌档案`);
    }
    
    await this.manager.addImportLog({
      type: 'signs',
      filePath,
      total: signs.length,
      valid: validSigns.length,
      errors: validation.errors.length
    });
    
    console.log('\n📋 接下来导入巡检记录: os-inspect import-inspections <文件路径>');
  }

  async importInspections(filePath) {
    const data = await this._loadFile(filePath);
    const inspections = this._parseInspections(data, filePath);
    
    console.log(`\n📥 准备导入巡检记录`);
    console.log('='.repeat(60));
    console.log(`文件: ${filePath}`);
    console.log(`解析到 ${inspections.length} 条记录`);
    
    const validation = this._validateInspections(inspections);
    
    if (validation.errors.length > 0) {
      console.log(`\n❌ 发现 ${validation.errors.length} 条无效记录（已跳过）：`);
      validation.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. 第${err.lineNum}行: ${err.reason}`);
        console.log(`     数据: ${JSON.stringify(err.data)}`);
      });
    }
    
    const validInspections = validation.valid;
    console.log(`\n✅ 有效记录: ${validInspections.length} 条`);
    
    const results = await this.manager.saveInspections(validInspections);
    
    console.log(`\n📊 导入结果:`);
    console.log(`  ✅ 成功导入: ${results.success.length} 条`);
    
    if (results.duplicates.length > 0) {
      console.log(`  ⚠️  重复记录（已跳过）: ${results.duplicates.length} 条`);
      results.duplicates.forEach(d => {
        console.log(`     - 广告牌 ${d.inspection.signId} | ${d.inspection.date} | 原因: ${d.reason}`);
      });
    }
    
    if (results.conflicts.length > 0) {
      console.log(`  ⚠️  状态冲突（需要人工确认）: ${results.conflicts.length} 条`);
      results.conflicts.forEach(c => {
        console.log(`     - 广告牌 ${c.inspection.signId} | ${c.inspection.date}`);
        console.log(`       原因: ${c.reason}`);
        console.log(`       现有: 锈蚀=${c.existing?.rustLevel}, 照明=${c.existing?.lightingStatus}`);
        console.log(`       新入: 锈蚀=${c.inspection.rustLevel}, 照明=${c.inspection.lightingStatus}`);
      });
    }
    
    if (results.missingSigns.length > 0) {
      console.log(`  ❌ 来源记录缺失（广告牌不存在）: ${results.missingSigns.length} 条`);
      results.missingSigns.forEach(m => {
        console.log(`     - 广告牌 ${m.inspection.signId} | ${m.reason}`);
      });
    }
    
    const totalProcessed = results.success.length + results.duplicates.length + 
                           results.conflicts.length + results.missingSigns.length;
    
    await this.manager.addImportLog({
      type: 'inspections',
      filePath,
      total: inspections.length,
      valid: validInspections.length,
      errors: validation.errors.length,
      processed: {
        success: results.success.length,
        duplicates: results.duplicates.length,
        conflicts: results.conflicts.length,
        missingSigns: results.missingSigns.length
      }
    });
    
    console.log(`\n📈 总共处理: ${totalProcessed} 条`);
    console.log(`\n🔍 接下来执行风险评估: os-inspect assess`);
  }

  async _loadFile(filePath) {
    const absPath = path.resolve(filePath);
    const content = await fs.readFile(absPath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.csv') {
      return parse(content, { columns: true, skip_empty_lines: true });
    } else {
      throw new Error(`不支持的文件格式: ${ext}，请使用 .json 或 .csv`);
    }
  }

  _parseSigns(data, filePath) {
    if (!Array.isArray(data)) {
      return [data];
    }
    return data.map((item, idx) => ({
      ...item,
      _lineNum: idx + 2
    }));
  }

  _parseInspections(data, filePath) {
    if (!Array.isArray(data)) {
      return [data];
    }
    return data.map((item, idx) => ({
      ...item,
      _lineNum: idx + 2
    }));
  }

  _validateSigns(signs) {
    const valid = [];
    const errors = [];
    
    const validRustLevels = ['none', 'minor', 'moderate', 'severe'];
    const validLighting = ['working', 'partial', 'failed'];

    signs.forEach(sign => {
      const lineNum = sign._lineNum || '?';
      const issues = [];
      
      if (!sign.id) {
        issues.push('缺少广告牌 ID');
      }
      
      if (!sign.location) {
        issues.push('缺少位置信息');
      }
      
      if (!sign.contractEndDate) {
        issues.push('缺少合同到期日期');
      } else if (!this._isValidDate(sign.contractEndDate)) {
        issues.push(`合同到期日期格式无效: ${sign.contractEndDate} (应为 YYYY-MM-DD)`);
      }
      
      if (sign.initialRustLevel && !validRustLevels.includes(sign.initialRustLevel)) {
        issues.push(`初始锈蚀程度无效: ${sign.initialRustLevel} (应为: ${validRustLevels.join(', ')})`);
      }
      
      if (sign.initialLighting && !validLighting.includes(sign.initialLighting)) {
        issues.push(`初始照明状态无效: ${sign.initialLighting} (应为: ${validLighting.join(', ')})`);
      }
      
      if (issues.length > 0) {
        errors.push({
          lineNum,
          data: sign,
          reason: issues.join('; ')
        });
      } else {
        valid.push({
          id: sign.id,
          location: sign.location,
          contractStartDate: sign.contractStartDate,
          contractEndDate: sign.contractEndDate,
          owner: sign.owner,
          size: sign.size,
          type: sign.type,
          initialRustLevel: sign.initialRustLevel || 'none',
          initialLighting: sign.initialLighting || 'working'
        });
      }
    });
    
    return { valid, errors };
  }

  _validateInspections(inspections) {
    const valid = [];
    const errors = [];
    
    const validRustLevels = ['none', 'minor', 'moderate', 'severe'];
    const validLighting = ['working', 'partial', 'failed'];

    inspections.forEach(ins => {
      const lineNum = ins._lineNum || '?';
      const issues = [];
      
      if (!ins.signId) {
        issues.push('缺少广告牌 ID');
      }
      
      if (!ins.date) {
        issues.push('缺少巡检日期');
      } else if (!this._isValidDate(ins.date)) {
        issues.push(`巡检日期格式无效: ${ins.date} (应为 YYYY-MM-DD)`);
      }
      
      if (!ins.rustLevel) {
        issues.push('缺少锈蚀程度');
      } else if (!validRustLevels.includes(ins.rustLevel)) {
        issues.push(`锈蚀程度无效: ${ins.rustLevel} (应为: ${validRustLevels.join(', ')})`);
      }
      
      if (!ins.lightingStatus) {
        issues.push('缺少照明状态');
      } else if (!validLighting.includes(ins.lightingStatus)) {
        issues.push(`照明状态无效: ${ins.lightingStatus} (应为: ${validLighting.join(', ')})`);
      }
      
      if (issues.length > 0) {
        errors.push({
          lineNum,
          data: ins,
          reason: issues.join('; ')
        });
      } else {
        valid.push({
          signId: ins.signId,
          date: ins.date,
          inspector: ins.inspector || '未知',
          rustLevel: ins.rustLevel,
          lightingStatus: ins.lightingStatus,
          notes: ins.notes || ''
        });
      }
    });
    
    return { valid, errors };
  }

  _isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  }
}

module.exports = { InspectionImporter };
