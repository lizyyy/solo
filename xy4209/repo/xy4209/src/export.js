import { LevelState } from './levels.js';

export function generateMarkdownReport(state, gameResult) {
  const finalState = state;
  const result = gameResult;
  
  const lines = [];
  
  lines.push('# 疏散演练复盘报告');
  lines.push('');
  lines.push('## 基本信息');
  lines.push('');
  lines.push(`- **关卡**: ${finalState.levelName}`);
  lines.push(`- **游戏时间**: ${formatDuration(finalState.elapsedTime)} / ${formatDuration(finalState.maxTime)}`);
  lines.push(`- **最终得分**: ${Math.round(finalState.score)} 分`);
  lines.push(`- **结果**: ${result.isWin ? '✅ 成功' : '❌ 失败'}`);
  lines.push('');
  
  lines.push('## 人员统计');
  lines.push('');
  const totalPeople = finalState.totalPeople;
  const evacuated = finalState.peopleEvacuated;
  const panicked = finalState.peoplePanicked;
  const remaining = totalPeople - evacuated - panicked;
  
  lines.push(`| 状态 | 人数 | 占比 |`);
  lines.push(`|------|------|------|`);
  lines.push(`| 已疏散 | ${evacuated} | ${((evacuated / totalPeople) * 100).toFixed(1)}% |`);
  lines.push(`| 恐慌 | ${panicked} | ${((panicked / totalPeople) * 100).toFixed(1)}% |`);
  lines.push(`| 未疏散 | ${remaining} | ${((remaining / totalPeople) * 100).toFixed(1)}% |`);
  lines.push(`| **总计** | **${totalPeople}** | **100%** |`);
  lines.push('');
  
  lines.push('## 人群构成');
  lines.push('');
  
  const typeStats = calculateTypeStats(finalState);
  lines.push(`| 人群类型 | 初始人数 | 已疏散 | 恐慌 |`);
  lines.push(`|----------|----------|--------|------|`);
  
  for (const [type, stats] of Object.entries(typeStats)) {
    lines.push(`| ${stats.name} | ${stats.total} | ${stats.evacuated} | ${stats.panicked} |`);
  }
  lines.push('');
  
  lines.push('## 行动记录');
  lines.push('');
  
  const actionSummary = analyzeActions(finalState);
  lines.push(`- **志愿者移动**: ${actionSummary.volunteerMoves} 次`);
  lines.push(`- **广播使用**: ${actionSummary.broadcastsUsed} 次`);
  lines.push(`- **路径封锁**: ${actionSummary.pathBlocks} 次`);
  
  if (finalState.replayActions.length > 0) {
    lines.push('');
    lines.push('### 详细行动时间线');
    lines.push('');
    
    const recentActions = finalState.replayActions.slice(-20);
    for (const action of recentActions) {
      const timeFormatted = formatDuration(action.timestamp);
      const actionDesc = formatAction(action);
      lines.push(`- **[${timeFormatted}]** ${actionDesc}`);
    }
  }
  lines.push('');
  
  lines.push('## 事件记录');
  lines.push('');
  
  const triggeredEvents = finalState.events.filter(e => e.triggered);
  if (triggeredEvents.length > 0) {
    lines.push(`| 时间 | 事件类型 | 描述 | 状态 |`);
    lines.push(`|------|----------|------|------|`);
    
    for (const event of triggeredEvents) {
      const timeFormatted = formatDuration(event.appliedAt || 0);
      const eventType = formatEventType(event.type);
      const status = event.handled ? '已处理' : '未处理';
      lines.push(`| ${timeFormatted} | ${eventType} | ${event.description || '-'} | ${status} |`);
    }
  } else {
    lines.push('本次演练没有触发事件。');
  }
  lines.push('');
  
  lines.push('## 计分明细');
  lines.push('');
  
  const scoring = finalState.scoring;
  const points = {
    evacuation: evacuated * (scoring.pointsPerEvacuation || 10),
    timeBonus: Math.max(0, (finalState.maxTime - finalState.elapsedTime) * (scoring.timeBonusPerSecond || 1)),
    panicPenalty: -panicked * (scoring.penaltyPerPanic || 20),
    volunteerPenalty: -actionSummary.volunteerMoves * (scoring.penaltyPerVolunteerAction || 5),
    broadcastPenalty: -actionSummary.broadcastsUsed * (scoring.penaltyPerBroadcast || 15)
  };
  
  lines.push(`| 项目 | 分数 | 说明 |`);
  lines.push(`|------|------|------|`);
  lines.push(`| 疏散奖励 | +${points.evacuation} | ${evacuated} 人 × ${scoring.pointsPerEvacuation || 10} 分 |`);
  
  if (points.timeBonus > 0) {
    lines.push(`| 时间奖励 | +${Math.round(points.timeBonus)} | ${Math.round(finalState.maxTime - finalState.elapsedTime)} 秒剩余 |`);
  }
  
  if (points.panicPenalty < 0) {
    lines.push(`| 恐慌惩罚 | ${points.panicPenalty} | ${panicked} 人 × ${scoring.penaltyPerPanic || 20} 分 |`);
  }
  
  if (points.volunteerPenalty < 0) {
    lines.push(`| 志愿者操作惩罚 | ${points.volunteerPenalty} | ${actionSummary.volunteerMoves} 次 × ${scoring.penaltyPerVolunteerAction || 5} 分 |`);
  }
  
  if (points.broadcastPenalty < 0) {
    lines.push(`| 广播使用惩罚 | ${points.broadcastPenalty} | ${actionSummary.broadcastsUsed} 次 × ${scoring.penaltyPerBroadcast || 15} 分 |`);
  }
  
  lines.push(`| **总计** | **${Math.round(finalState.score)}** | |`);
  lines.push('');
  
  lines.push('## 评估与建议');
  lines.push('');
  
  const evaluation = generateEvaluation(finalState, result);
  lines.push(evaluation);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push(`*报告生成时间: ${new Date().toLocaleString()}*`);
  lines.push(`*游戏版本: 十分钟清场 v1.0*`);
  
  return lines.join('\n');
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function calculateTypeStats(state) {
  const stats = {
    normal: { name: '普通人群', total: 0, evacuated: 0, panicked: 0 },
    elderly: { name: '老人', total: 0, evacuated: 0, panicked: 0 },
    child: { name: '儿童', total: 0, evacuated: 0, panicked: 0 },
    disabled: { name: '残障人士', total: 0, evacuated: 0, panicked: 0 }
  };
  
  for (const person of state.persons) {
    const type = person.type || 'normal';
    if (!stats[type]) continue;
    
    stats[type].total++;
    
    if (person.state === 'evacuated') {
      stats[type].evacuated++;
    } else if (person.state === 'panicked') {
      stats[type].panicked++;
    }
  }
  
  return stats;
}

function analyzeActions(state) {
  const summary = {
    volunteerMoves: 0,
    broadcastsUsed: 0,
    pathBlocks: 0
  };
  
  for (const action of state.replayActions) {
    switch (action.type) {
      case 'move_volunteer':
      case 'direct_people':
        summary.volunteerMoves++;
        break;
      case 'use_broadcast':
        summary.broadcastsUsed++;
        break;
      case 'block_path':
        summary.pathBlocks++;
        break;
    }
  }
  
  return summary;
}

function formatAction(action) {
  const actionMap = {
    move_volunteer: '移动志愿者',
    direct_people: '引导人群',
    use_broadcast: '使用广播',
    block_path: '封锁路径',
    unblock_path: '解封路径',
    trigger_event: '触发事件'
  };
  
  const baseDesc = actionMap[action.type] || action.type;
  
  if (action.data) {
    if (action.data.volunteerId) {
      return `${baseDesc} (志愿者: ${action.data.volunteerId})`;
    }
    if (action.data.direction) {
      return `${baseDesc} (方向: ${action.data.direction})`;
    }
    if (action.data.broadcastType) {
      return `${baseDesc} (类型: ${action.data.broadcastType})`;
    }
  }
  
  return baseDesc;
}

function formatEventType(type) {
  const typeMap = {
    temporary_blockage: '临时封路',
    broadcast_announcement: '广播指令',
    medical_emergency: '医疗紧急情况',
    additional_crowd: '额外人群',
    equipment_failure: '设备故障'
  };
  return typeMap[type] || type;
}

function generateEvaluation(state, result) {
  const lines = [];
  const totalPeople = state.totalPeople;
  const evacuated = state.peopleEvacuated;
  const panicked = state.peoplePanicked;
  const evacuationRate = (evacuated / totalPeople) * 100;
  const panicRate = (panicked / totalPeople) * 100;
  
  if (result.isWin) {
    lines.push('### 🎉 演练评估: 成功');
    lines.push('');
    lines.push(`恭喜！你成功在规定时间内疏散了 ${evacuationRate.toFixed(1)}% 的人群。`);
  } else {
    lines.push('### ⚠️ 演练评估: 需要改进');
    lines.push('');
    if (panicRate >= 30) {
      lines.push('**主要问题**: 恐慌人数过多。');
      lines.push('');
      lines.push('建议:');
      lines.push('- 及时使用安抚广播稳定人群情绪');
      lines.push('- 在拥堵区域安排志愿者引导');
      lines.push('- 避免在拥堵时使用警告广播');
    } else {
      lines.push('**主要问题**: 疏散时间不够。');
      lines.push('');
      lines.push('建议:');
      lines.push('- 在关键路口提前安排志愿者');
      lines.push('- 合理使用广播加速疏散');
      lines.push('- 考虑分流策略减少入口拥堵');
    }
  }
  
  lines.push('');
  lines.push('### 📊 关键指标分析');
  lines.push('');
  
  if (evacuationRate >= 90) {
    lines.push(`- ✅ **疏散率** (${evacuationRate.toFixed(1)}%): 优秀`);
  } else if (evacuationRate >= 70) {
    lines.push(`- ⚠️ **疏散率** (${evacuationRate.toFixed(1)}%): 需要改进`);
  } else {
    lines.push(`- ❌ **疏散率** (${evacuationRate.toFixed(1)}%): 严重不足`);
  }
  
  if (panicRate <= 10) {
    lines.push(`- ✅ **恐慌率** (${panicRate.toFixed(1)}%): 优秀`);
  } else if (panicRate <= 20) {
    lines.push(`- ⚠️ **恐慌率** (${panicRate.toFixed(1)}%): 需要关注`);
  } else {
    lines.push(`- ❌ **恐慌率** (${panicRate.toFixed(1)}%): 严重问题`);
  }
  
  const typeStats = calculateTypeStats(state);
  const elderlyEvacRate = typeStats.elderly.total > 0 
    ? (typeStats.elderly.evacuated / typeStats.elderly.total) * 100 
    : 100;
  
  if (elderlyEvacRate >= 80) {
    lines.push(`- ✅ **老人疏散率** (${elderlyEvacRate.toFixed(1)}%): 良好`);
  } else {
    lines.push(`- ⚠️ **老人疏散率** (${elderlyEvacRate.toFixed(1)}%): 需要更多关注`);
    lines.push('  - 提示: 老人移动速度较慢，需要提前引导');
  }
  
  return lines.join('\n');
}

export function downloadMarkdown(report, filename = 'evacuation-report.md') {
  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsJSON(data, filename = 'game-export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
