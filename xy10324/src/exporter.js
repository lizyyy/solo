const XLSX = require('xlsx');
const path = require('path');
const dayjs = require('dayjs');

function exportBill(calcResult, outputPath) {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['【负责人视角】核对汇总'],
    [''],
    ['一、关键指标'],
    ['学生总数', calcResult.summary.totalStudents],
    ['总购课时', calcResult.summary.totalLessonsPurchased],
    ['已用课时', calcResult.summary.totalLessonsUsed],
    ['剩余课时', calcResult.summary.totalLessonsRemaining],
    ['课消率', `${calcResult.summary.utilizationRate}%`],
    [''],
    ['二、风险预警'],
    ...(calcResult.summary.risks.length > 0 
      ? calcResult.summary.risks.map(r => ['⚠', r])
      : [['✓', '暂无风险项']]),
    [''],
    ['三、待办事项'],
    ...(calcResult.summary.todos.length > 0
      ? calcResult.summary.todos.map((t, i) => [`${i + 1}.`, t])
      : [['✓', '全部完成，无待办']]),
    [''],
    ['四、已完成检查'],
    ...calcResult.summary.completedChecks.map(c => ['✓', c])
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, '汇总');

  const studentHeader = ['学号', '姓名', '班级', '总课时', '初始已用', '本期消耗', '调整', '累计已用', '剩余', '状态'];
  const studentData = [studentHeader];
  
  for (const s of calcResult.students) {
    let status = '正常';
    if (s.isOverdrawn) status = '透支';
    else if (s.hasLowBalance) status = '不足';
    
    studentData.push([
      s.studentId,
      s.studentName,
      s.className || '-',
      s.totalLessons,
      s.initialUsed,
      s.periodConsumed,
      s.corrections,
      s.usedLessons,
      s.remaining,
      status
    ]);
  }
  const studentWs = XLSX.utils.aoa_to_sheet(studentData);
  XLSX.utils.book_append_sheet(wb, studentWs, '学生清单');

  const detailHeader = ['学号', '姓名', '日期', '班级', '时间', '课时', '类型', '是否扣课', '备注'];
  const detailData = [detailHeader];
  
  for (const s of calcResult.students) {
    for (const d of s.details) {
      detailData.push([
        s.studentId,
        s.studentName,
        d.date,
        d.className || d.classId,
        d.startTime || '',
        d.hours,
        d.deductionType,
        d.deducted ? '是' : '否',
        d.anomaly ? d.anomaly.message : ''
      ]);
    }
  }
  if (detailData.length > 1) {
    const detailWs = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, detailWs, '课消明细');
  }

  const leaveHeader = ['学号', '姓名', '请假日期', '班级', '请假原因'];
  const leaveData = [leaveHeader];
  
  for (const s of calcResult.students) {
    for (const l of s.unmadeLeaves) {
      leaveData.push([
        s.studentId,
        s.studentName,
        l.date,
        l.classId,
        l.reason || ''
      ]);
    }
  }
  if (leaveData.length > 1) {
    const leaveWs = XLSX.utils.aoa_to_sheet(leaveData);
    XLSX.utils.book_append_sheet(wb, leaveWs, '待补课');
  }

  if (calcResult.anomalies.length > 0) {
    const anomalyHeader = ['类型', '学生', '学号', '日期', '说明'];
    const anomalyData = [anomalyHeader];
    const typeLabels = {
      overdrawn: '课时透支',
      low_balance: '余额不足',
      orphan_makeup: '孤立补课'
    };
    
    for (const a of calcResult.anomalies) {
      anomalyData.push([
        typeLabels[a.type] || a.type,
        a.studentName,
        a.studentId,
        a.date || '',
        a.message
      ]);
    }
    const anomalyWs = XLSX.utils.aoa_to_sheet(anomalyData);
    XLSX.utils.book_append_sheet(wb, anomalyWs, '异常记录');
  }

  const finalPath = outputPath || path.join(process.cwd(), `课消账单_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
  XLSX.writeFile(wb, finalPath);
  return finalPath;
}

module.exports = {
  exportBill
};
