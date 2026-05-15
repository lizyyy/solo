import { get, run, all } from '../database';
import { Certificate, BusBooking } from '../types';

export function generateDemoCertificates(): Certificate[] {
  const now = new Date();
  const certificates: Certificate[] = [
    {
      certificateNo: 'CERT-2024-001',
      applicant: '张三',
      issueDate: '2024-01-15',
      status: 'issued',
      createdAt: new Date(now.getTime() - 86400000 * 5).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000 * 5).toISOString(),
    },
    {
      certificateNo: 'CERT-2024-002',
      applicant: '李四',
      issueDate: '2024-01-20',
      status: 'issued',
      createdAt: new Date(now.getTime() - 86400000 * 4).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000 * 4).toISOString(),
    },
    {
      certificateNo: 'CERT-2024-003',
      applicant: '王五',
      issueDate: '2024-01-10',
      status: 'issued',
      createdAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
    },
    {
      certificateNo: 'CERT-2024-004',
      applicant: '赵六',
      issueDate: '2024-01-25',
      status: 'pending',
      createdAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
    },
    {
      certificateNo: 'CERT-2024-005',
      applicant: '钱七',
      issueDate: '2024-02-01',
      status: 'issued',
      createdAt: new Date(now.getTime() - 86400000 * 6).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000 * 6).toISOString(),
    },
  ];
  return certificates;
}

export function generateDemoBusBookings(): BusBooking[] {
  const now = new Date();
  const bookings: BusBooking[] = [
    {
      originalLineNo: 1,
      employeeName: '张三',
      employeeId: 'EMP001',
      route: '线路A-科技园',
      bookingDate: '2024-01-15',
      manualRemark: '特殊情况：需预留前排座位',
      createdAt: now.toISOString(),
    },
    {
      originalLineNo: 2,
      employeeName: '李四',
      employeeId: 'EMP002',
      route: '线路B-市中心',
      bookingDate: '2024-01-15',
      manualRemark: '',
      createdAt: now.toISOString(),
    },
    {
      originalLineNo: 3,
      employeeName: '王五',
      employeeId: 'EMP003',
      route: '线路A-科技园',
      bookingDate: '2024-01-15',
      manualRemark: '携带大件行李',
      createdAt: now.toISOString(),
    },
    {
      originalLineNo: 4,
      employeeName: '赵六',
      employeeId: 'EMP004',
      route: '线路C-郊区',
      bookingDate: '2024-01-16',
      manualRemark: '需换乘，请确认时间',
      createdAt: now.toISOString(),
    },
    {
      originalLineNo: 5,
      employeeName: '钱七',
      employeeId: 'EMP005',
      route: '线路B-市中心',
      bookingDate: '2024-01-16',
      manualRemark: '',
      createdAt: now.toISOString(),
    },
  ];
  return bookings;
}

export async function insertDemoData() {
  const certCount = await get<{ count: number }>('SELECT COUNT(*) as count FROM certificates');
  
  if (!certCount || certCount.count === 0) {
    const certificates = generateDemoCertificates();
    for (const cert of certificates) {
      await run(
        'INSERT INTO certificates (certificateNo, applicant, issueDate, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [cert.certificateNo, cert.applicant, cert.issueDate, cert.status, cert.createdAt, cert.updatedAt]
      );
    }
    console.log(`已插入 ${certificates.length} 条演示证书数据`);
  }
  
  const bookingCount = await get<{ count: number }>('SELECT COUNT(*) as count FROM bus_bookings');
  if (!bookingCount || bookingCount.count === 0) {
    const bookings = generateDemoBusBookings();
    for (const booking of bookings) {
      await run(
        'INSERT INTO bus_bookings (originalLineNo, employeeName, employeeId, route, bookingDate, manualRemark, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [booking.originalLineNo, booking.employeeName, booking.employeeId, booking.route, booking.bookingDate, booking.manualRemark, booking.createdAt]
      );
    }
    console.log(`已插入 ${bookings.length} 条演示班车预约数据`);
  }
}

export async function getAnomalyCertificateId(): Promise<number | null> {
  const result = await get<{ id: number }>(
    'SELECT id FROM certificates WHERE certificateNo = ?',
    ['CERT-2024-005']
  );
  return result ? result.id : null;
}
