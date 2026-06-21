const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3002;
const DATA_FILE = path.join(__dirname, 'data', 'materials.json');

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const demoData = generateDemoData();
    saveData(demoData);
    return demoData;
  }
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(content);
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function generateDemoData() {
  return {
    materials: [
      {
        id: 'MAT-2026-001',
        projectName: '机电管综方案比选-小样例',
        materialName: '给排水管道系统-1F',
        reviewer: '张三',
        reviewDate: '2026-06-01',
        status: 'normal',
        collisionScreenshots: [
          {
            id: 'COL-001',
            name: '1F-走廊-管道与风管碰撞',
            description: '给水管DN100与排烟风管800x400标高冲突',
            cameraView: { x: 120.5, y: 45.2, z: 3.0, targetX: 125.0, targetY: 48.0, targetZ: 3.2 },
            bbox: { minX: 118, minY: 42, minZ: 2.8, maxX: 128, maxY: 51, maxZ: 3.6 },
            imageUrl: '/screenshots/col-001.png'
          }
        ],
        attachments: [
          {
            id: 'ATT-001',
            name: '材料报审表-给排水-1F.pdf',
            uploadTime: '2026-06-01 10:00:00',
            isLate: false,
            isChangeOrder: false,
            lateReason: ''
          }
        ],
        remark: '正常记录，碰撞点已标注',
        importBatch: 'BATCH-001',
        importTime: '2026-06-01 10:05:00',
        hasManualRemark: false,
        sourceLink: 'material://MAT-2026-001'
      },
      {
        id: 'MAT-2026-002',
        projectName: '机电管综方案比选-小样例',
        materialName: '喷淋系统-B1层',
        reviewer: '李四',
        reviewDate: '2026-06-02',
        status: 'normal',
        collisionScreenshots: [
          {
            id: 'COL-002',
            name: 'B1-停车场-喷淋头与桥架碰撞',
            description: '喷淋头上喷与强电桥架200x100距离不足',
            cameraView: { x: 80.0, y: 120.0, z: -2.5, targetX: 82.5, targetY: 123.0, targetZ: -2.8 },
            bbox: { minX: 78, minY: 118, minZ: -3.0, maxX: 86, maxY: 126, maxZ: -2.2 },
            imageUrl: '/screenshots/col-002.png'
          }
        ],
        attachments: [
          {
            id: 'ATT-002',
            name: '材料报审表-喷淋-B1.pdf',
            uploadTime: '2026-06-02 14:00:00',
            isLate: false,
            isChangeOrder: false,
            lateReason: ''
          }
        ],
        remark: '',
        importBatch: 'BATCH-001',
        importTime: '2026-06-01 10:05:00',
        hasManualRemark: false,
        sourceLink: 'material://MAT-2026-002'
      },
      {
        id: 'MAT-2026-003',
        projectName: '机电管综方案比选-小样例',
        materialName: '消防报警系统-2F',
        reviewer: '王五',
        reviewDate: '2026-06-03',
        status: 'dirty_late_attachment',
        collisionScreenshots: [
          {
            id: 'COL-003',
            name: '2F-办公区-烟感与灯具冲突',
            description: '烟感探测器距荧光灯水平距离不足0.5m',
            cameraView: { x: 200.0, y: 80.0, z: 6.0, targetX: 202.0, targetY: 82.0, targetZ: 5.8 },
            bbox: { minX: 198, minY: 78, minZ: 5.5, maxX: 205, maxY: 85, maxZ: 6.2 },
            imageUrl: '/screenshots/col-003.png'
          }
        ],
        attachments: [
          {
            id: 'ATT-003',
            name: '材料报审表-消防报警-2F.pdf',
            uploadTime: '2026-06-03 09:00:00',
            isLate: false,
            isChangeOrder: false,
            lateReason: ''
          },
          {
            id: 'ATT-004',
            name: '补充检测报告-烟感-2F.pdf',
            uploadTime: '2026-06-05 16:30:00',
            isLate: true,
            isChangeOrder: false,
            lateReason: '附件晚到：比材料报审表提交晚3天，超出送审窗口期',
            originalMaterialId: 'MAT-2026-003'
          }
        ],
        remark: '',
        importBatch: 'BATCH-002',
        importTime: '2026-06-05 17:00:00',
        hasManualRemark: false,
        sourceLink: 'material://MAT-2026-003',
        dirtyFlags: ['late_attachment']
      },
      {
        id: 'MAT-2026-004',
        projectName: '机电管综方案比选-小样例',
        materialName: '暖通空调系统-3F',
        reviewer: '赵六',
        reviewDate: '2026-06-04',
        status: 'dirty_change_order',
        collisionScreenshots: [
          {
            id: 'COL-004',
            name: '3F-会议室-新风管与喷淋主管碰撞',
            description: '新风管630x250与喷淋主管DN150交叉碰撞',
            cameraView: { x: 150.0, y: 200.0, z: 9.0, targetX: 152.5, targetY: 203.0, targetZ: 8.8 },
            bbox: { minX: 148, minY: 198, minZ: 8.5, maxX: 156, maxY: 206, maxZ: 9.3 },
            imageUrl: '/screenshots/col-004.png'
          }
        ],
        attachments: [
          {
            id: 'ATT-005',
            name: '材料报审表-暖通-3F.pdf',
            uploadTime: '2026-06-04 11:00:00',
            isLate: false,
            isChangeOrder: false,
            lateReason: ''
          }
        ],
        remark: '',
        importBatch: 'BATCH-002',
        importTime: '2026-06-04 11:30:00',
        hasManualRemark: false,
        sourceLink: 'material://MAT-2026-004',
        changeOrders: [
          {
            id: 'CO-001',
            name: '变更单-暖通3F-新风管改路径',
            issueDate: '2026-06-07',
            uploadTime: '2026-06-07 15:00:00',
            isLate: true,
            reason: '变更单晚到：方案比选截止后才提交，影响方案决策依据',
            originalMaterialId: 'MAT-2026-004'
          }
        ],
        dirtyFlags: ['change_order_late']
      },
      {
        id: 'MAT-2026-005',
        projectName: '机电管综方案比选-小样例',
        materialName: '强电系统-4F',
        reviewer: '钱七',
        reviewDate: '2026-06-05',
        status: 'normal',
        collisionScreenshots: [
          {
            id: 'COL-005',
            name: '4F-配电间-桥架与母线槽碰撞',
            description: '弱电桥架300x150与母线槽1000A距离不足',
            cameraView: { x: 300.0, y: 150.0, z: 12.0, targetX: 302.0, targetY: 152.0, targetZ: 11.8 },
            bbox: { minX: 298, minY: 148, minZ: 11.5, maxX: 305, maxY: 155, maxZ: 12.3 },
            imageUrl: '/screenshots/col-005.png'
          }
        ],
        attachments: [
          {
            id: 'ATT-006',
            name: '材料报审表-强电-4F.pdf',
            uploadTime: '2026-06-05 10:00:00',
            isLate: false,
            isChangeOrder: false,
            lateReason: ''
          }
        ],
        remark: '强电桥架方案已复核，与母线槽间距需按GB50303规范调整，建议复测后再定版',
        importBatch: 'BATCH-003',
        importTime: '2026-06-06 09:15:00',
        hasManualRemark: true,
        sourceLink: 'material://MAT-2026-005'
      }
    ],
    importBatches: [
      { id: 'BATCH-001', name: '首次导入-给排水+喷淋', importTime: '2026-06-01 10:05:00', count: 2 },
      { id: 'BATCH-002', name: '第二批-消防+暖通（含晚到数据）', importTime: '2026-06-05 17:00:00', count: 2 },
      { id: 'BATCH-003', name: '补充导入-强电', importTime: '2026-06-06 09:15:00', count: 1 }
    ]
  };
}

app.get('/api/materials', (req, res) => {
  const { status, projectName } = req.query;
  let data = loadData();
  let result = [...data.materials];

  if (status) {
    result = result.filter(m => m.status === status);
  }
  if (projectName) {
    result = result.filter(m => m.projectName.includes(projectName));
  }

  res.json({
    code: 0,
    data: result,
    summary: {
      total: result.length,
      normal: result.filter(m => m.status === 'normal').length,
      dirty: result.filter(m => m.status !== 'normal').length
    }
  });
});

app.get('/api/materials/:id', (req, res) => {
  const data = loadData();
  const material = data.materials.find(m => m.id === req.params.id);
  if (!material) {
    return res.status(404).json({ code: 404, message: '记录不存在' });
  }
  res.json({ code: 0, data: material });
});

app.put('/api/materials/:id/remark', (req, res) => {
  const { remark } = req.body;
  const data = loadData();
  const idx = data.materials.findIndex(m => m.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ code: 404, message: '记录不存在' });
  }
  data.materials[idx].remark = remark || '';
  data.materials[idx].hasManualRemark = true;
  saveData(data);
  res.json({ code: 0, data: data.materials[idx], message: '备注已更新' });
});

app.get('/api/materials/dirty/list', (req, res) => {
  const data = loadData();
  const dirtyItems = data.materials.filter(m => m.status !== 'normal');
  const detailedDirty = dirtyItems.map(m => {
    const dirtyDetails = [];
    if (m.dirtyFlags?.includes('late_attachment')) {
      const lateAtt = m.attachments?.find(a => a.isLate);
      if (lateAtt) {
        dirtyDetails.push({
          type: 'late_attachment',
          typeName: '晚到附件',
          name: lateAtt.name,
          reason: lateAtt.lateReason,
          uploadTime: lateAtt.uploadTime,
          originalLink: lateAtt.originalMaterialId ? `material://${lateAtt.originalMaterialId}` : null
        });
      }
    }
    if (m.dirtyFlags?.includes('change_order_late')) {
      const lateCO = m.changeOrders?.find(c => c.isLate);
      if (lateCO) {
        dirtyDetails.push({
          type: 'change_order_late',
          typeName: '变更单晚到',
          name: lateCO.name,
          reason: lateCO.reason,
          uploadTime: lateCO.uploadTime,
          originalLink: lateCO.originalMaterialId ? `material://${lateCO.originalMaterialId}` : null
        });
      }
    }
    return {
      ...m,
      dirtyDetails
    };
  });
  res.json({
    code: 0,
    data: detailedDirty,
    summary: {
      total: detailedDirty.length,
      lateAttachmentCount: detailedDirty.filter(m => m.dirtyFlags?.includes('late_attachment')).length,
      changeOrderLateCount: detailedDirty.filter(m => m.dirtyFlags?.includes('change_order_late')).length
    }
  });
});

app.post('/api/materials/import', (req, res) => {
  const { items, batchName } = req.body;
  const data = loadData();
  const batchId = 'BATCH-' + String(data.importBatches.length + 1).padStart(3, '0');
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const imported = [];
  const skipped = [];
  const conflicts = [];

  items.forEach(item => {
    const existingIdx = data.materials.findIndex(m => m.id === item.id);
    if (existingIdx >= 0) {
      const existing = data.materials[existingIdx];
      skipped.push({
        id: item.id,
        name: item.materialName,
        reason: '记录已存在，跳过不重复导入'
      });
      if (item.remark && !existing.hasManualRemark) {
        existing.remark = item.remark;
      }
      conflicts.push({
        id: item.id,
        existingRemark: existing.remark,
        importRemark: item.remark,
        remarkPreserved: existing.hasManualRemark
      });
    } else {
      let status = 'normal';
      const dirtyFlags = [];

      if (item.attachments?.some(a => a.isLate)) {
        status = 'dirty_late_attachment';
        dirtyFlags.push('late_attachment');
      }
      if (item.changeOrders?.some(c => c.isLate)) {
        status = status === 'normal' ? 'dirty_change_order' : 'dirty_mixed';
        dirtyFlags.push('change_order_late');
      }

      const newItem = {
        ...item,
        status,
        dirtyFlags: dirtyFlags.length > 0 ? dirtyFlags : undefined,
        importBatch: batchId,
        importTime: now,
        hasManualRemark: !!item.remark,
        sourceLink: `material://${item.id}`
      };
      data.materials.push(newItem);
      imported.push(newItem);
    }
  });

  data.importBatches.push({
    id: batchId,
    name: batchName || `导入批次-${now.slice(0, 10)}`,
    importTime: now,
    count: imported.length
  });

  saveData(data);

  res.json({
    code: 0,
    data: {
      batchId,
      imported,
      skipped,
      conflicts,
      totals: {
        requestCount: items.length,
        importedCount: imported.length,
        skippedCount: skipped.length
      }
    },
    message: `导入完成：新增 ${imported.length} 条，跳过 ${skipped.length} 条`
  });
});

app.get('/api/materials/screenshot/:materialId/:screenshotId', (req, res) => {
  const data = loadData();
  const material = data.materials.find(m => m.id === req.params.materialId);
  if (!material) {
    return res.status(404).json({ code: 404, message: '记录不存在' });
  }
  const screenshot = material.collisionScreenshots?.find(s => s.id === req.params.screenshotId);
  if (!screenshot) {
    return res.status(404).json({ code: 404, message: '截图不存在' });
  }
  res.json({
    code: 0,
    data: {
      ...screenshot,
      materialId: material.id,
      materialName: material.materialName,
      remark: material.remark
    }
  });
});

app.post('/api/materials/sync-remark-before-export', (req, res) => {
  const { id, remark } = req.body;
  const data = loadData();
  const idx = data.materials.findIndex(m => m.id === id);
  if (idx === -1) {
    return res.status(404).json({ code: 404, message: '记录不存在' });
  }
  data.materials[idx].remark = remark || '';
  data.materials[idx].hasManualRemark = true;
  saveData(data);
  res.json({
    code: 0,
    data: {
      id,
      remark: data.materials[idx].remark,
      synced: true,
      exportReady: true
    }
  });
});

app.get('/api/export/excel', async (req, res) => {
  const { includeDirty = 'true' } = req.query;
  const data = loadData();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '机电管综方案比选系统';
  workbook.created = new Date();

  const normalSheet = workbook.addWorksheet('正常记录');
  normalSheet.columns = [
    { header: '材料编号', key: 'id', width: 18 },
    { header: '项目名称', key: 'projectName', width: 28 },
    { header: '材料名称', key: 'materialName', width: 24 },
    { header: '复核人', key: 'reviewer', width: 10 },
    { header: '复核日期', key: 'reviewDate', width: 12 },
    { header: '碰撞点数量', key: 'collisionCount', width: 12 },
    { header: '附件数量', key: 'attachmentCount', width: 10 },
    { header: '备注', key: 'remark', width: 40 },
    { header: '导入批次', key: 'importBatch', width: 14 },
    { header: '导入时间', key: 'importTime', width: 20 },
    { header: '原始对象链接', key: 'sourceLink', width: 24 }
  ];
  normalSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  normalSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

  const normalItems = data.materials.filter(m => m.status === 'normal');
  normalItems.forEach(m => {
    normalSheet.addRow({
      id: m.id,
      projectName: m.projectName,
      materialName: m.materialName,
      reviewer: m.reviewer,
      reviewDate: m.reviewDate,
      collisionCount: m.collisionScreenshots?.length || 0,
      attachmentCount: m.attachments?.length || 0,
      remark: m.remark || '',
      importBatch: m.importBatch,
      importTime: m.importTime,
      sourceLink: m.sourceLink
    });
  });

  if (includeDirty === 'true') {
    const dirtySheet = workbook.addWorksheet('脏数据清单-晚到附件和变更单');
    dirtySheet.columns = [
      { header: '材料编号', key: 'id', width: 18 },
      { header: '材料名称', key: 'materialName', width: 24 },
      { header: '脏数据类型', key: 'dirtyTypeName', width: 18 },
      { header: '问题文件名称', key: 'dirtyFileName', width: 30 },
      { header: '晚到原因', key: 'dirtyReason', width: 40 },
      { header: '上传时间', key: 'uploadTime', width: 20 },
      { header: '对应原记录链接', key: 'originalLink', width: 24 },
      { header: '备注', key: 'remark', width: 30 },
      { header: '处理状态', key: 'handleStatus', width: 12 }
    ];
    dirtySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    dirtySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };

    data.materials.filter(m => m.status !== 'normal').forEach(m => {
      if (m.dirtyFlags?.includes('late_attachment')) {
        m.attachments?.filter(a => a.isLate).forEach(a => {
          dirtySheet.addRow({
            id: m.id,
            materialName: m.materialName,
            dirtyTypeName: '晚到附件',
            dirtyFileName: a.name,
            dirtyReason: a.lateReason,
            uploadTime: a.uploadTime,
            originalLink: a.originalMaterialId ? `material://${a.originalMaterialId}` : m.sourceLink,
            remark: m.remark || '',
            handleStatus: '待人工确认'
          });
        });
      }
      if (m.dirtyFlags?.includes('change_order_late')) {
        m.changeOrders?.filter(c => c.isLate).forEach(c => {
          dirtySheet.addRow({
            id: m.id,
            materialName: m.materialName,
            dirtyTypeName: '变更单晚到',
            dirtyFileName: c.name,
            dirtyReason: c.reason,
            uploadTime: c.uploadTime,
            originalLink: c.originalMaterialId ? `material://${c.originalMaterialId}` : m.sourceLink,
            remark: m.remark || '',
            handleStatus: '待人工确认'
          });
        });
      }
    });

    const summarySheet = workbook.addWorksheet('导出汇总');
    summarySheet.columns = [
      { header: '统计项', key: 'item', width: 28 },
      { header: '数量', key: 'count', width: 12 },
      { header: '说明', key: 'remark', width: 40 }
    ];
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };

    const dirtyItems = data.materials.filter(m => m.status !== 'normal');
    const lateAttCount = dirtyItems.filter(m => m.dirtyFlags?.includes('late_attachment')).length;
    const lateCOCount = dirtyItems.filter(m => m.dirtyFlags?.includes('change_order_late')).length;

    summarySheet.addRow({ item: '正常记录数', count: normalItems.length, remark: '状态正常，可直接参与方案比选' });
    summarySheet.addRow({ item: '脏数据记录数', count: dirtyItems.length, remark: '含晚到附件或变更单晚到，需人工复核后决定是否纳入比选' });
    summarySheet.addRow({ item: '  其中：晚到附件', count: lateAttCount, remark: '附件上传时间超出送审窗口期' });
    summarySheet.addRow({ item: '  其中：变更单晚到', count: lateCOCount, remark: '变更单在方案比选截止后提交' });
    summarySheet.addRow({ item: '总记录数', count: data.materials.length, remark: '正常+脏数据' });
    summarySheet.addRow({ item: '导出时间', count: '', remark: new Date().toLocaleString('zh-CN') });
  }

  const filename = `机电管综方案比选_${new Date().toISOString().slice(0,10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();
});

app.get('/api/batches', (req, res) => {
  const data = loadData();
  res.json({ code: 0, data: data.importBatches });
});

app.post('/api/reset-demo', (req, res) => {
  const demoData = generateDemoData();
  saveData(demoData);
  res.json({ code: 0, data: demoData, message: '已重置为演示数据（含晚到附件+变更单晚到）' });
});

app.listen(PORT, () => {
  console.log(`机电管综方案比选 - 后端服务已启动: http://localhost:${PORT}`);
  console.log(`数据文件: ${DATA_FILE}`);
});
