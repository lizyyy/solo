import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const headers = ['商户名称', '位置', '面积', '经营时间', '纬度', '经度', '联系人', '联系电话'];

const rows = [
  ['星巴克咖啡外摆区', '万达广场1号门入口右侧', '8.5', '10:00-22:30', '31.2304', '121.4737', '张经理', '138****1234'],
  ['奈雪的茶', '南京西路1788号', '7', '09:00-22:00', '31.2320', '121.4680', '刘店长', '138****2222'],
];

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '审批记录');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync('test_approval_records.xlsx', buf);
console.log('test_approval_records.xlsx created');
