import * as XLSX from 'xlsx';
import { getAll, getOne } from '../database';
import { maskName, maskPhone } from '../security/masking';

export interface SettlementReport {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalCleanings: number;
    totalReworks: number;
    totalComplaints: number;
    totalDeductions: number;
  };
  byCleaner: {
    cleanerName: string;
    cleaningCount: number;
    reworkCount: number;
    complaintCount: number;
    totalDeductions: number;
    qualityScore?: number;
  }[];
  details: {
    id: number;
    type: 'cleaning' | 'rework' | 'complaint';
    roomNumber: string;
    cleanerName: string;
    date: string;
    description: string;
    deductionAmount: number;
  }[];
}

export const generateSettlementReport = async (
  startDate: string,
  endDate: string
): Promise<SettlementReport> => {
  const cleaningRecords = await getAll<any>(
    `SELECT id, room_number, cleaner_name, cleaner_phone, scheduled_date, quality_score, status, remarks
     FROM cleaning_records
     WHERE scheduled_date BETWEEN ? AND ?
     ORDER BY scheduled_date`,
    [startDate, endDate]
  );
  
  const reworkRecords = await getAll<any>(
    `SELECT r.id, r.room_number, r.reworker_name, r.rework_date, r.rework_reason, r.deduction_amount,
            r.related_cleaning_id, c.cleaner_name
     FROM rework_records r
     LEFT JOIN cleaning_records c ON r.related_cleaning_id = c.id
     WHERE r.rework_date BETWEEN ? AND ?
     ORDER BY r.rework_date`,
    [startDate, endDate]
  );
  
  const complaintRecords = await getAll<any>(
    `SELECT id, room_number, guest_name, guest_phone, complaint_date, category, description,
            deduction_amount, related_cleaning_id
     FROM complaints
     WHERE complaint_date BETWEEN ? AND ?
     ORDER BY complaint_date`,
    [startDate, endDate]
  );
  
  const details: SettlementReport['details'] = [];
  
  cleaningRecords.forEach(record => {
    if (record.status === 'needs_rework' || (record.quality_score !== null && record.quality_score < 60)) {
      details.push({
        id: record.id,
        type: 'cleaning',
        roomNumber: record.room_number,
        cleanerName: record.cleaner_name,
        date: record.scheduled_date,
        description: `保洁质量问题 - 分数: ${record.quality_score || '未评分'} - ${record.remarks || ''}`,
        deductionAmount: record.quality_score !== null && record.quality_score < 60 ? 50 : 0
      });
    }
  });
  
  reworkRecords.forEach(record => {
    details.push({
      id: record.id,
      type: 'rework',
      roomNumber: record.room_number,
      cleanerName: record.reworker_name,
      date: record.rework_date,
      description: record.rework_reason,
      deductionAmount: record.deduction_amount || 0
    });
  });
  
  complaintRecords.forEach(record => {
    details.push({
      id: record.id,
      type: 'complaint',
      roomNumber: record.room_number,
      cleanerName: '客诉处理',
      date: record.complaint_date,
      description: `[${record.category}] ${record.description}`,
      deductionAmount: record.deduction_amount || 0
    });
  });
  
  const byCleanerMap = new Map<string, {
    cleaningCount: number;
    reworkCount: number;
    complaintCount: number;
    totalDeductions: number;
    totalScore: number;
    scoreCount: number;
  }>();
  
  cleaningRecords.forEach(record => {
    const existing = byCleanerMap.get(record.cleaner_name) || {
      cleaningCount: 0,
      reworkCount: 0,
      complaintCount: 0,
      totalDeductions: 0,
      totalScore: 0,
      scoreCount: 0
    };
    existing.cleaningCount++;
    if (record.quality_score !== null && record.quality_score !== undefined) {
      existing.totalScore += record.quality_score;
      existing.scoreCount++;
    }
    byCleanerMap.set(record.cleaner_name, existing);
  });
  
  reworkRecords.forEach(record => {
    const existing = byCleanerMap.get(record.reworker_name) || {
      cleaningCount: 0,
      reworkCount: 0,
      complaintCount: 0,
      totalDeductions: 0,
      totalScore: 0,
      scoreCount: 0
    };
    existing.reworkCount++;
    existing.totalDeductions += record.deduction_amount || 0;
    byCleanerMap.set(record.reworker_name, existing);
  });
  
  complaintRecords.forEach(record => {
    if (record.related_cleaning_id) {
      const cleaning = cleaningRecords.find(c => c.id === record.related_cleaning_id);
      if (cleaning) {
        const existing = byCleanerMap.get(cleaning.cleaner_name) || {
          cleaningCount: 0,
          reworkCount: 0,
          complaintCount: 0,
          totalDeductions: 0,
          totalScore: 0,
          scoreCount: 0
        };
        existing.complaintCount++;
        existing.totalDeductions += record.deduction_amount || 0;
        byCleanerMap.set(cleaning.cleaner_name, existing);
      }
    }
  });
  
  const byCleaner: SettlementReport['byCleaner'] = Array.from(byCleanerMap.entries()).map(([name, stats]) => ({
    cleanerName: name,
    cleaningCount: stats.cleaningCount,
    reworkCount: stats.reworkCount,
    complaintCount: stats.complaintCount,
    totalDeductions: stats.totalDeductions,
    qualityScore: stats.scoreCount > 0 ? Math.round(stats.totalScore / stats.scoreCount) : undefined
  }));
  
  const totalDeductions = details.reduce((sum, d) => sum + d.deductionAmount, 0);
  
  return {
    period: { startDate, endDate },
    summary: {
      totalCleanings: cleaningRecords.length,
      totalReworks: reworkRecords.length,
      totalComplaints: complaintRecords.length,
      totalDeductions
    },
    byCleaner,
    details
  };
};

export const exportReportToExcel = async (report: SettlementReport): Promise<Buffer> => {
  const workbook = XLSX.utils.book_new();
  
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['民宿运营结算报表'],
    [`统计周期: ${report.period.startDate} 至 ${report.period.endDate}`],
    [],
    ['汇总数据'],
    ['保洁总数', report.summary.totalCleanings],
    ['返工总数', report.summary.totalReworks],
    ['客诉总数', report.summary.totalComplaints],
    ['扣款总额', report.summary.totalDeductions],
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总');
  
  const cleanerData = [
    ['保洁员姓名', '保洁次数', '返工次数', '客诉次数', '扣款总额', '平均质量分'],
    ...report.byCleaner.map(item => [
      item.cleanerName,
      item.cleaningCount,
      item.reworkCount,
      item.complaintCount,
      item.totalDeductions,
      item.qualityScore || '-'
    ])
  ];
  const cleanerSheet = XLSX.utils.aoa_to_sheet(cleanerData);
  XLSX.utils.book_append_sheet(workbook, cleanerSheet, '按保洁员统计');
  
  const detailData = [
    ['ID', '类型', '房间号', '保洁员', '日期', '描述', '扣款金额'],
    ...report.details.map(item => [
      item.id,
      item.type === 'cleaning' ? '保洁' : item.type === 'rework' ? '返工' : '客诉',
      item.roomNumber,
      maskName(item.cleanerName),
      item.date,
      item.description,
      item.deductionAmount
    ])
  ];
  const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
  XLSX.utils.book_append_sheet(workbook, detailSheet, '明细');
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

export const getDeductionRules = async () => {
  return getAll('SELECT * FROM deduction_rules ORDER BY category, sub_category');
};
