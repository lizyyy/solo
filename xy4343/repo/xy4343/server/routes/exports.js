const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

const exportsDir = path.join(__dirname, '../../data/exports');

// 生成Markdown复盘报告
router.get('/markdown/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  
  // 获取会话详情
  db.get(`
    SELECT s.*, l.name as level_name, l.description as level_description
    FROM sessions s 
    LEFT JOIN levels l ON s.level_id = l.id 
    WHERE s.id = ?
  `, [sessionId], (err, session) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    
    // 获取关卡详情
    db.get('SELECT * FROM levels WHERE id = ?', [session.level_id], (err, level) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const checkpoints = JSON.parse(level.checkpoints);
      const visitedCheckpoints = JSON.parse(session.checkpoints_visited);
      const missedCheckpoints = JSON.parse(session.checkpoints_missed);
      
      // 生成Markdown内容
      const markdown = generateMarkdownReport(session, level, checkpoints, visitedCheckpoints, missedCheckpoints);
      
      // 保存到文件
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `review_${sessionId}_${timestamp}.md`;
      const filePath = path.join(exportsDir, filename);
      
      fs.writeFile(filePath, markdown, 'utf8', (err) => {
        if (err) {
          return res.status(500).json({ error: '保存Markdown文件失败: ' + err.message });
        }
        
        res.json({
          success: true,
          filename: filename,
          content: markdown,
          message: 'Markdown复盘报告生成成功'
        });
      });
    });
  });
});

// 生成JSON审计包
router.get('/json/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  
  // 获取会话详情
  db.get(`
    SELECT s.*, l.name as level_name
    FROM sessions s 
    LEFT JOIN levels l ON s.level_id = l.id 
    WHERE s.id = ?
  `, [sessionId], (err, session) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    
    // 获取关卡详情
    db.get('SELECT * FROM levels WHERE id = ?', [session.level_id], (err, level) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // 获取回放数据
      db.get('SELECT * FROM replays WHERE session_id = ?', [sessionId], (err, replay) => {
        // 构建审计包
        const auditPackage = {
          version: '1.0.0',
          generated_at: moment().toISOString(),
          session: {
            id: session.id,
            player_name: session.player_name,
            level_id: session.level_id,
            level_name: session.level_name,
            start_time: session.start_time,
            end_time: session.end_time,
            time_used: session.time_used,
            status: session.status
          },
          score: {
            total: session.total_score,
            obtained: session.score,
            penalties: {
              missed_checkpoints: session.missed_penalty,
              detour: session.detour_penalty,
              overtime: session.over_time_penalty
            }
          },
          checkpoints: {
            total: JSON.parse(level.checkpoints).length,
            visited: JSON.parse(session.checkpoints_visited).length,
            missed: JSON.parse(session.checkpoints_missed).length,
            visited_list: JSON.parse(session.checkpoints_visited),
            missed_list: JSON.parse(session.checkpoints_missed)
          },
          distance: {
            actual: session.distance_traveled,
            optimal: session.optimal_distance,
            efficiency: session.optimal_distance > 0 
              ? Math.round((session.optimal_distance / session.distance_traveled) * 100) 
              : 0
          },
          time: {
            used: session.time_used,
            limit: level.time_limit,
            overtime: Math.max(0, session.time_used - level.time_limit)
          },
          level_info: {
            name: level.name,
            description: level.description,
            time_limit: level.time_limit,
            checkpoints: JSON.parse(level.checkpoints),
            floor_plan: JSON.parse(level.floor_plan)
          },
          replay_data: replay ? JSON.parse(replay.replay_data) : null
        };
        
        // 保存到文件
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const filename = `audit_${sessionId}_${timestamp}.json`;
        const filePath = path.join(exportsDir, filename);
        
        fs.writeJson(filePath, auditPackage, { spaces: 2 }, (err) => {
          if (err) {
            return res.status(500).json({ error: '保存JSON文件失败: ' + err.message });
          }
          
          res.json({
            success: true,
            filename: filename,
            content: auditPackage,
            message: 'JSON审计包生成成功'
          });
        });
      });
    });
  });
});

// 生成Markdown报告的辅助函数
function generateMarkdownReport(session, level, checkpoints, visitedCheckpoints, missedCheckpoints) {
  const missedDetails = checkpoints.filter(cp => missedCheckpoints.includes(cp.id));
  
  let report = `# 巡查复盘报告

## 基本信息

| 项目 | 详情 |
|------|------|
| 巡查员 | ${session.player_name} |
| 关卡 | ${session.level_name} |
| 开始时间 | ${session.start_time} |
| 结束时间 | ${session.end_time || '未完成'} |
| 用时 | ${session.time_used} 秒 (限制: ${level.time_limit} 秒) |

## 评分详情

| 项目 | 分数 |
|------|------|
| 总分 | ${session.total_score} |
| 得分 | **${session.score}** |

### 扣分明细

- **漏检惩罚**: -${session.missed_penalty} 分 (${missedCheckpoints.length} 个检查点未检查)
- **绕路惩罚**: -${session.detour_penalty} 分
- **超时惩罚**: -${session.over_time_penalty} 分

## 检查点情况

### 统计

| 项目 | 数量 |
|------|------|
| 总检查点 | ${checkpoints.length} |
| 已检查 | ${visitedCheckpoints.length} |
| 漏检 | ${missedCheckpoints.length} |

`;

  if (missedDetails.length > 0) {
    report += `### 漏检检查点详情

| 检查点名称 | 类型 | 位置 |
|------------|------|------|
`;
    missedDetails.forEach(cp => {
      report += `| ${cp.name} | ${getCheckpointTypeName(cp.type)} | (${cp.position.x}, ${cp.position.y}) |\n`;
    });
  }

  report += `

## 路线分析

- **实际移动距离**: ${Math.round(session.distance_traveled)} 单位
- **最优路线距离**: ${Math.round(session.optimal_distance)} 单位
- **路线效率**: ${session.optimal_distance > 0 ? Math.round((session.optimal_distance / session.distance_traveled) * 100) : 0}%

## 时间分析

- **实际用时**: ${session.time_used} 秒
- **时间限制**: ${level.time_limit} 秒
- **超时**: ${Math.max(0, session.time_used - level.time_limit)} 秒

## 总结

${getSummary(session)}

---
*报告生成时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}*
`;

  return report;
}

function getCheckpointTypeName(type) {
  const types = {
    'door': '门禁',
    'temperature': '温湿度报警',
    'exhibit': '重点展柜'
  };
  return types[type] || type;
}

function getSummary(session) {
  if (session.score >= 90) {
    return '本次巡查表现优秀！所有检查点均已检查，路线规划合理，用时控制良好。';
  } else if (session.score >= 70) {
    return '本次巡查表现良好。建议注意：如有漏检请加强检查点记忆；如有绕路请优化巡查路线。';
  } else if (session.score >= 50) {
    return '本次巡查需要改进。请重点关注：\n- 确保所有检查点都被检查\n- 优化巡查路线减少绕路\n- 控制巡查时间';
  } else {
    return '本次巡查存在较多问题。建议：\n- 重新熟悉所有检查点位置\n- 规划最优巡查路线\n- 加强时间管理意识';
  }
}

module.exports = router;
