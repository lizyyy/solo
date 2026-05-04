import { createTables, dropTables } from '../database/schema';
import { 
  TeacherService, StudentService, ClassService, 
  PackageService, LessonService, NotificationService, ExportService 
} from '../services';
import { BusinessError, ErrorCodes } from '../errors';
import { addDays, now } from '../utils/date';
import dayjs from 'dayjs';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

const test = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, details: err.code });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    if (err.code) {
      console.log(`   Code: ${err.code}`);
    }
  }
};

export const runSelfCheck = async () => {
  console.log('\n========================================');
  console.log('  Dance Studio API Self-Check');
  console.log('========================================\n');

  console.log('Resetting database...');
  dropTables();
  createTables();
  console.log('Database reset complete.\n');

  const teacherService = new TeacherService();
  const studentService = new StudentService();
  const classService = new ClassService();
  const packageService = new PackageService();
  const lessonService = new LessonService();
  const notificationService = new NotificationService();
  const exportService = new ExportService();

  console.log('--- Basic CRUD Tests ---\n');

  await test('Create teacher', async () => {
    const teacher = await teacherService.createTeacher({
      name: '李老师',
      phone: '13800138001',
      hourly_rate: 200,
    });
    if (teacher.name !== '李老师') throw new Error('Name mismatch');
  });

  await test('Create student', async () => {
    const student = await studentService.createStudent({
      name: '张小雨',
      phone: '13900139001',
      guardian_name: '张妈妈',
      guardian_phone: '13900139001',
    });
    if (student.name !== '张小雨') throw new Error('Name mismatch');
  });

  await test('Create class with teacher', async () => {
    const teacher = await teacherService.createTeacher({
      name: '王老师',
      hourly_rate: 180,
    });
    const cls = await classService.createClass({
      name: '少儿芭蕾基础班',
      teacher_id: teacher.id,
      capacity: 8,
    });
    if (cls.teacher_id !== teacher.id) throw new Error('Teacher ID mismatch');
  });

  await test('Create student package', async () => {
    const student = await studentService.createStudent({
      name: '课包测试学生',
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '20次课包',
      total_lessons: 20,
      valid_days: 180,
    });
    if (pkg.total_lessons !== 20) throw new Error('Total lessons mismatch');
    if (pkg.used_lessons !== 0) throw new Error('Used lessons should be 0');
  });

  console.log('\n--- Package Business Rules ---\n');

  await test('Deduct lesson from package', async () => {
    const student = await studentService.createStudent({
      name: '扣课测试学生',
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const updated = await packageService.deductLesson(pkg.id);
    if (updated.used_lessons !== 1) throw new Error('Used lessons should be 1');
  });

  await test('Refund lesson to package', async () => {
    const student = await studentService.createStudent({
      name: '退款测试学生',
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    await packageService.deductLesson(pkg.id);
    const updated = await packageService.refundLesson(pkg.id);
    if (updated.used_lessons !== 0) throw new Error('Used lessons should be 0');
  });

  await test('Freeze and unfreeze package', async () => {
    const student = await studentService.createStudent({
      name: '冻结测试学生',
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    
    const frozen = await packageService.freezePackage(pkg.id, 30);
    if (frozen.is_frozen !== 1) throw new Error('Package should be frozen');
    
    const unfrozen = await packageService.unfreezePackage(pkg.id);
    if (unfrozen.is_frozen !== 0) throw new Error('Package should be unfrozen');
  });

  await test('Get package balance', async () => {
    const student = await studentService.createStudent({
      name: '余额测试学生',
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    await packageService.deductLesson(pkg.id);
    
    const balance = await packageService.getPackageBalance(pkg.id);
    if (balance.total !== 10) throw new Error('Total mismatch');
    if (balance.used !== 1) throw new Error('Used mismatch');
    if (balance.remaining !== 9) throw new Error('Remaining mismatch');
  });

  console.log('\n--- Booking Business Rules ---\n');

  await test('Book a lesson', async () => {
    const teacher = await teacherService.createTeacher({
      name: '预约测试老师',
      hourly_rate: 200,
    });
    const student = await studentService.createStudent({
      name: '预约测试学生',
    });
    const cls = await classService.createClass({
      name: '预约测试班级',
      teacher_id: teacher.id,
      capacity: 10,
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '预约测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const tomorrow = dayjs().add(1, 'day');
    const lesson = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(11).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    });
    
    const booking = await lessonService.bookLesson(student.id, lesson.id, pkg.id);
    if (booking.lesson_id !== lesson.id) throw new Error('Lesson ID mismatch');
  });

  console.log('\n--- Validation Tests ---\n');

  await test('Prevent double booking', async () => {
    const teacher = await teacherService.createTeacher({
      name: '重复预约测试老师',
      hourly_rate: 200,
    });
    const student = await studentService.createStudent({
      name: '重复预约测试学生',
    });
    const cls = await classService.createClass({
      name: '重复预约测试班级',
      teacher_id: teacher.id,
      capacity: 10,
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const tomorrow = dayjs().add(1, 'day');
    const lesson = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(14).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(15).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    });
    
    await lessonService.bookLesson(student.id, lesson.id, pkg.id);
    
    try {
      await lessonService.bookLesson(student.id, lesson.id, pkg.id);
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (err.code !== ErrorCodes.STUDENT_ALREADY_BOOKED) {
        throw new Error(`Expected ${ErrorCodes.STUDENT_ALREADY_BOOKED}, got ${err.code}`);
      }
    }
  });

  await test('Validate class capacity', async () => {
    const teacher = await teacherService.createTeacher({
      name: '容量测试老师',
      hourly_rate: 200,
    });
    const student1 = await studentService.createStudent({ name: '容量测试学生1' });
    const student2 = await studentService.createStudent({ name: '容量测试学生2' });
    const cls = await classService.createClass({
      name: '容量测试班级',
      teacher_id: teacher.id,
      capacity: 1,
    });
    const pkg1 = await packageService.createStudentPackage({
      student_id: student1.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const pkg2 = await packageService.createStudentPackage({
      student_id: student2.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const tomorrow = dayjs().add(1, 'day');
    const lesson = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(16).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(17).minute(30).format('YYYY-MM-DD HH:mm:ss'),
      capacity: 1,
    });
    
    await lessonService.bookLesson(student1.id, lesson.id, pkg1.id);
    
    try {
      await lessonService.bookLesson(student2.id, lesson.id, pkg2.id);
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (err.code !== ErrorCodes.CLASS_CAPACITY_FULL) {
        throw new Error(`Expected ${ErrorCodes.CLASS_CAPACITY_FULL}, got ${err.code}`);
      }
    }
  });

  await test('Validate time slot conflict', async () => {
    const teacher = await teacherService.createTeacher({
      name: '时间冲突测试老师',
      hourly_rate: 200,
    });
    const student = await studentService.createStudent({ name: '时间冲突测试学生' });
    const cls = await classService.createClass({
      name: '时间冲突测试班级',
      teacher_id: teacher.id,
      capacity: 10,
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const tomorrow = dayjs().add(1, 'day');
    
    const lesson1 = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(11).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    });
    
    const lesson2 = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(10).minute(30).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(12).minute(0).format('YYYY-MM-DD HH:mm:ss'),
    });
    
    await lessonService.bookLesson(student.id, lesson1.id, pkg.id);
    
    try {
      await lessonService.bookLesson(student.id, lesson2.id, pkg.id);
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (err.code !== ErrorCodes.TIME_SLOT_CONFLICT) {
        throw new Error(`Expected ${ErrorCodes.TIME_SLOT_CONFLICT}, got ${err.code}`);
      }
    }
  });

  await test('Validate package expiration', async () => {
    const teacher = await teacherService.createTeacher({
      name: '过期测试老师',
      hourly_rate: 200,
    });
    const student = await studentService.createStudent({ name: '过期测试学生' });
    const cls = await classService.createClass({
      name: '过期测试班级',
      teacher_id: teacher.id,
      capacity: 10,
    });
    const expiredPkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '过期课包',
      total_lessons: 10,
      valid_days: -1,
    });
    const tomorrow = dayjs().add(1, 'day');
    const lesson = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(18).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(19).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    });
    
    try {
      await lessonService.bookLesson(student.id, lesson.id, expiredPkg.id);
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (err.code !== ErrorCodes.PACKAGE_EXPIRED) {
        throw new Error(`Expected ${ErrorCodes.PACKAGE_EXPIRED}, got ${err.code}`);
      }
    }
  });

  await test('Validate insufficient lessons', async () => {
    const teacher = await teacherService.createTeacher({
      name: '余额不足测试老师',
      hourly_rate: 200,
    });
    const student = await studentService.createStudent({ name: '余额不足测试学生' });
    const cls = await classService.createClass({
      name: '余额不足测试班级',
      teacher_id: teacher.id,
      capacity: 10,
    });
    const emptyPkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '空课包',
      total_lessons: 0,
      valid_days: 180,
    });
    const tomorrow = dayjs().add(1, 'day');
    const lesson = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(20).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(21).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    });
    
    try {
      await lessonService.bookLesson(student.id, lesson.id, emptyPkg.id);
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (err.code !== ErrorCodes.INSUFFICIENT_LESSONS) {
        throw new Error(`Expected ${ErrorCodes.INSUFFICIENT_LESSONS}, got ${err.code}`);
      }
    }
  });

  console.log('\n--- Leave and Makeup Tests ---\n');

  await test('Request leave and create makeup ticket', async () => {
    const teacher = await teacherService.createTeacher({
      name: '请假测试老师',
      hourly_rate: 200,
    });
    const student = await studentService.createStudent({ name: '请假测试学生' });
    const cls = await classService.createClass({
      name: '请假测试班级',
      teacher_id: teacher.id,
      capacity: 10,
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const tomorrow = dayjs().add(1, 'day');
    const lesson = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(9).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(10).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    });
    
    const booking = await lessonService.bookLesson(student.id, lesson.id, pkg.id);
    const result = await lessonService.requestLeave(booking.id, '身体不适');
    
    if (!result.leave) throw new Error('Leave not created');
    if (!result.makeupTicket) throw new Error('Makeup ticket not created');
    if (result.makeupTicket.status !== 'available') throw new Error('Makeup ticket should be available');
  });

  await test('Use makeup ticket for another lesson', async () => {
    const teacher = await teacherService.createTeacher({
      name: '补课测试老师',
      hourly_rate: 200,
    });
    const student = await studentService.createStudent({ name: '补课测试学生' });
    const cls = await classService.createClass({
      name: '补课测试班级',
      teacher_id: teacher.id,
      capacity: 10,
    });
    const pkg = await packageService.createStudentPackage({
      student_id: student.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const tomorrow = dayjs().add(1, 'day');
    const nextWeek = dayjs().add(7, 'day');
    
    const lesson1 = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(9).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(10).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    });
    
    const lesson2 = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: nextWeek.hour(9).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: nextWeek.hour(10).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    });
    
    const booking = await lessonService.bookLesson(student.id, lesson1.id, pkg.id);
    const { makeupTicket } = await lessonService.requestLeave(booking.id, '请假');
    
    const makeupBooking = await lessonService.useMakeupTicket(makeupTicket.id, lesson2.id);
    
    if (makeupBooking.is_makeup !== 1) throw new Error('Should be marked as makeup');
    if (makeupBooking.makeup_ticket_id !== makeupTicket.id) throw new Error('Makeup ticket ID mismatch');
  });

  console.log('\n--- Waitlist Tests ---\n');

  await test('Join waitlist when class is full', async () => {
    const teacher = await teacherService.createTeacher({
      name: '候补测试老师',
      hourly_rate: 200,
    });
    const student1 = await studentService.createStudent({ name: '候补测试学生1' });
    const student2 = await studentService.createStudent({ name: '候补测试学生2' });
    const cls = await classService.createClass({
      name: '候补测试班级',
      teacher_id: teacher.id,
      capacity: 1,
    });
    const pkg1 = await packageService.createStudentPackage({
      student_id: student1.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const pkg2 = await packageService.createStudentPackage({
      student_id: student2.id,
      name: '测试课包',
      total_lessons: 10,
      valid_days: 180,
    });
    const tomorrow = dayjs().add(1, 'day');
    const lesson = await lessonService.createLesson({
      class_id: cls.id,
      teacher_id: teacher.id,
      start_time: tomorrow.hour(11).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: tomorrow.hour(12).minute(30).format('YYYY-MM-DD HH:mm:ss'),
      capacity: 1,
    });
    
    await lessonService.bookLesson(student1.id, lesson.id, pkg1.id);
    
    try {
      await lessonService.bookLesson(student2.id, lesson.id, pkg2.id);
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (err.code !== ErrorCodes.CLASS_CAPACITY_FULL) {
        throw new Error(`Expected ${ErrorCodes.CLASS_CAPACITY_FULL}, got ${err.code}`);
      }
    }
    
    const waitlist = await lessonService.joinWaitlist(student2.id, lesson.id);
    if (waitlist.position !== 1) throw new Error('Position should be 1');
    if (waitlist.status !== 'waiting') throw new Error('Status should be waiting');
  });

  console.log('\n--- Export Tests ---\n');

  await test('Export student balances to JSON', async () => {
    const balances = await exportService.getStudentBalanceReport();
    const json = await exportService.exportToJSON(balances);
    if (!json) throw new Error('JSON export failed');
  });

  await test('Export student balances to CSV', async () => {
    const balances = await exportService.getStudentBalanceReport();
    const csv = await exportService.exportStudentBalancesToCSV(balances);
    if (!csv) throw new Error('CSV export failed');
  });

  await test('Get monthly report', async () => {
    const now = dayjs();
    const report = await exportService.getMonthlyReport(now.year(), now.month() + 1);
    if (!report) throw new Error('Monthly report failed');
  });

  console.log('\n--- Notification Tests ---\n');

  await test('Generate todos', async () => {
    const todos = await notificationService.generateToDos();
    if (!todos) throw new Error('Todos generation failed');
  });

  console.log('\n========================================');
  console.log('  Self-Check Results');
  console.log('========================================\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n--- Failed Tests ---');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`❌ ${r.name}`);
      console.log(`   Error: ${r.error}`);
      if (r.details) console.log(`   Details: ${JSON.stringify(r.details)}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }

  return { passed, failed, results };
};

if (require.main === module) {
  runSelfCheck().catch(err => {
    console.error('Self-check failed:', err);
    process.exit(1);
  });
}
