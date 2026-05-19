const XLSX = require('xlsx');
const path = require('path');

const shortageData = [
  {
    productId: 'P001',
    productName: '新鲜草莓',
    shortageDate: '2024-01-16',
    expectedQuantity: 100,
    actualQuantity: 95,
    shortageQuantity: 5,
    supplierId: 'S001',
    supplierName: '草莓农场',
    reason: '天气原因导致减产'
  },
  {
    productId: 'P002',
    productName: '进口车厘子',
    shortageDate: '2024-01-16',
    expectedQuantity: 50,
    actualQuantity: 45,
    shortageQuantity: 5,
    supplierId: 'S002',
    supplierName: '进口水果供应商',
    reason: '海关清关延迟'
  },
  {
    productId: 'P003',
    productName: '有机猕猴桃',
    shortageDate: '2024-01-16',
    expectedQuantity: 80,
    actualQuantity: 70,
    shortageQuantity: 10,
    supplierId: 'S003',
    supplierName: '有机农场',
    reason: '运输损坏'
  }
];

const worksheet = XLSX.utils.json_to_sheet(shortageData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, '缺货清单');

const filePath = path.join(__dirname, 'shortage_list.xlsx');
XLSX.writeFile(workbook, filePath);
console.log('已生成缺货清单Excel文件:', filePath);
