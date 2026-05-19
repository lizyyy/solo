const XLSX = require('xlsx');
const path = require('path');

const outOfStockData = [
  { product_id: 'P001', product_name: '新鲜草莓', stock_quantity: 0, affected_orders: 2 },
  { product_id: 'P002', product_name: '有机蓝莓', stock_quantity: 0, affected_orders: 1 },
  { product_id: '', product_name: '精选樱桃', stock_quantity: 0, affected_orders: 3 }
];

const ws = XLSX.utils.json_to_sheet(outOfStockData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '缺货清单');

const filePath = path.join(__dirname, '../data/samples/out_of_stock.xlsx');
XLSX.writeFile(wb, filePath);

console.log('缺货清单Excel已生成:', filePath);
