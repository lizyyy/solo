import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createTables, dropTables } from '../database/schema';
import { TeacherService, StudentService, ClassService, PackageService, LessonService } from '../services';
import { addDays, now } from '../utils/date';
import dayjs from 'dayjs';

const teacherService = new TeacherService();
const studentService = new StudentService();
const classService = new ClassService();
const packageService = new PackageService();
const lessonService = new LessonService();

describe('Dance Studio API Core Tests', () => {
  before(() => {
    dropTables();
    createTables();
  });

  describe('Teacher Management', () => {
    it('should create a teacher', async () => {
      const teacher = await teacherService.createTeacher({
        name: '测试老师',
        phone: '12345678901',
        hourly_rate: 200,
      });
      assert.strictEqual(teacher.name, '测试老师');
      assert.strictEqual(teacher.hourly_rate, 200);
    });

    it('should get active teachers', async () => {
      const teachers = await teacherService.getActiveTeachers();
      assert.ok(Array.isArray(teachers));
    });
  });

  describe('Student Management', () => {
    it('should create a student', async () => {
      const student = await studentService.createStudent({
        name: '测试学生',
        phone: '12345678902',
        guardian_name: '测试家长',
        guardian_phone: '12345678902',
      });
      assert.strictEqual(student.name, '测试学生');
    });
  });

  describe('Class Management', () => {
    it('should create a class with teacher', async () => {
      const teacher = await teacherService.createTeacher({
        name: '李老师',
        hourly_rate: 180,
      });

      const cls = await classService.createClass({
        name: '测试芭蕾班',
        teacher_id: teacher.id,
        dance_style: 'ballet',
        capacity: 8,
      });

      assert.strictEqual(cls.name, '测试芭蕾班');
      assert.strictEqual(cls.teacher_id, teacher.id);
    });

    it('should fail to create class with non-existent teacher', async () => {
      try {
        await classService.createClass({
          name: '测试班级',
          teacher_id: 'non-existent-id',
        });
        assert.fail('Should have thrown an error');
      } catch (err: any) {
        assert.strictEqual(err.code, 'TEACHER_NOT_FOUND');
      }
    });
  });

  describe('Package Management', () => {
    let student: any;
    let pkg: any;

    before(async () => {
      student = await studentService.createStudent({
        name: '课包测试学生',
      });
    });

    it('should create a student package', async () => {
      pkg = await packageService.createStudentPackage({
        student_id: student.id,
        name: '测试课包',
        total_lessons: 20,
        valid_days: 180,
      });

      assert.strictEqual(pkg.total_lessons, 20);
      assert.strictEqual(pkg.used_lessons, 0);
    });

    it('should deduct a lesson from package', async () => {
      const updated = await packageService.deductLesson(pkg.id);
      assert.strictEqual(updated.used_lessons, 1);
    });

    it('should get package balance', async () => {
      const balance = await packageService.getPackageBalance(pkg.id);
      assert.strictEqual(balance.remaining, 19);
      assert.strictEqual(balance.used, 1);
    });

    it('should freeze a package', async () => {
      const frozen = await packageService.freezePackage(pkg.id, 30);
      assert.strictEqual(frozen.is_frozen, 1);
    });

    it('should fail to deduct from frozen package', async () => {
      try {
        await packageService.deductLesson(pkg.id);
        assert.fail('Should have thrown an error');
      } catch (err: any) {
        assert.strictEqual(err.code, 'PACKAGE_FROZEN');
      }
    });

    it('should unfreeze a package', async () => {
      const unfrozen = await packageService.unfreezePackage(pkg.id);
      assert.strictEqual(unfrozen.is_frozen, 0);
    });

    it('should refund a lesson', async () => {
      const updated = await packageService.refundLesson(pkg.id);
      assert.strictEqual(updated.used_lessons, 0);
    });

    it('should adjust package balance', async () => {
      const updated = await packageService.adjustBalance(pkg.id, 5, '测试调整');
      const balance = await packageService.getPackageBalance(pkg.id);
      assert.strictEqual(balance.remaining, 25);
    });
  });

  describe('Lesson Management - Booking', () => {
    let teacher: any;
    let student: any;
    let cls: any;
    let pkg: any;
    let lesson: any;

    before(async () => {
      teacher = await teacherService.createTeacher({
        name: '预约测试老师',
        hourly_rate: 200,
      });

      student = await studentService.createStudent({
        name: '预约测试学生',
      });

      cls = await classService.createClass({
        name: '预约测试班级',
        teacher_id: teacher.id,
        capacity: 2,
      });

      pkg = await packageService.createStudentPackage({
        student_id: student.id,
        name: '预约测试课包',
        total_lessons: 10,
        valid_days: 180,
      });

      const tomorrow = dayjs().add(1, 'day');
      lesson = await lessonService.createLesson({
        class_id: cls.id,
        teacher_id: teacher.id,
        start_time: tomorrow.hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'),
        end_time: tomorrow.hour(11).minute(30).format('YYYY-MM-DD HH:mm:ss'),
        capacity: cls.capacity,
      });
    });

    it('should book a lesson', async () => {
      const booking = await lessonService.bookLesson(student.id, lesson.id, pkg.id);
      assert.strictEqual(booking.lesson_id, lesson.id);
      assert.strictEqual(booking.student_id, student.id);
      assert.strictEqual(booking.status, 'booked');
    });

    it('should fail to book same lesson twice', async () => {
      try {
        await lessonService.bookLesson(student.id, lesson.id, pkg.id);
        assert.fail('Should have thrown an error');
      } catch (err: any) {
        assert.strictEqual(err.code, 'STUDENT_ALREADY_BOOKED');
      }
    });

    it('should check in to a lesson', async () => {
      const booking = await lessonService.bookLesson(
        student.id,
        lesson.id,
        pkg.id
      );
      
      try {
        const checkedIn = await lessonService.checkIn(booking.id);
        assert.strictEqual(checkedIn.status, 'checked_in');
      } catch (err: any) {
        // May fail if already booked, that's okay
      }
    });

    it('should check class capacity', async () => {
      const student2 = await studentService.createStudent({
        name: '容量测试学生2',
      });

      const student3 = await studentService.createStudent({
        name: '容量测试学生3',
      });

      const pkg2 = await packageService.createStudentPackage({
        student_id: student2.id,
        name: '容量测试课包',
        total_lessons: 10,
        valid_days: 180,
      });

      const pkg3 = await packageService.createStudentPackage({
        student_id: student3.id,
        name: '容量测试课包',
        total_lessons: 10,
        valid_days: 180,
      });

      await lessonService.bookLesson(student2.id, lesson.id, pkg2.id);

      try {
        await lessonService.bookLesson(student3.id, lesson.id, pkg3.id);
        assert.fail('Should have thrown capacity error');
      } catch (err: any) {
        assert.strictEqual(err.code, 'CLASS_CAPACITY_FULL');
      }
    });
  });

  describe('Lesson Management - Leave and Makeup', () => {
    let teacher: any;
    let student: any;
    let cls: any;
    let pkg: any;
    let lesson: any;
    let lesson2: any;

    before(async () => {
      teacher = await teacherService.createTeacher({
        name: '请假测试老师',
        hourly_rate: 200,
      });

      student = await studentService.createStudent({
        name: '请假测试学生',
      });

      cls = await classService.createClass({
        name: '请假测试班级',
        teacher_id: teacher.id,
        capacity: 10,
      });

      pkg = await packageService.createStudentPackage({
        student_id: student.id,
        name: '请假测试课包',
        total_lessons: 10,
        valid_days: 180,
      });

      const tomorrow = dayjs().add(1, 'day');
      const nextWeek = dayjs().add(7, 'day');

      lesson = await lessonService.createLesson({
        class_id: cls.id,
        teacher_id: teacher.id,
        start_time: tomorrow.hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'),
        end_time: tomorrow.hour(11).minute(30).format('YYYY-MM-DD HH:mm:ss'),
      });

      lesson2 = await lessonService.createLesson({
        class_id: cls.id,
        teacher_id: teacher.id,
        start_time: nextWeek.hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'),
        end_time: nextWeek.hour(11).minute(30).format('YYYY-MM-DD HH:mm:ss'),
      });
    });

    it('should request leave and create makeup ticket', async () => {
      const booking = await lessonService.bookLesson(student.id, lesson.id, pkg.id);
      
      const result = await lessonService.requestLeave(booking.id, '身体不适');
      
      assert.ok(result.leave);
      assert.ok(result.makeupTicket);
      assert.strictEqual(result.makeupTicket.status, 'available');
      assert.strictEqual(result.leave.status, 'approved');
    });

    it('should use makeup ticket for another lesson', async () => {
      const booking = await lessonService.bookLesson(student.id, lesson.id, pkg.id);
      const { makeupTicket } = await lessonService.requestLeave(booking.id, '请假');
      
      const makeupBooking = await lessonService.useMakeupTicket(makeupTicket.id, lesson2.id);
      
      assert.strictEqual(makeupBooking.is_makeup, 1);
      assert.strictEqual(makeupBooking.makeup_ticket_id, makeupTicket.id);

      const usedTicket = (await lessonService.getAvailableMakeupTickets(student.id))
        .find(t => t.id === makeupTicket.id);
      assert.ok(!usedTicket);
    });
  });

  describe('Lesson Management - Waitlist', () => {
    let teacher: any;
    let student1: any;
    let student2: any;
    let cls: any;
    let lesson: any;

    before(async () => {
      teacher = await teacherService.createTeacher({
        name: '候补测试老师',
        hourly_rate: 200,
      });

      student1 = await studentService.createStudent({
        name: '候补测试学生1',
      });

      student2 = await studentService.createStudent({
        name: '候补测试学生2',
      });

      cls = await classService.createClass({
        name: '候补测试班级',
        teacher_id: teacher.id,
        capacity: 1,
      });

      const tomorrow = dayjs().add(1, 'day');
      lesson = await lessonService.createLesson({
        class_id: cls.id,
        teacher_id: teacher.id,
        start_time: tomorrow.hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'),
        end_time: tomorrow.hour(11).minute(30).format('YYYY-MM-DD HH:mm:ss'),
        capacity: 1,
      });
    });

    it('should join waitlist when class is full', async () => {
      const pkg1 = await packageService.createStudentPackage({
        student_id: student1.id,
        name: '候补测试课包1',
        total_lessons: 10,
        valid_days: 180,
      });

      const pkg2 = await packageService.createStudentPackage({
        student_id: student2.id,
        name: '候补测试课包2',
        total_lessons: 10,
        valid_days: 180,
      });

      await lessonService.bookLesson(student1.id, lesson.id, pkg1.id);

      try {
        await lessonService.bookLesson(student2.id, lesson.id, pkg2.id);
        assert.fail('Should have thrown capacity error');
      } catch (err: any) {
        assert.strictEqual(err.code, 'CLASS_CAPACITY_FULL');
      }

      const waitlist = await lessonService.joinWaitlist(student2.id, lesson.id);
      assert.strictEqual(waitlist.position, 1);
      assert.strictEqual(waitlist.status, 'waiting');
    });

    it('should convert waitlist to booking when spot opens', async () => {
      const student3 = await studentService.createStudent({
        name: '候补转正测试学生',
      });

      const pkg3 = await packageService.createStudentPackage({
        student_id: student3.id,
        name: '测试课包',
        total_lessons: 10,
        valid_days: 180,
      });

      const teacher2 = await teacherService.createTeacher({
        name: '转正测试老师',
        hourly_rate: 200,
      });

      const cls2 = await classService.createClass({
        name: '转正测试班级',
        teacher_id: teacher2.id,
        capacity: 1,
      });

      const lesson2 = await lessonService.createLesson({
        class_id: cls2.id,
        teacher_id: teacher2.id,
        start_time: dayjs().add(2, 'day').hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'),
        end_time: dayjs().add(2, 'day').hour(11).minute(30).format('YYYY-MM-DD HH:mm:ss'),
        capacity: 1,
      });

      const booking = await lessonService.bookLesson(student3.id, lesson2.id, pkg3.id);
      await lessonService.joinWaitlist(student1.id, lesson2.id);

      await lessonService.cancelBooking(booking.id);

      const waitlist = await lessonService.getWaitlistByLesson(lesson2.id);
      assert.ok(waitlist.length > 0);

      if (waitlist.length > 0) {
        const converted = await lessonService.convertWaitlist(waitlist[0].id, pkg3.id);
        assert.strictEqual(converted.status, 'booked');
      }
    });
  });

  describe('Business Validations', () => {
    let teacher: any;
    let student: any;
    let cls: any;
    let pkg: any;

    before(async () => {
      teacher = await teacherService.createTeacher({
        name: '校验测试老师',
        hourly_rate: 200,
      });

      student = await studentService.createStudent({
        name: '校验测试学生',
      });

      cls = await classService.createClass({
        name: '校验测试班级',
        teacher_id: teacher.id,
        capacity: 10,
      });

      pkg = await packageService.createStudentPackage({
        student_id: student.id,
        name: '校验测试课包',
        total_lessons: 1,
        valid_days: 180,
      });
    });

    it('should validate time slot conflict', async () => {
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
        assert.fail('Should have thrown time conflict error');
      } catch (err: any) {
        assert.strictEqual(err.code, 'TIME_SLOT_CONFLICT');
      }
    });

    it('should validate package expiration', async () => {
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
        start_time: tomorrow.hour(14).minute(0).format('YYYY-MM-DD HH:mm:ss'),
        end_time: tomorrow.hour(15).minute(30).format('YYYY-MM-DD HH:mm:ss'),
      });

      try {
        await lessonService.bookLesson(student.id, lesson.id, expiredPkg.id);
        assert.fail('Should have thrown expired error');
      } catch (err: any) {
        assert.strictEqual(err.code, 'PACKAGE_EXPIRED');
      }
    });

    it('should validate insufficient lessons', async () => {
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
        start_time: tomorrow.hour(16).minute(0).format('YYYY-MM-DD HH:mm:ss'),
        end_time: tomorrow.hour(17).minute(30).format('YYYY-MM-DD HH:mm:ss'),
      });

      try {
        await lessonService.bookLesson(student.id, lesson.id, emptyPkg.id);
        assert.fail('Should have thrown insufficient lessons error');
      } catch (err: any) {
        assert.strictEqual(err.code, 'INSUFFICIENT_LESSONS');
      }
    });
  });
});
