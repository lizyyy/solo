import { db } from './database';

const sampleStudents = [
  { name: '张三', idCard: '110101199001011234', phone: '13800138001', email: 'zhangsan@example.com', course: '计算机基础' },
  { name: '李四', idCard: '110101199002021235', phone: '13800138002', email: 'lisi@example.com', course: '计算机基础' },
  { name: '王五', idCard: '110101199003031236', phone: '13800138003', email: 'wangwu@example.com', course: '计算机基础' },
  { name: '赵六', idCard: '110101199004041237', phone: '13800138004', email: 'zhaoliu@example.com', course: '网络技术' },
  { name: '钱七', idCard: '110101199005051238', phone: '13800138005', email: 'qianqi@example.com', course: '网络技术' },
  { name: '孙八', idCard: '110101199006061239', phone: '13800138006', email: 'sunba@example.com', course: '软件测试' },
  { name: '周九', idCard: '110101199007071240', phone: '13800138007', email: 'zhoujiu@example.com', course: '软件测试' },
  { name: '吴十', idCard: '110101199008081241', phone: '13800138008', email: 'wushi@example.com', course: '数据库管理' }
];

export default {
  initialize() {
    const studentIds: string[] = [];
    sampleStudents.forEach((s, index) => {
      const student = db.createStudent(s, 'admin');
      studentIds.push(student.id);

      for (let i = 1; i <= 5; i++) {
        const date = `2024-0${i}-01`;
        const statuses = ['present', 'present', 'present', 'absent', 'late'];
        db.createAttendance({
          studentId: student.id,
          date,
          status: statuses[index % 5] as any,
          createdBy: 'admin'
        }, 'admin');
      }

      const scores = [85, 72, 95, 55, 78, 88, 45, 92];
      const examScore = db.createExamScore({
        studentId: student.id,
        examType: 'final',
        score: scores[index],
        fullScore: 100,
        passScore: 60,
        examDate: '2024-06-15',
        createdBy: 'teacher1'
      }, 'teacher1');

      if (scores[index] < 60) {
        db.createRetakeRecord({
          studentId: student.id,
          originalExamId: examScore.id,
          retakeCount: 1,
          retakeDate: '2024-06-25',
          score: index === 6 ? 58 : 75,
          isPassed: index !== 6,
          createdBy: 'teacher1'
        }, 'teacher1');
      }
    });

    const certStatuses = ['issued', 'issued', 'issued', 'revoked', 'issued', 'pending', 'rechecked', 'issued'];
    studentIds.forEach((id, index) => {
      const cert = db.createCertificate({
        certificateNo: `CERT-2024-${String(index + 1).padStart(4, '0')}`,
        studentId: id,
        status: certStatuses[index] as any,
        issueDate: certStatuses[index] !== 'pending' ? '2024-07-01' : undefined,
        createdBy: 'admin'
      }, 'admin');

      if (certStatuses[index] === 'revoked') {
        db.revokeCertificate(cert.id, '考试作弊被查实', 'auditor');
      }

      if (certStatuses[index] === 'rechecked') {
        db.recheckCertificate(cert.id, 'admin');
      }
    });

    const studentToUpdate = db.getStudentById(studentIds[0]);
    if (studentToUpdate) {
      db.updateStudent(studentToUpdate.id, { phone: '13900139001' }, 'admin');
      db.updateStudent(studentToUpdate.id, { email: 'zhangsan_new@example.com' }, 'operator1');
    }

    console.log('示例数据初始化完成');
  }
};
