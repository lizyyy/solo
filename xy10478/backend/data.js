const { v4: uuidv4 } = require('uuid');

const DATA = {
  courses: [],
  assignments: [],
  students: [],
  submissions: [],
  assistants: [],
  assignmentsToAssistants: [],
  gradingRecords: [],
  gradeHistory: []
};

const initData = () => {
  DATA.courses = [
    { id: 'course-1', name: '软件工程导论', teacher: '李教授', semester: '2024秋季' },
    { id: 'course-2', name: '高级Web开发', teacher: '王教授', semester: '2024秋季' },
    { id: 'course-3', name: '数据结构与算法', teacher: '张教授', semester: '2024秋季' }
  ];

  DATA.assignments = [
    { id: 'hw-1', courseId: 'course-1', name: '编程作业：简易计算器', type: 'programming', deadline: '2024-12-15T23:59:59', totalScore: 100, description: '实现一个支持加减乘除的计算器' },
    { id: 'hw-2', courseId: 'course-1', name: '作文：软件工程的未来', type: 'essay', deadline: '2024-12-20T23:59:59', totalScore: 100, description: '谈谈你对软件工程未来发展的看法' },
    { id: 'hw-3', courseId: 'course-2', name: '测验：JavaScript基础', type: 'quiz', deadline: '2024-12-10T23:59:59', totalScore: 50, description: 'JavaScript基础知识测验' },
    { id: 'hw-4', courseId: 'course-3', name: '编程作业：链表实现', type: 'programming', deadline: '2024-12-18T23:59:59', totalScore: 100, description: '实现单向链表及其基本操作' }
  ];

  DATA.students = [
    { id: 'stu-1', name: '张三', studentId: '2021001', courseIds: ['course-1', 'course-2'] },
    { id: 'stu-2', name: '李四', studentId: '2021002', courseIds: ['course-1', 'course-3'] },
    { id: 'stu-3', name: '王五', studentId: '2021003', courseIds: ['course-2', 'course-3'] },
    { id: 'stu-4', name: '赵六', studentId: '2021004', courseIds: ['course-1', 'course-2', 'course-3'] },
    { id: 'stu-5', name: '钱七', studentId: '2021005', courseIds: ['course-1'] },
    { id: 'stu-6', name: '孙八', studentId: '2021006', courseIds: ['course-2', 'course-3'] }
  ];

  DATA.assistants = [
    { id: 'ta-1', name: '陈助教', workload: 0, maxWorkload: 10, active: true },
    { id: 'ta-2', name: '刘助教', workload: 0, maxWorkload: 10, active: true },
    { id: 'ta-3', name: '周助教', workload: 0, maxWorkload: 8, active: true }
  ];

  DATA.submissions = [
    { id: 'sub-1', assignmentId: 'hw-1', studentId: 'stu-1', content: 'function calc(a, b, op) { if(op==="+") return a+b; if(op==="-") return a-b; if(op==="*") return a*b; if(op==="/") return b!==0 ? a/b : "Error"; }', submittedAt: '2024-12-14T10:00:00', status: 'submitted', assignedAssistantId: null, retryCount: 0 },
    { id: 'sub-2', assignmentId: 'hw-1', studentId: 'stu-2', content: '// 简易计算器实现\nfunction calculate(num1, num2, operator) {\n  switch(operator) {\n    case "+": return num1 + num2;\n    case "-": return num1 - num2;\n    case "*": return num1 * num2;\n    case "/": return num2 !== 0 ? num1 / num2 : "Division by zero";\n    default: return "Invalid operator";\n  }\n}', submittedAt: '2024-12-14T15:30:00', status: 'submitted', assignedAssistantId: null, retryCount: 0 },
    { id: 'sub-3', assignmentId: 'hw-1', studentId: 'stu-4', content: '// 我的计算器\nfunction add(a,b){return a+b;}\nfunction sub(a,b){return a-b;}\nfunction mul(a,b){return a*b;}\nfunction div(a,b){if(b===0)return null;return a/b;}', submittedAt: '2024-12-15T08:00:00', status: 'submitted', assignedAssistantId: null, retryCount: 0 },
    { id: 'sub-4', assignmentId: 'hw-2', studentId: 'stu-1', content: '软件工程的未来发展趋势\n\n随着人工智能和自动化技术的快速发展，软件工程正在经历深刻的变革。我认为未来的软件工程将呈现以下几个特点：\n\n1. AI辅助开发将成为主流\n2. 低代码/无代码平台的普及\n3. DevOps和持续交付的进一步深化\n\n总之，软件工程的未来充满机遇和挑战。', submittedAt: '2024-12-19T14:00:00', status: 'submitted', assignedAssistantId: null, retryCount: 0 },
    { id: 'sub-5', assignmentId: 'hw-2', studentId: 'stu-5', content: '软件工程的未来\n\n我觉得软件工程未来会越来越好。AI会帮助程序员写代码，这样工作效率会更高。', submittedAt: '2024-12-19T20:00:00', status: 'submitted', assignedAssistantId: null, retryCount: 0 },
    { id: 'sub-6', assignmentId: 'hw-3', studentId: 'stu-1', content: '{\n  "answers": {\n    "q1": "var, let, const",\n    "q2": "回调函数是作为参数传递给另一个函数的函数",\n    "q3": "Promise是处理异步操作的对象",\n    "q4": "箭头函数不绑定this"\n  }\n}', submittedAt: '2024-12-09T16:00:00', status: 'submitted', assignedAssistantId: null, retryCount: 0 },
    { id: 'sub-7', assignmentId: 'hw-3', studentId: 'stu-3', content: '{\n  "answers": {\n    "q1": "let和const",\n    "q2": "不知道",\n    "q3": "用于异步",\n    "q4": "更简洁"\n  }\n}', submittedAt: '2024-12-09T18:30:00', status: 'submitted', assignedAssistantId: null, retryCount: 0 },
    { id: 'sub-8', assignmentId: 'hw-4', studentId: 'stu-3', content: 'class Node {\n  constructor(data) {\n    this.data = data;\n    this.next = null;\n  }\n}\n\nclass LinkedList {\n  constructor() {\n    this.head = null;\n  }\n  insert(data) { /* 实现 */ }\n  delete(data) { /* 实现 */ }\n}', submittedAt: '2024-12-17T11:00:00', status: 'submitted', assignedAssistantId: null, retryCount: 0 },
    { id: 'sub-9', assignmentId: 'hw-4', studentId: 'stu-6', content: '// 链表实现\n// TODO: 完成链表操作', submittedAt: '2024-12-17T22:00:00', status: 'submitted', assignedAssistantId: null, retryCount: 0 }
  ];

  DATA.gradingRecords = [];
  DATA.gradeHistory = [];
  DATA.assignmentsToAssistants = [];
};

const getAssignmentById = (id) => DATA.assignments.find(a => a.id === id);
const getStudentById = (id) => DATA.students.find(s => s.id === id);
const getCourseById = (id) => DATA.courses.find(c => c.id === id);
const getAssistantById = (id) => DATA.assistants.find(a => a.id === id);
const getSubmissionById = (id) => DATA.submissions.find(s => s.id === id);

const getSubmissionsByAssignment = (assignmentId) => 
  DATA.submissions.filter(s => s.assignmentId === assignmentId);

const getSubmissionsByAssistant = (assistantId) => 
  DATA.submissions.filter(s => s.assignedAssistantId === assistantId);

const getGradingRecordsBySubmission = (submissionId) =>
  DATA.gradingRecords.filter(g => g.submissionId === submissionId);

const getGradeHistoryBySubmission = (submissionId) =>
  DATA.gradeHistory.filter(h => h.submissionId === submissionId);

const getSubmissionsWithDetails = (filter = {}) => {
  let submissions = [...DATA.submissions];
  
  if (filter.assignmentId) {
    submissions = submissions.filter(s => s.assignmentId === filter.assignmentId);
  }
  if (filter.courseId) {
    const assignmentIds = DATA.assignments
      .filter(a => a.courseId === filter.courseId)
      .map(a => a.id);
    submissions = submissions.filter(s => assignmentIds.includes(s.assignmentId));
  }
  if (filter.status) {
    submissions = submissions.filter(s => s.status === filter.status);
  }
  if (filter.assistantId) {
    submissions = submissions.filter(s => s.assignedAssistantId === filter.assistantId);
  }
  if (filter.studentId) {
    submissions = submissions.filter(s => s.studentId === filter.studentId);
  }

  return submissions.map(s => ({
    ...s,
    assignment: getAssignmentById(s.assignmentId),
    student: getStudentById(s.studentId),
    course: getAssignmentById(s.assignmentId) 
      ? getCourseById(getAssignmentById(s.assignmentId).courseId) 
      : null,
    assistant: s.assignedAssistantId ? getAssistantById(s.assignedAssistantId) : null,
    gradingRecords: getGradingRecordsBySubmission(s.id),
    gradeHistory: getGradeHistoryBySubmission(s.id)
  }));
};

const findAssistantWithLeastWorkload = () => {
  const activeAssistants = DATA.assistants.filter(a => a.active && a.workload < a.maxWorkload);
  if (activeAssistants.length === 0) return null;
  
  activeAssistants.sort((a, b) => a.workload - b.workload);
  return activeAssistants[0];
};

const assignSubmissionToAssistant = (submissionId) => {
  const submission = getSubmissionById(submissionId);
  if (!submission) throw new Error('提交不存在');
  if (submission.assignedAssistantId) throw new Error('该提交已分配助教');
  
  const assistant = findAssistantWithLeastWorkload();
  if (!assistant) throw new Error('没有可用的助教');
  
  submission.assignedAssistantId = assistant.id;
  submission.status = 'assigned';
  submission.assignedAt = new Date().toISOString();
  assistant.workload += 1;
  
  return submission;
};

const checkGradingPermission = (submissionId, assistantId) => {
  const submission = getSubmissionById(submissionId);
  if (!submission) return { allowed: false, reason: '提交不存在' };
  
  if (submission.assignedAssistantId !== assistantId) {
    return { allowed: false, reason: '您没有权限批改此作业' };
  }
  
  const latestRecord = DATA.gradingRecords
    .filter(g => g.submissionId === submissionId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  
  if (latestRecord) {
    if (latestRecord.status === 'published') {
      return { allowed: false, reason: '成绩已发布，不可再次批改' };
    }
    if (latestRecord.status === 'returned' && submission.status !== 'resubmitted') {
      return { allowed: false, reason: '作业已退回，需等待学生重交后才能复批' };
    }
  }
  
  return { allowed: true };
};

const checkTimeout = (submission) => {
  if (!submission.assignedAt) return false;
  const assignedTime = new Date(submission.assignedAt);
  const now = new Date();
  const hoursDiff = (now - assignedTime) / (1000 * 60 * 60);
  return hoursDiff > 24;
};

const createGradingRecord = (submissionId, assistantId, score, feedback, status = 'graded') => {
  const permission = checkGradingPermission(submissionId, assistantId);
  if (!permission.allowed) {
    throw new Error(permission.reason);
  }
  
  const submission = getSubmissionById(submissionId);
  const assignment = getAssignmentById(submission.assignmentId);
  
  if (score < 0 || score > assignment.totalScore) {
    throw new Error(`分数必须在0到${assignment.totalScore}之间`);
  }
  
  const previousRecord = DATA.gradingRecords
    .filter(g => g.submissionId === submissionId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  
  if (previousRecord && previousRecord.status === status && previousRecord.score === score) {
    throw new Error('重复的批改操作');
  }
  
  const record = {
    id: uuidv4(),
    submissionId,
    assistantId,
    score,
    feedback,
    status,
    createdAt: new Date().toISOString()
  };
  
  DATA.gradingRecords.push(record);
  
  if (previousRecord) {
    DATA.gradeHistory.push({
      id: uuidv4(),
      submissionId,
      previousScore: previousRecord.score,
      newScore: score,
      previousStatus: previousRecord.status,
      newStatus: status,
      changedBy: assistantId,
      changedAt: new Date().toISOString(),
      reason: status === 'regraded' ? '复批调分' : (status === 'returned' ? '退回重交' : '成绩更新')
    });
  }
  
  if (status === 'published') {
    submission.status = 'graded';
    submission.finalScore = score;
  } else if (status === 'returned') {
    submission.status = 'returned';
    submission.returnReason = feedback;
  } else if (status === 'regraded') {
    submission.status = 'regraded';
  }
  
  return record;
};

const resubmitAssignment = (submissionId, newContent) => {
  const submission = getSubmissionById(submissionId);
  if (!submission) throw new Error('提交不存在');
  
  if (submission.status !== 'returned') {
    throw new Error('只有被退回的作业才能重交');
  }
  
  submission.content = newContent;
  submission.status = 'resubmitted';
  submission.resubmittedAt = new Date().toISOString();
  submission.retryCount = (submission.retryCount || 0) + 1;
  
  return submission;
};

const getAssistantEfficiencyReport = () => {
  return DATA.assistants.map(assistant => {
    const submissions = getSubmissionsByAssistant(assistant.id);
    const graded = submissions.filter(s => s.status === 'graded' || s.status === 'regraded').length;
    const returned = submissions.filter(s => s.status === 'returned').length;
    const pending = submissions.filter(s => s.status === 'assigned').length;
    const overdue = submissions.filter(s => s.status === 'assigned' && checkTimeout(s)).length;
    
    const records = DATA.gradingRecords.filter(g => g.assistantId === assistant.id);
    const totalScore = records.reduce((sum, r) => sum + r.score, 0);
    const avgScore = records.length > 0 ? (totalScore / records.length).toFixed(1) : 0;
    
    return {
      ...assistant,
      graded,
      returned,
      pending,
      overdue,
      totalGrading: records.length,
      avgScore
    };
  });
};

const getScoreDistribution = (assignmentId) => {
  const submissions = getSubmissionsWithDetails({ assignmentId, status: 'graded' });
  const assignment = getAssignmentById(assignmentId);
  const totalScore = assignment.totalScore;
  
  const ranges = [
    { name: '0-59', count: 0, min: 0, max: 59 },
    { name: '60-69', count: 0, min: 60, max: 69 },
    { name: '70-79', count: 0, min: 70, max: 79 },
    { name: '80-89', count: 0, min: 80, max: 89 },
    { name: '90-100', count: 0, min: 90, max: 100 }
  ];
  
  submissions.forEach(s => {
    const score = s.finalScore || 0;
    const range = ranges.find(r => score >= r.min && score <= r.max);
    if (range) range.count++;
  });
  
  return {
    assignment,
    totalSubmissions: submissions.length,
    distribution: ranges,
    average: submissions.length > 0 
      ? (submissions.reduce((sum, s) => sum + (s.finalScore || 0), 0) / submissions.length).toFixed(1)
      : 0
  };
};

const getTeacherView = (courseId) => {
  const submissions = getSubmissionsWithDetails({ courseId });
  
  return submissions.map(s => ({
    submissionId: s.id,
    studentName: s.student?.name,
    assignmentName: s.assignment?.name,
    status: s.status,
    finalScore: s.finalScore,
    totalScore: s.assignment?.totalScore,
    gradeHistory: s.gradeHistory.map(h => ({
      previousScore: h.previousScore,
      newScore: h.newScore,
      reason: h.reason,
      changedAt: h.changedAt,
      changedBy: getAssistantById(h.changedBy)?.name
    })),
    latestFeedback: s.gradingRecords.length > 0 
      ? s.gradingRecords[s.gradingRecords.length - 1].feedback 
      : null
  }));
};

module.exports = {
  DATA,
  initData,
  getAssignmentById,
  getStudentById,
  getCourseById,
  getAssistantById,
  getSubmissionById,
  getSubmissionsByAssignment,
  getSubmissionsByAssistant,
  getGradingRecordsBySubmission,
  getGradeHistoryBySubmission,
  getSubmissionsWithDetails,
  findAssistantWithLeastWorkload,
  assignSubmissionToAssistant,
  checkGradingPermission,
  checkTimeout,
  createGradingRecord,
  resubmitAssignment,
  getAssistantEfficiencyReport,
  getScoreDistribution,
  getTeacherView
};
