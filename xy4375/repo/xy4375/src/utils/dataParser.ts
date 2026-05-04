import Papa from 'papaparse';
import {
  Prescription,
  PrescriptionHerb,
  HerbBatch,
  DecoctionPot,
  PickupTimeSlot,
  ImportResult,
  ImportError,
  ImportWarning,
  DecoctionMethod,
  SpecialProcessType,
} from '../types';

const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getValue = (row: Record<string, string>, keys: string[]): string => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return '';
};

const getNumberValue = (row: Record<string, string>, keys: string[], defaultValue: number = 0): number => {
  const value = getValue(row, keys);
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseSpecialProcess = (value: string): SpecialProcessType => {
  const lowerValue = value.toLowerCase().trim();
  const processMap: Record<string, SpecialProcessType> = {
    '先煎': 'first_decoct',
    '先煮': 'first_decoct',
    '后下': 'later_add',
    '后入': 'later_add',
    '包煎': 'wrap_decoct',
    '烊化': 'dissolve',
    '溶化': 'dissolve',
    '冲服': 'infuse',
    '另煎': 'decoct_separately',
    '另炖': 'decoct_separately',
    '分煎': 'decoct_separately',
    '入丸散': 'powder',
    '研粉': 'powder',
    '冲服': 'infuse',
  };
  return processMap[lowerValue] || 'normal';
};

const parseGender = (value: string): 'male' | 'female' | 'unknown' => {
  const lowerValue = value.toLowerCase().trim();
  if (lowerValue === '男' || lowerValue === 'm' || lowerValue === 'male') return 'male';
  if (lowerValue === '女' || lowerValue === 'f' || lowerValue === 'female') return 'female';
  return 'unknown';
};

const parsePriority = (value: string): 'normal' | 'urgent' | 'emergency' => {
  const lowerValue = value.toLowerCase().trim();
  if (lowerValue === '紧急' || lowerValue === '急' || lowerValue === 'emergency') return 'emergency';
  if (lowerValue === '加急' || lowerValue === 'urgent') return 'urgent';
  return 'normal';
};

const parsePrescriptionStatus = (value: string): Prescription['status'] => {
  const lowerValue = value.toLowerCase().trim();
  const statusMap: Record<string, Prescription['status']> = {
    '待处理': 'pending',
    'pending': 'pending',
    '备药中': 'preparing',
    'preparing': 'preparing',
    '煎煮中': 'decocting',
    'decocting': 'decocting',
    '已完成': 'completed',
    'completed': 'completed',
    '已取药': 'picked_up',
    'picked_up': 'picked_up',
    '已取消': 'cancelled',
    'cancelled': 'cancelled',
  };
  return statusMap[lowerValue] || 'pending';
};

const parseDecoctionType = (value: string): DecoctionMethod['type'] => {
  const lowerValue = value.toLowerCase().trim();
  if (lowerValue === '酒煎' || lowerValue === 'wine') return 'wine';
  if (lowerValue === '水酒共煎' || lowerValue === 'water_wine') return 'water_wine';
  if (lowerValue === '其他' || lowerValue === 'other') return 'other';
  return 'water';
};

const parseFireType = (value: string): DecoctionMethod['fireType'] => {
  const lowerValue = value.toLowerCase().trim();
  if (lowerValue === '武火' || lowerValue === 'strong') return 'strong';
  if (lowerValue === '文火' || lowerValue === 'gentle') return 'gentle';
  return 'mixed';
};

const parsePotStatus = (value: string): DecoctionPot['status'] => {
  const lowerValue = value.toLowerCase().trim();
  if (lowerValue === '使用中' || lowerValue === 'in_use') return 'in_use';
  if (lowerValue === '维护中' || lowerValue === 'maintenance') return 'maintenance';
  if (lowerValue === '禁用' || lowerValue === 'disabled') return 'disabled';
  return 'idle';
};

const parsePotType = (value: string): DecoctionPot['type'] => {
  const lowerValue = value.toLowerCase().trim();
  if (lowerValue === '半自动' || lowerValue === 'semi_automatic') return 'semi_automatic';
  if (lowerValue === '手动' || lowerValue === 'manual') return 'manual';
  return 'automatic';
};

export const parsePrescriptionCSV = (csvContent: string): ImportResult<Prescription> => {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
  });

  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  const prescriptions: Prescription[] = [];
  let total = 0;
  let imported = 0;
  let skipped = 0;

  if (result.errors.length > 0) {
    result.errors.forEach((err, idx) => {
      errors.push({
        row: (err.row || 0) + 2,
        field: err.code,
        value: '',
        message: err.message || 'CSV解析错误',
      });
    });
  }

  result.data.forEach((row, index) => {
    total++;
    const rowNum = index + 2;

    try {
      const prescriptionNo = getValue(row, ['prescriptionNo', '处方号', 'prescription_no', 'id', 'ID']);
      const patientName = getValue(row, ['patientName', '患者姓名', '姓名', 'name', 'Name']);

      if (!prescriptionNo) {
        warnings.push({
          row: rowNum,
          field: 'prescriptionNo',
          message: '处方号为空，已自动生成',
        });
      }

      if (!patientName) {
        warnings.push({
          row: rowNum,
          field: 'patientName',
          message: '患者姓名为空',
        });
      }

      const herbsStr = getValue(row, ['herbs', '药材', '药品', '中药', '药物']);
      const herbs: PrescriptionHerb[] = [];

      if (herbsStr) {
        try {
          const herbList = herbsStr.split(/[;；]/).filter(h => h.trim());
          herbList.forEach((herbItem) => {
            const parts = herbItem.split(/[：:]/);
            const herbName = parts[0]?.trim() || '';
            const dosagePart = parts[1]?.trim() || '';
            const dosageMatch = dosagePart.match(/([\d.]+)\s*([克g两钱斤]*)?/);
            const dosage = dosageMatch ? parseFloat(dosageMatch[1]) : 0;
            const unit = dosageMatch?.[2] || 'g';

            const specialProcessMatch = herbItem.match(/[（(]([^)）]+)[)）]/);
            const specialProcess = specialProcessMatch ? parseSpecialProcess(specialProcessMatch[1]) : 'normal';

            if (herbName) {
              herbs.push({
                herbId: `herb_${generateId()}`,
                herbName,
                pinyin: '',
                dosage,
                unit: unit === '克' ? 'g' : unit,
                batchId: '',
                specialProcess,
                notes: '',
              });
            }
          });
        } catch {
          warnings.push({
            row: rowNum,
            field: 'herbs',
            message: '药材列表解析失败，使用空列表',
          });
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const orderDate = getValue(row, ['orderDate', '开方日期', '日期', 'order_date']) || today;
      const pickupDate = getValue(row, ['pickupDate', '取药日期', 'pickup_date']) || orderDate;

      const prescription: Prescription = {
        id: `pres_${generateId()}`,
        prescriptionNo: prescriptionNo || `RX-${Date.now()}-${index}`,
        patientName: patientName || `患者${index + 1}`,
        patientAge: getNumberValue(row, ['patientAge', '年龄', 'age']),
        patientGender: parseGender(getValue(row, ['patientGender', '性别', 'gender'])),
        department: getValue(row, ['department', '科室', 'dept']),
        doctorName: getValue(row, ['doctorName', '医生', '医师', 'doctor']),
        diagnosis: getValue(row, ['diagnosis', '诊断', 'diagnose']),
        herbs,
        decoctionMethod: {
          type: parseDecoctionType(getValue(row, ['decoctionType', '煎煮类型', '煎法'])),
          waterAmount: getValue(row, ['waterAmount', '水量', '加水量']),
          soakingTime: getNumberValue(row, ['soakingTime', '浸泡时间', '浸泡'], 30),
          firstDecoctionTime: getNumberValue(row, ['firstDecoctionTime', '头煎时间', '第一煎'], 30),
          secondDecoctionTime: getNumberValue(row, ['secondDecoctionTime', '二煎时间', '第二煎'], 20),
          fireType: parseFireType(getValue(row, ['fireType', '火候', '火力'])),
          notes: getValue(row, ['decoctionNotes', '煎法备注', '煎煮备注']),
        },
        dosage: getValue(row, ['dosage', '剂量', '用量']),
        frequency: getValue(row, ['frequency', '频次', '服用次数', '服法']),
        totalDoses: getNumberValue(row, ['totalDoses', '总剂数', '剂数'], 1),
        preparedDoses: getNumberValue(row, ['preparedDoses', '已煎剂数'], 0),
        orderDate,
        pickupDate,
        pickupTimeSlotId: getValue(row, ['pickupTimeSlotId', '取药时段', '时段']),
        status: parsePrescriptionStatus(getValue(row, ['status', '状态'])),
        priority: parsePriority(getValue(row, ['priority', '优先级', '紧急程度'])),
        notes: getValue(row, ['notes', '备注', 'remark']),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      prescriptions.push(prescription);
      imported++;
    } catch (error) {
      errors.push({
        row: rowNum,
        field: 'all',
        value: JSON.stringify(row).substring(0, 100),
        message: error instanceof Error ? error.message : '解析处方失败',
      });
      skipped++;
    }
  });

  return {
    success: errors.length === 0,
    data: prescriptions,
    errors,
    warnings,
    stats: {
      total,
      imported,
      skipped,
      updated: 0,
    },
  };
};

export const parseHerbBatchJSON = (jsonContent: string): ImportResult<HerbBatch> => {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  const batches: HerbBatch[] = [];
  let total = 0;
  let imported = 0;
  let skipped = 0;

  try {
    let data: unknown;
    try {
      data = JSON.parse(jsonContent);
    } catch {
      throw new Error('JSON 格式错误，请检查文件内容');
    }

    const batchArray: unknown[] = Array.isArray(data) 
      ? data 
      : (data as Record<string, unknown>).data 
        ? (data as Record<string, unknown>).data as unknown[]
        : (data as Record<string, unknown>).batches 
          ? (data as Record<string, unknown>).batches as unknown[]
          : [data];

    batchArray.forEach((item, index) => {
      total++;
      try {
        const row = item as Record<string, unknown>;
        
        const batchNo = (row.batchNo as string) || (row['批号'] as string) || (row.batch_no as string) || '';
        const herbName = (row.herbName as string) || (row['药材名称'] as string) || (row['名称'] as string) || '';

        if (!batchNo) {
          warnings.push({
            row: index + 1,
            field: 'batchNo',
            message: '批次号为空，已自动生成',
          });
        }

        if (!herbName) {
          warnings.push({
            row: index + 1,
            field: 'herbName',
            message: '药材名称为空',
          });
        }

        const today = new Date().toISOString().split('T')[0];
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        const batch: HerbBatch = {
          id: `batch_${generateId()}`,
          herbId: (row.herbId as string) || (row['药材ID'] as string) || `herb_${generateId()}`,
          herbName: herbName || `药材${index + 1}`,
          pinyin: (row.pinyin as string) || (row['拼音'] as string) || '',
          batchNo: batchNo || `BATCH-${Date.now()}-${index}`,
          origin: (row.origin as string) || (row['产地'] as string) || (row['来源'] as string) || '',
          supplier: (row.supplier as string) || (row['供应商'] as string) || (row['供货商'] as string) || '',
          productionDate: (row.productionDate as string) || (row['生产日期'] as string) || today,
          expiryDate: (row.expiryDate as string) || (row['有效期'] as string) || (row['到期日期'] as string) || nextYear.toISOString().split('T')[0],
          qualityStatus: ((row.qualityStatus as string) || (row['质量状态'] as string)) === 'rejected' ? 'rejected' :
                         ((row.qualityStatus as string) || (row['质量状态'] as string)) === 'pending' ? 'pending' : 'qualified',
          storageCondition: (row.storageCondition as string) || (row['储存条件'] as string) || '',
          remainingQuantity: parseFloat((row.remainingQuantity as string) || (row['剩余数量'] as string) || (row['库存'] as string) || '0'),
          unit: (row.unit as string) || (row['单位'] as string) || 'kg',
          pricePerUnit: parseFloat((row.pricePerUnit as string) || (row['单价'] as string) || '0'),
          inspectionReportNo: (row.inspectionReportNo as string) || (row['检验报告号'] as string) || (row['质检号'] as string) || '',
          notes: (row.notes as string) || (row['备注'] as string) || '',
          createdAt: Date.now(),
        };

        batches.push(batch);
        imported++;
      } catch (error) {
        errors.push({
          row: index + 1,
          field: 'all',
          value: JSON.stringify(item).substring(0, 100),
          message: error instanceof Error ? error.message : '解析批次失败',
        });
        skipped++;
      }
    });
  } catch (error) {
    errors.push({
      row: 0,
      field: 'json',
      value: jsonContent.substring(0, 100),
      message: error instanceof Error ? error.message : 'JSON解析失败',
    });
  }

  return {
    success: errors.length === 0,
    data: batches,
    errors,
    warnings,
    stats: {
      total,
      imported,
      skipped,
      updated: 0,
    },
  };
};

export const parseDecoctionPotCSV = (csvContent: string): ImportResult<DecoctionPot> => {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
  });

  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  const pots: DecoctionPot[] = [];
  let total = 0;
  let imported = 0;
  let skipped = 0;

  result.data.forEach((row, index) => {
    total++;
    const rowNum = index + 2;

    try {
      const potNo = getValue(row, ['potNo', '锅号', '煎锅号', '编号']);
      const name = getValue(row, ['name', '名称', '煎锅名称']);

      if (!potNo) {
        warnings.push({
          row: rowNum,
          field: 'potNo',
          message: '煎锅编号为空，已自动生成',
        });
      }

      const pot: DecoctionPot = {
        id: `pot_${generateId()}`,
        potNo: potNo || `POT-${index + 1}`,
        name: name || `煎锅${potNo || index + 1}`,
        capacity: getNumberValue(row, ['capacity', '容量', '容积'], 20),
        capacityUnit: getValue(row, ['capacityUnit', '容量单位', '单位']) || 'L',
        type: parsePotType(getValue(row, ['type', '类型', '煎锅类型'])),
        status: parsePotStatus(getValue(row, ['status', '状态'])),
        currentPrescriptionId: null,
        currentScheduleId: null,
        lastUsedAt: null,
        location: getValue(row, ['location', '位置', '存放位置']),
        notes: getValue(row, ['notes', '备注']),
      };

      pots.push(pot);
      imported++;
    } catch (error) {
      errors.push({
        row: rowNum,
        field: 'all',
        value: JSON.stringify(row).substring(0, 100),
        message: error instanceof Error ? error.message : '解析煎锅失败',
      });
      skipped++;
    }
  });

  return {
    success: errors.length === 0,
    data: pots,
    errors,
    warnings,
    stats: {
      total,
      imported,
      skipped,
      updated: 0,
    },
  };
};

export const parsePickupTimeSlotCSV = (csvContent: string): ImportResult<PickupTimeSlot> => {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
  });

  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  const slots: PickupTimeSlot[] = [];
  let total = 0;
  let imported = 0;
  let skipped = 0;

  const today = new Date().toISOString().split('T')[0];

  result.data.forEach((row, index) => {
    total++;
    const rowNum = index + 2;

    try {
      const date = getValue(row, ['date', '日期', '取药日期']) || today;
      const startTime = getValue(row, ['startTime', '开始时间', 'start_time']);
      const endTime = getValue(row, ['endTime', '结束时间', 'end_time']);

      if (!startTime || !endTime) {
        warnings.push({
          row: rowNum,
          field: 'time',
          message: '时段时间不完整，使用默认时段',
        });
      }

      const slot: PickupTimeSlot = {
        id: `slot_${generateId()}`,
        date,
        startTime: startTime || '08:00',
        endTime: endTime || '09:00',
        maxCapacity: getNumberValue(row, ['maxCapacity', '最大容量', 'max_capacity', '容量'], 20),
        currentBookings: getNumberValue(row, ['currentBookings', '当前预约', 'current_bookings'], 0),
        status: getValue(row, ['status', '状态']) === 'cancelled' ? 'cancelled' :
                getValue(row, ['status', '状态']) === 'full' ? 'full' : 'active',
        notes: getValue(row, ['notes', '备注']),
      };

      slots.push(slot);
      imported++;
    } catch (error) {
      errors.push({
        row: rowNum,
        field: 'all',
        value: JSON.stringify(row).substring(0, 100),
        message: error instanceof Error ? error.message : '解析取药时段失败',
      });
      skipped++;
    }
  });

  return {
    success: errors.length === 0,
    data: slots,
    errors,
    warnings,
    stats: {
      total,
      imported,
      skipped,
      updated: 0,
    },
  };
};

export const parseHerbsFromText = (text: string): PrescriptionHerb[] => {
  const herbs: PrescriptionHerb[] = [];
  const lines = text.split(/[\n\r]+/).filter(line => line.trim());

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    const specialMatch = trimmed.match(/[（(]([^)）]+)[)）]/);
    const specialProcess = specialMatch ? parseSpecialProcess(specialMatch[1]) : 'normal';
    
    const cleanLine = trimmed.replace(/[（(][^)）]+[)）]/g, '').trim();
    
    const match = cleanLine.match(/^([^\d]+)\s*([\d.]+)\s*([克g两钱斤]*)?/);
    
    if (match) {
      const herbName = match[1].trim();
      const dosage = parseFloat(match[2]);
      const unit = match[3] || 'g';

      if (herbName && !isNaN(dosage)) {
        herbs.push({
          herbId: `herb_${generateId()}`,
          herbName,
          pinyin: '',
          dosage,
          unit: unit === '克' ? 'g' : unit,
          batchId: '',
          specialProcess,
          notes: '',
        });
      }
    } else if (cleanLine.length > 0) {
      herbs.push({
        herbId: `herb_${generateId()}`,
        herbName: cleanLine,
        pinyin: '',
        dosage: 0,
        unit: 'g',
        batchId: '',
        specialProcess: 'normal',
        notes: '',
      });
    }
  });

  return herbs;
};
