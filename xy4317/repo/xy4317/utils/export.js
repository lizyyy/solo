const { Parser } = require('json2csv');
const storage = require('../models/storage');

const exportUtils = {
  exportBuildingSummary: async (buildingCode, format = 'json') => {
    const building = await storage.getBuildingByCode(buildingCode);
    
    if (!building) {
      throw new Error('楼栋不存在');
    }

    const households = await storage.getHouseholdsByBuilding(building.id);
    const signatures = await storage.getSignatures();
    const buildingSignatures = signatures.filter(s => s.building_id === building.id);
    const constructionBatches = await storage.getConstructionBatches();
    const buildingBatches = constructionBatches.filter(cb => cb.building_id === building.id);
    const complaints = await storage.getComplaints();
    const buildingComplaints = complaints.filter(c => c.building_id === building.id);

    const totalHouseholds = households.length;
    const signedCount = buildingSignatures.length;
    const agreeCount = buildingSignatures.filter(s => s.is_agree).length;
    const opposeCount = buildingSignatures.filter(s => !s.is_agree).length;

    const signatureRatio = totalHouseholds > 0 ? signedCount / totalHouseholds : 0;
    const agreeRatio = signedCount > 0 ? agreeCount / signedCount : 0;

    const householdDetails = households.map(h => {
      const sig = buildingSignatures.find(s => s.household_id === h.id);
      return {
        '楼栋编码': buildingCode,
        '楼栋名称': building.building_name,
        '楼层': h.floor,
        '房号': h.unit_number,
        '业主姓名': h.owner_name || '',
        '联系电话': h.phone || '',
        '面积': h.area || '',
        '是否签字': sig ? '是' : '否',
        '是否同意': sig ? (sig.is_agree ? '同意' : '反对') : '',
        '签字日期': sig ? sig.signature_date : '',
        '备注': sig ? (sig.notes || '') : ''
      };
    });

    const summaryData = {
      building_info: {
        building_code: buildingCode,
        building_name: building.building_name,
        total_floors: building.total_floors,
        total_units: building.total_units
      },
      summary: {
        total_households: totalHouseholds,
        signed_count: signedCount,
        unsigned_count: totalHouseholds - signedCount,
        agree_count: agreeCount,
        oppose_count: opposeCount,
        signature_ratio: (signatureRatio * 100).toFixed(1) + '%',
        agree_ratio: (agreeRatio * 100).toFixed(1) + '%',
        meets_requirement: signatureRatio >= 0.7 ? '是' : '否'
      },
      construction_batches: buildingBatches.map(b => ({
        batch_name: b.batch_name,
        start_date: b.start_date,
        end_date: b.end_date,
        work_hours: `${b.work_hours_start} - ${b.work_hours_end}`,
        status: b.status
      })),
      complaints: buildingComplaints.map(c => ({
        unit_number: c.unit_number || '',
        complaint_date: c.complaint_date,
        complaint_type: c.complaint_type,
        description: c.description,
        status: c.status,
        resolution: c.resolution || ''
      })),
      household_details: householdDetails
    };

    if (format === 'csv') {
      return {
        type: 'csv',
        data: {
          summary: exportUtils.jsonToCsv([summaryData.summary]),
          construction_batches: exportUtils.jsonToCsv(summaryData.construction_batches),
          complaints: exportUtils.jsonToCsv(summaryData.complaints),
          household_details: exportUtils.jsonToCsv(householdDetails)
        },
        filename: `楼栋汇总_${buildingCode}_${new Date().toISOString().split('T')[0]}`
      };
    }

    return {
      type: 'json',
      data: summaryData,
      filename: `楼栋汇总_${buildingCode}_${new Date().toISOString().split('T')[0]}.json`
    };
  },

  exportAllBuildings: async (format = 'json') => {
    const buildings = await storage.getBuildings();
    const signatures = await storage.getSignatures();
    const constructionBatches = await storage.getConstructionBatches();
    const complaints = await storage.getComplaints();

    const allSummaries = [];

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

      allSummaries.push({
        '楼栋编码': building.building_code,
        '楼栋名称': building.building_name,
        '总户数': totalHouseholds,
        '已签字数': signedCount,
        '未签字数': totalHouseholds - signedCount,
        '同意数': agreeCount,
        '反对数': opposeCount,
        '签字比例': (signatureRatio * 100).toFixed(1) + '%',
        '是否达标': signatureRatio >= 0.7 ? '是' : '否',
        '施工批次数': buildingBatches.length,
        '投诉数': buildingComplaints.length
      });
    }

    const data = {
      export_date: new Date().toISOString(),
      total_buildings: buildings.length,
      buildings: allSummaries
    };

    if (format === 'csv') {
      return {
        type: 'csv',
        data: exportUtils.jsonToCsv(allSummaries),
        filename: `所有楼栋汇总_${new Date().toISOString().split('T')[0]}`
      };
    }

    return {
      type: 'json',
      data,
      filename: `所有楼栋汇总_${new Date().toISOString().split('T')[0]}.json`
    };
  },

  exportSignatures: async (buildingCode, format = 'json') => {
    const building = await storage.getBuildingByCode(buildingCode);
    
    if (!building) {
      throw new Error('楼栋不存在');
    }

    const households = await storage.getHouseholdsByBuilding(building.id);
    const signatures = await storage.getSignatures();
    const buildingSignatures = signatures.filter(s => s.building_id === building.id);

    const signatureDetails = buildingSignatures.map(sig => ({
      '楼栋编码': buildingCode,
      '楼栋名称': building.building_name,
      '楼层': sig.floor,
      '房号': sig.unit_number,
      '是否同意': sig.is_agree ? '同意' : '反对',
      '签字日期': sig.signature_date,
      '备注': sig.notes || ''
    }));

    const data = {
      export_date: new Date().toISOString(),
      building_code: buildingCode,
      building_name: building.building_name,
      total_signatures: buildingSignatures.length,
      signatures: signatureDetails
    };

    if (format === 'csv') {
      return {
        type: 'csv',
        data: exportUtils.jsonToCsv(signatureDetails),
        filename: `签字记录_${buildingCode}_${new Date().toISOString().split('T')[0]}`
      };
    }

    return {
      type: 'json',
      data,
      filename: `签字记录_${buildingCode}_${new Date().toISOString().split('T')[0]}.json`
    };
  },

  exportValidationReport: async (buildingCode, format = 'json') => {
    const building = await storage.getBuildingByCode(buildingCode);
    
    if (!building) {
      throw new Error('楼栋不存在');
    }

    const households = await storage.getHouseholdsByBuilding(building.id);
    const signatures = await storage.getSignatures();
    const buildingSignatures = signatures.filter(s => s.building_id === building.id);
    const constructionBatches = await storage.getConstructionBatches();
    const buildingBatches = constructionBatches.filter(cb => cb.building_id === building.id);

    const lowFloorThreshold = 3;
    const lowFloors = households.filter(h => h.floor <= lowFloorThreshold);
    const lowFloorIds = lowFloors.map(h => h.id);
    const lowFloorSignatures = buildingSignatures.filter(s => lowFloorIds.includes(s.household_id));
    const lowFloorOppose = lowFloorSignatures.filter(s => !s.is_agree);

    const validationIssues = [];

    if (lowFloorOppose.length > 0) {
      validationIssues.push({
        type: 'low_floor_opposition',
        severity: 'warning',
        message: `检测到${lowFloorOppose.length}户低楼层住户反对`,
        details: lowFloorOppose.map(s => ({
          unit_number: s.unit_number,
          floor: s.floor,
          signature_date: s.signature_date
        }))
      });
    }

    const totalHouseholds = households.length;
    const signatureRatio = totalHouseholds > 0 ? buildingSignatures.length / totalHouseholds : 0;
    
    if (signatureRatio < 0.7) {
      validationIssues.push({
        type: 'signature_ratio',
        severity: 'error',
        message: `签字比例${(signatureRatio * 100).toFixed(1)}%未达到70%要求`,
        details: {
          current_ratio: (signatureRatio * 100).toFixed(1) + '%',
          required_ratio: '70%',
          missing_signatures: totalHouseholds - buildingSignatures.length
        }
      });
    }

    const timeConflictBatches = buildingBatches.filter(b => {
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      const gaokaoStart2026 = new Date('2026-06-07');
      const gaokaoEnd2026 = new Date('2026-06-09');
      const gaokaoStart2027 = new Date('2027-06-07');
      const gaokaoEnd2027 = new Date('2027-06-09');
      
      return (startDate <= gaokaoEnd2026 && endDate >= gaokaoStart2026) ||
             (startDate <= gaokaoEnd2027 && endDate >= gaokaoStart2027) ||
             b.work_hours_start < '06:00' ||
             b.work_hours_end > '22:00';
    });

    if (timeConflictBatches.length > 0) {
      validationIssues.push({
        type: 'construction_time_conflict',
        severity: 'warning',
        message: `检测到${timeConflictBatches.length}个施工批次存在时间冲突`,
        details: timeConflictBatches.map(b => ({
          batch_name: b.batch_name,
          start_date: b.start_date,
          end_date: b.end_date,
          work_hours: `${b.work_hours_start} - ${b.work_hours_end}`
        }))
      });
    }

    const report = {
      report_date: new Date().toISOString(),
      building_info: {
        building_code: buildingCode,
        building_name: building.building_name,
        total_floors: building.total_floors,
        total_units: building.total_units
      },
      summary: {
        total_issues: validationIssues.length,
        errors: validationIssues.filter(i => i.severity === 'error').length,
        warnings: validationIssues.filter(i => i.severity === 'warning').length,
        status: validationIssues.filter(i => i.severity === 'error').length > 0 ? '不通过' : '通过'
      },
      issues: validationIssues,
      statistics: {
        total_households: totalHouseholds,
        signed_count: buildingSignatures.length,
        signature_ratio: (signatureRatio * 100).toFixed(1) + '%',
        low_floor_households: lowFloors.length,
        low_floor_oppose: lowFloorOppose.length,
        construction_batches: buildingBatches.length
      }
    };

    if (format === 'csv') {
      const csvData = validationIssues.map(issue => ({
        '问题类型': issue.type,
        '严重程度': issue.severity === 'error' ? '错误' : '警告',
        '描述': issue.message,
        '详情': JSON.stringify(issue.details)
      }));

      return {
        type: 'csv',
        data: {
          summary: exportUtils.jsonToCsv([{
            '报告日期': report.report_date,
            '楼栋编码': buildingCode,
            '楼栋名称': building.building_name,
            '问题总数': report.summary.total_issues,
            '错误数': report.summary.errors,
            '警告数': report.summary.warnings,
            '状态': report.summary.status
          }]),
          issues: exportUtils.jsonToCsv(csvData)
        },
        filename: `校验报告_${buildingCode}_${new Date().toISOString().split('T')[0]}`
      };
    }

    return {
      type: 'json',
      data: report,
      filename: `校验报告_${buildingCode}_${new Date().toISOString().split('T')[0]}.json`
    };
  },

  jsonToCsv: (jsonData) => {
    if (!jsonData || jsonData.length === 0) {
      return '';
    }
    const parser = new Parser();
    return parser.parse(jsonData);
  }
};

module.exports = exportUtils;
