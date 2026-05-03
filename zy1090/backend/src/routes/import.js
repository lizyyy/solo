import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

const router = Router();
const prisma = new PrismaClient();

function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString());
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

router.post('/materials', async (req, res, next) => {
  try {
    const { format, data } = req.body;

    if (!data) {
      return res.status(400).json({ error: '请提供导入数据' });
    }

    let records = [];

    if (format === 'csv') {
      try {
        const buffer = Buffer.from(data, 'base64');
        records = await parseCSV(buffer);
      } catch (error) {
        return res.status(400).json({ error: 'CSV 解析失败', details: error.message });
      }
    } else if (format === 'json') {
      try {
        records = typeof data === 'string' ? JSON.parse(data) : data;
        if (!Array.isArray(records)) {
          records = [records];
        }
      } catch (error) {
        return res.status(400).json({ error: 'JSON 解析失败', details: error.message });
      }
    } else {
      return res.status(400).json({ error: '不支持的导入格式，请使用 csv 或 json' });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: '没有找到可导入的记录' });
    }

    const results = {
      total: records.length,
      success: 0,
      failed: 0,
      errors: [],
      created: []
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 1;

      try {
        const name = record.name || record.名称 || record.material_name;
        const unit = record.unit || record.单位 || record.unit_name;
        const allergens = record.allergens || record.过敏原 || '';
        const description = record.description || record.描述 || '';
        const note = record.note || record.备注 || '';

        if (!name || name.trim() === '') {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            record,
            error: '材料名称不能为空'
          });
          continue;
        }

        if (!unit || unit.trim() === '') {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            record,
            error: '单位不能为空'
          });
          continue;
        }

        const existing = await prisma.material.findFirst({
          where: { name: name.trim() }
        });

        if (existing) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            record,
            error: '材料名称已存在'
          });
          continue;
        }

        const material = await prisma.material.create({
          data: {
            name: name.trim(),
            unit: unit.trim(),
            allergens: allergens ? String(allergens).trim() : null,
            description: description ? String(description).trim() : null,
            note: note ? String(note).trim() : null
          }
        });

        results.success++;
        results.created.push(material);
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          record,
          error: error.message
        });
      }
    }

    res.json({
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

router.post('/material-batches', async (req, res, next) => {
  try {
    const { format, data } = req.body;

    if (!data) {
      return res.status(400).json({ error: '请提供导入数据' });
    }

    let records = [];

    if (format === 'csv') {
      try {
        const buffer = Buffer.from(data, 'base64');
        records = await parseCSV(buffer);
      } catch (error) {
        return res.status(400).json({ error: 'CSV 解析失败', details: error.message });
      }
    } else if (format === 'json') {
      try {
        records = typeof data === 'string' ? JSON.parse(data) : data;
        if (!Array.isArray(records)) {
          records = [records];
        }
      } catch (error) {
        return res.status(400).json({ error: 'JSON 解析失败', details: error.message });
      }
    } else {
      return res.status(400).json({ error: '不支持的导入格式，请使用 csv 或 json' });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: '没有找到可导入的记录' });
    }

    const materials = await prisma.material.findMany();
    const materialMap = new Map(materials.map(m => [m.name, m.id]));

    const suppliers = await prisma.supplier.findMany();
    const supplierMap = new Map(suppliers.map(s => [s.name, s.id]));

    const results = {
      total: records.length,
      success: 0,
      failed: 0,
      errors: [],
      created: []
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 1;

      try {
        const materialName = record.materialName || record.material_name || record.材料名称;
        const batchNumber = record.batchNumber || record.batch_number || record.批次号;
        const quantity = parseFloat(record.quantity || record.数量 || record.qty || 0);
        const unitPrice = parseFloat(record.unitPrice || record.unit_price || record.单价 || 0);
        const totalPrice = parseFloat(record.totalPrice || record.total_price || record.总价 || (quantity * unitPrice));
        const unit = record.unit || record.单位 || 'g';
        const receivedDate = record.receivedDate || record.received_date || record.入库日期;
        const expiryDate = record.expiryDate || record.expiry_date || record.有效期;
        const allergens = record.allergens || record.过敏原 || '';
        const note = record.note || record.备注 || '';
        const supplierName = record.supplierName || record.supplier_name || record.供应商名称;

        if (!materialName || materialName.trim() === '') {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            record,
            error: '材料名称不能为空'
          });
          continue;
        }

        if (!batchNumber || batchNumber.trim() === '') {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            record,
            error: '批次号不能为空'
          });
          continue;
        }

        if (quantity <= 0) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            record,
            error: '数量必须大于 0'
          });
          continue;
        }

        let materialId = materialMap.get(materialName.trim());
        if (!materialId) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            record,
            error: `材料 "${materialName}" 不存在，请先创建材料`
          });
          continue;
        }

        const existingBatch = await prisma.materialBatch.findFirst({
          where: { batchNumber: batchNumber.trim() }
        });

        if (existingBatch) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            record,
            error: `批次号 "${batchNumber}" 已存在`
          });
          continue;
        }

        let supplierId = null;
        if (supplierName && supplierName.trim() !== '') {
          supplierId = supplierMap.get(supplierName.trim());
        }

        const batch = await prisma.materialBatch.create({
          data: {
            materialId,
            supplierId,
            batchNumber: batchNumber.trim(),
            quantity,
            remainingQuantity: quantity,
            unitPrice,
            totalPrice,
            unit: unit.trim(),
            receivedDate: receivedDate ? new Date(receivedDate) : null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            allergens: allergens ? String(allergens).trim() : null,
            note: note ? String(note).trim() : null,
            status: 'active'
          },
          include: {
            material: true,
            supplier: true
          }
        });

        results.success++;
        results.created.push(batch);
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          record,
          error: error.message
        });
      }
    }

    res.json({
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

router.get('/templates', async (req, res, next) => {
  try {
    const templates = {
      materials: {
        description: '材料导入模板',
        fields: [
          { name: 'name', label: '材料名称', required: true },
          { name: 'unit', label: '单位', required: true, examples: 'g, ml, 个, 盒' },
          { name: 'allergens', label: '过敏原', required: false, examples: '蜂产品, 香精, 柑橘类' },
          { name: 'description', label: '描述', required: false },
          { name: 'note', label: '备注', required: false }
        ],
        example: {
          json: [
            { name: '大豆蜡', unit: 'g', allergens: '', description: '纯天然大豆蜡', note: '常用材料' },
            { name: '薰衣草香精', unit: 'ml', allergens: '香精', description: '法国进口', note: '' }
          ],
          csv: 'name,unit,allergens,description,note\n大豆蜡,g,,纯天然大豆蜡,常用材料\n薰衣草香精,ml,香精,法国进口,'
        }
      },
      materialBatches: {
        description: '材料批次导入模板',
        fields: [
          { name: 'materialName', label: '材料名称', required: true, note: '必须是已存在的材料名称' },
          { name: 'batchNumber', label: '批次号', required: true },
          { name: 'quantity', label: '数量', required: true, type: 'number' },
          { name: 'unitPrice', label: '单价', required: false, type: 'number' },
          { name: 'totalPrice', label: '总价', required: false, type: 'number' },
          { name: 'unit', label: '单位', required: true, examples: 'g, ml, 个, 盒' },
          { name: 'receivedDate', label: '入库日期', required: false, examples: '2024-01-01' },
          { name: 'expiryDate', label: '有效期', required: false, examples: '2026-12-31' },
          { name: 'allergens', label: '过敏原', required: false },
          { name: 'supplierName', label: '供应商名称', required: false, note: '必须是已存在的供应商名称' },
          { name: 'note', label: '备注', required: false }
        ],
        example: {
          json: [
            {
              materialName: '大豆蜡',
              batchNumber: 'WAX-2024-001',
              quantity: 5000,
              unitPrice: 0.05,
              totalPrice: 250,
              unit: 'g',
              receivedDate: '2024-01-15',
              expiryDate: '2026-01-15',
              allergens: '',
              supplierName: '天然蜡业有限公司',
              note: '优质大豆蜡'
            }
          ]
        }
      }
    };

    res.json({ data: templates });
  } catch (error) {
    next(error);
  }
});

export default router;
