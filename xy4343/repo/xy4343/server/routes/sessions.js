const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs-extra');
const path = require('path');
const uuid = require('uuid');
const moment = require('moment');

const replaysDir = path.join(__dirname, '../../data/replays');

// 创建新的巡查会话
router.post('/', (req, res) => {
  const { level_id, player_name } = req.body;
  
  if (!level_id) {
    return res.status(400).json({ error: '缺少 level_id 参数' });
  }
  
  const sessionId = uuid.v4();
  const stmt = db.prepare(`
    INSERT INTO sessions (id, level_id, player_name, status)
    VALUES (?, ?, ?, 'running')
  `);
  
  stmt.run(sessionId, level_id, player_name || '匿名巡查员', (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      success: true,
      session_id: sessionId,
      message: '巡查会话创建成功'
    });
  });
  stmt.finalize();
});

// 获取会话详情
router.get('/:id', (req, res) => {
  const sessionId = req.params.id;
  db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '会话不存在' });
    }
    
    // 解析JSON数据
    const session = {
      ...row,
      checkpoints_visited: JSON.parse(row.checkpoints_visited),
      checkpoints_missed: JSON.parse(row.checkpoints_missed)
    };
    res.json(session);
  });
});

// 更新会话状态（记录移动轨迹、检查点访问等）
router.put('/:id', (req, res) => {
  const sessionId = req.params.id;
  const { 
    checkpoints_visited, 
    distance_traveled, 
    time_used,
    status
  } = req.body;
  
  // 获取当前会话数据
  db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '会话不存在' });
    }
    
    // 更新会话数据
    const currentVisited = JSON.parse(row.checkpoints_visited);
    const newVisited = checkpoints_visited || currentVisited;
    
    const stmt = db.prepare(`
      UPDATE sessions 
      SET checkpoints_visited = ?, distance_traveled = ?, time_used = ?, status = ?
      WHERE id = ?
    `);
    
    stmt.run(
      JSON.stringify(newVisited),
      distance_traveled || row.distance_traveled,
      time_used || row.time_used,
      status || row.status,
      sessionId,
      (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: '会话更新成功' });
      }
    );
    stmt.finalize();
  });
});

// 结束会话并计算最终评分
router.post('/:id/finish', (req, res) => {
  const sessionId = req.params.id;
  const { replay_data } = req.body;
  
  // 获取会话和关卡数据
  db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, session) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    
    db.get('SELECT * FROM levels WHERE id = ?', [session.level_id], (err, level) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!level) {
        return res.status(404).json({ error: '关卡不存在' });
      }
      
      // 解析数据
      const checkpoints = JSON.parse(level.checkpoints);
      const visitedCheckpoints = JSON.parse(session.checkpoints_visited);
      
      // 计算漏检的检查点
      const missedCheckpoints = checkpoints.filter(cp => 
        !visitedCheckpoints.includes(cp.id)
      );
      
      // 计算最佳路径距离（简化：起点到所有检查点的最短路径）
      const floorPlan = JSON.parse(level.floor_plan);
      const startPoint = floorPlan.start || { x: 0, y: 0 };
      
      // 计算实际距离和最优距离
      const actualDistance = session.distance_traveled;
      
      // 简单估算最优距离（检查点之间的直线距离总和 + 起点到第一个检查点）
      let optimalDistance = 0;
      if (checkpoints.length > 0) {
        // 起点到第一个检查点
        optimalDistance += calculateDistance(startPoint, checkpoints[0].position);
        
        // 检查点之间的距离
        for (let i = 0; i < checkpoints.length - 1; i++) {
          optimalDistance += calculateDistance(
            checkpoints[i].position, 
            checkpoints[i + 1].position
          );
        }
      }
      
      // 计算各项惩罚分数
      const totalScore = 100;
      let score = totalScore;
      
      // 漏检惩罚：每个漏检扣20分
      const missedPenalty = missedCheckpoints.length * 20;
      score -= missedPenalty;
      
      // 绕路惩罚：超过最优距离50%的部分，每超过10个单位扣1分
      let detourPenalty = 0;
      if (optimalDistance > 0 && actualDistance > optimalDistance * 1.5) {
        const excessDistance = actualDistance - optimalDistance * 1.5;
        detourPenalty = Math.floor(excessDistance / 10);
        score -= detourPenalty;
      }
      
      // 超时惩罚：每超过时间限制10秒扣1分
      let overTimePenalty = 0;
      const timeLimit = level.time_limit;
      const timeUsed = session.time_used;
      if (timeUsed > timeLimit) {
        overTimePenalty = Math.floor((timeUsed - timeLimit) / 10);
        score -= overTimePenalty;
      }
      
      // 确保分数不低于0
      score = Math.max(0, score);
      
      // 保存回放数据
      if (replay_data) {
        const replayId = uuid.v4();
        const replayFile = path.join(replaysDir, `${replayId}.json`);
        
        fs.writeJson(replayFile, {
          id: replayId,
          session_id: sessionId,
          replay_data: replay_data,
          created_at: moment().toISOString()
        }, { spaces: 2 })
          .then(() => {
            const replayStmt = db.prepare(`
              INSERT INTO replays (id, session_id, replay_data)
              VALUES (?, ?, ?)
            `);
            replayStmt.run(replayId, sessionId, JSON.stringify(replay_data));
            replayStmt.finalize();
          })
          .catch(err => {
            console.error('保存回放失败:', err);
          });
      }
      
      // 更新会话最终数据
      const endTime = moment().toISOString();
      const updateStmt = db.prepare(`
        UPDATE sessions 
        SET end_time = ?, 
            score = ?, 
            checkpoints_missed = ?, 
            optimal_distance = ?,
            detour_penalty = ?,
            missed_penalty = ?,
            over_time_penalty = ?,
            status = 'completed'
        WHERE id = ?
      `);
      
      updateStmt.run(
        endTime,
        score,
        JSON.stringify(missedCheckpoints.map(cp => cp.id)),
        optimalDistance,
        detourPenalty,
        missedPenalty,
        overTimePenalty,
        sessionId,
        (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          res.json({
            success: true,
            session_id: sessionId,
            score: score,
            total_score: totalScore,
            penalties: {
              missed: missedPenalty,
              detour: detourPenalty,
              overtime: overTimePenalty
            },
            checkpoints: {
              total: checkpoints.length,
              visited: visitedCheckpoints.length,
              missed: missedCheckpoints.length
            },
            distance: {
              actual: actualDistance,
              optimal: optimalDistance
            },
            time: {
              used: timeUsed,
              limit: timeLimit
            },
            missed_checkpoints: missedCheckpoints
          });
        }
      );
      updateStmt.finalize();
    });
  });
});

// 获取所有历史会话
router.get('/', (req, res) => {
  db.all(`
    SELECT s.*, l.name as level_name 
    FROM sessions s 
    LEFT JOIN levels l ON s.level_id = l.id 
    ORDER BY s.start_time DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.map(row => ({
      ...row,
      checkpoints_visited: JSON.parse(row.checkpoints_visited),
      checkpoints_missed: JSON.parse(row.checkpoints_missed)
    })));
  });
});

// 辅助函数：计算两点之间的距离
function calculateDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

module.exports = router;
