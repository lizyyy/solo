const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const app = express();
app.use(express.json());

const students = [
  { id: 'S001', name: '张三', classId: 'C001' },
  { id: 'S002', name: '李四', classId: 'C001' },
  { id: 'S003', name: '王五', classId: 'C001' },
  { id: 'S004', name: '赵六', classId: 'C002' },
  { id: 'S005', name: '钱七', classId: 'C002' },
  { id: 'S006', name: '孙八', classId: 'C002' }
];

const courses = [
  { id: 'C001', name: '数据结构', teacherId: 'T001', teacherName: '王老师', studentIds: ['S001', 'S002', 'S003'] },
  { id: 'C002', name: '计算机网络', teacherId: 'T002', teacherName: '李老师', studentIds: ['S004', 'S005', 'S006'] },
  { id: 'C003', name: '操作系统', teacherId: 'T001', teacherName: '王老师', studentIds: ['S001', 'S004'] }
];

const assignments = [];
const submissions = [];
const extensionRequests = [];

const AssignmentStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  LOCKED: 'locked'
};

const SubmissionStatus = {
  NOT_SUBMITTED: 'not_submitted',
  SUBMITTED: 'submitted',
  LATE_SUBMITTED: 'late_submitted',
  RETURNED: 'returned',
  GRADED: 'graded'
};

const RequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

app.get('/api/courses', (req, res) => {
  res.json({ code: 0, data: courses });
});

app.get('/api/students', (req, res) => {
  const { classId } = req.query;
  let data = students;
  if (classId) {
    data = students.filter(s => s.classId === classId);
  }
  res.json({ code: 0, data });
});

app.post('/api/assignments', (req, res) => {
  const { courseId, title, description, deadline, createdBy } = req.body;
  
  if (!courseId || !title || !deadline || !createdBy) {
    return res.status(400).json({ code: 400, message: '缺少必要参数' });
  }

  const course = courses.find(c => c.id === courseId);
  if (!course) {
    return res.status(404).json({ code: 404, message: '课程不存在' });
  }

  const assignment = {
    id: 'A' + String(assignments.length + 1).padStart(3, '0'),
    courseId,
    courseName: course.name,
    title,
    description: description || '',
    deadline,
    createdBy,
    createdAt: dayjs().toISOString(),
    status: AssignmentStatus.PUBLISHED,
    totalStudents: course.studentIds.length
  };

  assignments.push(assignment);
  res.json({ code: 0, data: assignment });
});

app.get('/api/assignments', (req, res) => {
  const { courseId } = req.query;
  let data = assignments;
  if (courseId) {
    data = assignments.filter(a => a.courseId === courseId);
  }
  res.json({ code: 0, data });
});

app.get('/api/assignments/:id', (req, res) => {
  const assignment = assignments.find(a => a.id === req.params.id);
  if (!assignment) {
    return res.status(404).json({ code: 404, message: '作业不存在' });
  }
  res.json({ code: 0, data: assignment });
});

app.post('/api/assignments/:id/submit', (req, res) => {
  const { studentId, content } = req.body;
  const assignment = assignments.find(a => a.id === req.params.id);
  
  if (!assignment) {
    return res.status(404).json({ code: 404, message: '作业不存在' });
  }

  if (assignment.status === AssignmentStatus.LOCKED) {
    return res.status(400).json({ code: 400, message: '作业成绩已锁定，无法提交' });
  }

  const student = students.find(s => s.id === studentId);
  if (!student) {
    return res.status(404).json({ code: 404, message: '学生不存在' });
  }

  const now = dayjs();
  const deadline = dayjs(assignment.deadline);
  const isLate = now.isAfter(deadline);

  if (isLate) {
    const approvedRequest = extensionRequests.find(
      r => r.assignmentId === assignment.id && 
           r.studentId === studentId && 
           r.status === RequestStatus.APPROVED
    );
    
    if (!approvedRequest) {
      return res.status(400).json({ 
        code: 400, 
        message: '已过截止时间，需要先申请补交' 
      });
    }
  }

  const existingSubmission = submissions.find(
    s => s.assignmentId === assignment.id && s.studentId === studentId
  );

  if (existingSubmission && existingSubmission.status === SubmissionStatus.GRADED) {
    return res.status(400).json({ code: 400, message: '作业已批改，无法覆盖提交' });
  }

  const submission = {
    id: existingSubmission ? existingSubmission.id : ('SUB' + String(submissions.length + 1).padStart(4, '0')),
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    studentId,
    studentName: student.name,
    content,
    submittedAt: now.toISOString(),
    status: isLate ? SubmissionStatus.LATE_SUBMITTED : SubmissionStatus.SUBMITTED,
    isLate: isLate || (existingSubmission ? existingSubmission.isLate : false),
    grade: null,
    feedback: existingSubmission && existingSubmission.status === SubmissionStatus.RETURNED ? existingSubmission.feedback : null,
    gradedAt: null,
    version: existingSubmission ? existingSubmission.version + 1 : 1
  };

  if (existingSubmission) {
    const idx = submissions.findIndex(s => s.id === existingSubmission.id);
    submissions[idx] = submission;
  } else {
    submissions.push(submission);
  }

  res.json({ code: 0, data: submission });
});

app.post('/api/assignments/:id/extension-request', (req, res) => {
  const { studentId, reason } = req.body;
  const assignment = assignments.find(a => a.id === req.params.id);
  
  if (!assignment) {
    return res.status(404).json({ code: 404, message: '作业不存在' });
  }

  if (assignment.status === AssignmentStatus.LOCKED) {
    return res.status(400).json({ code: 400, message: '作业已锁定，无法申请补交' });
  }

  const student = students.find(s => s.id === studentId);
  if (!student) {
    return res.status(404).json({ code: 404, message: '学生不存在' });
  }

  const existingPending = extensionRequests.find(
    r => r.assignmentId === assignment.id && 
         r.studentId === studentId && 
         r.status === RequestStatus.PENDING
  );

  if (existingPending) {
    return res.json({ 
      code: 0, 
      message: '已有待审批的补交申请', 
      data: existingPending 
    });
  }

  const request = {
    id: 'REQ' + String(extensionRequests.length + 1).padStart(4, '0'),
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    courseId: assignment.courseId,
    studentId,
    studentName: student.name,
    reason: reason || '',
    status: RequestStatus.PENDING,
    createdAt: dayjs().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null
  };

  extensionRequests.push(request);
  res.json({ code: 0, data: request });
});

app.get('/api/extension-requests', (req, res) => {
  const { status, courseId, assignmentId } = req.query;
  let data = extensionRequests;
  
  if (status) {
    data = data.filter(r => r.status === status);
  }
  if (courseId) {
    data = data.filter(r => r.courseId === courseId);
  }
  if (assignmentId) {
    data = data.filter(r => r.assignmentId === assignmentId);
  }
  
  res.json({ code: 0, data });
});

app.post('/api/extension-requests/:id/review', (req, res) => {
  const { action, reviewedBy, comment } = req.body;
  const request = extensionRequests.find(r => r.id === req.params.id);
  
  if (!request) {
    return res.status(404).json({ code: 404, message: '申请不存在' });
  }

  if (request.status !== RequestStatus.PENDING) {
    return res.status(400).json({ code: 400, message: '该申请已被审批' });
  }

  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ code: 400, message: '无效的审批动作' });
  }

  request.status = action === 'approve' ? RequestStatus.APPROVED : RequestStatus.REJECTED;
  request.reviewedBy = reviewedBy;
  request.reviewedAt = dayjs().toISOString();
  request.reviewComment = comment || '';

  res.json({ code: 0, data: request });
});

app.post('/api/assignments/:assignmentId/submissions/:submissionId/return', (req, res) => {
  const { feedback, returnedBy } = req.body;
  const submission = submissions.find(s => s.id === req.params.submissionId);
  
  if (!submission) {
    return res.status(404).json({ code: 404, message: '提交记录不存在' });
  }

  const assignment = assignments.find(a => a.id === submission.assignmentId);
  if (assignment.status === AssignmentStatus.LOCKED) {
    return res.status(400).json({ code: 400, message: '作业已锁定，无法退回' });
  }

  if (submission.status === SubmissionStatus.RETURNED) {
    return res.status(400).json({ code: 400, message: '作业已在退回状态' });
  }

  submission.status = SubmissionStatus.RETURNED;
  submission.feedback = feedback || '';
  submission.returnedBy = returnedBy;
  submission.returnedAt = dayjs().toISOString();

  res.json({ code: 0, data: submission });
});

app.post('/api/assignments/:assignmentId/submissions/:submissionId/grade', (req, res) => {
  const { grade, feedback, gradedBy } = req.body;
  const submission = submissions.find(s => s.id === req.params.submissionId);
  
  if (!submission) {
    return res.status(404).json({ code: 404, message: '提交记录不存在' });
  }

  const assignment = assignments.find(a => a.id === submission.assignmentId);
  if (assignment.status === AssignmentStatus.LOCKED) {
    return res.status(400).json({ code: 400, message: '作业已锁定，无法批改' });
  }

  if (typeof grade !== 'number' || grade < 0 || grade > 100) {
    return res.status(400).json({ code: 400, message: '成绩必须在 0-100 之间' });
  }

  submission.status = SubmissionStatus.GRADED;
  submission.grade = grade;
  submission.feedback = feedback || '';
  submission.gradedBy = gradedBy;
  submission.gradedAt = dayjs().toISOString();

  res.json({ code: 0, data: submission });
});

app.post('/api/assignments/:id/lock', (req, res) => {
  const assignment = assignments.find(a => a.id === req.params.id);
  
  if (!assignment) {
    return res.status(404).json({ code: 404, message: '作业不存在' });
  }

  if (assignment.status === AssignmentStatus.LOCKED) {
    return res.status(400).json({ code: 400, message: '作业已锁定' });
  }

  assignment.status = AssignmentStatus.LOCKED;
  assignment.lockedAt = dayjs().toISOString();

  res.json({ code: 0, data: assignment });
});

app.get('/api/submissions', (req, res) => {
  const { assignmentId, studentId } = req.query;
  let data = submissions;
  
  if (assignmentId) {
    data = data.filter(s => s.assignmentId === assignmentId);
  }
  if (studentId) {
    data = data.filter(s => s.studentId === studentId);
  }
  
  res.json({ code: 0, data });
});

app.get('/api/assignments/:id/stats', (req, res) => {
  const assignment = assignments.find(a => a.id === req.params.id);
  
  if (!assignment) {
    return res.status(404).json({ code: 404, message: '作业不存在' });
  }

  const course = courses.find(c => c.id === assignment.courseId);
  const totalStudents = course.studentIds.length;
  
  const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);
  
  const submittedCount = assignmentSubmissions.filter(
    s => s.status === SubmissionStatus.SUBMITTED || 
         s.status === SubmissionStatus.LATE_SUBMITTED ||
         s.status === SubmissionStatus.GRADED
  ).length;
  
  const lateCount = assignmentSubmissions.filter(s => s.isLate).length;
  
  const pendingRequests = extensionRequests.filter(
    r => r.assignmentId === assignment.id && r.status === RequestStatus.PENDING
  );

  const completionRate = totalStudents > 0 
    ? Math.round((submittedCount / totalStudents) * 100) 
    : 0;

  res.json({
    code: 0,
    data: {
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      courseId: assignment.courseId,
      courseName: course.name,
      totalStudents,
      submittedCount,
      completionRate: completionRate + '%',
      lateCount,
      pendingRequests: pendingRequests.length,
      pendingRequestList: pendingRequests
    }
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`课程作业补交 API 服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('已加载样例数据:');
  console.log('- 课程:', courses.length, '门');
  console.log('- 学生:', students.length, '人');
  console.log('');
  console.log('课程列表:');
  courses.forEach(c => {
    console.log(`  ${c.id}: ${c.name} (${c.teacherName})`);
  });
  console.log('');
  console.log('学生列表:');
  students.forEach(s => {
    console.log(`  ${s.id}: ${s.name} (班级: ${s.classId})`);
  });
});
