const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

const ENHARMONIC_PAIRS = {
  'augmented_fourth': 'diminished_fifth',
  'diminished_fifth': 'augmented_fourth',
  'minor_sixth': 'augmented_fifth',
  'augmented_fifth': 'minor_sixth',
  'major_third': 'diminished_fourth',
  'diminished_fourth': 'major_third'
};

function isEnharmonic(answer1, answer2) {
  return ENHARMONIC_PAIRS[answer1] === answer2 || ENHARMONIC_PAIRS[answer2] === answer1;
}

function getErrorCategory(questionType, studentAnswer, standardAnswer) {
  if (!studentAnswer) return '缺字段-未填写答案';

  const comparisons = {
    interval: {
      'major_third/minor_third': '大小三度混淆',
      'minor_third/major_third': '大小三度混淆',
      'perfect_fifth/perfect_fourth': '纯四五度混淆',
      'perfect_fourth/perfect_fifth': '纯四五度混淆',
      'major_sixth/minor_sixth': '大小六度混淆',
      'minor_sixth/major_sixth': '大小六度混淆',
      'augmented_fourth/diminished_fifth': '等音判断-增四度减五度',
      'diminished_fifth/augmented_fourth': '等音判断-增四度减五度'
    },
    chord: {
      'major_triad/minor_triad': '大小三和弦混淆',
      'minor_triad/major_triad': '大小三和弦混淆',
      'dominant_seventh/major_seventh': '属七与大七混淆',
      'major_seventh/dominant_seventh': '属七与大七混淆',
      'diminished_seventh/minor_seventh': '减七与小七混淆',
      'minor_seventh/diminished_seventh': '减七与小七混淆'
    },
    rhythm: {
      'dotted_eighth_sixteenth/eighth_sixteenth': '附点节奏听辨错误',
      'eighth_sixteenth/dotted_eighth_sixteenth': '附点节奏听辨错误',
      'synopation/straight': '切分与均分节奏混淆',
      'straight/synopation': '切分与均分节奏混淆'
    }
  };

  const key = `${studentAnswer}/${standardAnswer}`;
  return comparisons[questionType]?.[key] || `${questionType}判断错误`;
}

function checkMissingFields(data) {
  const missing = [];
  if (!data.student_answer && data.student_answer !== '') missing.push('student_answer');
  return missing;
}

router.get('/', (req, res) => {
  const db = getDb();
  const { question_id, source } = req.query;
  let sql = `SELECT a.*, q.title, q.question_type, q.standard_answer, q.audio_file
             FROM answer_records a
             LEFT JOIN questions q ON a.question_id = q.id
             WHERE 1=1`;
  const params = [];

  if (question_id) {
    sql += ` AND a.question_id = ?`;
    params.push(question_id);
  }
  if (source) {
    sql += ` AND a.answer_source = ?`;
    params.push(source);
  }
  sql += ` ORDER BY a.submit_time DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { question_id, student_answer, answer_source = 'normal', remark } = req.body;
  const operator = req.body.operator || 'teacher';

  if (!question_id) {
    res.status(400).json({ error: '缺少题目ID' });
    return;
  }

  db.get(`SELECT * FROM questions WHERE id = ?`, [question_id], (err, question) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const missingFields = checkMissingFields({ student_answer });
    const isMissing = missingFields.length > 0;

    let isCorrect = 0;
    if (!isMissing && student_answer === question.standard_answer) {
      isCorrect = 1;
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.serialize(() => {
      const answerStmt = db.prepare(`
        INSERT INTO answer_records (
          question_id, student_answer, is_correct, answer_source,
          remark, is_missing_fields, missing_fields, submit_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const answerInfo = answerStmt.run([
        question_id, student_answer, isCorrect, answer_source,
        remark, isMissing ? 1 : 0, isMissing ? JSON.stringify(missingFields) : null, now
      ]);
      answerStmt.finalize();

      const historyStmt = db.prepare(`
        INSERT INTO practice_history (
          question_id, answer_id, student_answer, is_correct, operation_type,
          operation_time, after_data, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      historyStmt.run([
        question_id, answerInfo.lastID, student_answer, isCorrect,
        answer_source === 'makeup' ? 'makeup' : 'submit',
        now,
        JSON.stringify({ student_answer, is_correct: isCorrect, answer_source }),
        remark
      ]);
      historyStmt.finalize();

      if (isMissing) {
        const anomalyStmt = db.prepare(`
          INSERT INTO anomalies (
            type, status, answer_id, question_id, description, detail
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        anomalyStmt.run([
          'other', 'pending', answerInfo.lastID, question_id,
          '缺字段待补录',
          `缺失字段: ${missingFields.join(', ')}，需要补录完整信息`
        ]);
        anomalyStmt.finalize();
      }

      if (!isCorrect && !isMissing) {
        const errorType = question.question_type;
        const errorCategory = getErrorCategory(errorType, student_answer, question.standard_answer);
        const answerComparison = `学生答${student_answer}，标准答案${question.standard_answer}`;

        db.get(`SELECT * FROM error_records WHERE question_id = ? AND is_resolved = 0`, [question_id], (err, existingError) => {
          if (existingError) {
            db.run(`
              UPDATE error_records
              SET answer_id = ?, student_answer = ?, answer_comparison = ?,
                  practice_count = practice_count + 1, last_practice_time = ?,
                  updated_at = datetime('now', 'localtime'), remark = ?
              WHERE id = ?
            `, [
              answerInfo.lastID, student_answer, answerComparison, now, remark, existingError.id
            ]);

            db.get(`SELECT * FROM anomalies WHERE question_id = ? AND type = 'duplicate_unmerged' AND status = 'pending'`, [question_id], (err, existingAnomaly) => {
              if (!existingAnomaly) {
                const anomalyStmt = db.prepare(`
                  INSERT INTO anomalies (
                    type, status, answer_id, question_id, related_answer_ids,
                    description, detail
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                anomalyStmt.run([
                  'duplicate_unmerged', 'pending', existingError.answer_id, question_id,
                  JSON.stringify([existingError.answer_id, answerInfo.lastID]),
                  '重复练习未合并',
                  `同一题目多次答错，错题记录待合并，answer_ids: [${existingError.answer_id}, ${answerInfo.lastID}]`
                ]);
                anomalyStmt.finalize();
              } else {
                const relatedIds = JSON.parse(existingAnomaly.related_answer_ids || '[]');
                if (!relatedIds.includes(answerInfo.lastID)) {
                  relatedIds.push(answerInfo.lastID);
                  db.run(`
                    UPDATE anomalies
                    SET related_answer_ids = ?, updated_at = datetime('now', 'localtime')
                    WHERE id = ?
                  `, [JSON.stringify(relatedIds), existingAnomaly.id]);
                }
              }
            });
          } else {
            const errorStmt = db.prepare(`
              INSERT INTO error_records (
                answer_id, question_id, error_type, error_category,
                student_answer, standard_answer, answer_comparison,
                practice_count, last_practice_time, remark
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            errorStmt.run([
              answerInfo.lastID, question_id, errorType, errorCategory,
              student_answer, question.standard_answer, answerComparison,
              1, now, remark
            ]);
            errorStmt.finalize();
          }
        });

        if (isEnharmonic(student_answer, question.standard_answer)) {
          const anomalyStmt = db.prepare(`
            INSERT INTO anomalies (
              type, status, answer_id, question_id, description, detail
            ) VALUES (?, ?, ?, ?, ?, ?)
          `);
          anomalyStmt.run([
            'enharmonic_judge', 'pending', answerInfo.lastID, question_id,
            '等音误判待确认',
            `学生答案"${student_answer}"与标准答案"${question.standard_answer}"为等音关系，是否判定为错误待确认`
          ]);
          anomalyStmt.finalize();
        }
      }

      res.status(201).json({
        id: answerInfo.lastID,
        is_correct: isCorrect,
        is_missing_fields: isMissing,
        missing_fields: missingFields,
        message: isCorrect ? '答案正确' : (isMissing ? '记录缺字段，已进入异常清单' : '答案错误，已加入错题本')
      });
    });
  });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { student_answer, remark, answer_source } = req.body;
  const operator = req.body.operator || 'teacher';
  const correctionReason = req.body.correction_reason || '修正答题记录';

  db.get(`SELECT * FROM answer_records WHERE id = ?`, [id], (err, oldRecord) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldRecord) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }

    db.get(`SELECT * FROM questions WHERE id = ?`, [oldRecord.question_id], (err, question) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const beforeData = JSON.stringify(oldRecord);
      const updates = [];
      const params = [];
      const corrections = [];

      if (student_answer !== undefined && student_answer !== oldRecord.student_answer) {
        updates.push('student_answer = ?');
        params.push(student_answer);
        corrections.push({
          field: 'student_answer',
          old_value: oldRecord.student_answer,
          new_value: student_answer
        });

        const newIsCorrect = student_answer === question.standard_answer ? 1 : 0;
        updates.push('is_correct = ?');
        params.push(newIsCorrect);
        corrections.push({
          field: 'is_correct',
          old_value: String(oldRecord.is_correct),
          new_value: String(newIsCorrect)
        });
      }

      if (remark !== undefined && remark !== oldRecord.remark) {
        updates.push('remark = ?');
        params.push(remark);
        corrections.push({
          field: 'remark',
          old_value: oldRecord.remark,
          new_value: remark
        });
      }

      if (answer_source !== undefined && answer_source !== oldRecord.answer_source) {
        updates.push('answer_source = ?');
        params.push(answer_source);
        corrections.push({
          field: 'answer_source',
          old_value: oldRecord.answer_source,
          new_value: answer_source
        });
      }

      if (oldRecord.is_missing_fields && student_answer) {
        updates.push('is_missing_fields = 0');
        updates.push('missing_fields = NULL');
        corrections.push({
          field: 'is_missing_fields',
          old_value: '1',
          new_value: '0',
          reason: '补录缺失字段'
        });
      }

      if (updates.length === 0) {
        res.json({ message: '没有需要更新的内容' });
        return;
      }

      params.push(id);
      const sql = `UPDATE answer_records SET ${updates.join(', ')} WHERE id = ?`;

      db.run(sql, params, function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const correctionStmt = db.prepare(`
          INSERT INTO correction_history (target_table, target_id, field_name, old_value, new_value, reason, operator, corrected_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `);

        corrections.forEach(c => {
          correctionStmt.run([
            'answer_records', id, c.field, c.old_value, c.new_value,
            c.reason || correctionReason, operator
          ]);
        });
        correctionStmt.finalize();

        const afterData = JSON.stringify({ ...oldRecord, student_answer, remark, answer_source });

        db.run(`
          INSERT INTO practice_history (
            question_id, answer_id, student_answer, is_correct, operation_type,
            operation_time, before_data, after_data, remark
          ) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?)
        `, [
          oldRecord.question_id, id, student_answer || oldRecord.student_answer,
          student_answer === question.standard_answer ? 1 : oldRecord.is_correct,
          'update', beforeData, afterData, correctionReason
        ]);

        if (student_answer !== undefined) {
          const errorCategory = getErrorCategory(question.question_type, student_answer, question.standard_answer);
          const answerComparison = `学生答${student_answer}，标准答案${question.standard_answer}`;
          const newIsCorrect = student_answer === question.standard_answer ? 1 : 0;

          if (newIsCorrect) {
            db.run(`
              UPDATE error_records
              SET is_resolved = 1, resolved_at = datetime('now', 'localtime'),
                  resolved_note = '学生已掌握，答案正确',
                  student_answer = ?, answer_comparison = ?,
                  updated_at = datetime('now', 'localtime')
              WHERE answer_id = ?
            `, [student_answer, answerComparison, id]);
          } else {
            db.run(`
              UPDATE error_records
              SET student_answer = ?, answer_comparison = ?, error_category = ?,
                  updated_at = datetime('now', 'localtime')
              WHERE answer_id = ?
            `, [student_answer, answerComparison, errorCategory, id]);
          }
        }

        res.json({
          message: '更新成功',
          changes: this.changes,
          corrections: corrections.length
        });
      });
    });
  });
});

router.post('/:id/withdraw', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { reason, operator = 'teacher' } = req.body;

  db.get(`SELECT * FROM answer_records WHERE id = ?`, [id], (err, record) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!record) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }

    const beforeData = JSON.stringify(record);

    db.run(`
      UPDATE answer_records
      SET answer_source = 'withdrawn', remark = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [reason || '撤回记录', id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.run(`
        INSERT INTO correction_history (
          target_table, target_id, field_name, old_value, new_value, reason, operator, corrected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `, ['answer_records', id, 'answer_source', record.answer_source, 'withdrawn', reason || '撤回答题记录', operator]);

      db.run(`
        UPDATE error_records
        SET is_resolved = 1, resolved_at = datetime('now', 'localtime'),
            resolved_note = '答题记录已撤回',
            updated_at = datetime('now', 'localtime')
        WHERE answer_id = ?
      `, [id]);

      const afterData = JSON.stringify({ ...record, answer_source: 'withdrawn', remark: reason || '撤回记录' });

      db.run(`
        INSERT INTO practice_history (
          question_id, answer_id, student_answer, is_correct, operation_type,
          operation_time, before_data, after_data, remark
        ) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?)
      `, [record.question_id, id, record.student_answer, record.is_correct, 'withdraw', beforeData, afterData, reason || '撤回记录']);

      res.json({ message: '撤回成功', changes: this.changes });
    });
  });
});

module.exports = router;
