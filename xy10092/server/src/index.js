import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;
const DATA_DIR = join(__dirname, '..', 'data');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ dest: 'uploads/' });

async function ensureDataDir() {
  try {
    await readdir(DATA_DIR);
  } catch {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function readData(filename) {
  try {
    const content = await readFile(join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeData(filename, data) {
  await ensureDataDir();
  await writeFile(join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

async function getNextId(type) {
  const meta = await readData('meta.json') || {};
  const counters = meta.counters || {};
  const year = new Date().getFullYear().toString().slice(-2);
  const prefixes = {
    repair: 'WX',
    material: 'CL',
    student: 'XS',
    report: 'BG'
  };
  const prefix = prefixes[type] || 'XX';
  const count = (counters[type] || 0) + 1;
  const id = `${prefix}${year}${String(count).padStart(4, '0')}`;
  await writeData('meta.json', {
    ...meta,
    counters: {
      ...counters,
      [type]: count
    }
  });
  return id;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/repairs', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const materials = await readData('materials.json');
    const students = await readData('students.json');
    
    const repairMap = new Map(repairs.map(r => [r.id, r]));
    const materialMap = new Map(materials.map(m => [m.id, m]));
    const studentMap = new Map(students.map(s => [s.id, s]));
    
    const { 
      status, 
      dorm, 
      startDate, 
      endDate,
      hasDiscrepancy,
      keyword 
    } = req.query;
    
    let filtered = repairs;
    
    if (status && status !== 'all') {
      filtered = filtered.filter(r => r.status === status);
    }
    
    if (dorm) {
      filtered = filtered.filter(r => 
        (r.dormBuilding || '').includes(dorm) || 
        (r.dormNumber || '').includes(dorm)
      );
    }
    
    if (startDate) {
      filtered = filtered.filter(r => 
        new Date(r.createdAt) >= new Date(startDate)
      );
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => 
        new Date(r.createdAt) <= end
      );
    }
    
    if (hasDiscrepancy === 'true') {
      filtered = filtered.filter(r => r.hasDiscrepancy);
    }
    
    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter(r => 
        r.id.toLowerCase().includes(kw) ||
        (r.studentName || '').toLowerCase().includes(kw) ||
        (r.studentPhone || '').includes(kw) ||
        (r.repairType || '').toLowerCase().includes(kw)
      );
    }
    
    const enriched = filtered.map(r => {
      const discrepancyAnalysis = analyzeDiscrepancy(r);
      return {
        ...r,
        discrepancyAnalysis,
        student: studentMap.get(r.studentId),
        items: r.items.map(item => ({
          ...item,
          material: materialMap.get(item.materialId)
        }))
      };
    });
    
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/repairs/:id', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const materials = await readData('materials.json');
    const students = await readData('students.json');
    
    const repair = repairs.find(r => r.id === req.params.id);
    if (!repair) {
      return res.status(404).json({ error: '维修单不存在' });
    }
    
    const materialMap = new Map(materials.map(m => [m.id, m]));
    const studentMap = new Map(students.map(s => [s.id, s]));
    
    const discrepancyAnalysis = analyzeDiscrepancy(repair);
    res.json({
      ...repair,
      discrepancyAnalysis,
      student: studentMap.get(repair.studentId),
      items: repair.items.map(item => ({
        ...item,
        material: materialMap.get(item.materialId)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/repairs', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const students = await readData('students.json');
    
    const id = await getNextId('repair');
    const now = new Date().toISOString();
    
    let studentId = req.body.studentId;
    if (!studentId) {
      const existingStudent = students.find(s => 
        s.phone === req.body.studentPhone || 
        s.name === req.body.studentName
      );
      if (existingStudent) {
        studentId = existingStudent.id;
      } else {
        const newStudent = {
          id: await getNextId('student'),
          name: req.body.studentName,
          phone: req.body.studentPhone,
          dormBuilding: req.body.dormBuilding,
          dormNumber: req.body.dormNumber,
          createdAt: now
        };
        students.push(newStudent);
        await writeData('students.json', students);
        studentId = newStudent.id;
      }
    }
    
    const repair = {
      id,
      studentId,
      studentName: req.body.studentName,
      studentPhone: req.body.studentPhone,
      dormBuilding: req.body.dormBuilding,
      dormNumber: req.body.dormNumber,
      repairType: req.body.repairType,
      description: req.body.description,
      repairDate: req.body.repairDate,
      workerName: req.body.workerName,
      items: req.body.items || [],
      status: 'pending_verification',
      confirmedByStudent: null,
      studentConfirmationDate: null,
      hasDiscrepancy: false,
      discrepancyNote: null,
      resolutionNote: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
      history: [{
        id: uuidv4(),
        action: '创建维修单',
        actor: req.body.actor || '系统',
        timestamp: now,
        details: {
          repairType: req.body.repairType,
          dorm: `${req.body.dormBuilding}-${req.body.dormNumber}`
        }
      }]
    };
    
    repairs.push(repair);
    await writeData('repairs.json', repairs);
    
    res.status(201).json(repair);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/repairs/:id', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const index = repairs.findIndex(r => r.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: '维修单不存在' });
    }
    
    const now = new Date().toISOString();
    const oldRepair = repairs[index];
    
    const updated = {
      ...oldRepair,
      ...req.body,
      updatedAt: now
    };
    
    if (req.body.items) {
      const discrepancyAnalysis = analyzeDiscrepancy(updated);
      updated.hasDiscrepancy = discrepancyAnalysis.hasIssues;
    }
    
    if (!updated.history) {
      updated.history = [];
    }
    
    updated.history.push({
      id: uuidv4(),
      action: '更新维修单信息',
      actor: req.body.actor || '系统',
      timestamp: now,
      details: {
        changedFields: Object.keys(req.body)
      }
    });
    
    repairs[index] = updated;
    await writeData('repairs.json', repairs);
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/repairs/:id/items', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const index = repairs.findIndex(r => r.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: '维修单不存在' });
    }
    
    const now = new Date().toISOString();
    const repair = repairs[index];
    
    const existingItem = repair.items.find(
      i => i.materialId === req.body.materialId && i.type === req.body.type
    );
    
    if (existingItem) {
      existingItem.quantity += req.body.quantity;
      existingItem.updatedAt = now;
    } else {
      repair.items.push({
        id: uuidv4(),
        materialId: req.body.materialId,
        type: req.body.type,
        quantity: req.body.quantity,
        unitPrice: req.body.unitPrice || 0,
        note: req.body.note,
        createdAt: now,
        updatedAt: now
      });
    }
    
    const discrepancyAnalysis = analyzeDiscrepancy(repair);
    repair.hasDiscrepancy = discrepancyAnalysis.hasIssues;
    repair.updatedAt = now;
    
    if (!repair.history) repair.history = [];
    repair.history.push({
      id: uuidv4(),
      action: req.body.type === 'claim' ? '领用材料' : '退回材料',
      actor: req.body.actor || '系统',
      timestamp: now,
      details: {
        materialId: req.body.materialId,
        quantity: req.body.quantity,
        type: req.body.type
      }
    });
    
    repairs[index] = repair;
    await writeData('repairs.json', repairs);
    
    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/repairs/:id/items/:itemId', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const index = repairs.findIndex(r => r.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: '维修单不存在' });
    }
    
    const repair = repairs[index];
    const itemIndex = repair.items.findIndex(i => i.id === req.params.itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: '材料记录不存在' });
    }
    
    const item = repair.items[itemIndex];
    repair.items.splice(itemIndex, 1);
    
    const discrepancyAnalysis = analyzeDiscrepancy(repair);
    repair.hasDiscrepancy = discrepancyAnalysis.hasIssues;
    repair.updatedAt = new Date().toISOString();
    
    if (!repair.history) repair.history = [];
    repair.history.push({
      id: uuidv4(),
      action: '删除材料记录',
      actor: req.body.actor || '系统',
      timestamp: new Date().toISOString(),
      details: {
        materialId: item.materialId,
        quantity: item.quantity,
        type: item.type
      }
    });
    
    repairs[index] = repair;
    await writeData('repairs.json', repairs);
    
    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/repairs/:id/confirm', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const index = repairs.findIndex(r => r.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: '维修单不存在' });
    }
    
    const now = new Date().toISOString();
    const repair = repairs[index];
    const discrepancyAnalysis = analyzeDiscrepancy(repair);
    
    repair.confirmedByStudent = req.body.studentName || '学生';
    repair.studentConfirmationDate = now;
    repair.hasDiscrepancy = discrepancyAnalysis.hasIssues;
    repair.discrepancyNote = req.body.discrepancyNote || null;
    
    if (discrepancyAnalysis.hasIssues) {
      repair.status = 'discrepancy';
    } else {
      repair.status = 'completed';
    }
    repair.updatedAt = now;
    
    if (!repair.history) repair.history = [];
    repair.history.push({
      id: uuidv4(),
      action: '学生确认',
      actor: req.body.studentName || '学生',
      timestamp: now,
      details: {
        hasDiscrepancy: discrepancyAnalysis.hasIssues,
        issues: discrepancyAnalysis.issues
      }
    });
    
    repairs[index] = repair;
    await writeData('repairs.json', repairs);
    
    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/repairs/:id/resolve', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const index = repairs.findIndex(r => r.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: '维修单不存在' });
    }
    
    const now = new Date().toISOString();
    const repair = repairs[index];
    
    repair.resolutionNote = req.body.resolutionNote;
    repair.resolvedAt = now;
    repair.status = 'completed';
    repair.updatedAt = now;
    
    if (!repair.history) repair.history = [];
    repair.history.push({
      id: uuidv4(),
      action: '异常处理完成',
      actor: req.body.actor || '管理员',
      timestamp: now,
      details: {
        resolutionNote: req.body.resolutionNote
      }
    });
    
    repairs[index] = repair;
    await writeData('repairs.json', repairs);
    
    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/materials', async (req, res) => {
  try {
    const materials = await readData('materials.json');
    const { category, keyword } = req.query;
    
    let filtered = materials;
    
    if (category && category !== 'all') {
      filtered = filtered.filter(m => m.category === category);
    }
    
    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter(m => 
        m.id.toLowerCase().includes(kw) ||
        m.name.toLowerCase().includes(kw) ||
        (m.specification || '').toLowerCase().includes(kw)
      );
    }
    
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials', async (req, res) => {
  try {
    const materials = await readData('materials.json');
    const id = await getNextId('material');
    const now = new Date().toISOString();
    
    const material = {
      id,
      name: req.body.name,
      category: req.body.category,
      specification: req.body.specification,
      unit: req.body.unit,
      unitPrice: req.body.unitPrice || 0,
      stock: req.body.stock || 0,
      description: req.body.description,
      createdAt: now,
      updatedAt: now
    };
    
    materials.push(material);
    await writeData('materials.json', materials);
    
    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/materials', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    const materials = await readData('materials.json');
    const now = new Date().toISOString();
    let added = 0;
    let updated = 0;
    
    for (const row of data) {
      const existing = materials.find(m => 
        m.name === row['名称'] || m.id === row['编号']
      );
      
      if (existing) {
        Object.assign(existing, {
          name: row['名称'] || existing.name,
          category: row['分类'] || existing.category,
          specification: row['规格'] || existing.specification,
          unit: row['单位'] || existing.unit,
          unitPrice: row['单价'] != null ? parseFloat(row['单价']) : existing.unitPrice,
          stock: row['库存'] != null ? parseFloat(row['库存']) : existing.stock,
          description: row['描述'] || existing.description,
          updatedAt: now
        });
        updated++;
      } else {
        const id = await getNextId('material');
        materials.push({
          id,
          name: row['名称'],
          category: row['分类'],
          specification: row['规格'],
          unit: row['单位'],
          unitPrice: row['单价'] != null ? parseFloat(row['单价']) : 0,
          stock: row['库存'] != null ? parseFloat(row['库存']) : 0,
          description: row['描述'],
          createdAt: now,
          updatedAt: now
        });
        added++;
      }
    }
    
    await writeData('materials.json', materials);
    
    res.json({
      success: true,
      message: `导入成功：新增 ${added} 条，更新 ${updated} 条`,
      added,
      updated
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/repairs', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    const repairs = await readData('repairs.json');
    const materials = await readData('materials.json');
    const students = await readData('students.json');
    const now = new Date().toISOString();
    
    let added = 0;
    
    for (const row of data) {
      let studentId = null;
      const existingStudent = students.find(s => 
        s.phone === row['学生电话'] || s.name === row['学生姓名']
      );
      
      if (existingStudent) {
        studentId = existingStudent.id;
      } else {
        const newStudent = {
          id: await getNextId('student'),
          name: row['学生姓名'],
          phone: row['学生电话'],
          dormBuilding: row['宿舍楼'],
          dormNumber: row['宿舍号'],
          createdAt: now
        };
        students.push(newStudent);
        studentId = newStudent.id;
      }
      
      const items = [];
      if (row['领用材料']) {
        const materialNames = row['领用材料'].split(/[,，]/);
        const quantities = (row['领用数量'] || '').split(/[,，]/);
        
        materialNames.forEach((name, idx) => {
          const material = materials.find(m => m.name === name.trim());
          if (material) {
            items.push({
              id: uuidv4(),
              materialId: material.id,
              type: 'claim',
              quantity: parseFloat(quantities[idx]) || 1,
              unitPrice: material.unitPrice,
              createdAt: now,
              updatedAt: now
            });
          }
        });
      }
      
      if (row['退回材料']) {
        const materialNames = row['退回材料'].split(/[,，]/);
        const quantities = (row['退回数量'] || '').split(/[,，]/);
        
        materialNames.forEach((name, idx) => {
          const material = materials.find(m => m.name === name.trim());
          if (material) {
            items.push({
              id: uuidv4(),
              materialId: material.id,
              type: 'return',
              quantity: parseFloat(quantities[idx]) || 1,
              unitPrice: material.unitPrice,
              createdAt: now,
              updatedAt: now
            });
          }
        });
      }
      
      const id = await getNextId('repair');
      const repair = {
        id,
        studentId,
        studentName: row['学生姓名'],
        studentPhone: row['学生电话'],
        dormBuilding: row['宿舍楼'],
        dormNumber: row['宿舍号'],
        repairType: row['维修类型'],
        description: row['问题描述'],
        repairDate: row['维修日期'],
        workerName: row['维修人员'],
        items,
        status: row['状态'] || 'pending_verification',
        confirmedByStudent: null,
        studentConfirmationDate: null,
        hasDiscrepancy: false,
        discrepancyNote: null,
        resolutionNote: null,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
        history: [{
          id: uuidv4(),
          action: '批量导入创建',
          actor: '系统',
          timestamp: now,
          details: { source: 'import' }
        }]
      };
      
      repair.hasDiscrepancy = analyzeDiscrepancy(repair).hasIssues;
      repairs.push(repair);
      added++;
    }
    
    await writeData('repairs.json', repairs);
    await writeData('students.json', students);
    
    res.json({
      success: true,
      message: `导入成功：新增 ${added} 条维修单`,
      added
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/repairs', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const materials = await readData('materials.json');
    const materialMap = new Map(materials.map(m => [m.id, m]));
    
    const { status, startDate, endDate } = req.query;
    let filtered = repairs;
    
    if (status && status !== 'all') {
      filtered = filtered.filter(r => r.status === status);
    }
    
    if (startDate) {
      filtered = filtered.filter(r => 
        new Date(r.createdAt) >= new Date(startDate)
      );
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => 
        new Date(r.createdAt) <= end
      );
    }
    
    const exportData = filtered.map(r => {
      const claimItems = r.items.filter(i => i.type === 'claim');
      const returnItems = r.items.filter(i => i.type === 'return');
      
      return {
        '维修单编号': r.id,
        '学生姓名': r.studentName,
        '学生电话': r.studentPhone,
        '宿舍楼': r.dormBuilding,
        '宿舍号': r.dormNumber,
        '维修类型': r.repairType,
        '问题描述': r.description,
        '维修日期': r.repairDate,
        '维修人员': r.workerName,
        '领用材料': claimItems.map(i => materialMap.get(i.materialId)?.name || i.materialId).join('、'),
        '领用数量': claimItems.map(i => i.quantity).join('、'),
        '退回材料': returnItems.map(i => materialMap.get(i.materialId)?.name || i.materialId).join('、'),
        '退回数量': returnItems.map(i => i.quantity).join('、'),
        '状态': getStatusText(r.status),
        '是否有差异': r.hasDiscrepancy ? '是' : '否',
        '创建时间': r.createdAt,
        '确认时间': r.studentConfirmationDate || ''
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '维修单');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=repairs_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/materials', async (req, res) => {
  try {
    const materials = await readData('materials.json');
    
    const exportData = materials.map(m => ({
      '编号': m.id,
      '名称': m.name,
      '分类': m.category,
      '规格': m.specification,
      '单位': m.unit,
      '单价': m.unitPrice,
      '库存': m.stock,
      '描述': m.description
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '材料清单');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=materials_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/summary', async (req, res) => {
  try {
    const repairs = await readData('repairs.json');
    const materials = await readData('materials.json');
    const materialMap = new Map(materials.map(m => [m.id, m]));
    
    const { startDate, endDate, dormBuilding } = req.query;
    let filtered = repairs;
    
    if (dormBuilding) {
      filtered = filtered.filter(r => r.dormBuilding === dormBuilding);
    }
    
    if (startDate) {
      filtered = filtered.filter(r => 
        new Date(r.createdAt) >= new Date(startDate)
      );
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => 
        new Date(r.createdAt) <= end
      );
    }
    
    let totalClaimAmount = 0;
    let totalReturnAmount = 0;
    const materialUsage = {};
    const repairTypeStats = {};
    const dormStats = {};
    
    for (const repair of filtered) {
      if (repair.repairType) {
        repairTypeStats[repair.repairType] = (repairTypeStats[repair.repairType] || 0) + 1;
      }
      
      if (repair.dormBuilding) {
        if (!dormStats[repair.dormBuilding]) {
          dormStats[repair.dormBuilding] = { count: 0, amount: 0 };
        }
        dormStats[repair.dormBuilding].count++;
      }
      
      for (const item of repair.items) {
        const material = materialMap.get(item.materialId);
        const name = material?.name || item.materialId;
        const price = item.unitPrice || material?.unitPrice || 0;
        const amount = item.quantity * price;
        
        if (item.type === 'claim') {
          totalClaimAmount += amount;
          if (!materialUsage[name]) {
            materialUsage[name] = { claimQty: 0, returnQty: 0, claimAmount: 0, returnAmount: 0 };
          }
          materialUsage[name].claimQty += item.quantity;
          materialUsage[name].claimAmount += amount;
        } else {
          totalReturnAmount += amount;
          if (!materialUsage[name]) {
            materialUsage[name] = { claimQty: 0, returnQty: 0, claimAmount: 0, returnAmount: 0 };
          }
          materialUsage[name].returnQty += item.quantity;
          materialUsage[name].returnAmount += amount;
        }
      }
    }
    
    const statusStats = {
      pending_verification: 0,
      discrepancy: 0,
      completed: 0
    };
    
    filtered.forEach(r => {
      statusStats[r.status] = (statusStats[r.status] || 0) + 1;
    });
    
    const netAmount = totalClaimAmount - totalReturnAmount;
    const discrepancyCount = filtered.filter(r => r.hasDiscrepancy).length;
    const discrepancyRate = filtered.length > 0 ? (discrepancyCount / filtered.length * 100).toFixed(1) : 0;
    
    const topMaterials = Object.entries(materialUsage)
      .map(([name, stats]) => ({
        name,
        ...stats,
        netQty: stats.claimQty - stats.returnQty,
        netAmount: stats.claimAmount - stats.returnAmount
      }))
      .sort((a, b) => b.netAmount - a.netAmount)
      .slice(0, 10);
    
    res.json({
      period: { startDate, endDate },
      totalRepairs: filtered.length,
      statusStats,
      discrepancyCount,
      discrepancyRate: `${discrepancyRate}%`,
      totalClaimAmount: totalClaimAmount.toFixed(2),
      totalReturnAmount: totalReturnAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
      topMaterials,
      repairTypeStats,
      dormStats: Object.entries(dormStats).map(([dorm, stats]) => ({
        dorm,
        ...stats
      })).sort((a, b) => b.count - a.count)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const students = await readData('students.json');
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const students = await readData('students.json');
    const student = students.find(s => s.id === req.params.id);
    if (!student) {
      return res.status(404).json({ error: '学生不存在' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function analyzeDiscrepancy(repair) {
  const issues = [];
  const claimItems = repair.items.filter(i => i.type === 'claim');
  const returnItems = repair.items.filter(i => i.type === 'return');
  
  for (const returnItem of returnItems) {
    const matchingClaim = claimItems.find(
      c => c.materialId === returnItem.materialId
    );
    const claimQty = matchingClaim?.quantity || 0;
    
    if (returnItem.quantity > claimQty) {
      issues.push({
        type: 'return_exceeds_claim',
        materialId: returnItem.materialId,
        message: `退料数量(${returnItem.quantity})超过领用数量(${claimQty})`
      });
    }
  }
  
  if (returnItems.length > 0 && claimItems.length === 0) {
    issues.push({
      type: 'return_without_claim',
      message: '存在退料记录但没有领用记录'
    });
  }
  
  const duplicateMaterials = {};
  for (const item of repair.items) {
    const key = `${item.materialId}-${item.type}`;
    if (!duplicateMaterials[key]) {
      duplicateMaterials[key] = { count: 0, items: [] };
    }
    duplicateMaterials[key].count++;
    duplicateMaterials[key].items.push(item);
  }
  
  for (const [key, data] of Object.entries(duplicateMaterials)) {
    if (data.count > 1) {
      const [materialId, type] = key.split('-');
      issues.push({
        type: 'duplicate_entries',
        materialId,
        message: `${type === 'claim' ? '领用' : '退料'}存在多条相同材料记录，共${data.count}条`
      });
    }
  }
  
  const totalClaim = claimItems.reduce((sum, i) => sum + (i.unitPrice || 0) * i.quantity, 0);
  const totalReturn = returnItems.reduce((sum, i) => sum + (i.unitPrice || 0) * i.quantity, 0);
  
  if (totalClaim === 0 && totalReturn === 0 && repair.items.length > 0) {
    issues.push({
      type: 'missing_prices',
      message: '存在材料记录但缺少单价信息'
    });
  }
  
  return {
    hasIssues: issues.length > 0,
    issues,
    totals: {
      claimCount: claimItems.length,
      returnCount: returnItems.length,
      totalClaim,
      totalReturn,
      net: totalClaim - totalReturn
    }
  };
}

function getStatusText(status) {
  const statusMap = {
    pending_verification: '待确认',
    discrepancy: '异常待处理',
    completed: '已完成'
  };
  return statusMap[status] || status;
}

async function initSampleData() {
  await ensureDataDir();
  
  const materials = await readData('materials.json');
  if (materials.length === 0) {
    const sampleMaterials = [
      { id: 'CL240001', name: '水龙头阀芯', category: '水暖', specification: '通用型', unit: '个', unitPrice: 25, stock: 50 },
      { id: 'CL240002', name: 'LED灯珠', category: '电器', specification: '5W', unit: '个', unitPrice: 15, stock: 100 },
      { id: 'CL240003', name: '门锁', category: '五金', specification: '球形锁', unit: '把', unitPrice: 45, stock: 20 },
      { id: 'CL240004', name: 'PVC水管', category: '水暖', specification: 'DN20', unit: '米', unitPrice: 12, stock: 100 },
      { id: 'CL240005', name: '生料带', category: '水暖', specification: '标准', unit: '卷', unitPrice: 3, stock: 200 },
      { id: 'CL240006', name: '开关面板', category: '电器', specification: '单开', unit: '个', unitPrice: 18, stock: 50 },
      { id: 'CL240007', name: '合页', category: '五金', specification: '4寸', unit: '副', unitPrice: 22, stock: 30 },
      { id: 'CL240008', name: '玻璃胶', category: '耗材', specification: '中性', unit: '支', unitPrice: 15, stock: 40 }
    ];
    
    for (const m of sampleMaterials) {
      const now = new Date().toISOString();
      await writeData('meta.json', { counters: { material: parseInt(m.id.slice(-4)) } });
    }
    
    await writeData('materials.json', sampleMaterials.map(m => ({
      ...m,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })));
    await writeData('meta.json', { counters: { material: 8, repair: 0, student: 0, report: 0 } });
  }
  
  const repairs = await readData('repairs.json');
  if (repairs.length === 0) {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString();
    
    const sampleRepairs = [
      {
        id: 'WX240001',
        studentId: 'XS240001',
        studentName: '张三',
        studentPhone: '13800138001',
        dormBuilding: '1号楼',
        dormNumber: '301',
        repairType: '水暖维修',
        description: '水龙头漏水',
        repairDate: twoDaysAgo.split('T')[0],
        workerName: '李师傅',
        items: [
          { id: uuidv4(), materialId: 'CL240001', type: 'claim', quantity: 1, unitPrice: 25, createdAt: twoDaysAgo, updatedAt: twoDaysAgo },
          { id: uuidv4(), materialId: 'CL240005', type: 'claim', quantity: 1, unitPrice: 3, createdAt: twoDaysAgo, updatedAt: twoDaysAgo }
        ],
        status: 'completed',
        confirmedByStudent: '张三',
        studentConfirmationDate: yesterday,
        hasDiscrepancy: false,
        createdAt: twoDaysAgo,
        updatedAt: yesterday,
        history: [
          { id: uuidv4(), action: '创建维修单', actor: '李师傅', timestamp: twoDaysAgo, details: { repairType: '水暖维修', dorm: '1号楼-301' } },
          { id: uuidv4(), action: '学生确认', actor: '张三', timestamp: yesterday, details: { hasDiscrepancy: false } }
        ]
      },
      {
        id: 'WX240002',
        studentId: 'XS240002',
        studentName: '李四',
        studentPhone: '13800138002',
        dormBuilding: '2号楼',
        dormNumber: '502',
        repairType: '电器维修',
        description: '房间灯不亮',
        repairDate: yesterday.split('T')[0],
        workerName: '王师傅',
        items: [
          { id: uuidv4(), materialId: 'CL240002', type: 'claim', quantity: 2, unitPrice: 15, createdAt: yesterday, updatedAt: yesterday }
        ],
        status: 'pending_verification',
        confirmedByStudent: null,
        studentConfirmationDate: null,
        hasDiscrepancy: false,
        createdAt: yesterday,
        updatedAt: yesterday,
        history: [
          { id: uuidv4(), action: '创建维修单', actor: '王师傅', timestamp: yesterday, details: { repairType: '电器维修', dorm: '2号楼-502' } }
        ]
      },
      {
        id: 'WX240003',
        studentId: 'XS240003',
        studentName: '王五',
        studentPhone: '13800138003',
        dormBuilding: '1号楼',
        dormNumber: '405',
        repairType: '五金维修',
        description: '门锁损坏',
        repairDate: yesterday.split('T')[0],
        workerName: '李师傅',
        items: [
          { id: uuidv4(), materialId: 'CL240003', type: 'claim', quantity: 1, unitPrice: 45, createdAt: yesterday, updatedAt: yesterday },
          { id: uuidv4(), materialId: 'CL240003', type: 'return', quantity: 2, unitPrice: 45, createdAt: now, updatedAt: now }
        ],
        status: 'discrepancy',
        confirmedByStudent: '王五',
        studentConfirmationDate: now,
        hasDiscrepancy: true,
        discrepancyNote: '退料数量不对',
        createdAt: yesterday,
        updatedAt: now,
        history: [
          { id: uuidv4(), action: '创建维修单', actor: '李师傅', timestamp: yesterday, details: { repairType: '五金维修', dorm: '1号楼-405' } },
          { id: uuidv4(), action: '学生确认', actor: '王五', timestamp: now, details: { hasDiscrepancy: true } }
        ]
      }
    ];
    
    await writeData('repairs.json', sampleRepairs);
    await writeData('meta.json', { counters: { material: 8, repair: 3, student: 3, report: 0 } });
    
    const students = [
      { id: 'XS240001', name: '张三', phone: '13800138001', dormBuilding: '1号楼', dormNumber: '301', createdAt: twoDaysAgo },
      { id: 'XS240002', name: '李四', phone: '13800138002', dormBuilding: '2号楼', dormNumber: '502', createdAt: yesterday },
      { id: 'XS240003', name: '王五', phone: '13800138003', dormBuilding: '1号楼', dormNumber: '405', createdAt: yesterday }
    ];
    await writeData('students.json', students);
  }
}

initSampleData().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
});