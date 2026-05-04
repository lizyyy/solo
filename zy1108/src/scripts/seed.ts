import { createTables, dropTables } from '../database/schema';
import { 
  TeacherRepository, StudentRepository, ClassRepository, 
  PackageTemplateRepository, StudentPackageRepository, LessonRepository,
  LessonBookingRepository, MakeupTicketRepository
} from '../repositories';
import { addDays, now } from '../utils/date';
import dayjs from 'dayjs';

const teacherRepo = new TeacherRepository();
const studentRepo = new StudentRepository();
const classRepo = new ClassRepository();
const templateRepo = new PackageTemplateRepository();
const packageRepo = new StudentPackageRepository();
const lessonRepo = new LessonRepository();
const bookingRepo = new LessonBookingRepository();
const makeupTicketRepo = new MakeupTicketRepository();

export const seedDatabase = () => {
  console.log('Dropping existing tables...');
  dropTables();

  console.log('Creating tables...');
  createTables();

  console.log('Seeding data...');

  // Create teachers
  const teacher1 = teacherRepo.create({
    name: '李老师',
    phone: '13800138001',
    email: 'li@dance.com',
    hourly_rate: 200,
    status: 'active',
  });

  const teacher2 = teacherRepo.create({
    name: '王老师',
    phone: '13800138002',
    email: 'wang@dance.com',
    hourly_rate: 180,
    status: 'active',
  });

  console.log('Created teachers:', teacher1.name, teacher2.name);

  // Create students
  const student1 = studentRepo.create({
    name: '张小雨',
    phone: '13900139001',
    guardian_name: '张妈妈',
    guardian_phone: '13900139001',
    gender: 'female',
    birth_date: '2015-03-15',
    status: 'active',
    notes: '喜欢芭蕾，有2年基础',
  });

  const student2 = studentRepo.create({
    name: '李小阳',
    phone: '13900139002',
    guardian_name: '李爸爸',
    guardian_phone: '13900139002',
    gender: 'male',
    birth_date: '2014-07-20',
    status: 'active',
    notes: '街舞爱好者',
  });

  const student3 = studentRepo.create({
    name: '王小花',
    phone: '13900139003',
    guardian_name: '王妈妈',
    guardian_phone: '13900139003',
    gender: 'female',
    birth_date: '2016-01-10',
    status: 'active',
  });

  const student4 = studentRepo.create({
    name: '陈大明',
    phone: '13900139004',
    guardian_name: '陈爸爸',
    guardian_phone: '13900139004',
    gender: 'male',
    birth_date: '2013-11-05',
    status: 'active',
  });

  console.log('Created students:', student1.name, student2.name, student3.name, student4.name);

  // Create classes
  const class1 = classRepo.create({
    name: '少儿芭蕾基础班',
    teacher_id: teacher1.id,
    dance_style: 'ballet',
    capacity: 8,
    description: '适合4-8岁儿童的芭蕾基础课程',
    status: 'active',
  });

  const class2 = classRepo.create({
    name: '少儿街舞班',
    teacher_id: teacher2.id,
    dance_style: 'hiphop',
    capacity: 10,
    description: '适合6-12岁儿童的街舞课程',
    status: 'active',
  });

  console.log('Created classes:', class1.name, class2.name);

  // Create package templates
  const template1 = templateRepo.create({
    name: '20次课包',
    total_lessons: 20,
    price: 2800,
    valid_days: 180,
    description: '20次课程，6个月有效期',
    status: 'active',
  });

  const template2 = templateRepo.create({
    name: '40次课包',
    total_lessons: 40,
    price: 5000,
    valid_days: 365,
    description: '40次课程，12个月有效期（推荐）',
    status: 'active',
  });

  const template3 = templateRepo.create({
    name: '10次体验课包',
    total_lessons: 10,
    price: 1500,
    valid_days: 90,
    description: '10次体验课程，3个月有效期',
    status: 'active',
  });

  console.log('Created templates:', template1.name, template2.name, template3.name);

  // Create student packages
  const today = dayjs();
  
  const pkg1 = packageRepo.create({
    student_id: student1.id,
    template_id: template2.id,
    name: '40次课包',
    total_lessons: 40,
    used_lessons: 5,
    freeze_lessons: 0,
    valid_from: now(),
    valid_to: addDays(now(), 365),
    status: 'active',
    is_frozen: 0,
  });

  const pkg2 = packageRepo.create({
    student_id: student2.id,
    template_id: template1.id,
    name: '20次课包',
    total_lessons: 20,
    used_lessons: 3,
    freeze_lessons: 0,
    valid_from: now(),
    valid_to: addDays(now(), 180),
    status: 'active',
    is_frozen: 0,
  });

  const pkg3 = packageRepo.create({
    student_id: student3.id,
    template_id: template3.id,
    name: '10次体验课包',
    total_lessons: 10,
    used_lessons: 8,
    freeze_lessons: 0,
    valid_from: addDays(now(), -60),
    valid_to: addDays(now(), 30),
    status: 'active',
    is_frozen: 0,
  });

  const pkg4 = packageRepo.create({
    student_id: student4.id,
    template_id: template1.id,
    name: '20次课包（已过期）',
    total_lessons: 20,
    used_lessons: 15,
    freeze_lessons: 0,
    valid_from: addDays(now(), -200),
    valid_to: addDays(now(), -20),
    status: 'expired',
    is_frozen: 0,
  });

  console.log('Created student packages');

  // Create lessons
  const nextSaturday = today.add(1, 'week').day(6);
  
  const lesson1 = lessonRepo.create({
    class_id: class1.id,
    teacher_id: teacher1.id,
    start_time: nextSaturday.hour(9).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    end_time: nextSaturday.hour(10).minute(30).second(0).format('YYYY-MM-DD HH:mm:ss'),
    location: '1号舞蹈室',
    capacity: class1.capacity,
    status: 'scheduled',
  });

  const lesson2 = lessonRepo.create({
    class_id: class1.id,
    teacher_id: teacher1.id,
    start_time: nextSaturday.add(1, 'week').hour(9).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    end_time: nextSaturday.add(1, 'week').hour(10).minute(30).second(0).format('YYYY-MM-DD HH:mm:ss'),
    location: '1号舞蹈室',
    capacity: class1.capacity,
    status: 'scheduled',
  });

  const lesson3 = lessonRepo.create({
    class_id: class2.id,
    teacher_id: teacher2.id,
    start_time: nextSaturday.hour(14).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    end_time: nextSaturday.hour(15).minute(30).second(0).format('YYYY-MM-DD HH:mm:ss'),
    location: '2号舞蹈室',
    capacity: class2.capacity,
    status: 'scheduled',
  });

  const lesson4 = lessonRepo.create({
    class_id: class2.id,
    teacher_id: teacher2.id,
    start_time: nextSaturday.add(1, 'week').hour(14).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    end_time: nextSaturday.add(1, 'week').hour(15).minute(30).second(0).format('YYYY-MM-DD HH:mm:ss'),
    location: '2号舞蹈室',
    capacity: class2.capacity,
    status: 'scheduled',
  });

  console.log('Created lessons');

  // Create some bookings
  bookingRepo.create({
    lesson_id: lesson1.id,
    student_id: student1.id,
    student_package_id: pkg1.id,
    status: 'booked',
    is_makeup: 0,
  });

  bookingRepo.create({
    lesson_id: lesson1.id,
    student_id: student3.id,
    student_package_id: pkg3.id,
    status: 'booked',
    is_makeup: 0,
  });

  bookingRepo.create({
    lesson_id: lesson3.id,
    student_id: student2.id,
    student_package_id: pkg2.id,
    status: 'booked',
    is_makeup: 0,
  });

  console.log('Created bookings');

  console.log('\nSeed data created successfully!');
  console.log('\n--- Seed Data Summary ---');
  console.log(`Teachers: 2 (${teacher1.name}, ${teacher2.name})`);
  console.log(`Students: 4 (${student1.name}, ${student2.name}, ${student3.name}, ${student4.name})`);
  console.log(`Classes: 2 (${class1.name}, ${class2.name})`);
  console.log(`Lessons: 4 (upcoming classes)`);
  console.log(`Bookings: 3`);
  console.log(`\nStudent balances:`);
  console.log(`  ${student1.name}: ${pkg1.total_lessons - pkg1.used_lessons} lessons remaining`);
  console.log(`  ${student2.name}: ${pkg2.total_lessons - pkg2.used_lessons} lessons remaining`);
  console.log(`  ${student3.name}: ${pkg3.total_lessons - pkg3.used_lessons} lessons remaining (expiring soon)`);
  console.log(`  ${student4.name}: ${pkg4.total_lessons - pkg4.used_lessons} lessons remaining (EXPIRED)`);

  return {
    teachers: [teacher1, teacher2],
    students: [student1, student2, student3, student4],
    classes: [class1, class2],
    templates: [template1, template2, template3],
    packages: [pkg1, pkg2, pkg3, pkg4],
    lessons: [lesson1, lesson2, lesson3, lesson4],
  };
};

if (require.main === module) {
  seedDatabase();
}
