// @ts-ignore
const XLSX = require('xlsx');
import path from 'path';
import fs from 'fs';

const advisors = ['张三', '李四', '王五', '赵六', '钱七'];
const channels = ['全民经纪人', '老业主推荐', '渠道分销', '中介带看', '线上广告', '自然到访'];
const statuses = ['已认领', '已确认', '待确认', '未认领'];

const customers = [
  { name: '客户A', phone: '13800138001' },
  { name: '客户B', phone: '13800138002' },
  { name: '客户C', phone: '13800138003' },
  { name: '客户D', phone: '13800138004' },
  { name: '客户E', phone: '13800138005' },
  { name: '客户F', phone: '13800138006' },
  { name: '客户G', phone: '13800138007' },
  { name: '客户H', phone: '13800138008' },
  { name: '客户I', phone: 'invalid-phone' },
  { name: '', phone: '13800138009' },
];

function generateVisitData() {
  const data = [['客户姓名', '客户电话', '来访日期', '置业顾问', '渠道名称', '认领状态']];
  
  customers.slice(0, 8).forEach((customer, i) => {
    data.push([
      customer.name,
      customer.phone,
      `2024-0${(i % 9) + 1}-${(i % 28) + 1}`,
      advisors[i % advisors.length],
      channels[i % channels.length],
      statuses[i % statuses.length]
    ]);
  });
  
  data.push(['坏客户1', 'invalid-phone', '2024-01-15', '张三', '自然到访', '已认领']);
  data.push(['坏客户2', '', '2024-01-16', '', '', '']);
  
  return data;
}

function generateChannelData() {
  const data = [['客户姓名', '客户电话', '渠道名称', '渠道类型', '置业顾问', '认领状态', '认领时间']];
  
  customers.slice(0, 6).forEach((customer, i) => {
    data.push([
      customer.name,
      customer.phone,
      channels[(i + 2) % channels.length],
      '渠道类型' + (i % 3),
      advisors[(i + 1) % advisors.length],
      statuses[(i + 1) % statuses.length],
      `2024-0${(i % 9) + 1}-${(i % 28) + 1}`
    ]);
  });
  
  customers.slice(0, 3).forEach((customer, i) => {
    data.push([
      customer.name,
      customer.phone,
      channels[(i + 4) % channels.length],
      '渠道类型' + ((i + 2) % 3),
      advisors[(i + 3) % advisors.length],
      statuses[(i + 2) % statuses.length],
      `2024-0${(i % 9) + 1}-${(i % 28) + 2}`
    ]);
  });
  
  data.push(['坏渠道1', '12345', '', '类型1', '顾问A', '已认领', '']);
  data.push(['坏渠道2', '13800138999', '', '类型2', '', '', '']);
  
  return data;
}

function main() {
  const examplesDir = path.join(process.cwd(), 'examples');
  
  if (!fs.existsSync(examplesDir)) {
    fs.mkdirSync(examplesDir, { recursive: true });
  }
  
  const visitWB = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(visitWB, XLSX.utils.aoa_to_sheet(generateVisitData()), '来访记录');
  XLSX.writeFile(visitWB, path.join(examplesDir, '来访表示例.xlsx'));
  console.log('✅ 已生成: examples/来访表示例.xlsx');
  
  const channelWB = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(channelWB, XLSX.utils.aoa_to_sheet(generateChannelData()), '渠道记录');
  XLSX.writeFile(channelWB, path.join(examplesDir, '渠道表示例.xlsx'));
  console.log('✅ 已生成: examples/渠道表示例.xlsx');
  
  console.log('\n📝 示例数据说明:');
  console.log('  - 前6个客户在两个表中都有记录，用于测试重复认领');
  console.log('  - 客户A/B/C在渠道表中有多条记录，属于不同渠道/顾问');
  console.log('  - 包含无效电话、空值等坏数据，用于测试异常处理');
}

main();
