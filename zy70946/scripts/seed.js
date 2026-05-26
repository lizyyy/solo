const fs = require('fs');
const path = require('path');

const appCsv = `apply_no,owner_name,room_no,deposit_amount,start_date,end_date,remark
ZX2024001,张三,1-101,5000,2024-03-01,2024-05-30,正常装修
ZX2024002,李四,1-102,5000,2024-03-10,2024-06-10,拆改阳台
ZX2024003,王五,2-305,8000,2024-04-01,2024-07-01,大户型
ZX2024004,赵六,3-502,5000,2024-04-15,2024-06-15,
ZX2024005,孙七,2-801,6000,2024-05-01,2024-08-01,复式`;

const inspJson = [
  { apply_no: 'ZX2024001', seq: 1, inspector: '李工', inspect_date: '2024-05-20', rule_code: 'R04', detail: '噪音投诉1次' },
  { apply_no: 'ZX2024001', seq: 2, inspector: '李工', inspect_date: '2024-05-25', rule_code: 'R06', detail: '楼道堆料，已整改' },
  { apply_no: 'ZX2024002', seq: 1, inspector: '王工', inspect_date: '2024-06-01', rule_code: 'R02', detail: '违规封阳台' },
  { apply_no: 'ZX2024002', seq: 2, inspector: '王工', inspect_date: '2024-06-05', rule_code: 'R02', detail: '整改完成' },
  { apply_no: 'ZX2024003', seq: 1, inspector: '张工', inspect_date: '2024-06-10', rule_code: 'R01', detail: '拆改承重墙' },
  { apply_no: 'ZX2024003', seq: 2, inspector: '张工', inspect_date: '2024-06-20', rule_code: 'R01', detail: '复查未通过' },
  { apply_no: 'ZX2024003', seq: 3, inspector: '张工', inspect_date: '2024-06-25', rule_code: 'R05', detail: '遮挡消防栓' },
  { apply_no: 'ZX2024004', seq: 1, inspector: '李工', inspect_date: '2024-06-18', rule_code: 'R03', detail: '私接水管' },
  { apply_no: 'ZX2024004', seq: 2, inspector: '李工', inspect_date: '2024-06-22', rule_code: 'R03', detail: '复查通过' },
  { apply_no: 'ZX2024005', seq: 1, inspector: '王工', inspect_date: '2024-07-05', rule_code: 'R06', detail: '占用公共区域，已整改' },
];

const dir = path.join(__dirname, '..', 'sample');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, 'applications.csv'), appCsv, 'utf8');
fs.writeFileSync(path.join(dir, 'inspections.json'), JSON.stringify(inspJson, null, 2), 'utf8');
console.log('示例数据已生成到 sample/ 目录');
