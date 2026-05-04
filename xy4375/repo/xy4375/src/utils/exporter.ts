import Papa from 'papaparse';
import {
  Prescription,
  PrescriptionHerb,
  HerbBatch,
  DecoctionSchedule,
  DecoctionPot,
  RiskEvent,
  ReviewLog,
  AuditTrail,
  ExportConfig,
  SpecialProcessType,
} from '../types';
import { RISK_TYPE_LABELS, SEVERITY_LABELS, SPECIAL_PROCESS_LABELS } from './riskDetector';

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const generatePrescriptionHerbsTable = (herbs: PrescriptionHerb[]): string => {
  const lines: string[] = [];
  lines.push('| 药材名称 | 剂量 | 单位 | 特殊处理 | 备注 |');
  lines.push('|----------|------|------|----------|------|');
  
  herbs.forEach((herb) => {
    const processLabel = SPECIAL_PROCESS_LABELS[herb.specialProcess] || herb.specialProcess;
    const processMark = herb.specialProcess !== 'normal' ? `**${processLabel}**` : processLabel;
    lines.push(`| ${herb.herbName} | ${herb.dosage} | ${herb.unit} | ${processMark} | ${herb.notes || '-'} |`);
  });
  
  return lines.join('\n');
};

export const generateDecoctionHandoverMarkdown = (
  prescription: Prescription,
  schedule?: DecoctionSchedule,
  pot?: DecoctionPot,
  risks?: RiskEvent[]
): string => {
  const lines: string[] = [];
  const now = new Date();

  lines.push('# 中药煎药交接单');
  lines.push('');
  lines.push(`> 生成时间: ${formatTimestamp(now.getTime())}`);
  lines.push('');

  lines.push('## 处方基本信息');
  lines.push('');
  lines.push('| 项目 | 内容 |');
  lines.push('|------|------|');
  lines.push(`| **处方号** | ${prescription.prescriptionNo} |`);
  lines.push(`| **患者姓名** | ${prescription.patientName} |`);
  lines.push(`| **性别** | ${prescription.patientGender === 'male' ? '男' : prescription.patientGender === 'female' ? '女' : '未知'} |`);
  lines.push(`| **年龄** | ${prescription.patientAge || '-'} 岁 |`);
  lines.push(`| **科室** | ${prescription.department || '-'} |`);
  lines.push(`| **医师** | ${prescription.doctorName || '-'} |`);
  lines.push(`| **诊断** | ${prescription.diagnosis || '-'} |`);
  lines.push(`| **开方日期** | ${formatDate(prescription.orderDate)} |`);
  lines.push(`| **取药日期** | ${formatDate(prescription.pickupDate)} |`);
  lines.push(`| **优先级** | ${prescription.priority === 'emergency' ? '🔴 急诊' : prescription.priority === 'urgent' ? '🟡 加急' : '普通'} |`);
  lines.push(`| **状态** | ${prescription.status === 'pending' ? '待处理' : prescription.status === 'preparing' ? '备药中' : prescription.status === 'decocting' ? '煎煮中' : prescription.status === 'completed' ? '已完成' : prescription.status === 'picked_up' ? '已取药' : '已取消'} |`);
  lines.push('');

  if (schedule) {
    lines.push('## 排程信息');
    lines.push('');
    lines.push('| 项目 | 内容 |');
    lines.push('|------|------|');
    lines.push(`| **煎锅** | ${pot ? pot.name : schedule.potNo} (${schedule.potNo}) |`);
    lines.push(`| **锅次** | 第 ${schedule.batchNo} 锅 |`);
    lines.push(`| **序号** | ${schedule.sequence} |`);
    lines.push(`| **状态** | ${schedule.status === 'pending' ? '待排程' : schedule.status === 'preparing' ? '备药中' : schedule.status === 'decocting' ? '煎煮中' : schedule.status === 'completed' ? '已完成' : '已复核'} |`);
    if (schedule.startTime) {
      lines.push(`| **开始时间** | ${formatTimestamp(schedule.startTime)} |`);
    }
    if (schedule.endTime) {
      lines.push(`| **结束时间** | ${formatTimestamp(schedule.endTime)} |`);
    }
    if (schedule.operatorName) {
      lines.push(`| **操作人员** | ${schedule.operatorName} |`);
    }
    lines.push('');
  }

  lines.push('## 煎煮工艺');
  lines.push('');
  const method = prescription.decoctionMethod;
  lines.push(`- **煎煮类型**: ${method.type === 'water' ? '水煎' : method.type === 'wine' ? '酒煎' : method.type === 'water_wine' ? '水酒共煎' : '其他'}`);
  lines.push(`- **加水量**: ${method.waterAmount || '遵医嘱'}`);
  lines.push(`- **浸泡时间**: ${method.soakingTime || 30} 分钟`);
  lines.push(`- **头煎时间**: ${method.firstDecoctionTime || 30} 分钟`);
  lines.push(`- **二煎时间**: ${method.secondDecoctionTime || 20} 分钟`);
  lines.push(`- **火候**: ${method.fireType === 'strong' ? '武火' : method.fireType === 'gentle' ? '文火' : '文武火交替'}`);
  if (method.notes) {
    lines.push(`- **煎法备注**: ${method.notes}`);
  }
  lines.push('');

  lines.push('## 药材清单');
  lines.push('');
  lines.push(`**总剂数**: ${prescription.totalDoses} 剂`);
  lines.push(`**服用方法**: ${prescription.dosage || '-'}，${prescription.frequency || '-'}`);
  lines.push('');
  lines.push(generatePrescriptionHerbsTable(prescription.herbs));
  lines.push('');

  const specialHerbs = prescription.herbs.filter(h => h.specialProcess !== 'normal');
  if (specialHerbs.length > 0) {
    lines.push('## 特殊处理注意事项');
    lines.push('');
    
    specialHerbs.forEach((herb) => {
      const processLabel = SPECIAL_PROCESS_LABELS[herb.specialProcess];
      let instruction = '';
      
      switch (herb.specialProcess) {
        case 'first_decoct':
          instruction = '需先煎30-60分钟，再与其他药材同煎';
          break;
        case 'later_add':
          instruction = '需在煎好前5-10分钟加入';
          break;
        case 'wrap_decoct':
          instruction = '需用纱布包好后再煎';
          break;
        case 'dissolve':
          instruction = '需用煎好的药液趁热溶化后服用';
          break;
        case 'infuse':
          instruction = '需用煎好的药液或开水冲服';
          break;
        case 'decoct_separately':
          instruction = '需单独煎煮后，再与其他药液兑服';
          break;
        case 'powder':
          instruction = '需研成粉末后服用';
          break;
      }
      
      lines.push(`### **${processLabel}**: ${herb.herbName} (${herb.dosage}${herb.unit})`);
      lines.push('');
      lines.push(`> ${instruction}`);
      lines.push('');
    });
  }

  if (risks && risks.length > 0) {
    const relatedRisks = risks.filter(r => 
      r.relatedPrescriptionId === prescription.id || 
      (schedule && r.relatedScheduleId === schedule.id)
    );

    if (relatedRisks.length > 0) {
      lines.push('## ⚠️ 风险提示');
      lines.push('');
      lines.push(`**共检测到 ${relatedRisks.length} 项风险，请复核确认**`);
      lines.push('');

      relatedRisks.forEach((risk, index) => {
        const severityEmoji = risk.severity === 'critical' ? '🔴' : risk.severity === 'high' ? '🟠' : risk.severity === 'medium' ? '🟡' : '🔵';
        lines.push(`### ${index + 1}. ${severityEmoji} [${SEVERITY_LABELS[risk.severity]}] ${risk.title}`);
        lines.push('');
        lines.push(`**描述**: ${risk.description}`);
        lines.push('');
        
        if (risk.evidence.length > 0) {
          lines.push('**证据**:');
          lines.push('');
          risk.evidence.forEach((e, i) => {
            lines.push(`${i + 1}. ${e.description}`);
          });
          lines.push('');
        }

        if (risk.isReviewed) {
          lines.push(`**复核状态**: ✅ 已复核`);
          lines.push(`**复核结果**: ${risk.reviewResult === 'confirmed' ? '确认风险' : risk.reviewResult === 'false_positive' ? '误报排除' : risk.reviewResult === 'mitigated' ? '风险已缓解' : '需进一步处理'}`);
          if (risk.reviewNotes) {
            lines.push(`**复核备注**: ${risk.reviewNotes}`);
          }
          if (risk.reviewedBy) {
            lines.push(`**复核人**: ${risk.reviewedBy}`);
          }
        } else {
          lines.push(`**复核状态**: ⏳ 待复核`);
        }
        lines.push('');
        lines.push('---');
        lines.push('');
      });
    }
  }

  if (prescription.notes) {
    lines.push('## 备注');
    lines.push('');
    lines.push(prescription.notes);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('### 交接确认');
  lines.push('');
  lines.push('| 岗位 | 签字 | 时间 |');
  lines.push('|------|------|------|');
  lines.push('| 备药人员 | ____________ | ____________ |');
  lines.push('| 煎煮人员 | ____________ | ____________ |');
  lines.push('| 发药人员 | ____________ | ____________ |');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(`*本交接单由中药煎药排程复核工具生成于 ${formatTimestamp(now.getTime())}*`);

  return lines.join('\n');
};

export const generateBatchHandoverMarkdown = (
  schedules: DecoctionSchedule[],
  prescriptions: Prescription[],
  pots: DecoctionPot[],
  risks: RiskEvent[],
  potNo?: string
): string => {
  const lines: string[] = [];
  const now = new Date();

  lines.push('# 煎药批次交接单');
  lines.push('');
  lines.push(`> 生成时间: ${formatTimestamp(now.getTime())}`);
  if (potNo) {
    lines.push(`> 煎锅: ${potNo}`);
  }
  lines.push('');

  const today = new Date().toISOString().split('T')[0];
  const todaySchedules = schedules.filter(s => {
    const matchPot = !potNo || s.potNo === potNo;
    const matchDate = s.scheduleDate === today;
    return matchPot && matchDate;
  }).sort((a, b) => {
    if (a.potNo !== b.potNo) return a.potNo.localeCompare(b.potNo);
    return a.sequence - b.sequence;
  });

  if (todaySchedules.length === 0) {
    lines.push('> 今日暂无排程');
    lines.push('');
  } else {
    lines.push(`## 今日排程概览 (${todaySchedules.length} 个排程)`);
    lines.push('');
    lines.push('| 煎锅 | 锅次 | 序号 | 处方数 | 状态 | 操作人 |');
    lines.push('|------|------|------|--------|------|--------|');
    
    todaySchedules.forEach((schedule) => {
      const statusLabel = schedule.status === 'pending' ? '待排程' : 
                         schedule.status === 'preparing' ? '备药中' :
                         schedule.status === 'decocting' ? '煎煮中' :
                         schedule.status === 'completed' ? '已完成' : '已复核';
      lines.push(`| ${schedule.potNo} | ${schedule.batchNo} | ${schedule.sequence} | ${schedule.prescriptions.length} | ${statusLabel} | ${schedule.operatorName || '-'} |`);
    });
    lines.push('');

    todaySchedules.forEach((schedule, scheduleIndex) => {
      const pot = pots.find(p => p.potNo === schedule.potNo);
      const schedulePrescriptions = schedule.prescriptions
        .map(id => prescriptions.find(p => p.id === id))
        .filter(Boolean) as Prescription[];

      lines.push(`---`);
      lines.push('');
      lines.push(`## 排程详情: ${schedule.potNo} 锅 - 第 ${schedule.batchNo} 锅 / 序号 ${schedule.sequence}`);
      lines.push('');

      lines.push('### 基本信息');
      lines.push('');
      lines.push('| 项目 | 内容 |');
      lines.push('|------|------|');
      lines.push(`| **煎锅** | ${pot?.name || schedule.potNo} |`);
      lines.push(`| **容量** | ${pot?.capacity || '-'} ${pot?.capacityUnit || ''} |`);
      lines.push(`| **处方数** | ${schedulePrescriptions.length} 张 |`);
      lines.push(`| **状态** | ${schedule.status === 'pending' ? '待排程' : schedule.status === 'preparing' ? '备药中' : schedule.status === 'decocting' ? '煎煮中' : schedule.status === 'completed' ? '已完成' : '已复核'} |`);
      if (schedule.startTime) {
        lines.push(`| **开始时间** | ${formatTimestamp(schedule.startTime)} |`);
      }
      if (schedule.endTime) {
        lines.push(`| **结束时间** | ${formatTimestamp(schedule.endTime)} |`);
      }
      if (schedule.actualFirstDecoctionTime) {
        lines.push(`| **实际头煎** | ${schedule.actualFirstDecoctionTime} 分钟 |`);
      }
      if (schedule.actualSecondDecoctionTime) {
        lines.push(`| **实际二煎** | ${schedule.actualSecondDecoctionTime} 分钟 |`);
      }
      if (schedule.operatorName) {
        lines.push(`| **操作人** | ${schedule.operatorName} |`);
      }
      lines.push('');

      lines.push(`### 处方列表 (${schedulePrescriptions.length} 张)`);
      lines.push('');

      schedulePrescriptions.forEach((prescription, pIndex) => {
        lines.push(`#### ${pIndex + 1}. ${prescription.prescriptionNo} - ${prescription.patientName}`);
        lines.push('');
        lines.push(`- **诊断**: ${prescription.diagnosis || '-'}`);
        lines.push(`- **医师**: ${prescription.doctorName || '-'}`);
        lines.push(`- **剂数**: ${prescription.totalDoses} 剂`);
        lines.push(`- **优先级**: ${prescription.priority === 'emergency' ? '🔴 急诊' : prescription.priority === 'urgent' ? '🟡 加急' : '普通'}`);
        lines.push('');

        lines.push('**药材**:');
        lines.push('');
        lines.push(prescription.herbs.map(h => {
          const process = h.specialProcess !== 'normal' ? ` (${SPECIAL_PROCESS_LABELS[h.specialProcess]})` : '';
          return `${h.herbName} ${h.dosage}${h.unit}${process}`;
        }).join('、'));
        lines.push('');
      });

      const scheduleRisks = risks.filter(r => r.relatedScheduleId === schedule.id);
      if (scheduleRisks.length > 0) {
        lines.push(`### ⚠️ 本排程风险 (${scheduleRisks.length} 项)`);
        lines.push('');

        scheduleRisks.forEach((risk, rIndex) => {
          const severityEmoji = risk.severity === 'critical' ? '🔴' : risk.severity === 'high' ? '🟠' : risk.severity === 'medium' ? '🟡' : '🔵';
          const statusEmoji = risk.isReviewed ? '✅' : '⏳';
          lines.push(`${rIndex + 1}. ${severityEmoji} [${SEVERITY_LABELS[risk.severity]}] ${statusEmoji} ${risk.title}`);
          lines.push(`   > ${risk.description}`);
          if (risk.isReviewed && risk.reviewResult) {
            lines.push(`   > 复核结果: ${risk.reviewResult === 'confirmed' ? '确认风险' : risk.reviewResult === 'false_positive' ? '误报排除' : risk.reviewResult === 'mitigated' ? '风险已缓解' : '需进一步处理'}`);
          }
          lines.push('');
        });
      }

      if (schedule.notes) {
        lines.push('### 排程备注');
        lines.push('');
        lines.push(schedule.notes);
        lines.push('');
      }
    });
  }

  const criticalRisks = risks.filter(r => r.severity === 'critical' && !r.isReviewed);
  if (criticalRisks.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 🔴 待处理严重风险汇总');
    lines.push('');
    lines.push(`**共 ${criticalRisks.length} 项严重风险待复核，请优先处理**`);
    lines.push('');

    criticalRisks.forEach((risk, index) => {
      const relatedPresc = prescriptions.find(p => p.id === risk.relatedPrescriptionId);
      lines.push(`${index + 1}. **${risk.title}**`);
      lines.push(`   > ${risk.description}`);
      if (relatedPresc) {
        lines.push(`   > 相关处方: ${relatedPresc.prescriptionNo} - ${relatedPresc.patientName}`);
      }
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('');
  lines.push('### 批次交接确认');
  lines.push('');
  lines.push('| 交接项目 | 移交人 | 接收人 | 时间 |');
  lines.push('|----------|--------|--------|------|');
  lines.push('| 药材核对 | ____________ | ____________ | ____________ |');
  lines.push('| 煎煮过程 | ____________ | ____________ | ____________ |');
  lines.push('| 成品交接 | ____________ | ____________ | ____________ |');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(`*本交接单由中药煎药排程复核工具生成于 ${formatTimestamp(now.getTime())}*`);

  return lines.join('\n');
};

export const generateRiskListCSV = (
  risks: RiskEvent[],
  prescriptions: Prescription[],
  schedules: DecoctionSchedule[]
): string => {
  const data = risks.map((risk) => {
    const relatedPresc = prescriptions.find(p => p.id === risk.relatedPrescriptionId);
    const relatedSchedule = schedules.find(s => s.id === risk.relatedScheduleId);

    return {
      '风险ID': risk.id.substring(0, 15),
      '风险类型': RISK_TYPE_LABELS[risk.type] || risk.type,
      '严重程度': SEVERITY_LABELS[risk.severity],
      '标题': risk.title,
      '描述': risk.description,
      '相关处方': relatedPresc ? `${relatedPresc.prescriptionNo} - ${relatedPresc.patientName}` : '-',
      '相关药材': risk.relatedHerbName || '-',
      '相关批次': risk.relatedBatchId || '-',
      '相关煎锅': relatedSchedule ? relatedSchedule.potNo : '-',
      '相关排程': relatedSchedule ? `${relatedSchedule.potNo}-${relatedSchedule.sequence}` : '-',
      '复核状态': risk.isReviewed ? '已复核' : '待复核',
      '复核结果': risk.reviewResult === 'confirmed' ? '确认风险' :
                  risk.reviewResult === 'false_positive' ? '误报排除' :
                  risk.reviewResult === 'mitigated' ? '风险已缓解' :
                  risk.reviewResult === 'escalated' ? '需进一步处理' : '-',
      '复核人': risk.reviewedBy || '-',
      '复核时间': risk.reviewedAt ? formatTimestamp(risk.reviewedAt) : '-',
      '复核备注': risk.reviewNotes || '-',
      '检测时间': formatTimestamp(risk.createdAt),
    };
  });

  return Papa.unparse(data);
};

export const generateAuditJSON = (
  prescriptions: Prescription[],
  batches: HerbBatch[],
  schedules: DecoctionSchedule[],
  risks: RiskEvent[],
  reviews: ReviewLog[],
  audits: AuditTrail[]
): string => {
  const auditData = {
    metadata: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      generatedBy: '中药煎药排程复核工具',
    },
    summary: {
      prescriptionCount: prescriptions.length,
      batchCount: batches.length,
      scheduleCount: schedules.length,
      riskCount: risks.length,
      reviewedRiskCount: risks.filter(r => r.isReviewed).length,
      pendingRiskCount: risks.filter(r => !r.isReviewed).length,
      criticalRiskCount: risks.filter(r => r.severity === 'critical').length,
      reviewCount: reviews.length,
      auditTrailCount: audits.length,
    },
    data: {
      prescriptions: prescriptions.map(p => ({
        id: p.id,
        prescriptionNo: p.prescriptionNo,
        patientName: p.patientName,
        patientAge: p.patientAge,
        patientGender: p.patientGender,
        department: p.department,
        doctorName: p.doctorName,
        diagnosis: p.diagnosis,
        herbCount: p.herbs.length,
        totalDoses: p.totalDoses,
        status: p.status,
        priority: p.priority,
        orderDate: p.orderDate,
        pickupDate: p.pickupDate,
        createdAt: formatTimestamp(p.createdAt),
        updatedAt: formatTimestamp(p.updatedAt),
      })),
      batches: batches.map(b => ({
        id: b.id,
        herbName: b.herbName,
        batchNo: b.batchNo,
        origin: b.origin,
        supplier: b.supplier,
        productionDate: b.productionDate,
        expiryDate: b.expiryDate,
        qualityStatus: b.qualityStatus,
        remainingQuantity: b.remainingQuantity,
        unit: b.unit,
      })),
      schedules: schedules.map(s => ({
        id: s.id,
        scheduleDate: s.scheduleDate,
        potNo: s.potNo,
        batchNo: s.batchNo,
        sequence: s.sequence,
        prescriptionCount: s.prescriptions.length,
        status: s.status,
        operatorName: s.operatorName,
        startTime: s.startTime ? formatTimestamp(s.startTime) : null,
        endTime: s.endTime ? formatTimestamp(s.endTime) : null,
      })),
      risks: risks.map(r => ({
        id: r.id,
        type: r.type,
        typeLabel: RISK_TYPE_LABELS[r.type],
        severity: r.severity,
        severityLabel: SEVERITY_LABELS[r.severity],
        title: r.title,
        description: r.description,
        isReviewed: r.isReviewed,
        reviewResult: r.reviewResult,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt ? formatTimestamp(r.reviewedAt) : null,
        createdAt: formatTimestamp(r.createdAt),
      })),
      reviews: reviews.map(r => ({
        id: r.id,
        riskEventId: r.riskEventId,
        reviewerName: r.reviewerName,
        reviewResult: r.reviewResult,
        previousResult: r.previousResult,
        notes: r.notes,
        createdAt: formatTimestamp(r.createdAt),
      })),
      auditTrails: audits.slice(-100).map(a => ({
        id: a.id,
        entityType: a.entityType,
        action: a.action,
        details: a.details,
        operatorName: a.operatorName,
        timestamp: formatTimestamp(a.timestamp),
      })),
    },
  };

  return JSON.stringify(auditData, null, 2);
};

export const exportDecoctionHandover = (
  prescription: Prescription,
  schedule?: DecoctionSchedule,
  pot?: DecoctionPot,
  risks?: RiskEvent[]
): void => {
  const content = generateDecoctionHandoverMarkdown(prescription, schedule, pot, risks);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `煎药交接单_${prescription.prescriptionNo}_${timestamp}.md`;
  downloadFile(content, filename, 'text/markdown;charset=utf-8');
};

export const exportBatchHandover = (
  schedules: DecoctionSchedule[],
  prescriptions: Prescription[],
  pots: DecoctionPot[],
  risks: RiskEvent[],
  potNo?: string
): void => {
  const content = generateBatchHandoverMarkdown(schedules, prescriptions, pots, risks, potNo);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `批次交接单${potNo ? `_${potNo}` : ''}_${timestamp}.md`;
  downloadFile(content, filename, 'text/markdown;charset=utf-8');
};

export const exportRiskListCSV = (
  risks: RiskEvent[],
  prescriptions: Prescription[],
  schedules: DecoctionSchedule[]
): void => {
  const content = generateRiskListCSV(risks, prescriptions, schedules);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `风险清单_${timestamp}.csv`;
  downloadFile(content, filename, 'text/csv;charset=utf-8');
};

export const exportAuditJSON = (
  prescriptions: Prescription[],
  batches: HerbBatch[],
  schedules: DecoctionSchedule[],
  risks: RiskEvent[],
  reviews: ReviewLog[],
  audits: AuditTrail[]
): void => {
  const content = generateAuditJSON(prescriptions, batches, schedules, risks, reviews, audits);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `审计包_${timestamp}.json`;
  downloadFile(content, filename, 'application/json;charset=utf-8');
};
