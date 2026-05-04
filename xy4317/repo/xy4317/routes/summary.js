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

    const households = await storage.getHouseholdsByBuilding(building.id);
    const signatures = await storage.getSignatures();
    const buildingSignatures = signatures.filter(s => s.building_id === building.id);
    const constructionBatches = await storage.getConstructionBatches();
    const buildingBatches = constructionBatches.filter(cb => cb.building_id === building.id);
    const complaints = await storage.getComplaints();
    const buildingComplaints = complaints.filter(c => c.building_id === building.id);

    const signatureSummary = await storage.getBuildingSignaturesSummary(building.id);
    const validationResult = await validation.runAllValidations({ buildingId: building.id });

    const totalHouseholds = households.length;
    const signedCount = buildingSignatures.length;
    const agreeCount = buildingSignatures.filter(s => s.is_agree).length;
    const opposeCount = buildingSignatures.filter(s => !s.is_agree).length;
    const unsignedCount = totalHouseholds - signedCount;

    const signatureRatio = totalHouseholds > 0 ? signedCount / totalHouseholds : 0;
    const agreeRatio = signedCount > 0 ? agreeCount / signedCount : 0;

    const byFloor = {};
    for (const household of households) {
      if (!byFloor[household.floor]) {
        byFloor[household.floor] = {
          floor: household.floor,
          total: 0,
          signed: 0,
          agree: 0,
          oppose: 0,
          units: []
        };
      }
      byFloor[household.floor].total++;
      
      const sig = buildingSignatures.find(s => s.household_id === household.id);
      if (sig) {
        byFloor[household.floor].signed++;
        if (sig.is_agree) {
          byFloor[household.floor].agree++;
        } else {
          byFloor[household.floor].oppose++;
        }
      }
      
      byFloor[household.floor].units.push({
        unit_number: household.unit_number,
        owner_name: household.owner_name,
        phone: household.phone,
        area: household.area,
        is_signed: !!sig,
        is_agree: sig ? sig.is_agree : null,
        signature_date: sig ? sig.signature_date : null
      });
    }

    const floorSummary = Object.values(byFloor).sort((a, b) => a.floor - b.floor);

    const lowFloorThreshold = 3;
    const lowFloors = floorSummary.filter(f => f.floor <= lowFloorThreshold);
    const lowFloorOppose = lowFloors.reduce((sum, f) => sum + f.oppose, 0);
    const hasLowFloorOpposition = lowFloorOppose > 0;

    const summary = {
      building_info: {
        id: building.id,
        building_code: building.building_code,
        building_name: building.building_name,
        total_floors: building.total_floors,
        units_per_floor: building.units_per_floor,
        total_units: building.total_units
      },
      households_summary: {
        total: totalHouseholds,
        by_floor: floorSummary.map(f => ({
          floor: f.floor,
          total: f.total,
          signed: f.signed,
          agree: f.agree,
          oppose: f.oppose,
          ratio: f.total > 0 ? (f.signed / f.total).toFixed(2) : '0.00'
        }))
      },
      signatures_summary: {
        total_signed: signedCount,
        total_unsigned: unsignedCount,
        agree_count: agreeCount,
        oppose_count: opposeCount,
        signature_ratio: signatureRatio.toFixed(2),
        agree_ratio: agreeRatio.toFixed(2),
        meets_requirement: signatureRatio >= 0.7
      },
      low_floor_status: {
        threshold: lowFloorThreshold,
        has_opposition: hasLowFloorOpposition,
        oppose_count: lowFloorOppose,
        details: lowFloors.map(f => ({
          floor: f.floor,
          oppose_count: f.oppose
        }))
      },
      construction_status: {
        total_batches: buildingBatches.length,
        batches: buildingBatches.map(batch => ({
          id: batch.id,
          batch_name: batch.batch_name,
          start_date: batch.start_date,
          end_date: batch.end_date,
          work_hours: `${batch.work_hours_start} - ${batch.work_hours_end}`,
          status: batch.status
        }))
      },
      complaints_status: {
        total: buildingComplaints.length,
        pending: buildingComplaints.filter(c => c.status === 'pending').length,
        resolved: buildingComplaints.filter(c => c.status === 'resolved').length,
        by_type: groupBy(buildingComplaints, 'complaint_type')
      },
      validation: validationResult,
      detailed_units: floorSummary
    };

    res.json({
      message: '方案汇总生成成功',
      summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/all-buildings', async (req, res) => {
  try {
    const buildings = await storage.getBuildings();
    const signatures = await storage.getSignatures();
    const constructionBatches = await storage.getConstructionBatches();
    const complaints = await storage.getComplaints();

    const summaries = [];

    for (const building of buildings) {
      const households = await storage.getHouseholdsByBuilding(building.id);
      const buildingSignatures = signatures.filter(s => s.building_id === building.id);
      const buildingBatches = constructionBatches.filter(cb => cb.building_id === building.id);
      const buildingComplaints = complaints.filter(c => c.building_id === building.id);

      const totalHouseholds = households.length;
      const signedCount = buildingSignatures.length;
      const agreeCount = buildingSignatures.filter(s => s.is_agree).length;
      const opposeCount = buildingSignatures.filter(s => !s.is_agree).length;

      const signatureRatio = totalHouseholds > 0 ? signedCount / totalHouseholds : 0;

      summaries.push({
        building_info: {
          id: building.id,
          building_code: building.building_code,
          building_name: building.building_name
        },
        summary: {
          total_households: totalHouseholds,
          signed_count: signedCount,
          agree_count: agreeCount,
          oppose_count: opposeCount,
          signature_ratio: signatureRatio.toFixed(2),
          meets_requirement: signatureRatio >= 0.7,
          construction_batches: buildingBatches.length,
          complaints: buildingComplaints.length
        }
      });
    }

    res.json({
      message: '所有楼栋汇总成功',
      total_buildings: buildings.length,
      summaries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const buildings = await storage.getBuildings();
    const signatures = await storage.getSignatures();
    const constructionBatches = await storage.getConstructionBatches();
    const complaints = await storage.getComplaints();

    let totalHouseholds = 0;
    for (const building of buildings) {
      const households = await storage.getHouseholdsByBuilding(building.id);
      totalHouseholds += households.length;
    }

    const signedCount = signatures.length;
    const agreeCount = signatures.filter(s => s.is_agree).length;
    const opposeCount = signatures.filter(s => !s.is_agree).length;

    const buildingsWithEnoughSignatures = [];
    for (const building of buildings) {
      const households = await storage.getHouseholdsByBuilding(building.id);
      const buildingSignatures = signatures.filter(s => s.building_id === building.id);
      const ratio = households.length > 0 ? buildingSignatures.length / households.length : 0;
      if (ratio >= 0.7) {
        buildingsWithEnoughSignatures.push({
          id: building.id,
          building_code: building.building_code,
          building_name: building.building_name,
          ratio: ratio.toFixed(2)
        });
      }
    }

    const pendingComplaints = complaints.filter(c => c.status === 'pending');

    res.json({
      message: '仪表板数据获取成功',
      dashboard: {
        overview: {
          total_buildings: buildings.length,
          total_households: totalHouseholds,
          total_signatures: signedCount,
          total_construction_batches: constructionBatches.length,
          total_complaints: complaints.length
        },
        signatures: {
          total_signed: signedCount,
          agree_count: agreeCount,
          oppose_count: opposeCount,
          agree_ratio: signedCount > 0 ? (agreeCount / signedCount).toFixed(2) : '0.00'
        },
        progress: {
          buildings_ready: buildingsWithEnoughSignatures.length,
          buildings_pending: buildings.length - buildingsWithEnoughSignatures.length,
          ready_buildings: buildingsWithEnoughSignatures
        },
        issues: {
          pending_complaints: pendingComplaints.length,
          pending_complaints_list: pendingComplaints.map(c => ({
            id: c.id,
            building_code: c.building_code,
            building_name: c.building_name,
            unit_number: c.unit_number,
            complaint_type: c.complaint_type,
            complaint_date: c.complaint_date,
            description: c.description
          }))
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function groupBy(array, key) {
  return array.reduce((result, item) => {
    (result[item[key]] = result[item[key]] || []).push(item);
    return result;
  }, {});
}

module.exports = router;
