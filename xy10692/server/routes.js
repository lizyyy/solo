const express = require('express');
const router = express.Router();
const db = require('./database');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const WATCH_THRESHOLD = 80;
const QUIZ_THRESHOLD = 60;
const INTERACTION_THRESHOLD = 10;

function logChange(recordType, recordId, fieldName, oldValue, newValue, changedBy) {
  db.run(
    'INSERT INTO change_history (record_type, record_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?)',
    [recordType, recordId, fieldName, oldValue, newValue, changedBy]
  );
}

router.get('/sessions', (req, res) => {
  db.all('SELECT * FROM live_sessions ORDER BY date DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/qualifications', (req, res) => {
  const { session_id, user_name, overall_qualified } = req.query;
  let query = `
    SELECT cq.*, ls.title as session_title, ls.duration as session_duration,
           wr.watch_duration, wr.watch_percentage,
           ir.total_score as interaction_score,
           qs.score as quiz_score, qs.is_passed as quiz_passed,
           rs.is_approved as replay_approved
    FROM certificate_qualifications cq
    LEFT JOIN live_sessions ls ON cq.session_id = ls.session_id
    LEFT JOIN watch_records wr ON cq.user_id = wr.user_id AND cq.session_id = wr.session_id
    LEFT JOIN interaction_records ir ON cq.user_id = ir.user_id AND cq.session_id = ir.session_id
    LEFT JOIN quiz_scores qs ON cq.user_id = qs.user_id AND cq.session_id = qs.session_id
    LEFT JOIN replay_studies rs ON cq.user_id = rs.user_id AND cq.session_id = rs.session_id
    WHERE 1=1
  `;
  const params = [];
  
  if (session_id) {
    query += ' AND cq.session_id = ?';
    params.push(session_id);
  }
  if (user_name) {
    query += ' AND cq.user_name LIKE ?';
    params.push(`%${user_name}%`);
  }
  if (overall_qualified !== undefined) {
    query += ' AND cq.overall_qualified = ?';
    params.push(overall_qualified);
  }
  
  query += ' ORDER BY cq.processed_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/watch-records/:session_id/:user_id', (req, res) => {
  const { session_id, user_id } = req.params;
  db.get(
    'SELECT * FROM watch_records WHERE session_id = ? AND user_id = ?',
    [session_id, user_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    }
  );
});

router.get('/interaction-records/:session_id/:user_id', (req, res) => {
  const { session_id, user_id } = req.params;
  db.get(
    'SELECT * FROM interaction_records WHERE session_id = ? AND user_id = ?',
    [session_id, user_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    }
  );
});

router.get('/quiz-scores/:session_id/:user_id', (req, res) => {
  const { session_id, user_id } = req.params;
  db.get(
    'SELECT * FROM quiz_scores WHERE session_id = ? AND user_id = ?',
    [session_id, user_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    }
  );
});

router.get('/replay-studies/:session_id/:user_id', (req, res) => {
  const { session_id, user_id } = req.params;
  db.get(
    'SELECT * FROM replay_studies WHERE session_id = ? AND user_id = ?',
    [session_id, user_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    }
  );
});

router.post('/validate-watch-time', (req, res) => {
  const { session_id, user_id, processed_by } = req.body;
  
  db.get(
    'SELECT * FROM watch_records WHERE session_id = ? AND user_id = ?',
    [session_id, user_id],
    (err, watch) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!watch) return res.status(404).json({ error: '观看记录不存在' });
      
      const isQualified = watch.watch_percentage >= WATCH_THRESHOLD;
      
      db.get(
        'SELECT * FROM certificate_qualifications WHERE session_id = ? AND user_id = ?',
        [session_id, user_id],
        (err, qual) => {
          if (err) return res.status(500).json({ error: err.message });
          
          if (qual) {
            logChange('certificate', qual.id, 'watch_qualified', qual.watch_qualified, isQualified ? 1 : 0, processed_by);
            db.run(
              'UPDATE certificate_qualifications SET watch_qualified = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ?',
              [isQualified ? 1 : 0, processed_by, session_id, user_id]
            );
          } else {
            db.get('SELECT user_name FROM watch_records WHERE user_id = ?', [user_id], (err, user) => {
              db.run(
                'INSERT INTO certificate_qualifications (user_id, user_name, session_id, watch_qualified, processed_by) VALUES (?, ?, ?, ?, ?)',
                [user_id, user.user_name, session_id, isQualified ? 1 : 0, processed_by]
              );
            });
          }
          
          res.json({
            success: true,
            watch_percentage: watch.watch_percentage,
            is_qualified: isQualified,
            threshold: WATCH_THRESHOLD
          });
        }
      );
    }
  );
});

router.post('/process-quiz-score', (req, res) => {
  const { session_id, user_id, processed_by } = req.body;
  
  db.get(
    'SELECT * FROM quiz_scores WHERE session_id = ? AND user_id = ?',
    [session_id, user_id],
    (err, quiz) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!quiz) return res.status(404).json({ error: '测验成绩不存在' });
      
      const isQualified = quiz.is_passed === 1 || quiz.score >= QUIZ_THRESHOLD;
      
      db.get(
        'SELECT * FROM certificate_qualifications WHERE session_id = ? AND user_id = ?',
        [session_id, user_id],
        (err, qual) => {
          if (err) return res.status(500).json({ error: err.message });
          
          if (qual) {
            logChange('certificate', qual.id, 'quiz_qualified', qual.quiz_qualified, isQualified ? 1 : 0, processed_by);
            db.run(
              'UPDATE certificate_qualifications SET quiz_qualified = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ?',
              [isQualified ? 1 : 0, processed_by, session_id, user_id]
            );
          } else {
            db.get('SELECT user_name FROM watch_records WHERE user_id = ?', [user_id], (err, user) => {
              db.run(
                'INSERT INTO certificate_qualifications (user_id, user_name, session_id, quiz_qualified, processed_by) VALUES (?, ?, ?, ?, ?)',
                [user_id, user.user_name, session_id, isQualified ? 1 : 0, processed_by]
              );
            });
          }
          
          res.json({
            success: true,
            score: quiz.score,
            is_qualified: isQualified,
            threshold: QUIZ_THRESHOLD
          });
        }
      );
    }
  );
});

router.post('/save-replay-study', (req, res) => {
  const { session_id, user_id, replay_duration, approved_by } = req.body;
  
  db.get(
    'SELECT duration FROM live_sessions WHERE session_id = ?',
    [session_id],
    (err, session) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!session) return res.status(404).json({ error: '直播场次不存在' });
      
      const isApproved = replay_duration >= session.duration * 0.8;
      
      db.get(
        'SELECT * FROM replay_studies WHERE session_id = ? AND user_id = ?',
        [session_id, user_id],
        (err, replay) => {
          if (err) return res.status(500).json({ error: err.message });
          
          if (replay) {
            logChange('replay', replay.id, 'replay_duration', replay.replay_duration, replay_duration, approved_by);
            logChange('replay', replay.id, 'is_approved', replay.is_approved, isApproved ? 1 : 0, approved_by);
            db.run(
              'UPDATE replay_studies SET replay_duration = ?, is_approved = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ?',
              [replay_duration, isApproved ? 1 : 0, approved_by, session_id, user_id]
            );
          } else {
            db.run(
              'INSERT INTO replay_studies (user_id, session_id, replay_duration, is_approved, approved_by, approved_at, completed_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
              [user_id, session_id, replay_duration, isApproved ? 1 : 0, approved_by]
            );
          }
          
          db.get(
            'SELECT * FROM certificate_qualifications WHERE session_id = ? AND user_id = ?',
            [session_id, user_id],
            (err, qual) => {
              if (qual) {
                logChange('certificate', qual.id, 'replay_qualified', qual.replay_qualified, isApproved ? 1 : 0, approved_by);
                db.run(
                  'UPDATE certificate_qualifications SET replay_qualified = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ?',
                  [isApproved ? 1 : 0, approved_by, session_id, user_id]
                );
              }
            }
          );
          
          res.json({
            success: true,
            replay_duration,
            is_approved: isApproved,
            required_duration: session.duration * 0.8
          });
        }
      );
    }
  );
});

router.post('/process-qualification', (req, res) => {
  const { session_id, user_id, processed_by } = req.body;
  
  db.get(
    'SELECT * FROM watch_records WHERE session_id = ? AND user_id = ?',
    [session_id, user_id],
    (err, watch) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get(
        'SELECT * FROM interaction_records WHERE session_id = ? AND user_id = ?',
        [session_id, user_id],
        (err, interaction) => {
          if (err) return res.status(500).json({ error: err.message });
          
          db.get(
            'SELECT * FROM quiz_scores WHERE session_id = ? AND user_id = ?',
            [session_id, user_id],
            (err, quiz) => {
              if (err) return res.status(500).json({ error: err.message });
              
              db.get(
                'SELECT * FROM replay_studies WHERE session_id = ? AND user_id = ?',
                [session_id, user_id],
                (err, replay) => {
                  if (err) return res.status(500).json({ error: err.message });
                  
                  const watchQualified = watch && watch.watch_percentage >= WATCH_THRESHOLD ? 1 : 0;
                  const interactionQualified = interaction && interaction.total_score >= INTERACTION_THRESHOLD ? 1 : 0;
                  const quizQualified = quiz && (quiz.is_passed === 1 || quiz.score >= QUIZ_THRESHOLD) ? 1 : 0;
                  const replayQualified = replay && replay.is_approved === 1 ? 1 : 0;
                  const overallQualified = (watchQualified || replayQualified) && quizQualified ? 1 : 0;
                  
                  db.get(
                    'SELECT * FROM certificate_qualifications WHERE session_id = ? AND user_id = ?',
                    [session_id, user_id],
                    (err, qual) => {
                      if (err) return res.status(500).json({ error: err.message });
                      
                      if (qual) {
                        logChange('certificate', qual.id, 'watch_qualified', qual.watch_qualified, watchQualified, processed_by);
                        logChange('certificate', qual.id, 'interaction_qualified', qual.interaction_qualified, interactionQualified, processed_by);
                        logChange('certificate', qual.id, 'quiz_qualified', qual.quiz_qualified, quizQualified, processed_by);
                        logChange('certificate', qual.id, 'replay_qualified', qual.replay_qualified, replayQualified, processed_by);
                        logChange('certificate', qual.id, 'overall_qualified', qual.overall_qualified, overallQualified, processed_by);
                        
                        db.run(
                          'UPDATE certificate_qualifications SET watch_qualified = ?, interaction_qualified = ?, quiz_qualified = ?, replay_qualified = ?, overall_qualified = ?, processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ?',
                          [watchQualified, interactionQualified, quizQualified, replayQualified, overallQualified, processed_by, session_id, user_id]
                        );
                      } else {
                        db.get('SELECT user_name FROM watch_records WHERE user_id = ?', [user_id], (err, user) => {
                          db.run(
                            'INSERT INTO certificate_qualifications (user_id, user_name, session_id, watch_qualified, interaction_qualified, quiz_qualified, replay_qualified, overall_qualified, processed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [user_id, user.user_name, session_id, watchQualified, interactionQualified, quizQualified, replayQualified, overallQualified, processed_by]
                          );
                        });
                      }
                      
                      res.json({
                        success: true,
                        watch_qualified: watchQualified,
                        interaction_qualified: interactionQualified,
                        quiz_qualified: quizQualified,
                        replay_qualified: replayQualified,
                        overall_qualified: overallQualified
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

router.get('/statistics', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM watch_records', (err, watchCount) => {
    db.get('SELECT COUNT(*) as qualified FROM watch_records WHERE is_qualified = 1', (err, watchQualified) => {
      db.get('SELECT COUNT(*) as passed FROM quiz_scores WHERE is_passed = 1', (err, quizPassed) => {
        db.get('SELECT COUNT(*) as total_quiz FROM quiz_scores', (err, quizTotal) => {
          db.get('SELECT COUNT(*) as approved FROM replay_studies WHERE is_approved = 1', (err, replayApproved) => {
            db.get('SELECT COUNT(*) as qualified_total FROM certificate_qualifications WHERE overall_qualified = 1', (err, certQualified) => {
              res.json({
                watch_records: watchCount.total,
                watch_qualified: watchQualified.qualified,
                quiz_passed: quizPassed.passed,
                quiz_total: quizTotal.total,
                replay_approved: replayApproved.approved,
                certificates_qualified: certQualified.qualified_total
              });
            });
          });
        });
      });
    });
  });
});

router.get('/change-history', (req, res) => {
  const { changed_by, start_date, end_date } = req.query;
  let query = 'SELECT * FROM change_history WHERE 1=1';
  const params = [];
  
  if (changed_by) {
    query += ' AND changed_by LIKE ?';
    params.push(`%${changed_by}%`);
  }
  if (start_date) {
    query += ' AND changed_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND changed_at <= ?';
    params.push(end_date + ' 23:59:59');
  }
  
  query += ' ORDER BY changed_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/export-report', (req, res) => {
  const { processed_by, start_date, end_date } = req.query;
  
  let query = `
    SELECT cq.*, ls.title as session_title,
           wr.watch_duration, wr.watch_percentage,
           ir.total_score as interaction_score,
           qs.score as quiz_score
    FROM certificate_qualifications cq
    LEFT JOIN live_sessions ls ON cq.session_id = ls.session_id
    LEFT JOIN watch_records wr ON cq.user_id = wr.user_id AND cq.session_id = wr.session_id
    LEFT JOIN interaction_records ir ON cq.user_id = ir.user_id AND cq.session_id = ir.session_id
    LEFT JOIN quiz_scores qs ON cq.user_id = qs.user_id AND cq.session_id = qs.session_id
    WHERE 1=1
  `;
  const params = [];
  
  if (processed_by) {
    query += ' AND cq.processed_by LIKE ?';
    params.push(`%${processed_by}%`);
  }
  if (start_date) {
    query += ' AND cq.processed_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND cq.processed_at <= ?';
    params.push(end_date + ' 23:59:59');
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const csvWriter = createCsvWriter({
      path: '/tmp/qualification_report.csv',
      header: [
        { id: 'user_id', title: '用户ID' },
        { id: 'user_name', title: '用户名' },
        { id: 'session_id', title: '场次ID' },
        { id: 'session_title', title: '场次名称' },
        { id: 'watch_duration', title: '观看时长' },
        { id: 'watch_percentage', title: '观看百分比' },
        { id: 'interaction_score', title: '互动分数' },
        { id: 'quiz_score', title: '测验分数' },
        { id: 'watch_qualified', title: '观看合格' },
        { id: 'interaction_qualified', title: '互动合格' },
        { id: 'quiz_qualified', title: '测验合格' },
        { id: 'replay_qualified', title: '回放合格' },
        { id: 'overall_qualified', title: '整体合格' },
        { id: 'processed_by', title: '处理人' },
        { id: 'processed_at', title: '处理时间' }
      ]
    });
    
    csvWriter.writeRecords(rows)
      .then(() => {
        res.download('/tmp/qualification_report.csv', '资格处理报告.csv');
      });
  });
});

module.exports = router;
