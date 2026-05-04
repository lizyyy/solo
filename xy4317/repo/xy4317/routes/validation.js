const express = require('express');
const router = express.Router();
const storage = require('../models/storage');
const validation = require('../rules/validation');

router.get('/building/:building_code', async (req, res) => {
  try {
    const { building_code } = req.params;

    const building = await storage.getBuildingByCode(building_code);
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在' });
    }

    const results = await validation.runAllValidations({
      buildingId: building.id
    });

    res.json({
      message: '楼栋校验完成',
      building: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name
      },
      validation: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check/duplicate-signatures', express.json(), async (req, res) => {
  try {
    const { building_code, unit_numbers } = req.body;

    if (!building_code) {
      return res.status(400).json({ error: '请提供楼栋编码' });
    }

    const building = await storage.getBuildingByCode(building_code);
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在' });
    }

    const results = [];
    
    if (unit_numbers && Array.isArray(unit_numbers)) {
      for (const unitNumber of unit_numbers) {
        const household = await storage.getHouseholdByUnit(building.id, unitNumber);
        if (household) {
          const check = await validation.checkDuplicateSignature(household.id);
          results.push({
            unit_number: unitNumber,
            household_id: household.id,
            ...check
          });
        } else {
          results.push({
            unit_number: unitNumber,
            valid: false,
            rule: 'household_not_found',
            message: '该房号不存在于楼栋中'
          });
        }
      }
    } else {
      const households = await storage.getHouseholdsByBuilding(building.id);
      for (const household of households) {
        const check = await validation.checkDuplicateSignature(household.id);
        results.push({
          unit_number: household.unit_number,
          household_id: household.id,
          ...check
        });
      }
    }

    const duplicates = results.filter(r => !r.valid);

    res.json({
      message: '重复签字校验完成',
      building: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name
      },
      summary: {
        total: results.length,
        duplicates_found: duplicates.length
      },
      results,
      duplicates
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check/low-floor-opposition', express.json(), async (req, res) => {
  try {
    const { building_code, low_floor_threshold } = req.body;

    if (!building_code) {
      return res.status(400).json({ error: '请提供楼栋编码' });
    }

    const building = await storage.getBuildingByCode(building_code);
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在' });
    }

    const result = await validation.checkLowFloorOpposition(building.id, {
      low_floor_threshold: low_floor_threshold || 3
    });

    res.json({
      message: '低楼层反对检查完成',
      building: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name
      },
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check/construction-conflicts', express.json(), async (req, res) => {
  try {
    const { batch } = req.body;

    if (!batch) {
      return res.status(400).json({ error: '请提供施工批次信息' });
    }

    const result = await validation.checkConstructionTimeConflict(batch, {
      gaokao_dates: [
        { start: "2026-06-07", end: "2026-06-09" },
        { start: "2027-06-07", end: "2027-06-09" }
      ],
      night_hours: { start: "22:00", end: "06:00" },
      silent_periods: [
        { start: "12:00", end: "14:00", description: "午休时间" }
      ]
    });

    res.json({
      message: '施工时间冲突检查完成',
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/check/signature-ratio/:building_code', async (req, res) => {
  try {
    const { building_code } = req.params;
    const { required_ratio } = req.query;

    const building = await storage.getBuildingByCode(building_code);
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在' });
    }

    const result = await validation.checkSignatureRatio(building.id, {
      required_ratio: required_ratio ? parseFloat(required_ratio) : 0.7,
      required_by_floor: true
    });

    res.json({
      message: '签字比例检查完成',
      building: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name
      },
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conflict-review', express.json(), async (req, res) => {
  try {
    const { building_code, review_type, conflict_details, resolution } = req.body;

    if (!building_code || !review_type) {
      return res.status(400).json({ error: '请提供楼栋编码和复核类型' });
    }

    const building = await storage.getBuildingByCode(building_code);
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在' });
    }

    let reviewResult;
    
    switch (review_type) {
      case 'signature_duplicate':
        reviewResult = await validation.checkDuplicateSignature(
          conflict_details?.household_id
        );
        break;
      case 'low_floor_opposition':
        reviewResult = await validation.checkLowFloorOpposition(building.id, {
          low_floor_threshold: conflict_details?.threshold || 3
        });
        break;
      case 'construction_time':
        reviewResult = await validation.checkConstructionTimeConflict(
          conflict_details?.batch,
          conflict_details?.rule_config
        );
        break;
      default:
        return res.status(400).json({ error: '无效的复核类型' });
    }

    res.json({
      message: '冲突复核完成',
      building: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name
      },
      review_type,
      conflict_details,
      resolution,
      review_result: reviewResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
