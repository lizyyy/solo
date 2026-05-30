module.exports = function(db, callback) {
  const now = new Date();
  const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

  const questions = [
    ['interval', '音程听辨-大三度', 'interval_major3.mp3', 'major_third', '请听辨音程类型', 'medium', '音程,大三度'],
    ['interval', '音程听辨-纯五度', 'interval_perfect5.mp3', 'perfect_fifth', '请听辨音程类型', 'medium', '音程,纯五度'],
    ['interval', '音程听辨-小六度(等音)', 'interval_minor6.mp3', 'minor_sixth', '请听辨音程类型，注意等音', 'hard', '音程,小六度,等音'],
    ['chord', '和弦听辨-大三和弦', 'chord_major.mp3', 'major_triad', '请听辨和弦类型', 'medium', '和弦,大三和弦'],
    ['chord', '和弦听辨-小三和弦', 'chord_minor.mp3', 'minor_triad', '请听辨和弦类型', 'medium', '和弦,小三和弦'],
    ['chord', '和弦听辨-属七和弦', 'chord_dominant7.mp3', 'dominant_seventh', '请听辨和弦类型', 'hard', '和弦,属七和弦'],
    ['rhythm', '节奏听辨-附点八分', 'rhythm_dotted8th.mp3', 'dotted_eighth_sixteenth', '请听辨节奏型', 'medium', '节奏,附点'],
    ['rhythm', '节奏听辨-切分节奏', 'rhythm_synopation.mp3', 'synopation', '请听辨节奏型', 'medium', '节奏,切分'],
    ['interval', '音程听辨-增四度(等音)', 'interval_aug4.mp3', 'augmented_fourth', '增四度等于减五度，注意等音判断', 'hard', '音程,增四度,等音'],
    ['chord', '和弦听辨-减七和弦', 'chord_diminished7.mp3', 'diminished_seventh', '减七和弦听辨', 'hard', '和弦,减七和弦']
  ];

  function insertQuestions(cb) {
    const questionIds = [];
    let index = 0;

    function insertNext() {
      if (index >= questions.length) {
        cb(null, questionIds);
        return;
      }

      const q = questions[index];
      db.run(`
        INSERT INTO questions (question_type, title, audio_file, standard_answer, description, difficulty, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, q, function(err) {
        if (err) {
          cb(err);
          return;
        }
        questionIds.push(this.lastID);
        index++;
        insertNext();
      });
    }

    insertNext();
  }

  insertQuestions((err, questionIds) => {
    if (err) {
      callback(err);
      return;
    }

    const answers = [
      [questionIds[0], 'major_third', 1, hoursAgo(48), 'normal', null, null, 0, null],
      [questionIds[0], 'minor_third', 0, hoursAgo(46), 'normal', null, '首次做错，学生混淆大小三度', 0, null],
      [questionIds[1], 'perfect_fifth', 1, hoursAgo(44), 'normal', null, null, 0, null],
      [questionIds[2], 'major_sixth', 0, hoursAgo(42), 'normal', null, null, 0, null],
      [questionIds[2], null, 0, hoursAgo(40), 'normal', null, null, 1, 'student_answer'],
      [questionIds[3], 'minor_triad', 0, hoursAgo(38), 'normal', null, null, 0, null],
      [questionIds[3], 'major_triad', 1, hoursAgo(36), 'makeup', null, '课后补做，已掌握', 0, null],
      [questionIds[4], 'major_triad', 0, hoursAgo(34), 'normal', null, null, 0, null],
      [questionIds[5], 'major_seventh', 0, hoursAgo(32), 'normal', null, null, 0, null],
      [questionIds[6], 'eighth_sixteenth', 0, hoursAgo(30), 'normal', null, null, 0, null],
      [questionIds[7], 'synopation', 1, hoursAgo(28), 'normal', null, null, 0, null],
      [questionIds[1], 'perfect_fourth', 0, hoursAgo(26), 'withdrawn', null, '撤回，学生实际答对了', 0, null],
      [questionIds[1], 'perfect_fifth', 1, hoursAgo(25), 'normal', null, '修正后记录', 0, null],
      [questionIds[3], 'minor_triad', 0, hoursAgo(24), 'duplicate', null, '重复提交', 0, null],
      [questionIds[8], 'diminished_fifth', 0, hoursAgo(22), 'normal', null, '等音误判，增四度=减五度', 0, null],
      [questionIds[9], 'minor_seventh', 0, hoursAgo(20), 'normal', null, null, 0, null],
      [questionIds[0], 'major_third', 1, hoursAgo(18), 'normal', null, null, 0, null],
      [questionIds[0], 'minor_third', 0, hoursAgo(16), 'normal', null, null, 0, null],
      [questionIds[2], 'minor_sixth', 1, hoursAgo(14), 'makeup', null, '晚补记录，学生放学后补交', 0, null],
      [questionIds[6], 'dotted_eighth_sixteenth', 1, hoursAgo(12), 'normal', null, '备注已修改：节奏掌握良好', 0, null]
    ];

    function insertAnswers(cb) {
      const answerIds = [];
      let index = 0;

      function insertNext() {
        if (index >= answers.length) {
          cb(null, answerIds);
          return;
        }

        const a = answers[index];
        db.run(`
          INSERT INTO answer_records (
            question_id, student_answer, is_correct, submit_time, answer_source,
            original_answer_id, remark, is_missing_fields, missing_fields
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, a, function(err) {
          if (err) {
            cb(err);
            return;
          }
          answerIds.push(this.lastID);
          index++;
          insertNext();
        });
      }

      insertNext();
    }

    insertAnswers((err, answerIds) => {
      if (err) {
        callback(err);
        return;
      }

      const errors = [
        [answerIds[1], questionIds[0], 'interval', '大小三度混淆', 'minor_third', 'major_third', '学生答小三度，标准答案大三度', 2, hoursAgo(16), '已练习2次，仍有混淆'],
        [answerIds[3], questionIds[2], 'interval', '音程度数判断错误', 'major_sixth', 'minor_sixth', '学生答大六度，标准答案小六度', 1, hoursAgo(42), null],
        [answerIds[4], questionIds[2], 'interval', '缺字段-未填写答案', null, 'minor_sixth', '学生答案缺失', 1, hoursAgo(40), '缺字段记录，待补录'],
        [answerIds[5], questionIds[3], 'chord', '大小三和弦混淆', 'minor_triad', 'major_triad', '学生答小三和弦，标准答案大三和弦', 2, hoursAgo(24), '重复练习，需关注'],
        [answerIds[7], questionIds[4], 'chord', '大小三和弦混淆', 'major_triad', 'minor_triad', '学生答大三和弦，标准答案小三和弦', 1, hoursAgo(34), null],
        [answerIds[8], questionIds[5], 'chord', '七和弦类型判断错误', 'major_seventh', 'dominant_seventh', '学生答大七和弦，标准答案属七和弦', 1, hoursAgo(32), null],
        [answerIds[9], questionIds[6], 'rhythm', '附点节奏听辨错误', 'eighth_sixteenth', 'dotted_eighth_sixteenth', '学生答八十六节奏，标准答案附点八十六', 1, hoursAgo(30), '已补录正确答案'],
        [answerIds[10], questionIds[7], 'rhythm', '切分节奏听辨正确', 'synopation', 'synopation', '正确答案', 1, hoursAgo(28), null],
        [answerIds[14], questionIds[8], 'interval', '等音判断-增四度减五度', 'diminished_fifth', 'augmented_fourth', '学生答减五度，标准答案增四度，存在等音关系', 1, hoursAgo(22), '待确认是否为有效错误'],
        [answerIds[15], questionIds[9], 'chord', '减七和弦判断错误', 'minor_seventh', 'diminished_seventh', '学生答小七和弦，标准答案减七和弦', 1, hoursAgo(20), null],
        [answerIds[17], questionIds[0], 'interval', '大小三度混淆', 'minor_third', 'major_third', '重复错题', 2, hoursAgo(16), '多次练习仍错']
      ];

      function insertErrors(cb) {
        let index = 0;

        function insertNext() {
          if (index >= errors.length) {
            cb(null);
            return;
          }

          db.run(`
            INSERT INTO error_records (
              answer_id, question_id, error_type, error_category,
              student_answer, standard_answer, answer_comparison,
              practice_count, last_practice_time, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, errors[index], function(err) {
            if (err) {
              cb(err);
              return;
            }
            index++;
            insertNext();
          });
        }

        insertNext();
      }

      insertErrors((err) => {
        if (err) {
          callback(err);
          return;
        }

        const anomalies = [
          ['enharmonic_judge', 'pending', answerIds[14], questionIds[8], JSON.stringify([answerIds[14]]),
            '等音误判待确认', '学生答案"减五度"与标准答案"增四度"为等音关系，是否判定为错误待确认'],
          ['type_misclassify', 'pending', answerIds[5], questionIds[3], JSON.stringify([answerIds[5], answerIds[7]]),
            '题型错归待确认', '题目类型为和弦，但错误归类可能需要调整'],
          ['duplicate_unmerged', 'pending', answerIds[5], questionIds[3], JSON.stringify([answerIds[5], answerIds[13]]),
            '重复练习未合并', '同一题目多次答错，错题记录未合并，answer_ids: [5, 13]'],
          ['other', 'pending', answerIds[4], questionIds[2], JSON.stringify([answerIds[4]]),
            '缺字段待补录', 'student_answer字段缺失，需要补录学生答案'],
          ['enharmonic_judge', 'confirmed', answerIds[3], questionIds[2], JSON.stringify([answerIds[3]]),
            '等音误判已确认', '大六度与小六度不是等音关系，判定为有效错误，已确认'],
          ['duplicate_unmerged', 'resolved', answerIds[1], questionIds[0], JSON.stringify([answerIds[1], answerIds[17]]),
            '重复练习已合并处理', '已合并两条大三度错题记录，累计练习2次']
        ];

        function insertAnomalies(cb) {
          let index = 0;

          function insertNext() {
            if (index >= anomalies.length) {
              cb(null);
              return;
            }

            db.run(`
              INSERT INTO anomalies (
                type, status, answer_id, question_id, related_answer_ids,
                description, detail
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, anomalies[index], function(err) {
              if (err) {
                cb(err);
                return;
              }
              index++;
              insertNext();
            });
          }

          insertNext();
        }

        insertAnomalies((err) => {
          if (err) {
            callback(err);
            return;
          }

          const history = [
            [questionIds[0], answerIds[1], 'minor_third', 0, 'submit', hoursAgo(46), null, JSON.stringify({student_answer: 'minor_third', is_correct: 0}), '首次答题错误'],
            [questionIds[3], answerIds[6], 'major_triad', 1, 'makeup', hoursAgo(36), JSON.stringify({status: 'incomplete'}), JSON.stringify({student_answer: 'major_triad', is_correct: 1}), '课后补录答题'],
            [questionIds[1], answerIds[11], 'perfect_fourth', 0, 'withdraw', hoursAgo(25), JSON.stringify({student_answer: 'perfect_fourth', is_correct: 0}), JSON.stringify({withdrawn: true}), '撤回错误记录，实际为答对'],
            [questionIds[3], answerIds[13], 'minor_triad', 0, 'duplicate', hoursAgo(24), JSON.stringify({answer_id: 6}), JSON.stringify({answer_id: 13}), '重复提交检测'],
            [questionIds[2], answerIds[18], 'minor_sixth', 1, 'makeup', hoursAgo(14), JSON.stringify({is_missing_fields: 1}), JSON.stringify({student_answer: 'minor_sixth', is_correct: 1}), '晚补记录，补交答案'],
            [questionIds[0], answerIds[17], 'minor_third', 0, 'retry', hoursAgo(16), JSON.stringify({practice_count: 1}), JSON.stringify({practice_count: 2}), '重复练习，再次做错'],
            [questionIds[6], answerIds[9], 'eighth_sixteenth', 0, 'update', hoursAgo(12), JSON.stringify({remark: null}), JSON.stringify({remark: '已修改：节奏掌握良好'}), '备注修改'],
            [questionIds[2], answerIds[4], null, 0, 'submit', hoursAgo(40), null, JSON.stringify({is_missing_fields: 1, missing_fields: 'student_answer'}), '缺字段提交']
          ];

          function insertHistory(cb) {
            let index = 0;

            function insertNext() {
              if (index >= history.length) {
                cb(null);
                return;
              }

              db.run(`
                INSERT INTO practice_history (
                  question_id, answer_id, student_answer, is_correct, operation_type,
                  operation_time, before_data, after_data, remark
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, history[index], function(err) {
                if (err) {
                  cb(err);
                  return;
                }
                index++;
                insertNext();
              });
            }

            insertNext();
          }

          insertHistory((err) => {
            if (err) {
              callback(err);
              return;
            }

            const corrections = [
              ['answer_records', answerIds[6], 'remark', null, '课后补做，已掌握', '添加备注说明补做情况', 'teacher', hoursAgo(36), null],
              ['answer_records', answerIds[11], 'answer_source', 'normal', 'withdrawn', '学生实际答对，撤回错误记录', 'teacher', hoursAgo(25), '月底复盘可查'],
              ['answer_records', answerIds[1], 'remark', null, '首次做错，学生混淆大小三度', '补充错误分析', 'teacher', hoursAgo(45), null],
              ['error_records', 1, 'practice_count', '1', '2', '合并重复练习记录，更新练习次数', 'teacher', hoursAgo(16), '合并了answer_id=1和answer_id=17的记录'],
              ['answer_records', answerIds[19], 'remark', null, '备注已修改：节奏掌握良好', '更新备注', 'teacher', hoursAgo(12), '备注修改记录'],
              ['anomalies', 5, 'status', 'pending', 'confirmed', '确认大六度与小六度不是等音关系，为有效错误', 'teacher', hoursAgo(35), '人工审核确认'],
              ['anomalies', 6, 'status', 'pending', 'resolved', '已合并重复练习记录', 'teacher', hoursAgo(15), '异常处理完成']
            ];

            function insertCorrections(cb) {
              let index = 0;

              function insertNext() {
                if (index >= corrections.length) {
                  cb(null);
                  return;
                }

                db.run(`
                  INSERT INTO correction_history (
                    target_table, target_id, field_name, old_value, new_value, reason, operator, corrected_at, remark
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, corrections[index], function(err) {
                  if (err) {
                    cb(err);
                    return;
                  }
                  index++;
                  insertNext();
                });
              }

              insertNext();
            }

            insertCorrections((err) => {
              if (err) {
                callback(err);
                return;
              }

              const fs = require('fs');
              const path = require('path');
              const audioDir = path.join(__dirname, '..', 'data', 'audio');

              const audioFiles = [
                'interval_major3.mp3', 'interval_perfect5.mp3', 'interval_minor6.mp3',
                'chord_major.mp3', 'chord_minor.mp3', 'chord_dominant7.mp3',
                'rhythm_dotted8th.mp3', 'rhythm_synopation.mp3', 'interval_aug4.mp3',
                'chord_diminished7.mp3'
              ];

              audioFiles.forEach(f => {
                const filePath = path.join(audioDir, f);
                if (!fs.existsSync(filePath)) {
                  fs.closeSync(fs.openSync(filePath, 'w'));
                }
              });

              console.log('所有样例数据插入完成');
              callback(null);
            });
          });
        });
      });
    });
  });
};
