const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const Visitor = require('../models/Visitor');
const TemporaryPlate = require('../models/TemporaryPlate');
const Blacklist = require('../models/Blacklist');
const VerifyRecord = require('../models/VerifyRecord');
const { maskData } = require('../utils/mask');

class ExportService {
  static async exportVisitors(filters = {}, options = {}) {
    const { isAdmin = false, includeSensitive = false } = options;
    let visitors = await Visitor.findAll(filters);
    
    if (!isAdmin || !includeSensitive) {
      visitors = maskData(visitors, { isAdmin: false });
    }
    
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '访客姓名', value: 'visitor_name' },
      { label: '联系电话', value: 'phone' },
      { label: '身份证号', value: 'id_card' },
      { label: '公司名称', value: 'company' },
      { label: '来访事由', value: 'visit_reason' },
      { label: '来访日期', value: 'visit_date' },
      { label: '开始时间', value: 'visit_time_start' },
      { label: '结束时间', value: 'visit_time_end' },
      { label: '被访人', value: 'visited_person' },
      { label: '车牌号', value: 'license_plate' },
      { label: '复核状态', value: 'review_status' },
      { label: '复核备注', value: 'review_remark' },
      { label: '黑名单标记', value: 'is_blacklisted' },
      { label: '创建时间', value: 'created_at' }
    ];
    
    return this.generateCSV(visitors, fields, 'visitors');
  }

  static async exportTemporaryPlates(filters = {}, options = {}) {
    const { isAdmin = false, includeSensitive = false } = options;
    let plates = await TemporaryPlate.findAll(filters);
    
    if (!isAdmin || !includeSensitive) {
      plates = maskData(plates, { isAdmin: false });
    }
    
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '车牌号', value: 'plate_number' },
      { label: '车辆类型', value: 'vehicle_type' },
      { label: '车主姓名', value: 'owner_name' },
      { label: '车主电话', value: 'owner_phone' },
      { label: '有效期开始', value: 'valid_start_date' },
      { label: '有效期结束', value: 'valid_end_date' },
      { label: '发证事由', value: 'issue_reason' },
      { label: '状态', value: 'status' },
      { label: '复核状态', value: 'review_status' },
      { label: '复核备注', value: 'review_remark' },
      { label: '黑名单标记', value: 'is_blacklisted' },
      { label: '创建时间', value: 'created_at' }
    ];
    
    return this.generateCSV(plates, fields, 'temporary_plates');
  }

  static async exportBlacklist(filters = {}, options = {}) {
    const { isAdmin = false, includeSensitive = false } = options;
    let blacklist = await Blacklist.findAll(filters);
    
    if (!isAdmin || !includeSensitive) {
      blacklist = maskData(blacklist, { isAdmin: false });
    }
    
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '类型', value: 'type' },
      { label: '姓名', value: 'name' },
      { label: '联系电话', value: 'phone' },
      { label: '身份证号', value: 'id_card' },
      { label: '车牌号', value: 'license_plate' },
      { label: '拉黑原因', value: 'reason' },
      { label: '风险级别', value: 'level' },
      { label: '状态', value: 'status' },
      { label: '添加人', value: 'added_by' },
      { label: '创建时间', value: 'created_at' }
    ];
    
    return this.generateCSV(blacklist, fields, 'blacklist');
  }

  static async exportVerifyRecords(filters = {}, options = {}) {
    const { isAdmin = false, includeSensitive = false } = options;
    let records = await VerifyRecord.findAll(filters);
    
    if (!isAdmin || !includeSensitive) {
      records = records.map(record => ({
        ...record,
        target_value: this.maskTargetValue(record.target_value, record.verify_type)
      }));
    }
    
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '核验类型', value: 'verify_type' },
      { label: '核验目标', value: 'target_value' },
      { label: '是否放行', value: 'is_allowed' },
      { label: '是否黑名单', value: 'is_in_blacklist' },
      { label: '核验结果', value: 'verify_result' },
      { label: '核验人', value: 'verify_by' },
      { label: '门岗编号', value: 'gate_number' },
      { label: '备注', value: 'remark' },
      { label: '核验时间', value: 'created_at' }
    ];
    
    return this.generateCSV(records, fields, 'verify_records');
  }

  static maskTargetValue(value, type) {
    if (!value) return value;
    
    switch (type) {
      case 'visitor':
      case 'id_card':
        return value.length > 7 ? value.slice(0, 3) + '****' + value.slice(-4) : value;
      case 'license_plate':
        return value.length > 4 ? value.slice(0, 2) + '***' + value.slice(-2) : value;
      default:
        return value;
    }
  }

  static generateCSV(data, fields, type) {
    try {
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);
      
      const fileName = `${type}_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;
      const filePath = path.join(__dirname, '../../data/exports', fileName);
      
      const exportDir = path.join(__dirname, '../../data/exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8');
      
      logger.info(`Exported ${data.length} ${type} records to ${filePath}`);
      
      return {
        success: true,
        fileName,
        filePath,
        recordCount: data.length
      };
    } catch (error) {
      logger.error('Export failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static getExportedFiles() {
    const exportDir = path.join(__dirname, '../../data/exports');
    if (!fs.existsSync(exportDir)) {
      return [];
    }
    
    const files = fs.readdirSync(exportDir)
      .filter(file => file.endsWith('.csv'))
      .map(file => {
        const stats = fs.statSync(path.join(exportDir, file));
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => b.created - a.created);
    
    return files;
  }
}

module.exports = ExportService;
