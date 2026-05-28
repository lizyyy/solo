import { VoucherRepository } from '../repositories/VoucherRepository';
import { BalanceService } from '../services/BalanceService';
import { VoucherService } from '../services/VoucherService';

export function insertSampleData() {
  const existingCount = VoucherRepository.getSummary().total;
  if (existingCount > 0) {
    console.log('Sample data already exists, skipping insertion');
    return;
  }

  console.log('Inserting sample data...');
  const operator = '张会计';

  const sampleVouchers = [
    {
      customerName: '阳光小吃店',
      amount: 350.00,
      date: '2026-05-20',
      description: '客户招待餐费',
      fileName: '餐饮发票_20260520.jpg',
      clarity: 85,
      isBlurred: false,
      needsRevision: false,
    },
    {
      customerName: '阳光小吃店',
      amount: 450.00,
      date: '2026-05-21',
      description: '车辆加油费',
      fileName: '中石化加油票_20260521.jpg',
      clarity: 90,
      isBlurred: false,
      needsRevision: false,
    },
    {
      customerName: '阳光小吃店',
      amount: 280.00,
      date: '2026-05-22',
      description: '办公用品采购',
      fileName: '办公文具发票_20260522.jpg',
      clarity: 88,
      isBlurred: false,
      needsRevision: false,
    },
    {
      customerName: '利民便利店',
      amount: 1280.00,
      date: '2026-05-18',
      description: '出差住宿费',
      fileName: '酒店住宿发票_20260518.jpg',
      clarity: 55,
      isBlurred: true,
      needsRevision: true,
    },
    {
      customerName: '利民便利店',
      amount: 85.00,
      date: '2026-05-19',
      description: '市内交通费',
      fileName: '滴滴出行电子凭证_20260519.jpg',
      clarity: 92,
      isBlurred: false,
      needsRevision: false,
    },
    {
      customerName: '鑫源五金店',
      amount: 5600.00,
      date: '2026-05-15',
      description: '原材料采购',
      fileName: '采购发票_20260515.jpg',
      clarity: 87,
      isBlurred: false,
      needsRevision: false,
    },
    {
      customerName: '鑫源五金店',
      amount: 15000.00,
      date: '2026-05-10',
      description: '员工工资发放',
      fileName: '工资表_20260510.jpg',
      clarity: 78,
      isBlurred: false,
      needsRevision: false,
    },
    {
      customerName: '鑫源五金店',
      amount: 320.00,
      date: '2026-05-25',
      description: '水电费',
      fileName: '电费发票_模糊_20260525.jpg',
      clarity: 45,
      isBlurred: true,
      needsRevision: true,
    },
    {
      customerName: '芳芳服装店',
      amount: 800.00,
      date: '2026-05-23',
      description: '物业费',
      fileName: '物业发票_20260523.jpg',
      clarity: 82,
      isBlurred: false,
      needsRevision: false,
    },
    {
      customerName: '芳芳服装店',
      amount: 6800.00,
      date: '2026-05-26',
      description: '销售收入',
      fileName: '销售日报_20260526.jpg',
      clarity: 75,
      isBlurred: false,
      needsRevision: false,
    },
  ];

  const createdVouchers: any[] = [];

  for (const sample of sampleVouchers) {
    const filePath = `/uploads/${sample.fileName}`;

    const voucher = VoucherService.createVoucher({
      customerName: sample.customerName,
      amount: sample.amount,
      date: sample.date,
      description: sample.description,
      uploadedBy: operator,
      imageFileName: sample.fileName,
      imageFilePath: filePath,
      imageFileSize: Math.floor(Math.random() * 2000000) + 500000,
    });

    const parsed = VoucherService.parseVoucher(voucher.id, operator);
    if (parsed) {
      if (sample.needsRevision) {
        VoucherRepository.addNote({
          voucherId: voucher.id,
          content: '【待办】此张票据模糊，金额和日期需要与客户确认后补全',
          createdBy: 'system',
        });

        if (sample.description.includes('水电费')) {
          VoucherRepository.addRevision({
            voucherId: voucher.id,
            fieldName: 'note',
            oldValue: null,
            newValue: '待客户确认电费单价和实际用量',
            reason: '票据模糊，关键信息缺失',
            revisedBy: 'system',
          });
        }

        if (sample.description.includes('住宿')) {
          VoucherRepository.addRevision({
            voucherId: voucher.id,
            fieldName: 'note',
            oldValue: null,
            newValue: '待确认出差人员和事由，补填差旅单',
            reason: '票据模糊，部分信息无法识别',
            revisedBy: 'system',
          });
        }
      } else if (parsed.status !== 'exception' && parsed.mappings.length > 0) {
        const totalDebit = parsed.mappings.filter(m => m.direction === 'debit').reduce((sum, m) => sum + m.amount, 0);
        const totalCredit = parsed.mappings.filter(m => m.direction === 'credit').reduce((sum, m) => sum + m.amount, 0);
        if (Math.abs(totalDebit - totalCredit) < 0.01) {
          VoucherService.completeVoucher(voucher.id, operator);
        }
      }
    }

    createdVouchers.push({ ...voucher, sample });
  }

  const currentPeriod = '2026-05';
  BalanceService.calculateBalances(currentPeriod);

  console.log(`Inserted ${createdVouchers.length} sample vouchers`);
  console.log(`  - Normal: ${createdVouchers.filter(v => !v.sample.isBlurred).length}`);
  console.log(`  - Blurred/Needs revision: ${createdVouchers.filter(v => v.sample.isBlurred).length}`);

  return createdVouchers;
}
