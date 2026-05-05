const XLSX = require('xlsx');
const Papa = require('papaparse');
const path = require('path');
const fs = require('fs');

class DataImporter {
  constructor(db) {
    this.db = db;
  }

  importFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.xlsx' || ext === '.xls') {
      return this.importExcel(filePath);
    } else if (ext === '.csv') {
      return this.importCSV(filePath);
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }
  }

  importExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
    
    return this.processData(jsonData);
  }

  importCSV(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const result = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true
    });
    
    if (result.errors.length > 0) {
      throw new Error(`CSV解析错误: ${result.errors[0].message}`);
    }
    
    return this.processData(result.data);
  }

  processData(dataArray) {
    let importedCount = 0;
    
    for (const row of dataArray) {
      try {
        const orderData = this.parseRow(row);
        if (orderData && orderData.order_number && orderData.patient_name) {
          this.db.createOrder(orderData);
          importedCount++;
        }
      } catch (error) {
        console.error('处理行时出错:', error, row);
      }
    }
    
    return importedCount;
  }

  parseRow(row) {
    const getValue = (keys) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key];
        }
      }
      return null;
    };

    const orderData = {
      order_number: getValue(['订单号', 'order_number', 'orderNo', 'OrderNo']),
      patient_name: getValue(['患者姓名', '姓名', 'patient_name', 'patientName', 'Patient Name']),
      phone: getValue(['电话', '联系电话', 'phone', 'telephone', 'Phone']),
      order_date: getValue(['下单日期', '开单日期', 'order_date', 'orderDate', 'Order Date']) || new Date().toISOString().slice(0, 10),
      pickup_date: getValue(['取镜日期', '预计取镜', 'pickup_date', 'pickupDate', 'Pickup Date'])
    };

    if (!orderData.pickup_date) {
      const orderDate = new Date(orderData.order_date);
      orderDate.setDate(orderDate.getDate() + 5);
      orderData.pickup_date = orderDate.toISOString().slice(0, 10);
    }

    orderData.prescriptions = this.parsePrescriptions(row);
    orderData.frames = this.parseFrames(row);
    orderData.lenses = this.parseLenses(row);
    orderData.grinding_log = this.parseGrindingLog(row);
    orderData.quality_check = this.parseQualityCheck(row);

    return orderData;
  }

  parsePrescriptions(row) {
    const prescriptions = [];
    
    const leftPrescription = this.parseSingleEye(row, 'left', '左眼', 'L', 'Left');
    const rightPrescription = this.parseSingleEye(row, 'right', '右眼', 'R', 'Right');

    if (leftPrescription) prescriptions.push(leftPrescription);
    if (rightPrescription) prescriptions.push(rightPrescription);

    return prescriptions;
  }

  parseSingleEye(row, eyeType, ...prefixes) {
    const getEyeValue = (suffixes) => {
      for (const prefix of prefixes) {
        for (const suffix of suffixes) {
          const key = `${prefix}${suffix}`;
          if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
            return this.parseNumber(row[key]);
          }
        }
      }
      return null;
    };

    const sphere = getEyeValue(['球镜', 'S', ' S', ' SPH', 'SPH', '球镜度']);
    const cylinder = getEyeValue(['柱镜', 'C', ' C', ' CYL', 'CYL', '柱镜度']);
    const axis = getEyeValue(['轴位', 'A', ' A', ' AX', 'AX', 'Axis']);
    const addPower = getEyeValue(['下加光', 'ADD', ' Add', '下加', '近用附加']);
    const pd = getEyeValue(['瞳距', 'PD', ' Pd', '瞳孔距离']);
    const ph = getEyeValue(['瞳高', 'PH', ' Ph', '瞳孔高度']);

    if (sphere !== null || cylinder !== null) {
      return {
        eye_type: eyeType,
        sphere,
        cylinder,
        axis,
        add_power: addPower,
        pd,
        ph
      };
    }
    return null;
  }

  parseFrames(row) {
    const getValue = (keys) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key];
        }
      }
      return null;
    };

    const frameModel = getValue(['镜框型号', '镜架型号', 'frame_model', 'frameModel', 'Frame Model']);
    const frameBrand = getValue(['镜框品牌', '镜架品牌', 'frame_brand', 'frameBrand', 'Frame Brand']);
    const frameWidth = this.parseNumber(getValue(['镜框宽度', 'frame_width', 'frameWidth']));
    const bridgeWidth = this.parseNumber(getValue(['鼻梁宽度', '鼻宽', 'bridge_width', 'bridgeWidth']));
    const templeLength = this.parseNumber(getValue(['镜腿长度', 'temple_length', 'templeLength']));
    const lensWidth = this.parseNumber(getValue(['镜片宽度', 'lens_width', 'lensWidth', '镜片尺寸']));

    if (frameModel || frameBrand || lensWidth) {
      return {
        frame_model: frameModel,
        frame_brand: frameBrand,
        frame_width: frameWidth,
        bridge_width: bridgeWidth,
        temple_length: templeLength,
        lens_width: lensWidth
      };
    }
    return null;
  }

  parseLenses(row) {
    const lenses = [];
    
    const leftLens = this.parseSingleLens(row, 'left', '左眼', 'L', 'Left');
    const rightLens = this.parseSingleLens(row, 'right', '右眼', 'R', 'Right');

    if (leftLens) lenses.push(leftLens);
    if (rightLens) lenses.push(rightLens);

    return lenses;
  }

  parseSingleLens(row, eyeType, ...prefixes) {
    const getEyeValue = (suffixes) => {
      for (const prefix of prefixes) {
        for (const suffix of suffixes) {
          const key = `${prefix}${suffix}`;
          if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
            return row[key];
          }
        }
      }
      return null;
    };

    const lensBrand = getEyeValue(['镜片品牌', '镜片牌子', 'lens_brand', 'lensBrand']);
    const lensType = getEyeValue(['镜片类型', 'lens_type', 'lensType', 'Lens Type']);
    const lensDiameter = this.parseNumber(getEyeValue(['镜片直径', 'lens_diameter', 'lensDiameter']));
    const baseCurve = this.parseNumber(getEyeValue(['基弧', 'base_curve', 'baseCurve', 'BC']));
    const centerThickness = this.parseNumber(getEyeValue(['中心厚度', 'center_thickness', 'centerThickness', 'CT']));

    if (lensBrand || lensType || lensDiameter) {
      return {
        eye_type: eyeType,
        lens_brand: lensBrand,
        lens_type: lensType,
        lens_diameter: lensDiameter,
        base_curve: baseCurve,
        center_thickness: centerThickness
      };
    }
    return null;
  }

  parseGrindingLog(row) {
    const getValue = (keys) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key];
        }
      }
      return null;
    };

    const grindingDate = getValue(['磨边日期', '加工日期', 'grinding_date', 'grindingDate']);
    const grindingMachine = getValue(['磨边机型号', '磨边机', 'grinding_machine', 'grindingMachine']);
    const operator = getValue(['操作员', '加工员', 'operator', 'Operator']);
    const lensSizeW = this.parseNumber(getValue(['镜片宽度', 'lens_size_w', 'lensSizeW', '磨边宽度']));
    const lensSizeH = this.parseNumber(getValue(['镜片高度', 'lens_size_h', 'lensSizeH', '磨边高度']));
    const bevelType = getValue(['磨边类型', 'bevel_type', 'bevelType']);
    const edgeThickness = this.parseNumber(getValue(['边缘厚度', 'edge_thickness', 'edgeThickness', 'ET']));
    const qualityCheck = getValue(['加工质量', 'quality_check', 'qualityCheck']);
    const remarks = getValue(['加工备注', 'remarks', 'Remarks']);

    if (grindingDate || grindingMachine || operator) {
      return {
        grinding_date: grindingDate,
        grinding_machine: grindingMachine,
        operator,
        lens_size_w: lensSizeW,
        lens_size_h: lensSizeH,
        bevel_type: bevelType,
        edge_thickness: edgeThickness,
        quality_check: qualityCheck,
        remarks
      };
    }
    return null;
  }

  parseQualityCheck(row) {
    const getValue = (keys) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key];
        }
      }
      return null;
    };

    const checkDate = getValue(['质检日期', '检查日期', 'check_date', 'checkDate']);
    const checker = getValue(['质检人', '检查人', 'checker', 'Checker']);
    const visualAcuityLeft = getValue(['左眼视力', 'va_left', 'vaLeft', 'Visual Acuity Left']);
    const visualAcuityRight = getValue(['右眼视力', 'va_right', 'vaRight', 'Visual Acuity Right']);
    const prismCheck = getValue(['棱镜检查', 'prism_check', 'prismCheck']);
    const axisVerification = getValue(['轴位验证', 'axis_verification', 'axisVerification']);
    const surfaceQuality = getValue(['表面质量', 'surface_quality', 'surfaceQuality']);
    const fittingCheck = getValue(['配戴检查', 'fitting_check', 'fittingCheck']);
    const overallResult = getValue(['总体结果', 'overall_result', 'overallResult', '质检结果']);
    const remarks = getValue(['质检备注', 'qc_remarks', 'qcRemarks']);

    if (checkDate || checker || overallResult) {
      return {
        check_date: checkDate,
        checker,
        visual_acuity_left: visualAcuityLeft,
        visual_acuity_right: visualAcuityRight,
        prism_check: prismCheck,
        axis_verification: axisVerification,
        surface_quality: surfaceQuality,
        fitting_check: fittingCheck,
        overall_result: overallResult,
        remarks
      };
    }
    return null;
  }

  parseNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    const strValue = String(value).trim();
    
    if (strValue === '') return null;
    
    const parsed = parseFloat(strValue);
    return isNaN(parsed) ? null : parsed;
  }
}

module.exports = DataImporter;
