const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const XLSX = require('xlsx');
const { Op } = require('sequelize');
const {
  BillImport,
  BillRecord,
  Project,
  SharedAllocation,
  SharedService,
  Anomaly,
  ManualAssignment,
  BudgetAlert,
  User,
  TagRule,
} = require('../db/models');
const billService = require('../services/billService');

async function getBillImports(req, res) {
  try {
    const { page = 1, pageSize = 10, billMonth, status } = req.query;
    const offset = (page - 1) * pageSize;
    const where = {};

    if (billMonth) {
      where.billMonth = billMonth;
    }
    if (status) {
      where.status = status;
    }

    const { count, rows } = await BillImport.findAndCountAll({
      where,
      include: [
        { model: User, as: 'importer', attributes: ['id', 'fullName', 'username'] },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(pageSize),
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    console.error('获取账单导入列表失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getBillImportById(req, res) {
  try {
    const { id } = req.params;
    const billImport = await BillImport.findByPk(id, {
      include: [
        { model: User, as: 'importer', attributes: ['id', 'fullName', 'username'] },
      ],
    });

    if (!billImport) {
      return res.status(404).json({ success: false, message: '账单导入不存在' });
    }

    res.json({ success: true, data: billImport });
  } catch (error) {
    console.error('获取账单导入详情失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function parseCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => records.push(row))
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet);
}

async function importBill(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传账单文件' });
    }

    const { billMonth, cloudProvider } = req.body;
    
    if (!billMonth) {
      return res.status(400).json({ success: false, message: '请指定账单月份' });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let records;

    try {
      if (fileExt === '.csv') {
        records = await parseCSVFile(req.file.path);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        records = parseExcelFile(req.file.path);
      } else {
        return res.status(400).json({ success: false, message: '不支持的文件格式，仅支持 CSV 和 Excel 文件' });
      }
    } catch (parseError) {
      return res.status(400).json({ success: false, message: '文件解析失败: ' + parseError.message });
    }

    if (records.length === 0) {
      return res.status(400).json({ success: false, message: '文件中没有数据' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    
    const result = await billService.importBillRecords(
      records,
      {
        fileName: req.file.originalname,
        fileBuffer,
        billMonth,
        cloudProvider,
      },
      req.user.id
    );

    fs.unlinkSync(req.file.path);

    if (result.isDuplicate) {
      return res.status(409).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('账单导入失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getBillRecords(req, res) {
  try {
    const {
      page = 1,
      pageSize = 20,
      billMonth,
      billImportId,
      projectId,
      allocationMethod,
      environment,
      search,
    } = req.query;

    const offset = (page - 1) * pageSize;
    const where = {};

    if (billMonth) where.billMonth = billMonth;
    if (billImportId) where.billImportId = billImportId;
    if (projectId) where.projectId = projectId;
    if (allocationMethod) where.allocationMethod = allocationMethod;
    if (environment) where.environment = environment;

    if (search) {
      where[Op.or] = [
        { resourceId: { [Op.iLike]: `%${search}%` } },
        { resourceName: { [Op.iLike]: `%${search}%` } },
        { productName: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await BillRecord.findAndCountAll({
      where,
      include: [
        { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
        { model: SharedService, as: 'sharedService', attributes: ['id', 'name', 'code'] },
        {
          model: SharedAllocation,
          as: 'allocations',
          include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'code'] }],
        },
        {
          model: ManualAssignment,
          as: 'manualAssignments',
          include: [{ model: User, as: 'assignedByUser', attributes: ['id', 'fullName'] }],
        },
      ],
      order: [['costAmount', 'DESC']],
      offset,
      limit: parseInt(pageSize),
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    console.error('获取账单记录失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getBillRecordById(req, res) {
  try {
    const { id } = req.params;
    const record = await BillRecord.findByPk(id, {
      include: [
        { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
        { model: SharedService, as: 'sharedService', attributes: ['id', 'name', 'code'] },
        {
          model: SharedAllocation,
          as: 'allocations',
          include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'code'] }],
        },
        {
          model: ManualAssignment,
          as: 'manualAssignments',
          include: [{ model: User, as: 'assignedByUser', attributes: ['id', 'fullName'] }],
        },
        {
          model: Anomaly,
          as: 'anomalies',
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    if (!record) {
      return res.status(404).json({ success: false, message: '账单记录不存在' });
    }

    const candidates = billService.suggestCandidates(
      record.tags,
      record.resourceName,
      record.resourceType
    );

    res.json({
      success: true,
      data: {
        ...record.toJSON(),
        suggestedCandidates: candidates,
      },
    });
  } catch (error) {
    console.error('获取账单记录详情失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function manualAssign(req, res) {
  try {
    const { id } = req.params;
    const { projectId, reason } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, message: '请选择项目' });
    }

    const result = await billService.manualAssignRecord(
      id,
      projectId,
      req.user.id,
      reason
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('人工分配失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

module.exports = {
  getBillImports,
  getBillImportById,
  importBill,
  getBillRecords,
  getBillRecordById,
  manualAssign,
};
