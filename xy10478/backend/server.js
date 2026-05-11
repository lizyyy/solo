const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const data = require('./data');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(bodyParser.json());

data.initData();

app.get('/api/courses', (req, res) => {
  res.json(data.DATA.courses);
});

app.post('/api/courses', (req, res) => {
  const { name, teacher, semester } = req.body;
  const course = {
    id: uuidv4(),
    name,
    teacher,
    semester
  };
  data.DATA.courses.push(course);
  res.status(201).json(course);
});

app.get('/api/assignments', (req, res) => {
  const { courseId } = req.query;
  let assignments = data.DATA.assignments;
  if (courseId) {
    assignments = assignments.filter(a => a.courseId === courseId);
  }
  res.json(assignments);
});

app.post('/api/assignments', (req, res) => {
  const { courseId, name, type, deadline, totalScore, description } = req.body;
  const assignment = {
    id: uuidv4(),
    courseId,
    name,
    type,
    deadline,
    totalScore,
    description
  };
  data.DATA.assignments.push(assignment);
  res.status(201).json(assignment);
});

app.get('/api/students', (req, res) => {
  const { courseId } = req.query;
  let students = data.DATA.students;
  if (courseId) {
    students = students.filter(s => s.courseIds.includes(courseId));
  }
  res.json(students);
});

app.post('/api/students', (req, res) => {
  const { name, studentId, courseIds } = req.body;
  const student = {
    id: uuidv4(),
    name,
    studentId,
    courseIds: courseIds || []
  };
  data.DATA.students.push(student);
  res.status(201).json(student);
});

app.get('/api/assistants', (req, res) => {
  res.json(data.DATA.assistants);
});

app.post('/api/assistants', (req, res) => {
  const { name, maxWorkload } = req.body;
  const assistant = {
    id: uuidv4(),
    name,
    workload: 0,
    maxWorkload: maxWorkload || 10,
    active: true
  };
  data.DATA.assistants.push(assistant);
  res.status(201).json(assistant);
});

app.get('/api/submissions', (req, res) => {
  const { courseId, assignmentId, status, assistantId, studentId } = req.query;
  const submissions = data.getSubmissionsWithDetails({
    courseId,
    assignmentId,
    status,
    assistantId,
    studentId
  });
  res.json(submissions);
});

app.post('/api/submissions', (req, res) => {
  const { assignmentId, studentId, content } = req.body;
  const submission = {
    id: uuidv4(),
    assignmentId,
    studentId,
    content,
    submittedAt: new Date().toISOString(),
    status: 'submitted',
    assignedAssistantId: null,
    retryCount: 0
  };
  data.DATA.submissions.push(submission);
  res.status(201).json(submission);
});

app.post('/api/submissions/:id/assign', (req, res) => {
  try {
    const submission = data.assignSubmissionToAssistant(req.params.id);
    res.json(submission);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/submissions/auto-assign', (req, res) => {
  const unassigned = data.DATA.submissions.filter(s => s.status === 'submitted' && !s.assignedAssistantId);
  const results = [];
  
  for (const submission of unassigned) {
    try {
      const assigned = data.assignSubmissionToAssistant(submission.id);
      results.push({ submissionId: submission.id, success: true, assistantId: assigned.assignedAssistantId });
    } catch (error) {
      results.push({ submissionId: submission.id, success: false, error: error.message });
    }
  }
  
  res.json({ total: unassigned.length, results });
});

app.get('/api/submissions/:id', (req, res) => {
  const submission = data.getSubmissionById(req.params.id);
  if (!submission) {
    return res.status(404).json({ error: '提交不存在' });
  }
  
  const details = {
    ...submission,
    assignment: data.getAssignmentById(submission.assignmentId),
    student: data.getStudentById(submission.studentId),
    assistant: submission.assignedAssistantId ? data.getAssistantById(submission.assignedAssistantId) : null,
    gradingRecords: data.getGradingRecordsBySubmission(submission.id),
    gradeHistory: data.getGradeHistoryBySubmission(submission.id).map(h => ({
      ...h,
      changedByName: data.getAssistantById(h.changedBy)?.name
    }))
  };
  
  res.json(details);
});

app.post('/api/grading', (req, res) => {
  const { submissionId, assistantId, score, feedback, status } = req.body;
  
  try {
    const record = data.createGradingRecord(submissionId, assistantId, score, feedback, status);
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/submissions/:id/resubmit', (req, res) => {
  try {
    const submission = data.resubmitAssignment(req.params.id, req.body.content);
    res.json(submission);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/reports/assistant-efficiency', (req, res) => {
  res.json(data.getAssistantEfficiencyReport());
});

app.get('/api/reports/score-distribution/:assignmentId', (req, res) => {
  res.json(data.getScoreDistribution(req.params.assignmentId));
});

app.get('/api/teacher-view/:courseId', (req, res) => {
  res.json(data.getTeacherView(req.params.courseId));
});

app.get('/api/alerts/overdue', (req, res) => {
  const overdue = data.DATA.submissions.filter(
    s => s.status === 'assigned' && data.checkTimeout(s)
  ).map(s => ({
    ...s,
    assignment: data.getAssignmentById(s.assignmentId),
    student: data.getStudentById(s.studentId),
    assistant: data.getAssistantById(s.assignedAssistantId)
  }));
  
  res.json(overdue);
});

app.get('/api/statistics', (req, res) => {
  const totalSubmissions = data.DATA.submissions.length;
  const graded = data.DATA.submissions.filter(s => s.status === 'graded' || s.status === 'regraded').length;
  const pending = data.DATA.submissions.filter(s => s.status === 'submitted' || s.status === 'assigned').length;
  const returned = data.DATA.submissions.filter(s => s.status === 'returned').length;
  const resubmitted = data.DATA.submissions.filter(s => s.status === 'resubmitted').length;
  const overdue = data.DATA.submissions.filter(s => s.status === 'assigned' && data.checkTimeout(s)).length;
  
  res.json({
    totalSubmissions,
    graded,
    pending,
    returned,
    resubmitted,
    overdue,
    gradingRate: totalSubmissions > 0 ? ((graded / totalSubmissions) * 100).toFixed(1) : 0
  });
});

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`);
  console.log(`API文档:
  GET  /api/courses                    - 获取课程列表
  POST /api/courses                    - 创建课程
  GET  /api/assignments                - 获取作业列表
  POST /api/assignments                - 创建作业
  GET  /api/students                   - 获取学生列表
  POST /api/students                   - 添加学生
  GET  /api/assistants                 - 获取助教列表
  POST /api/assistants                 - 添加助教
  GET  /api/submissions                - 获取提交列表（支持筛选）
  POST /api/submissions                - 提交作业
  POST /api/submissions/:id/assign     - 手动分配助教
  POST /api/submissions/auto-assign    - 自动分配所有未分配的提交
  GET  /api/submissions/:id            - 获取提交详情
  POST /api/grading                    - 批改作业
  POST /api/submissions/:id/resubmit   - 重交作业
  GET  /api/reports/assistant-efficiency - 助教效率报表
  GET  /api/reports/score-distribution/:id - 分数分布
  GET  /api/teacher-view/:courseId     - 老师视图（含复批历史）
  GET  /api/alerts/overdue             - 超时提醒
  GET  /api/statistics                 - 总体统计
  `);
});
