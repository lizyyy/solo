import {
  Prescription,
  HerbBatch,
  DecoctionSchedule,
  PickupTimeSlot,
  RiskEvent,
  RiskEvidence,
  RiskType,
  RiskSeverity,
  SpecialProcessType,
} from '../types';

const generateId = (): string => {
  return `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const EIGHTEEN_INCOMPATIBLE = [
  { herb1: '甘草', herb2: '海藻', description: '甘草反海藻' },
  { herb1: '甘草', herb2: '大戟', description: '甘草反大戟' },
  { herb1: '甘草', herb2: '甘遂', description: '甘草反甘遂' },
  { herb1: '甘草', herb2: '芫花', description: '甘草反芫花' },
  { herb1: '乌头', herb2: '半夏', description: '乌头反半夏' },
  { herb1: '乌头', herb2: '瓜蒌', description: '乌头反瓜蒌' },
  { herb1: '乌头', herb2: '贝母', description: '乌头反贝母' },
  { herb1: '乌头', herb2: '白蔹', description: '乌头反白蔹' },
  { herb1: '乌头', herb2: '白及', description: '乌头反白及' },
  { herb1: '乌头', herb2: '天花粉', description: '乌头反天花粉（瓜蒌根）' },
  { herb1: '藜芦', herb2: '人参', description: '藜芦反人参' },
  { herb1: '藜芦', herb2: '沙参', description: '藜芦反沙参' },
  { herb1: '藜芦', herb2: '丹参', description: '藜芦反丹参' },
  { herb1: '藜芦', herb2: '玄参', description: '藜芦反玄参' },
  { herb1: '藜芦', herb2: '苦参', description: '藜芦反苦参' },
  { herb1: '藜芦', herb2: '细辛', description: '藜芦反细辛' },
  { herb1: '藜芦', herb2: '芍药', description: '藜芦反芍药' },
  { herb1: '藜芦', herb2: '白芍', description: '藜芦反白芍' },
  { herb1: '藜芦', herb2: '赤芍', description: '藜芦反赤芍' },
  { herb1: '附子', herb2: '半夏', description: '附子（乌头类）反半夏' },
  { herb1: '附子', herb2: '瓜蒌', description: '附子（乌头类）反瓜蒌' },
  { herb1: '附子', herb2: '贝母', description: '附子（乌头类）反贝母' },
  { herb1: '川乌', herb2: '半夏', description: '川乌反半夏' },
  { herb1: '川乌', herb2: '瓜蒌', description: '川乌反瓜蒌' },
  { herb1: '草乌', herb2: '半夏', description: '草乌反半夏' },
  { herb1: '草乌', herb2: '瓜蒌', description: '草乌反瓜蒌' },
];

const NINETEEN_COUNTERACTS = [
  { herb1: '硫磺', herb2: '朴硝', description: '硫磺畏朴硝' },
  { herb1: '水银', herb2: '砒霜', description: '水银畏砒霜' },
  { herb1: '狼毒', herb2: '密陀僧', description: '狼毒畏密陀僧' },
  { herb1: '巴豆', herb2: '牵牛', description: '巴豆畏牵牛' },
  { herb1: '丁香', herb2: '郁金', description: '丁香畏郁金' },
  { herb1: '牙硝', herb2: '三棱', description: '牙硝畏三棱' },
  { herb1: '川乌', herb2: '犀角', description: '川乌畏犀角' },
  { herb1: '草乌', herb2: '犀角', description: '草乌畏犀角' },
  { herb1: '人参', herb2: '五灵脂', description: '人参畏五灵脂' },
  { herb1: '官桂', herb2: '赤石脂', description: '官桂畏赤石脂' },
  { herb1: '肉桂', herb2: '赤石脂', description: '肉桂畏赤石脂' },
];

const FIRST_DECOCT_HERBS = [
  '石膏', '寒水石', '滑石', '磁石', '代赭石',
  '龙骨', '牡蛎', '石决明', '珍珠母', '龟甲',
  '鳖甲', '水牛角', '羚羊角', '附子', '川乌',
  '草乌', '乌头', '雷公藤', '马钱子',
];

const LATER_ADD_HERBS = [
  '薄荷', '藿香', '佩兰', '砂仁', '白豆蔻',
  '草豆蔻', '沉香', '檀香', '降香', '青蒿',
  '香薷', '紫苏叶', '荆芥', '防风', '细辛',
  '辛夷', '苍耳子', '麻黄', '桂枝', '生姜',
  '钩藤', '大黄', '番泻叶', '芒硝', '芦荟',
];

const herbNameMatches = (prescriptionHerb: string, ruleHerb: string): boolean => {
  const normalizedPrescription = prescriptionHerb.replace(/[制炙炒煅煨炮酒醋盐姜蜜]?/g, '').trim();
  const normalizedRule = ruleHerb.replace(/[制炙炒煅煨炮酒醋盐姜蜜]?/g, '').trim();
  
  if (normalizedPrescription.includes(normalizedRule)) return true;
  if (normalizedRule.includes(normalizedPrescription)) return true;
  
  const variants: Record<string, string[]> = {
    '芍药': ['白芍', '赤芍', '杭芍', '川芍'],
    '瓜蒌': ['瓜蒌皮', '瓜蒌仁', '全瓜蒌', '天花粉', '瓜蒌根'],
    '贝母': ['川贝母', '浙贝母', '川贝', '浙贝', '象贝'],
    '朴硝': ['芒硝', '玄明粉', '皮硝'],
    '牵牛': ['黑丑', '白丑', '黑白丑', '牵牛子'],
  };
  
  if (variants[normalizedRule]) {
    for (const variant of variants[normalizedRule]) {
      if (normalizedPrescription.includes(variant)) return true;
    }
  }
  
  for (const [base, vars] of Object.entries(variants)) {
    if (vars.includes(normalizedRule)) {
      if (normalizedPrescription.includes(base)) return true;
    }
  }
  
  return false;
};

const createRiskEvent = (
  type: RiskType,
  severity: RiskSeverity,
  title: string,
  description: string,
  evidence: RiskEvidence[],
  options: {
    prescriptionId?: string;
    herbName?: string;
    batchId?: string;
    potId?: string;
    scheduleId?: string;
  } = {}
): RiskEvent => {
  return {
    id: generateId(),
    type,
    severity,
    title,
    description,
    relatedPrescriptionId: options.prescriptionId || null,
    relatedHerbName: options.herbName || null,
    relatedBatchId: options.batchId || null,
    relatedPotId: options.potId || null,
    relatedScheduleId: options.scheduleId || null,
    evidence,
    isReviewed: false,
    reviewResult: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: '',
    originalRiskLevel: null,
    createdAt: Date.now(),
  };
};

const createEvidence = (
  type: RiskEvidence['type'],
  description: string,
  details: Record<string, unknown> = {}
): RiskEvidence => {
  return {
    type,
    description,
    details,
  };
};

export const detectEighteenIncompatible = (prescriptions: Prescription[]): RiskEvent[] => {
  const risks: RiskEvent[] = [];

  prescriptions.forEach((prescription) => {
    const herbNames = prescription.herbs.map(h => h.herbName);
    
    for (const pair of EIGHTEEN_INCOMPATIBLE) {
      const hasHerb1 = herbNames.some(name => herbNameMatches(name, pair.herb1));
      const hasHerb2 = herbNames.some(name => herbNameMatches(name, pair.herb2));
      
      if (hasHerb1 && hasHerb2) {
        const matchedHerb1 = herbNames.find(name => herbNameMatches(name, pair.herb1));
        const matchedHerb2 = herbNames.find(name => herbNameMatches(name, pair.herb2));
        
        risks.push(createRiskEvent(
          'eighteen_incompatible',
          'critical',
          '十八反配伍禁忌',
          `处方 [${prescription.prescriptionNo}] 存在十八反配伍禁忌：${pair.description}`,
          [
            createEvidence('herb_pair', pair.description, {
              herb1: matchedHerb1,
              herb2: matchedHerb2,
              rule: pair.description,
              prescriptionNo: prescription.prescriptionNo,
              patientName: prescription.patientName,
            }),
          ],
          { prescriptionId: prescription.id }
        ));
      }
    }
  });

  return risks;
};

export const detectNineteenCounteracts = (prescriptions: Prescription[]): RiskEvent[] => {
  const risks: RiskEvent[] = [];

  prescriptions.forEach((prescription) => {
    const herbNames = prescription.herbs.map(h => h.herbName);
    
    for (const pair of NINETEEN_COUNTERACTS) {
      const hasHerb1 = herbNames.some(name => herbNameMatches(name, pair.herb1));
      const hasHerb2 = herbNames.some(name => herbNameMatches(name, pair.herb2));
      
      if (hasHerb1 && hasHerb2) {
        const matchedHerb1 = herbNames.find(name => herbNameMatches(name, pair.herb1));
        const matchedHerb2 = herbNames.find(name => herbNameMatches(name, pair.herb2));
        
        risks.push(createRiskEvent(
          'nineteen_counteracts',
          'high',
          '十九畏配伍禁忌',
          `处方 [${prescription.prescriptionNo}] 存在十九畏配伍禁忌：${pair.description}`,
          [
            createEvidence('herb_pair', pair.description, {
              herb1: matchedHerb1,
              herb2: matchedHerb2,
              rule: pair.description,
              prescriptionNo: prescription.prescriptionNo,
              patientName: prescription.patientName,
            }),
          ],
          { prescriptionId: prescription.id }
        ));
      }
    }
  });

  return risks;
};

export const detectFirstDecoctMissing = (prescriptions: Prescription[]): RiskEvent[] => {
  const risks: RiskEvent[] = [];

  prescriptions.forEach((prescription) => {
    prescription.herbs.forEach((herb) => {
      const shouldFirstDecoct = FIRST_DECOCT_HERBS.some(ruleHerb => 
        herbNameMatches(herb.herbName, ruleHerb)
      );
      
      if (shouldFirstDecoct && herb.specialProcess !== 'first_decoct') {
        risks.push(createRiskEvent(
          'first_decoct_missing',
          'medium',
          '先煎药材未标注',
          `处方 [${prescription.prescriptionNo}] 中的药材 [${herb.herbName}] 通常需要先煎，但未标注先煎处理`,
          [
            createEvidence('prescription_data', '药材通常需要先煎处理', {
              herbName: herb.herbName,
              currentProcess: herb.specialProcess,
              expectedProcess: 'first_decoct',
              prescriptionNo: prescription.prescriptionNo,
            }),
          ],
          { prescriptionId: prescription.id, herbName: herb.herbName }
        ));
      }
    });
  });

  return risks;
};

export const detectLaterAddOrder = (
  prescriptions: Prescription[],
  schedules: DecoctionSchedule[]
): RiskEvent[] => {
  const risks: RiskEvent[] = [];

  prescriptions.forEach((prescription) => {
    const laterAddHerbs = prescription.herbs.filter(
      h => h.specialProcess === 'later_add'
    );
    const normalHerbs = prescription.herbs.filter(
      h => h.specialProcess === 'normal' || h.specialProcess === 'first_decoct'
    );

    if (laterAddHerbs.length > 0 && normalHerbs.length === 0) {
      laterAddHerbs.forEach((herb) => {
        risks.push(createRiskEvent(
          'later_add_wrong_order',
          'low',
          '后下药顺序检查',
          `处方 [${prescription.prescriptionNo}] 中 [${herb.herbName}] 为后下药，请注意煎煮顺序`,
          [
            createEvidence('prescription_data', '后下药需要在最后5-10分钟加入', {
              herbName: herb.herbName,
              prescriptionNo: prescription.prescriptionNo,
            }),
          ],
          { prescriptionId: prescription.id, herbName: herb.herbName }
        ));
      });
    }

    schedules.forEach((schedule) => {
      if (schedule.prescriptions.includes(prescription.id) && laterAddHerbs.length > 0) {
        risks.push(createRiskEvent(
          'later_add_wrong_order',
          'medium',
          '排程含后下药需注意',
          `排程 [${schedule.potNo}-${schedule.sequence}] 包含后下药，请注意煎煮时间点`,
          [
            createEvidence('schedule_data', '后下药需要在煎煮结束前加入', {
              scheduleId: schedule.id,
              potNo: schedule.potNo,
              sequence: schedule.sequence,
              laterAddHerbs: laterAddHerbs.map(h => h.herbName),
            }),
          ],
          { prescriptionId: prescription.id, scheduleId: schedule.id }
        ));
      }
    });
  });

  return risks;
};

export const detectCrossPrescriptionMix = (
  prescriptions: Prescription[],
  schedules: DecoctionSchedule[]
): RiskEvent[] => {
  const risks: RiskEvent[] = [];

  schedules.forEach((schedule) => {
    if (schedule.prescriptions.length > 1) {
      const prescriptionList = schedule.prescriptions.map(
        id => prescriptions.find(p => p.id === id)
      ).filter(Boolean) as Prescription[];

      const allHerbs: string[] = [];
      prescriptionList.forEach(p => {
        p.herbs.forEach(h => allHerbs.push(h.herbName));
      });

      for (const pair of EIGHTEEN_INCOMPATIBLE) {
        const hasHerb1Across = prescriptionList.some(p =>
          p.herbs.some(h => herbNameMatches(h.herbName, pair.herb1))
        );
        const hasHerb2Across = prescriptionList.some(p =>
          p.herbs.some(h => herbNameMatches(h.herbName, pair.herb2))
        );

        const samePrescription = prescriptionList.some(p => {
          const has1 = p.herbs.some(h => herbNameMatches(h.herbName, pair.herb1));
          const has2 = p.herbs.some(h => herbNameMatches(h.herbName, pair.herb2));
          return has1 && has2;
        });

        if (hasHerb1Across && hasHerb2Across && !samePrescription) {
          const prescWithHerb1 = prescriptionList.find(p =>
            p.herbs.some(h => herbNameMatches(h.herbName, pair.herb1))
          );
          const prescWithHerb2 = prescriptionList.find(p =>
            p.herbs.some(h => herbNameMatches(h.herbName, pair.herb2))
          );

          risks.push(createRiskEvent(
            'cross_prescription_mix',
            'critical',
            '同锅串方-十八反风险',
            `排程 [${schedule.potNo}-${schedule.sequence}] 中存在跨处方十八反配伍风险：${pair.description}`,
            [
              createEvidence('schedule_data', '不同处方的药材存在配伍禁忌，同锅煎煮有风险', {
                scheduleId: schedule.id,
                potNo: schedule.potNo,
                sequence: schedule.sequence,
                prescription1: prescWithHerb1?.prescriptionNo,
                patient1: prescWithHerb1?.patientName,
                prescription2: prescWithHerb2?.prescriptionNo,
                patient2: prescWithHerb2?.patientName,
                conflict: pair.description,
              }),
            ],
            { scheduleId: schedule.id }
          ));
        }
      }

      if (schedule.prescriptions.length > 3) {
        risks.push(createRiskEvent(
          'cross_prescription_mix',
          'medium',
          '同锅处方过多',
          `排程 [${schedule.potNo}-${schedule.sequence}] 同锅煎煮 ${schedule.prescriptions.length} 张处方，请注意核对`,
          [
            createEvidence('schedule_data', '同锅处方数量较多，需仔细核对', {
              scheduleId: schedule.id,
              potNo: schedule.potNo,
              prescriptionCount: schedule.prescriptions.length,
              prescriptions: prescriptionList.map(p => ({
                no: p.prescriptionNo,
                patient: p.patientName,
              })),
            }),
          ],
          { scheduleId: schedule.id }
        ));
      }
    }
  });

  return risks;
};

export const detectExpiredBatches = (
  prescriptions: Prescription[],
  batches: HerbBatch[]
): RiskEvent[] => {
  const risks: RiskEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  prescriptions.forEach((prescription) => {
    prescription.herbs.forEach((herb) => {
      if (herb.batchId) {
        const batch = batches.find(b => b.id === herb.batchId || b.batchNo === herb.batchId);
        
        if (batch) {
          const expiryDate = new Date(batch.expiryDate);
          expiryDate.setHours(0, 0, 0, 0);

          if (expiryDate < today) {
            risks.push(createRiskEvent(
              'expired_batch',
              'critical',
              '使用过期批次',
              `处方 [${prescription.prescriptionNo}] 中的药材 [${herb.herbName}] 使用了过期批次 [${batch.batchNo}]`,
              [
                createEvidence('batch_data', '批次已过期', {
                  herbName: herb.herbName,
                  batchNo: batch.batchNo,
                  expiryDate: batch.expiryDate,
                  today: today.toISOString().split('T')[0],
                  prescriptionNo: prescription.prescriptionNo,
                }),
              ],
              { 
                prescriptionId: prescription.id, 
                herbName: herb.herbName,
                batchId: batch.id 
              }
            ));
          } else if (expiryDate <= thirtyDaysLater) {
            risks.push(createRiskEvent(
              'batch_near_expiry',
              'low',
              '批次即将过期',
              `处方 [${prescription.prescriptionNo}] 中的药材 [${herb.herbName}] 批次 [${batch.batchNo}] 即将在30天内过期`,
              [
                createEvidence('batch_data', '批次即将过期，请优先使用', {
                  herbName: herb.herbName,
                  batchNo: batch.batchNo,
                  expiryDate: batch.expiryDate,
                  daysRemaining: Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
                  prescriptionNo: prescription.prescriptionNo,
                }),
              ],
              { 
                prescriptionId: prescription.id, 
                herbName: herb.herbName,
                batchId: batch.id 
              }
            ));
          }

          if (batch.qualityStatus === 'rejected') {
            risks.push(createRiskEvent(
              'missing_batch',
              'high',
              '使用不合格批次',
              `处方 [${prescription.prescriptionNo}] 中的药材 [${herb.herbName}] 使用了质量不合格批次 [${batch.batchNo}]`,
              [
                createEvidence('batch_data', '批次质量状态为不合格', {
                  herbName: herb.herbName,
                  batchNo: batch.batchNo,
                  qualityStatus: batch.qualityStatus,
                  prescriptionNo: prescription.prescriptionNo,
                }),
              ],
              { 
                prescriptionId: prescription.id, 
                herbName: herb.herbName,
                batchId: batch.id 
              }
            ));
          }
        }
      } else {
        risks.push(createRiskEvent(
          'missing_batch',
          'medium',
          '未关联批次',
          `处方 [${prescription.prescriptionNo}] 中的药材 [${herb.herbName}] 未关联批次`,
          [
            createEvidence('prescription_data', '药材未指定使用批次', {
              herbName: herb.herbName,
              prescriptionNo: prescription.prescriptionNo,
            }),
          ],
          { 
            prescriptionId: prescription.id, 
            herbName: herb.herbName 
          }
        ));
      }
    });
  });

  batches.forEach((batch) => {
    const expiryDate = new Date(batch.expiryDate);
    expiryDate.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
      const isUsed = prescriptions.some(p =>
        p.herbs.some(h => h.batchId === batch.id || h.batchId === batch.batchNo)
      );

      if (!isUsed) {
        risks.push(createRiskEvent(
          'expired_batch',
          'medium',
          '库存过期批次',
          `药材 [${batch.herbName}] 批次 [${batch.batchNo}] 已过期，库存剩余 ${batch.remainingQuantity}${batch.unit}`,
          [
            createEvidence('batch_data', '库存批次已过期', {
              herbName: batch.herbName,
              batchNo: batch.batchNo,
              expiryDate: batch.expiryDate,
              remainingQuantity: batch.remainingQuantity,
              unit: batch.unit,
            }),
          ],
          { herbName: batch.herbName, batchId: batch.id }
        ));
      }
    }
  });

  return risks;
};

export const detectPickupTimeout = (
  prescriptions: Prescription[],
  timeSlots: PickupTimeSlot[]
): RiskEvent[] => {
  const risks: RiskEvent[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  prescriptions.forEach((prescription) => {
    if (prescription.status === 'completed' || prescription.status === 'picked_up') {
      const pickupDate = prescription.pickupDate || today;
      const pickupSlot = timeSlots.find(s => s.id === prescription.pickupTimeSlotId);

      if (pickupSlot) {
        const [hours, minutes] = pickupSlot.endTime.split(':').map(Number);
        const slotEndTime = new Date(pickupDate);
        slotEndTime.setHours(hours, minutes, 0, 0);

        if (now > slotEndTime && prescription.status !== 'picked_up') {
          const hoursOverdue = Math.floor((now.getTime() - slotEndTime.getTime()) / (1000 * 60 * 60));
          
          risks.push(createRiskEvent(
            'pickup_timeout',
            hoursOverdue > 24 ? 'high' : 'medium',
            '取药超时',
            `处方 [${prescription.prescriptionNo}] 取药超时 ${hoursOverdue} 小时，患者 [${prescription.patientName}] 尚未取药`,
            [
              createEvidence('time_data', '取药时段已过', {
                prescriptionNo: prescription.prescriptionNo,
                patientName: prescription.patientName,
                pickupDate: pickupDate,
                slotTime: `${pickupSlot.startTime} - ${pickupSlot.endTime}`,
                hoursOverdue,
              }),
            ],
            { prescriptionId: prescription.id }
          ));
        }
      } else if (prescription.status === 'completed') {
        const pickupDateObj = new Date(pickupDate);
        pickupDateObj.setHours(23, 59, 59, 999);

        if (now > pickupDateObj) {
          const daysOverdue = Math.floor((now.getTime() - pickupDateObj.getTime()) / (1000 * 60 * 60 * 24));
          
          risks.push(createRiskEvent(
            'pickup_timeout',
            daysOverdue > 3 ? 'high' : 'medium',
            '取药超时（无时段）',
            `处方 [${prescription.prescriptionNo}] 取药日期已过 ${daysOverdue} 天，患者 [${prescription.patientName}] 尚未取药`,
            [
              createEvidence('time_data', '取药日期已过', {
                prescriptionNo: prescription.prescriptionNo,
                patientName: prescription.patientName,
                pickupDate: pickupDate,
                daysOverdue,
              }),
            ],
            { prescriptionId: prescription.id }
          ));
        }
      }
    }
  });

  return risks;
};

export const detectUrgentPriority = (prescriptions: Prescription[]): RiskEvent[] => {
  const risks: RiskEvent[] = [];

  prescriptions.forEach((prescription) => {
    if (prescription.priority === 'emergency' || prescription.priority === 'urgent') {
      const isPending = prescription.status === 'pending' || prescription.status === 'preparing';
      
      if (isPending) {
        risks.push(createRiskEvent(
          'urgent_priority',
          prescription.priority === 'emergency' ? 'high' : 'medium',
          prescription.priority === 'emergency' ? '急诊处方待处理' : '加急处方待处理',
          `处方 [${prescription.prescriptionNo}] 为${prescription.priority === 'emergency' ? '急诊' : '加急'}处方，请优先处理`,
          [
            createEvidence('prescription_data', '处方优先级较高', {
              prescriptionNo: prescription.prescriptionNo,
              patientName: prescription.patientName,
              priority: prescription.priority,
              status: prescription.status,
              orderDate: prescription.orderDate,
            }),
          ],
          { prescriptionId: prescription.id }
        ));
      }
    }
  });

  return risks;
};

export const detectDosageAnomaly = (prescriptions: Prescription[]): RiskEvent[] => {
  const risks: RiskEvent[] = [];

  const dosageRules: Record<string, { min: number; max: number; unit: string }> = {
    '附子': { min: 3, max: 15, unit: 'g' },
    '川乌': { min: 1.5, max: 3, unit: 'g' },
    '草乌': { min: 1.5, max: 3, unit: 'g' },
    '马钱子': { min: 0.3, max: 0.6, unit: 'g' },
    '雷公藤': { min: 10, max: 25, unit: 'g' },
    '雄黄': { min: 0.05, max: 0.1, unit: 'g' },
    '朱砂': { min: 0.1, max: 0.5, unit: 'g' },
    '甘遂': { min: 0.5, max: 1.5, unit: 'g' },
    '大戟': { min: 1.5, max: 3, unit: 'g' },
    '芫花': { min: 1.5, max: 3, unit: 'g' },
    '巴豆': { min: 0.1, max: 0.3, unit: 'g' },
  };

  prescriptions.forEach((prescription) => {
    prescription.herbs.forEach((herb) => {
      for (const [ruleHerb, rule] of Object.entries(dosageRules)) {
        if (herbNameMatches(herb.herbName, ruleHerb)) {
          const dosage = herb.dosage;
          const unit = herb.unit.toLowerCase();
          const ruleUnit = rule.unit.toLowerCase();

          let adjustedDosage = dosage;
          if (unit === 'kg' || unit === '千克') {
            adjustedDosage = dosage * 1000;
          } else if (unit === 'mg' || unit === '毫克') {
            adjustedDosage = dosage / 1000;
          }

          if (ruleUnit === 'g' && (unit === 'g' || unit === '克' || unit === '')) {
            if (adjustedDosage > rule.max) {
              risks.push(createRiskEvent(
                'dosage_anomaly',
                'high',
                '剂量超量',
                `处方 [${prescription.prescriptionNo}] 中 [${herb.herbName}] 剂量 ${dosage}${herb.unit} 超出常规最大剂量 ${rule.max}${rule.unit}`,
                [
                  createEvidence('prescription_data', '剂量可能超出安全范围', {
                    herbName: herb.herbName,
                    prescribedDosage: dosage,
                    unit: herb.unit,
                    maxRecommended: rule.max,
                    maxUnit: rule.unit,
                    prescriptionNo: prescription.prescriptionNo,
                  }),
                ],
                { prescriptionId: prescription.id, herbName: herb.herbName }
              ));
            } else if (adjustedDosage < rule.min && adjustedDosage > 0) {
              risks.push(createRiskEvent(
                'dosage_anomaly',
                'low',
                '剂量偏低',
                `处方 [${prescription.prescriptionNo}] 中 [${herb.herbName}] 剂量 ${dosage}${herb.unit} 低于常规最小剂量 ${rule.min}${rule.unit}`,
                [
                  createEvidence('prescription_data', '剂量可能低于有效剂量', {
                    herbName: herb.herbName,
                    prescribedDosage: dosage,
                    unit: herb.unit,
                    minRecommended: rule.min,
                    minUnit: rule.unit,
                    prescriptionNo: prescription.prescriptionNo,
                  }),
                ],
                { prescriptionId: prescription.id, herbName: herb.herbName }
              ));
            }
          }
        }
      }
    });
  });

  return risks;
};

export const detectAllRisks = (
  prescriptions: Prescription[],
  batches: HerbBatch[],
  schedules: DecoctionSchedule[],
  timeSlots: PickupTimeSlot[]
): RiskEvent[] => {
  const allRisks: RiskEvent[] = [];

  allRisks.push(...detectEighteenIncompatible(prescriptions));
  allRisks.push(...detectNineteenCounteracts(prescriptions));
  allRisks.push(...detectFirstDecoctMissing(prescriptions));
  allRisks.push(...detectLaterAddOrder(prescriptions, schedules));
  allRisks.push(...detectCrossPrescriptionMix(prescriptions, schedules));
  allRisks.push(...detectExpiredBatches(prescriptions, batches));
  allRisks.push(...detectPickupTimeout(prescriptions, timeSlots));
  allRisks.push(...detectUrgentPriority(prescriptions));
  allRisks.push(...detectDosageAnomaly(prescriptions));

  allRisks.sort((a, b) => {
    const severityOrder: Record<RiskSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return allRisks;
};

export const RISK_TYPE_LABELS: Record<RiskType, string> = {
  eighteen_incompatible: '十八反配伍',
  nineteen_counteracts: '十九畏配伍',
  first_decoct_missing: '先煎未标注',
  later_add_wrong_order: '后下顺序问题',
  cross_prescription_mix: '同锅串方风险',
  expired_batch: '过期批次',
  batch_near_expiry: '批次即将过期',
  pickup_timeout: '取药超时',
  dosage_anomaly: '剂量异常',
  herb_conflict: '药材冲突',
  pot_capacity_exceeded: '煎锅容量超限',
  missing_batch: '缺少批次',
  urgent_priority: '紧急处方',
  review_required: '需要复核',
};

export const SEVERITY_LABELS: Record<RiskSeverity, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

export const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb',
};

export const SPECIAL_PROCESS_LABELS: Record<SpecialProcessType, string> = {
  normal: '常规',
  first_decoct: '先煎',
  later_add: '后下',
  wrap_decoct: '包煎',
  dissolve: '烊化',
  infuse: '冲服',
  decoct_separately: '另煎',
  powder: '入丸散',
};
