import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import { initDatabase } from './database';
import { seedDemoData } from './seedDemo';
import {
  getStudents, getStudentById, importStudents, assignStudentToGroup,
  getTeachers, getGroups, createGroup, updateGroupTeacher,
  getMeetingPoints, createMeetingPoint,
  recordAttendance, getAttendanceRecords,
  requestLeave, approveLeave, getLeaveRequests,
  changeStudentGroup, getGroupChanges,
  getAbsentAlerts, getDashboardData,
  ApiErrorException,
} from './services';
import { generateReport, getExportCSV, getGroupChangesCSV } from './export';
import type { AttendanceStatus, LeaveStatus } from './types';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

initDatabase();
seedDemoData();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/dashboard', (_req, res) => {
  res.json(getDashboardData());
});

app.get('/api/students', (_req, res) => {
  res.json(getStudents());
});

app.get('/api/students/:id', (req, res) => {
  const student = getStudentById(req.params.id);
  if (!student) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '学生不存在' });
  }
  res.json(student);
});

app.post('/api/students/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 'NO_FILE', message: '未上传文件' });
    }

    const rawContent = req.file.buffer.toString();
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const mappedData = data.map(row => ({
      name: String(row['姓名'] || row['name'] || ''),
      studentId: String(row['学号'] || row['studentId'] || ''),
      class: String(row['班级'] || row['class'] || ''),
      gender: String(row['性别'] || row['gender'] || ''),
      phone: String(row['电话'] || row['phone'] || ''),
      emergencyContact: String(row['紧急联系人'] || row['emergencyContact'] || ''),
    }));

    const result = importStudents(mappedData, rawContent);
    res.json(result);
  } catch (error) {
    res.status(500).json({ code: 'IMPORT_ERROR', message: (error as Error).message });
  }
});

app.put('/api/students/:id/group', (req, res) => {
  try {
    const rawInput = JSON.stringify(req.body);
    const { groupId } = req.body;
    const student = assignStudentToGroup(req.params.id, groupId || null, rawInput);
    res.json(student);
  } catch (e) {
    if (e instanceof ApiErrorException) {
      return res.status(400).json(e.toApiError());
    }
    res.status(500).json({ code: 'ERROR', message: (e as Error).message });
  }
});

app.get('/api/teachers', (_req, res) => {
  res.json(getTeachers());
});

app.get('/api/groups', (_req, res) => {
  res.json(getGroups());
});

app.post('/api/groups', (req, res) => {
  try {
    const { name, teacherId } = req.body;
    if (!name) {
      return res.status(400).json({ code: 'DATA_MISSING', message: '小组名称不能为空' });
    }
    const group = createGroup(name, teacherId);
    res.json(group);
  } catch (e) {
    res.status(500).json({ code: 'ERROR', message: (e as Error).message });
  }
});

app.put('/api/groups/:id/teacher', (req, res) => {
  try {
    const { teacherId } = req.body;
    updateGroupTeacher(req.params.id, teacherId || null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ code: 'ERROR', message: (e as Error).message });
  }
});

app.get('/api/meeting-points', (_req, res) => {
  res.json(getMeetingPoints());
});

app.post('/api/meeting-points', (req, res) => {
  try {
    const { name, location, description, orderIndex } = req.body;
    if (!name) {
      return res.status(400).json({ code: 'DATA_MISSING', message: '集合点名称不能为空' });
    }
    const mp = createMeetingPoint({ name, location, description, orderIndex });
    res.json(mp);
  } catch (e) {
    res.status(500).json({ code: 'ERROR', message: (e as Error).message });
  }
});

app.post('/api/attendance', (req, res) => {
  try {
    const rawInput = JSON.stringify(req.body);
    const { studentId, meetingPointId, status, operatorId, notes } = req.body;
    if (!studentId || !meetingPointId || !status) {
      return res.status(400).json({
        code: 'DATA_MISSING',
        message: '缺少必要参数',
        rawInput,
      });
    }
    const record = recordAttendance(
      studentId,
      meetingPointId,
      status as AttendanceStatus,
      rawInput,
      operatorId,
      notes
    );
    res.json(record);
  } catch (e) {
    if (e instanceof ApiErrorException) {
      return res.status(400).json(e.toApiError());
    }
    res.status(500).json({ code: 'ERROR', message: (e as Error).message });
  }
});

app.get('/api/attendance', (req, res) => {
  const { meetingPointId } = req.query;
  res.json(getAttendanceRecords(meetingPointId as string | undefined));
});

app.post('/api/leaves', (req, res) => {
  try {
    const rawInput = JSON.stringify(req.body);
    const { studentId, meetingPointId, reason, requestedBy } = req.body;
    if (!studentId || !meetingPointId) {
      return res.status(400).json({
        code: 'DATA_MISSING',
        message: '缺少必要参数',
        rawInput,
      });
    }
    const leave = requestLeave(
      studentId, meetingPointId, reason || '',
      rawInput, requestedBy || 'system'
    );
    res.json(leave);
  } catch (e) {
    if (e instanceof ApiErrorException) {
      return res.status(400).json(e.toApiError());
    }
    res.status(500).json({ code: 'ERROR', message: (e as Error).message });
  }
});

app.get('/api/leaves', (req, res) => {
  const { status } = req.query;
  res.json(getLeaveRequests(status as LeaveStatus | undefined));
});

app.put('/api/leaves/:id/approve', (req, res) => {
  try {
    const { approved, approvedBy } = req.body;
    const leave = approveLeave(req.params.id, !!approved, approvedBy || 'system');
    res.json(leave);
  } catch (e) {
    if (e instanceof ApiErrorException) {
      return res.status(400).json(e.toApiError());
    }
    res.status(500).json({ code: 'ERROR', message: (e as Error).message });
  }
});

app.post('/api/group-changes', (req, res) => {
  try {
    const rawInput = JSON.stringify(req.body);
    const { studentId, newGroupId, reason, operatorId } = req.body;
    if (!studentId) {
      return res.status(400).json({
        code: 'DATA_MISSING',
        message: '缺少学生ID',
        rawInput,
      });
    }
    const change = changeStudentGroup(
      studentId, newGroupId || null, reason || '',
      rawInput, operatorId || 'system'
    );
    res.json(change);
  } catch (e) {
    if (e instanceof ApiErrorException) {
      return res.status(400).json(e.toApiError());
    }
    res.status(500).json({ code: 'ERROR', message: (e as Error).message });
  }
});

app.get('/api/group-changes', (req, res) => {
  const { studentId } = req.query;
  res.json(getGroupChanges(studentId as string | undefined));
});

app.get('/api/alerts/absent', (_req, res) => {
  res.json(getAbsentAlerts());
});

app.get('/api/export/report', (_req, res) => {
  res.json(generateReport());
});

app.get('/api/export/csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="rollcall-report-${Date.now()}.csv"`
  );
  res.send('\ufeff' + getExportCSV());
});

app.get('/api/export/group-changes-csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="group-changes-${Date.now()}.csv"`
  );
  res.send('\ufeff' + getGroupChangesCSV());
});

app.listen(port, () => {
  console.log(`Roll Call API server running on http://localhost:${port}`);
});
