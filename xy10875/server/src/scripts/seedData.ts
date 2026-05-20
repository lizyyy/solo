import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, allQuery } from '../database';
import matchingEngine from '../services/matchingEngine';
import dayjs from 'dayjs';

async function seedData() {
  console.log('开始初始化演示数据...');

  await runQuery(`DELETE FROM status_timeline`);
  await runQuery(`DELETE FROM match_results`);
  await runQuery(`DELETE FROM duplicate_invoices`);
  await runQuery(`DELETE FROM invoice_images`);
  await runQuery(`DELETE FROM reimbursement_forms`);
  await runQuery(`DELETE FROM trip_records`);
  await runQuery(`DELETE FROM budget_categories`);

  console.log('已清空现有数据');

  const budgets = [
    { id: uuidv4(), code: 'BUD001', name: '差旅费-交通费', department: '销售部', annual_budget: 100000, used_budget: 35000 },
    { id: uuidv4(), code: 'BUD002', name: '差旅费-住宿费', department: '销售部', annual_budget: 80000, used_budget: 28000 },
    { id: uuidv4(), code: 'BUD003', name: '差旅费-餐饮费', department: '销售部', annual_budget: 50000, used_budget: 15000 },
    { id: uuidv4(), code: 'BUD004', name: '办公费用', department: '行政部', annual_budget: 30000, used_budget: 8000 },
    { id: uuidv4(), code: 'BUD005', name: '业务招待费', department: '销售部', annual_budget: 60000, used_budget: 20000 },
  ];

  for (const budget of budgets) {
    await runQuery(`
      INSERT INTO budget_categories (id, code, name, department, annual_budget, used_budget, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `, [budget.id, budget.code, budget.name, budget.department, budget.annual_budget, budget.used_budget, dayjs().format('YYYY-MM-DD HH:mm:ss'), dayjs().format('YYYY-MM-DD HH:mm:ss')]);
  }
  console.log(`已插入 ${budgets.length} 条预算科目`);

  const employees = [
    { id: 'E001', name: '张三', department: '销售部' },
    { id: 'E002', name: '李四', department: '销售部' },
    { id: 'E003', name: '王五', department: '技术部' },
    { id: 'E004', name: '赵六', department: '财务部' },
  ];

  const trips = [
    { employee_id: 'E001', employee_name: '张三', department: '销售部', departure_city: '北京', arrival_city: '上海', start_date: '2024-01-15', end_date: '2024-01-18', purpose: '客户拜访', estimated_amount: 3500 },
    { employee_id: 'E001', employee_name: '张三', department: '销售部', departure_city: '北京', arrival_city: '广州', start_date: '2024-02-20', end_date: '2024-02-22', purpose: '参加展会', estimated_amount: 2800 },
    { employee_id: 'E002', employee_name: '李四', department: '销售部', departure_city: '上海', arrival_city: '深圳', start_date: '2024-01-20', end_date: '2024-01-23', purpose: '项目洽谈', estimated_amount: 3200 },
    { employee_id: 'E003', employee_name: '王五', department: '技术部', departure_city: '北京', arrival_city: '杭州', start_date: '2024-02-10', end_date: '2024-02-12', purpose: '技术交流', estimated_amount: 2000 },
  ];

  for (const trip of trips) {
    await runQuery(`
      INSERT INTO trip_records (id, employee_id, employee_name, department, departure_city, arrival_city, start_date, end_date, purpose, estimated_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [uuidv4(), trip.employee_id, trip.employee_name, trip.department, trip.departure_city, trip.arrival_city, trip.start_date, trip.end_date, trip.purpose, trip.estimated_amount, dayjs().format('YYYY-MM-DD HH:mm:ss'), dayjs().format('YYYY-MM-DD HH:mm:ss')]);
  }
  console.log(`已插入 ${trips.length} 条行程记录`);

  const invoiceDataList = [
    { invoice_no: '12345678901234560001', invoice_code: '1100201230', invoice_date: '2024-01-16', amount: 550, tax_amount: 49.5, total_amount: 599.5, seller_name: '中国国际航空股份有限公司', category: '交通', employee_id: 'E001', employee_name: '张三', department: '销售部' },
    { invoice_no: '12345678901234560002', invoice_code: '1100201230', invoice_date: '2024-01-18', amount: 480, tax_amount: 43.2, total_amount: 523.2, seller_name: '中国国际航空股份有限公司', category: '交通', employee_id: 'E001', employee_name: '张三', department: '销售部' },
    { invoice_no: '12345678901234560003', invoice_code: '3100201230', invoice_date: '2024-01-17', amount: 1200, tax_amount: 72, total_amount: 1272, seller_name: '上海希尔顿酒店', category: '住宿', employee_id: 'E001', employee_name: '张三', department: '销售部' },
    { invoice_no: '12345678901234560004', invoice_code: '3100201231', invoice_date: '2024-01-16', amount: 280, tax_amount: 16.8, total_amount: 296.8, seller_name: '上海小南国餐饮', category: '餐饮', employee_id: 'E001', employee_name: '张三', department: '销售部' },
    { invoice_no: '12345678901234560005', invoice_code: '4400201230', invoice_date: '2024-01-21', amount: 720, tax_amount: 64.8, total_amount: 784.8, seller_name: '深圳航空有限公司', category: '交通', employee_id: 'E002', employee_name: '李四', department: '销售部' },
    { invoice_no: '12345678901234560006', invoice_code: '4400201231', invoice_date: '2024-01-22', amount: 980, tax_amount: 58.8, total_amount: 1038.8, seller_name: '深圳万豪酒店', category: '住宿', employee_id: 'E002', employee_name: '李四', department: '销售部' },
    { invoice_no: '12345678901234560007', invoice_code: '3300201230', invoice_date: '2024-02-11', amount: 420, tax_amount: 37.8, total_amount: 457.8, seller_name: '杭州东站', category: '交通', employee_id: 'E003', employee_name: '王五', department: '技术部' },
    { invoice_no: '12345678901234560008', invoice_code: '3300201231', invoice_date: '2024-02-11', amount: 560, tax_amount: 33.6, total_amount: 593.6, seller_name: '杭州西湖国宾馆', category: '住宿', employee_id: 'E003', employee_name: '王五', department: '技术部' },
    { invoice_no: '12345678901234560009', invoice_code: '1100201230', invoice_date: '2024-02-21', amount: 890, tax_amount: 80.1, total_amount: 970.1, seller_name: '中国南方航空', category: '交通', employee_id: 'E001', employee_name: '张三', department: '销售部' },
    { invoice_no: '12345678901234560010', invoice_code: '1100201232', invoice_date: '2024-03-01', amount: 350, tax_amount: 21, total_amount: 371, seller_name: '北京办公用品商店', category: '办公', employee_id: 'E004', employee_name: '赵六', department: '财务部' },
  ];

  for (const invoiceData of invoiceDataList) {
    const invoice = await matchingEngine.receiveInvoiceOCR(invoiceData);
    const { isDuplicate } = await matchingEngine.checkDuplicate(invoice.id);
    if (!isDuplicate) {
      await matchingEngine.autoMatch(invoice.id);
    }
  }
  console.log(`已插入 ${invoiceDataList.length} 条票据数据`);

  const duplicateInvoice = await matchingEngine.receiveInvoiceOCR({
    invoice_no: '12345678901234560001',
    invoice_code: '1100201230',
    invoice_date: '2024-01-16',
    amount: 550,
    tax_amount: 49.5,
    total_amount: 599.5,
    seller_name: '中国国际航空股份有限公司',
    category: '交通',
    employee_id: 'E001',
    employee_name: '张三',
    department: '销售部',
  });
  await matchingEngine.checkDuplicate(duplicateInvoice.id);
  console.log('已插入1条重复票据用于演示');

  const pendingInvoice = await matchingEngine.receiveInvoiceOCR({
    invoice_no: '99999999999999999999',
    invoice_code: '9999999999',
    invoice_date: '2024-03-15',
    amount: 1500,
    tax_amount: 90,
    total_amount: 1590,
    seller_name: '某某公司',
    category: '其他',
    employee_id: 'E002',
    employee_name: '李四',
    department: '销售部',
  });
  console.log('已插入1条待人工匹配票据');

  const allInvoices = await allQuery(`SELECT * FROM invoice_images ORDER BY created_at DESC`);
  const matchedInvoices = allInvoices.filter((i: any) => i.status === 'matched');
  
  if (matchedInvoices.length > 0) {
    const matches = await allQuery(`SELECT * FROM match_results WHERE invoice_id = ?`, [matchedInvoices[0].id]);
    if (matches.length > 0) {
      await matchingEngine.confirmMatch(matches[0].id, '演示用户');
      console.log('已确认1条匹配记录用于演示');
    }
  }

  console.log('\n演示数据初始化完成！');
  console.log('========================================');
  console.log(`预算科目: ${budgets.length} 条`);
  console.log(`行程记录: ${trips.length} 条`);
  console.log(`票据总数: ${allInvoices.length} 条`);
  console.log(`  - 待匹配: ${allInvoices.filter((i: any) => i.status === 'pending').length} 条`);
  console.log(`  - 已匹配: ${allInvoices.filter((i: any) => i.status === 'matched').length} 条`);
  console.log(`  - 重复: ${allInvoices.filter((i: any) => i.status === 'duplicate').length} 条`);
  console.log(`  - 已确认: ${allInvoices.filter((i: any) => i.status === 'confirmed').length} 条`);
  console.log('========================================');
  console.log('您可以通过前端界面查看和操作这些演示数据');
  console.log('前端地址: http://localhost:5173');
  console.log('后端API: http://localhost:3001');
  console.log('========================================');

  process.exit(0);
}

seedData().catch((error) => {
  console.error('初始化演示数据失败:', error);
  process.exit(1);
});
