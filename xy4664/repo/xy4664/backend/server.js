const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = require('./database');
const rulesEngine = require('./rulesEngine');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.post('/api/upload/candidates', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择文件' });
  }

  const candidates = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      candidates.push(row);
    })
    .on('end', () => {
      let imported = 0;
      let errors = [];

      candidates.forEach((row, index) => {
        const candidateId = row.candidate_id || row.id || uuidv4();
        const name = row.name || row.候选人姓名 || row.姓名;
        const email = row.email || row.邮箱;
        const phone = row.phone || row.电话;
        const position = row.position || row.职位;

        if (!name) {
          errors.push(`第 ${index + 1} 行缺少姓名`);
          return;
        }

        db.run(`
          INSERT OR REPLACE INTO candidates (candidate_id, name, email, phone, position, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [candidateId, name, email, phone, position], function(err) {
          if (err) {
            errors.push(`导入候选人 "${name}" 失败: ${err.message}`);
          } else {
            imported++;
          }
        });
      });

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        imported: imported,
        total: candidates.length,
        errors: errors
      });
    })
    .on('error', (err) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: '解析CSV文件失败: ' + err.message });
    });
});

app.post('/api/upload/interviews', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择文件' });
  }

  const filePath = req.file.path;
  const interviews = [];

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      fs.unlinkSync(filePath);
      return res.status(500).json({ error: '读取文件失败' });
    }

    const lines = data.trim().split('\n');
    lines.forEach((line, index) => {
      try {
        if (line.trim()) {
          const obj = JSON.parse(line);
          interviews.push(obj);
        }
      } catch (e) {
        console.error(`解析第 ${index + 1} 行失败: ${e.message}`);
      }
    });

    let imported = 0;
    let errors = [];

    interviews.forEach((item) => {
      const candidateId = item.candidate_id || item.candidateId;
      const feedbackId = item.feedback_id || item.feedbackId || uuidv4();
      const roundName = item.round_name || item.roundName;
      const interviewerName = item.interviewer_name || item.interviewerName;
      const interviewDate = item.interview_date || item.interviewDate;
      const overallRating = item.overall_rating || item.overallRating;
      const technicalRating = item.technical_rating || item.technicalRating;
      const softSkillRating = item.soft_skill_rating || item.softSkillRating;
      const feedbackText = item.feedback_text || item.feedbackText;
      const status = item.status;

      if (!candidateId) {
        errors.push(`缺少候选人ID，跳过该条记录`);
        return;
      }

      db.get(`SELECT MAX(version) as max_version FROM interview_feedback WHERE candidate_id = ? AND feedback_id = ?`, 
        [candidateId, feedbackId], (err, row) => {
          const version = (row?.max_version || 0) + 1;
          const versionHash = uuidv4();

          db.run(`
            INSERT INTO interview_feedback 
            (candidate_id, feedback_id, round_name, interviewer_name, interview_date, 
             overall_rating, technical_rating, soft_skill_rating, feedback_text, status, version, version_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [candidateId, feedbackId, roundName, interviewerName, interviewDate,
              overallRating, technicalRating, softSkillRating, feedbackText, status, version, versionHash], 
            function(err) {
              if (err) {
                errors.push(`导入面试反馈失败: ${err.message}`);
              } else {
                imported++;
              }
            });
        });
    });

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      imported: imported,
      total: interviews.length,
      errors: errors
    });
  });
});

app.post('/api/upload/audit-logs', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择文件' });
  }

  const filePath = req.file.path;
  const logs = [];

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      fs.unlinkSync(filePath);
      return res.status(500).json({ error: '读取文件失败' });
    }

    const lines = data.trim().split('\n');
    lines.forEach((line, index) => {
      try {
        if (line.trim()) {
          const obj = JSON.parse(line);
          logs.push(obj);
        }
      } catch (e) {
        console.error(`解析第 ${index + 1} 行失败: ${e.message}`);
      }
    });

    let imported = 0;
    let errors = [];

    logs.forEach((item) => {
      const candidateId = item.candidate_id || item.candidateId;
      const action = item.action;
      const actionType = item.action_type || item.actionType;
      const fieldName = item.field_name || item.fieldName;
      const oldValue = item.old_value || item.oldValue;
      const newValue = item.new_value || item.newValue;
      const operator = item.operator;
      const comment = item.comment;

      if (!candidateId || !action) {
        errors.push(`缺少候选人ID或操作类型，跳过该条记录`);
        return;
      }

      db.run(`
        INSERT INTO audit_logs 
        (candidate_id, action, action_type, field_name, old_value, new_value, operator, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [candidateId, action, actionType, fieldName, oldValue, newValue, operator, comment],
        function(err) {
          if (err) {
            errors.push(`导入审计日志失败: ${err.message}`);
          } else {
            imported++;
          }
        });
    });

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      imported: imported,
      total: logs.length,
      errors: errors
    });
  });
});

app.post('/api/upload/offer-approvals', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择文件' });
  }

  const filePath = req.file.path;
  const approvals = [];

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      fs.unlinkSync(filePath);
      return res.status(500).json({ error: '读取文件失败' });
    }

    const lines = data.trim().split('\n');
    lines.forEach((line, index) => {
      try {
        if (line.trim()) {
          const obj = JSON.parse(line);
          approvals.push(obj);
        }
      } catch (e) {
        console.error(`解析第 ${index + 1} 行失败: ${e.message}`);
      }
    });

    let imported = 0;
    let errors = [];

    approvals.forEach((item) => {
      const candidateId = item.candidate_id || item.candidateId;
      const approvalId = item.approval_id || item.approvalId || uuidv4();
      const approver = item.approver;
      const approvalDate = item.approval_date || item.approvalDate;
      const approvalStatus = item.approval_status || item.approvalStatus;
      const comment = item.comment;

      if (!candidateId) {
        errors.push(`缺少候选人ID，跳过该条记录`);
        return;
      }

      db.run(`
        INSERT INTO offer_approvals 
        (candidate_id, approval_id, approver, approval_date, approval_status, comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [candidateId, approvalId, approver, approvalDate, approvalStatus, comment],
        function(err) {
          if (err) {
            errors.push(`导入Offer审批失败: ${err.message}`);
          } else {
            imported++;
          }
        });
    });

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      imported: imported,
      total: approvals.length,
      errors: errors
    });
  });
});

app.get('/api/candidates', (req, res) => {
  db.all(`SELECT * FROM candidates ORDER BY created_at DESC`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/candidates/:id', (req, res) => {
  const candidateId = req.params.id;
  
  db.get(`SELECT * FROM candidates WHERE candidate_id = ?`, [candidateId], (err, candidate) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!candidate) {
      return res.status(404).json({ error: '候选人不存在' });
    }
    
    db.all(`SELECT * FROM interview_feedback WHERE candidate_id = ? ORDER BY version DESC, created_at DESC`, [candidateId], (err, feedbacks) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.all(`SELECT * FROM audit_logs WHERE candidate_id = ? ORDER BY created_at DESC`, [candidateId], (err, audits) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        db.all(`SELECT * FROM offer_approvals WHERE candidate_id = ? ORDER BY created_at DESC`, [candidateId], (err, approvals) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          db.all(`SELECT * FROM report_snapshots WHERE candidate_id = ? ORDER BY created_at DESC`, [candidateId], (err, reports) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            db.all(`SELECT * FROM review_comments WHERE candidate_id = ? ORDER BY created_at DESC`, [candidateId], (err, comments) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              res.json({
                candidate,
                feedbacks,
                audits,
                approvals,
                reports,
                comments
              });
            });
          });
        });
      });
    });
  });
});

app.get('/api/issues', (req, res) => {
  rulesEngine.runAllRules((err, issues) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.all(`SELECT * FROM review_comments ORDER BY created_at DESC`, (err, comments) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const issuesWithComments = issues.map(issue => {
        const issueComments = comments.filter(c => c.issue_id === issue.id);
        return {
          ...issue,
          comments: issueComments
        };
      });
      
      res.json(issuesWithComments);
    });
  });
});

app.post('/api/issues/:issueId/comments', (req, res) => {
  const issueId = req.params.issueId;
  const { candidateId, comment, reviewer } = req.body;
  
  if (!comment || !candidateId) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  db.run(`
    INSERT INTO review_comments (candidate_id, issue_id, comment, reviewer)
    VALUES (?, ?, ?, ?)
  `, [candidateId, issueId, comment, reviewer || '匿名'], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.get(`SELECT * FROM review_comments WHERE id = ?`, [this.lastID], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(row);
    });
  });
});

app.get('/api/export/markdown', (req, res) => {
  db.all(`SELECT * FROM candidates ORDER BY created_at DESC`, (err, candidates) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    rulesEngine.runAllRules((err, issues) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.all(`SELECT * FROM review_comments ORDER BY created_at DESC`, (err, comments) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        let markdown = '# 面试反馈一致性审计报告\n\n';
        markdown += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
        markdown += `---\n\n`;
        
        markdown += '## 审计概览\n\n';
        const highSeverity = issues.filter(i => i.severity === 'high').length;
        const mediumSeverity = issues.filter(i => i.severity === 'medium').length;
        const totalIssues = issues.length;
        
        markdown += `- 候选人总数: ${candidates.length}\n`;
        markdown += `- 发现问题总数: ${totalIssues}\n`;
        markdown += `  - 高严重级别: ${highSeverity}\n`;
        markdown += `  - 中严重级别: ${mediumSeverity}\n\n`;
        
        if (totalIssues > 0) {
          markdown += '## 问题详情\n\n';
          
          const groupedByCandidate = {};
          issues.forEach(issue => {
            if (!groupedByCandidate[issue.candidateId]) {
              groupedByCandidate[issue.candidateId] = [];
            }
            groupedByCandidate[issue.candidateId].push(issue);
          });
          
          Object.keys(groupedByCandidate).forEach(candidateId => {
            const candidate = candidates.find(c => c.candidate_id === candidateId);
            const candidateIssues = groupedByCandidate[candidateId];
            
            markdown += `### ${candidate?.name || candidateId}\n\n`;
            
            candidateIssues.forEach(issue => {
              const severityIcon = issue.severity === 'high' ? '🔴' : '🟡';
              markdown += `${severityIcon} **${issue.type.replace(/_/g, ' ')}**\n\n`;
              markdown += `描述: ${issue.description}\n\n`;
              
              const issueComments = comments.filter(c => c.issue_id === issue.id);
              if (issueComments.length > 0) {
                markdown += `复核备注:\n`;
                issueComments.forEach(c => {
                  markdown += `- [${c.reviewer || '匿名'}] ${c.comment} (${c.created_at})\n`;
                });
                markdown += '\n';
              }
            });
            
            markdown += '---\n\n';
          });
        } else {
          markdown += '## 审计结果\n\n';
          markdown += '✅ 未发现一致性问题。\n\n';
        }
        
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=audit-report-${Date.now()}.md`);
        res.send(markdown);
      });
    });
  });
});

app.get('/api/export/json', (req, res) => {
  const exportData = {
    exportTime: new Date().toISOString(),
    version: '1.0.0'
  };
  
  db.all(`SELECT * FROM candidates ORDER BY created_at DESC`, (err, candidates) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    exportData.candidates = candidates;
    
    db.all(`SELECT * FROM interview_feedback ORDER BY created_at DESC`, (err, feedbacks) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      exportData.interviewFeedbacks = feedbacks;
      
      db.all(`SELECT * FROM audit_logs ORDER BY created_at DESC`, (err, audits) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        exportData.auditLogs = audits;
        
        db.all(`SELECT * FROM offer_approvals ORDER BY created_at DESC`, (err, approvals) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          exportData.offerApprovals = approvals;
          
          db.all(`SELECT * FROM report_snapshots ORDER BY created_at DESC`, (err, reports) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            exportData.reportSnapshots = reports;
            
            db.all(`SELECT * FROM review_comments ORDER BY created_at DESC`, (err, comments) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              exportData.reviewComments = comments;
              
              rulesEngine.runAllRules((err, issues) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                exportData.issues = issues;
                
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename=audit-package-${Date.now()}.json`);
                res.send(JSON.stringify(exportData, null, 2));
              });
            });
          });
        });
      });
    });
  });
});

app.delete('/api/data', (req, res) => {
  db.serialize(() => {
    db.run(`DELETE FROM review_comments`);
    db.run(`DELETE FROM report_snapshots`);
    db.run(`DELETE FROM offer_approvals`);
    db.run(`DELETE FROM audit_logs`);
    db.run(`DELETE FROM interview_feedback`);
    db.run(`DELETE FROM candidates`, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: '所有数据已清除' });
    });
  });
});

app.get('/api/stats', (req, res) => {
  const stats = {};
  
  db.get(`SELECT COUNT(*) as count FROM candidates`, (err, row) => {
    stats.candidates = row?.count || 0;
    
    db.get(`SELECT COUNT(*) as count FROM interview_feedback`, (err, row) => {
      stats.interviews = row?.count || 0;
      
      db.get(`SELECT COUNT(*) as count FROM audit_logs`, (err, row) => {
        stats.auditLogs = row?.count || 0;
        
        db.get(`SELECT COUNT(*) as count FROM offer_approvals`, (err, row) => {
          stats.offerApprovals = row?.count || 0;
          
          res.json(stats);
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`面试反馈一致性审计台已启动`);
  console.log(`访问地址: http://localhost:${PORT}`);
});
