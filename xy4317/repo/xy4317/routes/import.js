const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const storage = require('../models/storage');
const validation = require('../rules/validation');

const upload = multer({ dest: 'uploads/' });

router.post('/households/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择CSV文件' });
    }

    const { building_code, building_name } = req.body;
    
    if (!building_code || !building_name) {
      return res.status(400).json({ error: '请提供楼栋编码和楼栋名称' });
    }

    const results = [];
    const filePath = req.file.path;

    const parseCSV = () => {
      return new Promise((resolve, reject) => {
        const data = [];
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on('data', (row) => data.push(row))
          .on('end', () => resolve(data))
          .on('error', (err) => reject(err));
      });
    };

    const csvData = await parseCSV();

    let building = await storage.getBuildingByCode(building_code);
    
    if (!building) {
      const total_floors = Math.max(...csvData.map(row => parseInt(row['楼层'] || row['floor'] || 0)));
      const units_per_floor = csvData.length / total_floors;
      
      building = await storage.createBuilding({
        building_code,
        building_name,
        total_floors,
        units_per_floor: Math.ceil(units_per_floor),
        total_units: csvData.length
      });
    }

    const imported = [];
    const errors = [];
    const duplicates = [];

    for (const row of csvData) {
      try {
        const unitNumber = row['房号'] || row['unit_number'] || row['unit'];
        const floor = parseInt(row['楼层'] || row['floor'] || 0);
        const ownerName = row['业主姓名'] || row['owner_name'] || row['owner'];
        const phone = row['联系电话'] || row['phone'] || row['telephone'];
        const area = parseFloat(row['面积'] || row['area']) || null;

        if (!unitNumber) {
          errors.push({ row, error: '缺少房号信息' });
          continue;
        }

        const existingHousehold = await storage.getHouseholdByUnit(building.id, unitNumber);
        
        if (existingHousehold) {
          await storage.updateHousehold(existingHousehold.id, {
            owner_name: ownerName,
            phone,
            area
          });
          duplicates.push({ unitNumber, action: 'updated' });
        } else {
          await storage.createHousehold({
            building_id: building.id,
            unit_number: unitNumber,
            floor,
            owner_name: ownerName,
            phone,
            area
          });
          imported.push({ unitNumber, floor });
        }
      } catch (err) {
        errors.push({ row, error: err.message });
      }
    }

    fs.unlinkSync(filePath);

    res.json({
      message: '楼栋住户表导入完成',
      building: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name
      },
      summary: {
        total: csvData.length,
        imported: imported.length,
        updated: duplicates.length,
        errors: errors.length
      },
      imported,
      duplicates,
      errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/signatures/json', express.json(), async (req, res) => {
  try {
    const { building_code, signatures } = req.body;

    if (!building_code) {
      return res.status(400).json({ error: '请提供楼栋编码' });
    }

    if (!signatures || !Array.isArray(signatures)) {
      return res.status(400).json({ error: '请提供有效的签字数据数组' });
    }

    const building = await storage.getBuildingByCode(building_code);
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在，请先导入楼栋住户表' });
    }

    const imported = [];
    const duplicates = [];
    const errors = [];
    const validationErrors = [];

    for (const sig of signatures) {
      try {
        const unitNumber = sig.unit_number || sig.unitNumber || sig['房号'];
        const isAgree = sig.is_agree !== undefined ? sig.is_agree : sig.agree;
        const signatureDate = sig.signature_date || sig.signatureDate || sig['签字日期'];
        const notes = sig.notes || sig.remark || sig['备注'];

        if (!unitNumber) {
          errors.push({ signature: sig, error: '缺少房号信息' });
          continue;
        }

        const household = await storage.getHouseholdByUnit(building.id, unitNumber);
        
        if (!household) {
          errors.push({ signature: sig, error: `房号${unitNumber}不存在于该楼栋` });
          continue;
        }

        const dupCheck = await validation.checkDuplicateSignature(household.id);
        if (!dupCheck.valid) {
          validationErrors.push({
            unitNumber,
            rule: 'duplicate_signature_check',
            message: dupCheck.message,
            details: dupCheck.details
          });
          duplicates.push({ unitNumber, action: 'skipped_duplicate' });
          continue;
        }

        await storage.createSignature({
          household_id: household.id,
          is_agree: isAgree,
          signature_date: signatureDate,
          notes
        });

        imported.push({
          unitNumber,
          is_agree: isAgree,
          signature_date: signatureDate
        });
      } catch (err) {
        errors.push({ signature: sig, error: err.message });
      }
    }

    const buildingValidation = await validation.runAllValidations({
      buildingId: building.id
    });

    res.json({
      message: '签字意愿导入完成',
      building: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name
      },
      summary: {
        total: signatures.length,
        imported: imported.length,
        duplicates: duplicates.length,
        errors: errors.length
      },
      imported,
      duplicates,
      errors,
      validation_errors: validationErrors,
      building_validation: buildingValidation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/construction-batches', express.json(), async (req, res) => {
  try {
    const { building_code, batches } = req.body;

    if (!building_code) {
      return res.status(400).json({ error: '请提供楼栋编码' });
    }

    if (!batches || !Array.isArray(batches)) {
      return res.status(400).json({ error: '请提供有效的施工批次数组' });
    }

    const building = await storage.getBuildingByCode(building_code);
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在' });
    }

    const imported = [];
    const errors = [];
    const conflicts = [];

    for (const batch of batches) {
      try {
        const batchName = batch.batch_name || batch.batchName || batch['批次名称'];
        const startDate = batch.start_date || batch.startDate || batch['开始日期'];
        const endDate = batch.end_date || batch.endDate || batch['结束日期'];
        const workHoursStart = batch.work_hours_start || batch.workHoursStart || batch['工作开始时间'] || '08:00';
        const workHoursEnd = batch.work_hours_end || batch.workHoursEnd || batch['工作结束时间'] || '18:00';
        const status = batch.status || 'pending';

        if (!batchName || !startDate || !endDate) {
          errors.push({ batch, error: '缺少必要字段：批次名称、开始日期、结束日期' });
          continue;
        }

        const timeCheck = await validation.checkConstructionTimeConflict({
          start_date: startDate,
          end_date: endDate,
          work_hours_start: workHoursStart,
          work_hours_end: workHoursEnd
        }, {
          gaokao_dates: [
            { start: "2026-06-07", end: "2026-06-09" },
            { start: "2027-06-07", end: "2027-06-09" }
          ],
          night_hours: { start: "22:00", end: "06:00" },
          silent_periods: [
            { start: "12:00", end: "14:00", description: "午休时间" }
          ]
        });

        if (!timeCheck.valid) {
          conflicts.push({
            batch: batchName,
            ...timeCheck
          });
        }

        const createdBatch = await storage.createConstructionBatch({
          batch_name: batchName,
          building_id: building.id,
          start_date: startDate,
          end_date: endDate,
          work_hours_start: workHoursStart,
          work_hours_end: workHoursEnd,
          status
        });

        imported.push({
          ...createdBatch,
          has_conflicts: !timeCheck.valid
        });
      } catch (err) {
        errors.push({ batch, error: err.message });
      }
    }

    res.json({
      message: '施工批次导入完成',
      building: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name
      },
      summary: {
        total: batches.length,
        imported: imported.length,
        errors: errors.length,
        conflicts: conflicts.length
      },
      imported,
      errors,
      time_conflicts: conflicts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/complaints', express.json(), async (req, res) => {
  try {
    const { building_code, complaints } = req.body;

    if (!building_code) {
      return res.status(400).json({ error: '请提供楼栋编码' });
    }

    if (!complaints || !Array.isArray(complaints)) {
      return res.status(400).json({ error: '请提供有效的投诉记录数组' });
    }

    const building = await storage.getBuildingByCode(building_code);
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在' });
    }

    const imported = [];
    const errors = [];

    for (const complaint of complaints) {
      try {
        const unitNumber = complaint.unit_number || complaint.unitNumber || complaint['房号'];
        const complaintDate = complaint.complaint_date || complaint.complaintDate || complaint['投诉日期'];
        const complaintType = complaint.complaint_type || complaint.complaintType || complaint['投诉类型'];
        const description = complaint.description || complaint['描述'] || complaint['详情'];
        const status = complaint.status || 'pending';
        const resolution = complaint.resolution || complaint['处理结果'];

        if (!complaintDate || !complaintType || !description) {
          errors.push({ complaint, error: '缺少必要字段：投诉日期、投诉类型、描述' });
          continue;
        }

        let householdId = null;
        if (unitNumber) {
          const household = await storage.getHouseholdByUnit(building.id, unitNumber);
          if (household) {
            householdId = household.id;
          }
        }

        const createdComplaint = await storage.createComplaint({
          building_id: building.id,
          household_id: householdId,
          complaint_date: complaintDate,
          complaint_type: complaintType,
          description,
          status,
          resolution
        });

        imported.push({
          ...createdComplaint,
          unitNumber
        });
      } catch (err) {
        errors.push({ complaint, error: err.message });
      }
    }

    res.json({
      message: '投诉记录导入完成',
      building: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name
      },
      summary: {
        total: complaints.length,
        imported: imported.length,
        errors: errors.length
      },
      imported,
      errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
