const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const renewalDao = require('../daos/renewalDao');

class ExportService {
  constructor() {
    this.exportDir = path.join(__dirname, '../../exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportRenewalChecklistToCSV(checklistDate = null) {
    const filters = checklistDate ? { checklist_date: checklistDate } : {};
    const checklists = await renewalDao.findRenewalChecklists(filters);

    const dateStr = checklistDate || new Date().toISOString().split('T')[0];
    const filename = `renewal_checklist_${dateStr}.csv`;
    const filePath = path.join(this.exportDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'employee_no', title: '员工编号' },
        { id: 'employee_name', title: '员工姓名' },
        { id: 'certificate_code', title: '证书代码' },
        { id: 'certificate_name', title: '证书名称' },
        { id: 'checklist_date', title: '检查日期' },
        { id: 'days_until_expiry', title: '距过期天数' },
        { id: 'is_qualified', title: '是否符合资格' },
        { id: 'status', title: '状态' },
        { id: 'qualification_details', title: '资格详情' }
      ]
    });

    const records = checklists.map(cl => ({
      employee_no: cl.employee_no,
      employee_name: cl.employee_name,
      certificate_code: cl.certificate_code,
      certificate_name: cl.certificate_name,
      checklist_date: cl.checklist_date,
      days_until_expiry: cl.days_until_expiry || 'N/A',
      is_qualified: cl.is_qualified ? '是' : '否',
      status: cl.status,
      qualification_details: cl.qualification_details || ''
    }));

    await csvWriter.writeRecords(records);

    return {
      filename,
      filePath,
      recordCount: records.length
    };
  }

  async exportRenewalChecklistToJSON(checklistDate = null) {
    const filters = checklistDate ? { checklist_date: checklistDate } : {};
    const checklists = await renewalDao.findRenewalChecklists(filters);

    const dateStr = checklistDate || new Date().toISOString().split('T')[0];
    const filename = `renewal_checklist_${dateStr}.json`;
    const filePath = path.join(this.exportDir, filename);

    const data = {
      exportDate: new Date().toISOString(),
      checklistDate: checklistDate,
      totalCount: checklists.length,
      data: checklists
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      filename,
      filePath,
      recordCount: checklists.length
    };
  }

  getExportedFiles() {
    const files = fs.readdirSync(this.exportDir);
    return files.map(file => {
      const fullPath = path.join(this.exportDir, file);
      const stats = fs.statSync(fullPath);
      return {
        filename: file,
        size: stats.size,
        created_at: stats.birthtime,
        path: fullPath
      };
    }).sort((a, b) => b.created_at - a.created_at);
  }
}

module.exports = new ExportService();
