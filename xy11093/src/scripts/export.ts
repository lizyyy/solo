import fs from 'fs';
import path from 'path';
import { Parser } from 'json2csv';
import { getSigninRecords, getSigninRecordById } from '../services/signinService';
import { getEmployeeById } from '../services/employeeService';
import { getCourseById } from '../services/courseService';
import { ExportRecord } from '../types';

const exportDir = path.join(__dirname, '../../exports');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

async function exportToCsv() {
  console.log('开始导出签到补录数据...');

  const records = await getSigninRecords();
  console.log(`找到 ${records.length} 条记录`);

  const exportRecords: ExportRecord[] = [];

  for (const record of records) {
    const employee = await getEmployeeById(record.employeeId);
    const course = await getCourseById(record.courseId);

    exportRecords.push({
      ...record,
      employeeName: employee?.name || '未知',
      employeeNo: employee?.employeeNo || '未知',
      department: employee?.department || '未知',
      courseName: course?.courseName || '未知',
      courseCode: course?.courseCode || '未知',
      trainingDate: course?.trainingDate || '未知'
    });
  }

  const fields = [
    { label: '记录编号', value: 'recordNo' },
    { label: '员工编号', value: 'employeeNo' },
    { label: '员工姓名', value: 'employeeName' },
    { label: '部门', value: 'department' },
    { label: '课程编号', value: 'courseCode' },
    { label: '课程名称', value: 'courseName' },
    { label: '培训日期', value: 'trainingDate' },
    { label: '签到类型', value: 'signinType' },
    { label: '座位号', value: 'seatNumber' },
    { label: '签到时间', value: 'signinTime' },
    { label: '状态', value: 'status' },
    { label: '异常类型', value: 'abnormalType' },
    { label: '业务解释', value: 'businessExplanation' },
    { label: '提交人', value: 'submitterName' },
    { label: '创建时间', value: 'createdAt' },
    { label: '更新时间', value: 'updatedAt' }
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(exportRecords);

  const fileName = `signin_supplement_${new Date().toISOString().slice(0, 10)}.csv`;
  const filePath = path.join(exportDir, fileName);

  fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf-8');

  console.log(`导出完成! 文件: ${filePath}`);
  console.log(`共导出 ${exportRecords.length} 条记录`);
}

async function exportRecordHistory(recordId: string) {
  console.log(`导出记录 ${recordId} 的历史...`);

  const record = await getSigninRecordById(recordId);
  if (!record) {
    console.log('记录不存在');
    return;
  }

  const { getSigninHistory } = await import('../services/signinService');
  const history = await getSigninHistory(recordId);

  const fields = [
    { label: '操作类型', value: 'action' },
    { label: '之前状态', value: 'previousStatus' },
    { label: '新状态', value: 'newStatus' },
    { label: '操作人', value: 'operatorName' },
    { label: '备注', value: 'remark' },
    { label: '操作时间', value: 'createdAt' }
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(history);

  const fileName = `signin_history_${record.recordNo}_${new Date().toISOString().slice(0, 10)}.csv`;
  const filePath = path.join(exportDir, fileName);

  fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf-8');

  console.log(`导出完成! 文件: ${filePath}`);
  console.log(`共导出 ${history.length} 条历史记录`);
}

const [,, recordId] = process.argv;

if (recordId) {
  exportRecordHistory(recordId).catch(console.error);
} else {
  exportToCsv().catch(console.error);
}
