const express = require('express');
const router = express.Router();
const db = require('./database');
const rules = require('./businessRules');

const { 
  promisifyQuery, 
  promisifyRun, 
  checkCertificateLocked,
  checkRegistration,
  checkDuplicateRegistration,
  getSession,
  calculateIsLate,
  determineCheckinStatus,
  canIssueCertificate,
  updateCertificateStatusOnRetakePass,
  uuidv4 
} = rules;

router.post('/employees', async (req, res) => {
  try {
    const { name, department } = req.body;
    if (!name || !department) {
      return res.status(400).json({ error: 'name and department are required' });
    }
    const id = uuidv4();
    await promisifyRun(db, 'INSERT INTO employees (id, name, department) VALUES (?, ?, ?)', [id, name, department]);
    res.json({ id, name, department });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/employees', async (req, res) => {
  try {
    const employees = await promisifyQuery(db, 'SELECT * FROM employees');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const { name, type, start_time, end_time, grace_minutes = 10, pass_score = 60, location } = req.body;
    if (!name || !type || !start_time || !end_time) {
      return res.status(400).json({ error: 'name, type, start_time, end_time are required' });
    }
    const id = uuidv4();
    await promisifyRun(
      db,
      'INSERT INTO training_sessions (id, name, type, start_time, end_time, grace_minutes, pass_score, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, type, start_time, end_time, grace_minutes, pass_score, location]
    );
    const session = await getSession(id);
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const sessions = await promisifyQuery(db, 'SELECT * FROM training_sessions');
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/registrations', async (req, res) => {
  try {
    const { session_id, employee_id } = req.body;
    if (!session_id || !employee_id) {
      return res.status(400).json({ error: 'session_id and employee_id are required' });
    }

    const session = await getSession(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isDuplicate = await checkDuplicateRegistration(session_id, employee_id);
    if (isDuplicate) {
      return res.status(400).json({ error: '同一员工不能重复报名同一场次' });
    }

    const id = uuidv4();
    await promisifyRun(
      db,
      'INSERT INTO registrations (id, session_id, employee_id, status) VALUES (?, ?, ?, ?)',
      [id, session_id, employee_id, 'registered']
    );
    const regs = await promisifyQuery(db, 'SELECT * FROM registrations WHERE id = ?', [id]);
    res.json(regs[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/registrations', async (req, res) => {
  try {
    const registrations = await promisifyQuery(db, 'SELECT * FROM registrations');
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/checkins', async (req, res) => {
  try {
    const { session_id, employee_id, checkin_time } = req.body;
    if (!session_id || !employee_id || !checkin_time) {
      return res.status(400).json({ error: 'session_id, employee_id, checkin_time are required' });
    }

    const isRegistered = await checkRegistration(session_id, employee_id);
    if (!isRegistered) {
      return res.status(400).json({ error: '未报名员工不能签到' });
    }

    const session = await getSession(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isLate = calculateIsLate(checkin_time, session.start_time, session.grace_minutes);
    const status = determineCheckinStatus(isLate);

    const id = uuidv4();
    try {
      await promisifyRun(
        db,
        'INSERT INTO checkins (id, session_id, employee_id, checkin_time, is_late, status) VALUES (?, ?, ?, ?, ?, ?)',
        [id, session_id, employee_id, checkin_time, isLate ? 1 : 0, status]
      );
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        return res.status(400).json({ error: '该员工已签到' });
      }
      throw e;
    }

    const checkins = await promisifyQuery(db, 'SELECT * FROM checkins WHERE id = ?', [id]);
    res.json(checkins[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/checkins', async (req, res) => {
  try {
    const checkins = await promisifyQuery(db, 'SELECT * FROM checkins');
    res.json(checkins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/checkins/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const checkins = await promisifyQuery(db, 'SELECT * FROM checkins WHERE id = ?', [id]);
    if (checkins.length === 0) {
      return res.status(404).json({ error: 'Checkin not found' });
    }

    await promisifyRun(db, 'UPDATE checkins SET status = "approved" WHERE id = ?', [id]);
    const updated = await promisifyQuery(db, 'SELECT * FROM checkins WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/checkins/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const checkins = await promisifyQuery(db, 'SELECT * FROM checkins WHERE id = ?', [id]);
    if (checkins.length === 0) {
      return res.status(404).json({ error: 'Checkin not found' });
    }

    await promisifyRun(db, 'UPDATE checkins SET status = "rejected" WHERE id = ?', [id]);
    const updated = await promisifyQuery(db, 'SELECT * FROM checkins WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/exams', async (req, res) => {
  try {
    const { session_id, employee_id, score, exam_time } = req.body;
    if (!session_id || !employee_id || score === undefined) {
      return res.status(400).json({ error: 'session_id, employee_id, score are required' });
    }

    const isLocked = await checkCertificateLocked(session_id, employee_id);
    if (isLocked) {
      return res.status(400).json({ error: '证书已发放，不能随意修改成绩' });
    }

    const session = await getSession(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isPassed = score >= session.pass_score ? 1 : 0;
    const attempts = await promisifyQuery(
      db,
      'SELECT COUNT(*) as count FROM exams WHERE session_id = ? AND employee_id = ?',
      [session_id, employee_id]
    );
    const attempt = attempts[0].count + 1;

    const id = uuidv4();
    await promisifyRun(
      db,
      'INSERT INTO exams (id, session_id, employee_id, score, is_passed, exam_time, attempt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, session_id, employee_id, score, isPassed, exam_time || new Date().toISOString(), attempt]
    );

    const pendingRetakes = await promisifyQuery(
      db,
      'SELECT * FROM retakes WHERE session_id = ? AND employee_id = ? AND status = "scheduled"',
      [session_id, employee_id]
    );
    for (const retake of pendingRetakes) {
      await promisifyRun(db, 'UPDATE retakes SET status = "completed" WHERE id = ?', [retake.id]);
    }

    if (isPassed) {
      await updateCertificateStatusOnRetakePass(session_id, employee_id, id);
    }

    const exams = await promisifyQuery(db, 'SELECT * FROM exams WHERE id = ?', [id]);
    res.json(exams[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/exams', async (req, res) => {
  try {
    const exams = await promisifyQuery(db, 'SELECT * FROM exams');
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/retakes', async (req, res) => {
  try {
    const { session_id, employee_id, original_exam_id, scheduled_time } = req.body;
    if (!session_id || !employee_id || !original_exam_id) {
      return res.status(400).json({ error: 'session_id, employee_id, original_exam_id are required' });
    }

    const originalExam = await promisifyQuery(db, 'SELECT * FROM exams WHERE id = ?', [original_exam_id]);
    if (originalExam.length === 0) {
      return res.status(404).json({ error: 'Original exam not found' });
    }
    if (originalExam[0].is_passed === 1) {
      return res.status(400).json({ error: '考试已通过，无需安排补考' });
    }

    const id = uuidv4();
    await promisifyRun(
      db,
      'INSERT INTO retakes (id, session_id, employee_id, original_exam_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, session_id, employee_id, original_exam_id, scheduled_time, 'scheduled']
    );

    const retakes = await promisifyQuery(db, 'SELECT * FROM retakes WHERE id = ?', [id]);
    res.json(retakes[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/retakes', async (req, res) => {
  try {
    const retakes = await promisifyQuery(db, 'SELECT * FROM retakes');
    res.json(retakes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/certificates', async (req, res) => {
  try {
    const { session_id, employee_id } = req.body;
    if (!session_id || !employee_id) {
      return res.status(400).json({ error: 'session_id and employee_id are required' });
    }

    const existing = await promisifyQuery(
      db,
      'SELECT * FROM certificates WHERE session_id = ? AND employee_id = ?',
      [session_id, employee_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '该员工证书已存在' });
    }

    const result = await canIssueCertificate(session_id, employee_id);
    if (!result.canIssue) {
      return res.status(400).json({ error: result.reason });
    }

    const id = uuidv4();
    const certNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    await promisifyRun(
      db,
      'INSERT INTO certificates (id, session_id, employee_id, exam_id, status, certificate_number) VALUES (?, ?, ?, ?, ?, ?)',
      [id, session_id, employee_id, result.exam.id, 'active', certNumber]
    );

    const certs = await promisifyQuery(db, 'SELECT * FROM certificates WHERE id = ?', [id]);
    res.json(certs[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/certificates', async (req, res) => {
  try {
    const certs = await promisifyQuery(db, 'SELECT * FROM certificates');
    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    let sessions;
    if (session_id) {
      sessions = await promisifyQuery(db, 'SELECT * FROM training_sessions WHERE id = ?', [session_id]);
    } else {
      sessions = await promisifyQuery(db, 'SELECT * FROM training_sessions');
    }

    const employees = await promisifyQuery(db, 'SELECT * FROM employees');
    const registrations = await promisifyQuery(db, 'SELECT * FROM registrations');
    const checkins = await promisifyQuery(db, 'SELECT * FROM checkins');
    const exams = await promisifyQuery(db, 'SELECT * FROM exams');
    const retakes = await promisifyQuery(db, 'SELECT * FROM retakes');
    const certificates = await promisifyQuery(db, 'SELECT * FROM certificates');

    const departments = [...new Set(employees.map(e => e.department))];
    const departmentStats = {};

    for (const dept of departments) {
      const deptEmployees = employees.filter(e => e.department === dept);
      let completed = 0;
      let registered = 0;

      for (const emp of deptEmployees) {
        const empRegs = registrations.filter(r => r.employee_id === emp.id);
        if (empRegs.length > 0) registered++;
        
        const empCerts = certificates.filter(c => c.employee_id === emp.id);
        if (empCerts.length > 0) completed++;
      }

      departmentStats[dept] = {
        total_employees: deptEmployees.length,
        registered: registered,
        completed: completed,
        completion_rate: deptEmployees.length > 0 ? (completed / deptEmployees.length * 100).toFixed(1) + '%' : '0%'
      };
    }

    const incompleteList = [];
    for (const emp of employees) {
      const empCerts = certificates.filter(c => c.employee_id === emp.id);
      const empRegs = registrations.filter(r => r.employee_id === emp.id);
      const empCheckins = checkins.filter(c => c.employee_id === emp.id);
      const empExams = exams.filter(e => e.employee_id === emp.id);

      if (empCerts.length === 0) {
        incompleteList.push({
          employee_id: emp.id,
          name: emp.name,
          department: emp.department,
          has_registration: empRegs.length > 0,
          has_checkin: empCheckins.length > 0,
          checkin_status: empCheckins.length > 0 ? empCheckins[0].status : null,
          has_exam: empExams.length > 0,
          latest_score: empExams.length > 0 ? empExams[empExams.length - 1].score : null,
          is_passed: empExams.length > 0 ? empExams[empExams.length - 1].is_passed === 1 : null
        });
      }
    }

    const retakeSchedule = retakes.map(r => {
      const emp = employees.find(e => e.id === r.employee_id);
      const session = sessions.find(s => s.id === r.session_id);
      return {
        retake_id: r.id,
        session_name: session ? session.name : r.session_id,
        employee_name: emp ? emp.name : r.employee_id,
        employee_department: emp ? emp.department : null,
        scheduled_time: r.scheduled_time,
        status: r.status
      };
    });

    const certificateRecords = certificates.map(c => {
      const emp = employees.find(e => e.id === c.employee_id);
      const session = sessions.find(s => s.id === c.session_id);
      const exam = exams.find(e => e.id === c.exam_id);
      return {
        certificate_number: c.certificate_number,
        session_name: session ? session.name : c.session_id,
        employee_name: emp ? emp.name : c.employee_id,
        employee_department: emp ? emp.department : null,
        exam_score: exam ? exam.score : null,
        issued_at: c.issued_at,
        status: c.status
      };
    });

    res.json({
      department_completion_rates: departmentStats,
      incomplete_list: incompleteList,
      retake_schedule: retakeSchedule,
      certificate_records: certificateRecords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
