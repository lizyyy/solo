const db = require('../database');

const sampleSessions = [
  { session_id: 'LIVE-001', title: '产品设计基础培训', date: '2024-01-15', duration: 120, trainer: '张老师' },
  { session_id: 'LIVE-002', title: '销售技巧进阶', date: '2024-01-16', duration: 90, trainer: '李老师' },
  { session_id: 'LIVE-003', title: '团队管理实战', date: '2024-01-17', duration: 150, trainer: '王老师' },
];

const sampleUsers = [
  { user_id: 'USER-001', user_name: '张三' },
  { user_id: 'USER-002', user_name: '李四' },
  { user_id: 'USER-003', user_name: '王五' },
  { user_id: 'USER-004', user_name: '赵六' },
  { user_id: 'USER-005', user_name: '钱七' },
];

db.serialize(() => {
  const stmtSession = db.prepare('INSERT OR IGNORE INTO live_sessions (session_id, title, date, duration, trainer) VALUES (?, ?, ?, ?, ?)');
  sampleSessions.forEach(s => {
    stmtSession.run(s.session_id, s.title, s.date, s.duration, s.trainer);
  });
  stmtSession.finalize();

  const stmtWatch = db.prepare('INSERT OR IGNORE INTO watch_records (user_id, user_name, session_id, watch_duration, watch_percentage, is_qualified) VALUES (?, ?, ?, ?, ?, ?)');
  sampleUsers.forEach(user => {
    sampleSessions.forEach(session => {
      const watchDuration = Math.floor(Math.random() * session.duration);
      const percentage = (watchDuration / session.duration) * 100;
      const isQualified = percentage >= 80 ? 1 : 0;
      stmtWatch.run(user.user_id, user.user_name, session.session_id, watchDuration, percentage, isQualified);
    });
  });
  stmtWatch.finalize();

  const stmtInteraction = db.prepare('INSERT OR IGNORE INTO interaction_records (user_id, session_id, comment_count, question_count, poll_participated, total_score) VALUES (?, ?, ?, ?, ?, ?)');
  sampleUsers.forEach(user => {
    sampleSessions.forEach(session => {
      const comments = Math.floor(Math.random() * 10);
      const questions = Math.floor(Math.random() * 5);
      const poll = Math.random() > 0.5 ? 1 : 0;
      const score = comments * 2 + questions * 3 + poll * 5;
      stmtInteraction.run(user.user_id, session.session_id, comments, questions, poll, score);
    });
  });
  stmtInteraction.finalize();

  const stmtQuiz = db.prepare('INSERT OR IGNORE INTO quiz_scores (user_id, session_id, total_questions, correct_answers, score, is_passed) VALUES (?, ?, ?, ?, ?, ?)');
  sampleUsers.forEach(user => {
    sampleSessions.forEach(session => {
      const totalQ = 10;
      const correct = Math.floor(Math.random() * 11);
      const score = (correct / totalQ) * 100;
      const passed = score >= 60 ? 1 : 0;
      stmtQuiz.run(user.user_id, session.session_id, totalQ, correct, score, passed);
    });
  });
  stmtQuiz.finalize();

  const stmtReplay = db.prepare('INSERT OR IGNORE INTO replay_studies (user_id, session_id, replay_duration, completed_at, is_approved, approved_by) VALUES (?, ?, ?, ?, ?, ?)');
  sampleUsers.forEach(user => {
    sampleSessions.forEach(session => {
      if (Math.random() > 0.5) {
        const replayDuration = Math.floor(Math.random() * session.duration);
        const completed = replayDuration >= session.duration * 0.8;
        stmtReplay.run(user.user_id, session.session_id, replayDuration, completed ? '2024-01-20' : null, completed ? 1 : 0, completed ? '管理员' : null);
      }
    });
  });
  stmtReplay.finalize();

  console.log('数据库初始化完成，已插入样例数据');
});
