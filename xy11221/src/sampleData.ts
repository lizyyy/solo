import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const TODAY = new Date().toISOString().split('T')[0];

export async function createSampleExcel(): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('留样记录');

  worksheet.columns = [
    { header: '日期', key: 'date', width: 12 },
    { header: '菜品名称', key: 'dishName', width: 20 },
    { header: '菜品类型', key: 'dishType', width: 12 },
    { header: '数量', key: 'quantity', width: 10 },
    { header: '留样人', key: 'reservedBy', width: 12 },
    { header: '留样时间', key: 'reservedAt', width: 20 },
    { header: '存放位置', key: 'storageLocation', width: 15 },
    { header: '废弃日期', key: 'discardDate', width: 12 },
    { header: '备注', key: 'remarks', width: 20 }
  ];

  const sampleData = [
    {
      date: TODAY,
      dishName: '宫保鸡丁',
      dishType: '热菜',
      quantity: 1,
      reservedBy: '张厨师',
      reservedAt: `${TODAY} 10:30:00`,
      storageLocation: '留样冰箱1号',
      discardDate: TODAY,
      remarks: '正常留样'
    },
    {
      date: TODAY,
      dishName: '红烧肉',
      dishType: '热菜',
      quantity: 1,
      reservedBy: '张厨师',
      reservedAt: `${TODAY} 10:35:00`,
      storageLocation: '留样冰箱1号',
      discardDate: TODAY,
      remarks: '正常留样'
    },
    {
      date: TODAY,
      dishName: '凉拌黄瓜',
      dishType: '凉菜',
      quantity: 1,
      reservedBy: '李厨师',
      reservedAt: `${TODAY} 10:40:00`,
      storageLocation: '留样冰箱1号',
      discardDate: TODAY,
      remarks: ''
    },
    {
      date: TODAY,
      dishName: '',
      dishType: '主食',
      quantity: 1,
      reservedBy: '王厨师',
      reservedAt: `${TODAY} 10:45:00`,
      storageLocation: '留样冰箱2号',
      discardDate: TODAY,
      remarks: '测试错误数据 - 菜品名称为空'
    },
    {
      date: TODAY,
      dishName: '蛋炒饭',
      dishType: '主食',
      quantity: -1,
      reservedBy: '王厨师',
      reservedAt: `${TODAY} 10:50:00`,
      storageLocation: '留样冰箱2号',
      discardDate: TODAY,
      remarks: '测试错误数据 - 数量为负数'
    }
  ];

  sampleData.forEach(row => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };

  const dataDir = './data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, 'sample_retention.xlsx');
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

export async function createTemperatureCSV(): Promise<string> {
  const headers = ['日期', '冰箱编号', '冰箱名称', '温度', '最低温度', '最高温度', '测量人', '测量时间', '备注'];
  
  const csvData = [
    headers.join(','),
    `${TODAY},FRIDGE-001,留样冰箱1号,4.2,0,8,张主管,${TODAY} 08:00:00,正常`,
    `${TODAY},FRIDGE-001,留样冰箱1号,3.8,0,8,张主管,${TODAY} 12:00:00,正常`,
    `${TODAY},FRIDGE-001,留样冰箱1号,4.5,0,8,张主管,${TODAY} 18:00:00,正常`,
    `${TODAY},FRIDGE-002,留样冰箱2号,9.2,0,8,李主管,${TODAY} 08:00:00,温度异常偏高`,
    `${TODAY},FRIDGE-002,留样冰箱2号,5.0,0,8,李主管,${TODAY} 12:00:00,已调整`,
    `,FRIDGE-002,留样冰箱2号,4.8,0,8,李主管,${TODAY} 18:00:00,测试错误数据 - 日期为空`,
    `${TODAY},FRIDGE-003,肉类冰箱,invalid,0,8,王主管,${TODAY} 08:00:00,测试错误数据 - 温度无效`
  ];

  const dataDir = './data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, 'temperature_log.csv');
  fs.writeFileSync(filePath, '\uFEFF' + csvData.join('\n'), 'utf8');
  return filePath;
}