import { GameState, LogEntry } from '../types';
import { formatDate, resourceDeltaToString } from '../utils/helpers';

export class ExportService {
  exportToMarkdown(game: GameState): string {
    let md = `# 《鲁滨逊漂流记》生存游戏 - 航海日志\n\n`;
    md += `## 游戏信息\n\n`;
    md += `- **游戏名称**: ${game.name}\n`;
    md += `- **总天数**: 第 ${game.currentDay} 天\n`;
    md += `- **结局**: ${game.gameOver ? (game.rescueSuccess ? '成功获救' : game.gameOverReason) : '游戏进行中'}\n`;
    md += `- **是否获得星期五**: ${game.hasFriday ? '是' : '否'}\n`;
    md += `- **是否建立庇护所**: ${game.hasShelter ? '是' : '否'}\n`;
    md += `- **是否生火**: ${game.hasFire ? '是' : '否'}\n\n`;

    md += `## 最终状态\n\n`;
    md += `### 资源\n\n`;
    md += `| 资源 | 数值 |\n|------|------|\n`;
    md += `| 食物 | ${game.resources.food}/${game.maxResources.food} |\n`;
    md += `| 水 | ${game.resources.water}/${game.maxResources.water} |\n`;
    md += `| 体力 | ${game.resources.energy}/${game.maxResources.energy} |\n`;
    md += `| 精神 | ${game.resources.spirit}/${game.maxResources.spirit} |\n`;
    md += `| 工具耐久 | ${game.resources.toolDurability}/${game.maxResources.toolDurability} |\n`;
    md += `| 安全值 | ${game.resources.safety}/${game.maxResources.safety} |\n\n`;

    md += `### 营地设施\n\n`;
    md += `| 设施 | 等级 | 状态 |\n|------|------|------|\n`;
    game.facilities.forEach((f) => {
      md += `| ${f.name} | ${f.level}/${f.maxLevel} | ${f.built ? '已建造' : '未建造'} |\n`;
    });
    md += `\n`;

    md += `### 探索的地点\n\n`;
    md += `| 地点 | 探索进度 | 状态 |\n|------|----------|------|\n`;
    game.locations.forEach((l) => {
      if (l.discovered) {
        md += `| ${l.name} | ${l.explorationProgress}% | ${l.explored ? '已探索' : '部分探索'} |\n`;
      }
    });
    md += `\n`;

    md += `## 航海日志\n\n`;
    const logsByDay = this.groupLogsByDay(game.logs);
    
    const sortedDays = Array.from(logsByDay.keys()).sort((a, b) => a - b);
    sortedDays.forEach((day) => {
      md += `### 第 ${day} 天\n\n`;
      const dayLogs = logsByDay.get(day) || [];
      dayLogs.forEach((log) => {
        const logType = this.getLogTypeLabel(log.type);
        md += `**[${logType}] ${log.title}**\n\n`;
        md += `${log.content}\n\n`;
        if (log.resourceChanges) {
          const deltaStr = resourceDeltaToString(log.resourceChanges);
          if (deltaStr) {
            md += `*资源变化: ${deltaStr}*\n\n`;
          }
        }
      });
      md += `---\n\n`;
    });

    md += `\n---\n\n`;
    md += `*此日志由鲁滨逊漂流记生存游戏自动生成*\n`;
    md += `*生成时间: ${formatDate(game.lastUpdated)}*\n`;

    return md;
  }

  exportToHTML(game: GameState): string {
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>鲁滨逊漂流记 - 航海日志</title>
    <style>
        body {
            font-family: 'Georgia', serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #faf8f5;
            color: #333;
            line-height: 1.6;
        }
        h1, h2, h3 {
            color: #5d4037;
            border-bottom: 2px solid #d7ccc8;
            padding-bottom: 10px;
        }
        .log-type-action { background-color: #e3f2fd; color: #1565c0; }
        .log-type-event { background-color: #fff3e0; color: #e65100; }
        .log-type-settlement { background-color: #e8f5e9; color: #2e7d32; }
        .log-type-end { background-color: #fce4ec; color: #c62828; }
        .log-type-resource { background-color: #f3e5f5; color: #6a1b9a; }
        .log-entry {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .log-title {
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 10px;
        }
        .log-type {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 8px;
        }
        .resource-change {
            font-size: 0.9em;
            color: #666;
            font-style: italic;
            margin-top: 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #d7ccc8;
            padding: 10px;
            text-align: left;
        }
        th {
            background-color: #efebe9;
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #d7ccc8;
            color: #666;
            font-size: 0.9em;
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>《鲁滨逊漂流记》生存游戏 - 航海日志</h1>
    
    <h2>游戏信息</h2>
    <ul>
        <li><strong>游戏名称:</strong> ${game.name}</li>
        <li><strong>总天数:</strong> 第 ${game.currentDay} 天</li>
        <li><strong>结局:</strong> ${game.gameOver ? (game.rescueSuccess ? '成功获救' : game.gameOverReason) : '游戏进行中'}</li>
        <li><strong>是否获得星期五:</strong> ${game.hasFriday ? '是' : '否'}</li>
        <li><strong>是否建立庇护所:</strong> ${game.hasShelter ? '是' : '否'}</li>
        <li><strong>是否生火:</strong> ${game.hasFire ? '是' : '否'}</li>
    </ul>
    
    <h2>最终状态</h2>
    
    <h3>资源</h3>
    <table>
        <tr><th>资源</th><th>数值</th></tr>
        <tr><td>食物</td><td>${game.resources.food}/${game.maxResources.food}</td></tr>
        <tr><td>水</td><td>${game.resources.water}/${game.maxResources.water}</td></tr>
        <tr><td>体力</td><td>${game.resources.energy}/${game.maxResources.energy}</td></tr>
        <tr><td>精神</td><td>${game.resources.spirit}/${game.maxResources.spirit}</td></tr>
        <tr><td>工具耐久</td><td>${game.resources.toolDurability}/${game.maxResources.toolDurability}</td></tr>
        <tr><td>安全值</td><td>${game.resources.safety}/${game.maxResources.safety}</td></tr>
    </table>
    
    <h3>营地设施</h3>
    <table>
        <tr><th>设施</th><th>等级</th><th>状态</th></tr>
        ${game.facilities.map(f => `<tr><td>${f.name}</td><td>${f.level}/${f.maxLevel}</td><td>${f.built ? '已建造' : '未建造'}</td></tr>`).join('')}
    </table>
    
    <h3>探索的地点</h3>
    <table>
        <tr><th>地点</th><th>探索进度</th><th>状态</th></tr>
        ${game.locations.filter(l => l.discovered).map(l => `<tr><td>${l.name}</td><td>${l.explorationProgress}%</td><td>${l.explored ? '已探索' : '部分探索'}</td></tr>`).join('')}
    </table>
    
    <h2>航海日志</h2>
`;

    const logsByDay = this.groupLogsByDay(game.logs);
    const sortedDays = Array.from(logsByDay.keys()).sort((a, b) => a - b);
    
    sortedDays.forEach((day) => {
      html += `    <h3>第 ${day} 天</h3>\n`;
      const dayLogs = logsByDay.get(day) || [];
      dayLogs.forEach((log) => {
        const logTypeClass = `log-type-${log.type}`;
        const logTypeLabel = this.getLogTypeLabel(log.type);
        
        html += `
    <div class="log-entry">
        <div class="log-title">
            <span class="log-type ${logTypeClass}">${logTypeLabel}</span>
            ${log.title}
        </div>
        <div class="log-content">${log.content}</div>`;
        
        if (log.resourceChanges) {
          const deltaStr = resourceDeltaToString(log.resourceChanges);
          if (deltaStr) {
            html += `
        <div class="resource-change">资源变化: ${deltaStr}</div>`;
          }
        }
        
        html += `
    </div>\n`;
      });
    });

    html += `
    <div class="footer">
        <p>此日志由鲁滨逊漂流记生存游戏自动生成</p>
        <p>生成时间: ${formatDate(game.lastUpdated)}</p>
    </div>
</body>
</html>`;

    return html;
  }

  exportToJSON(game: GameState): string {
    return JSON.stringify({
      game: {
        id: game.id,
        name: game.name,
        currentDay: game.currentDay,
        rescueSuccess: game.rescueSuccess,
        gameOver: game.gameOver,
        gameOverReason: game.gameOverReason,
        hasFriday: game.hasFriday,
        hasShelter: game.hasShelter,
        hasFire: game.hasFire,
        created: game.created,
        lastUpdated: game.lastUpdated,
      },
      finalResources: game.resources,
      maxResources: game.maxResources,
      facilities: game.facilities.map((f) => ({
        id: f.id,
        name: f.name,
        level: f.level,
        maxLevel: f.maxLevel,
        built: f.built,
      })),
      locations: game.locations
        .filter((l) => l.discovered)
        .map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          explored: l.explored,
          explorationProgress: l.explorationProgress,
        })),
      inventory: game.inventory,
      logs: game.logs.map((log) => ({
        id: log.id,
        day: log.day,
        timestamp: log.timestamp,
        type: log.type,
        title: log.title,
        content: log.content,
        resourceChanges: log.resourceChanges,
        actionTaken: log.actionTaken,
        eventId: log.eventId,
      })),
    }, null, 2);
  }

  private groupLogsByDay(logs: LogEntry[]): Map<number, LogEntry[]> {
    const map = new Map<number, LogEntry[]>();
    logs.forEach((log) => {
      if (!map.has(log.day)) {
        map.set(log.day, []);
      }
      map.get(log.day)!.push(log);
    });
    return map;
  }

  private getLogTypeLabel(type: LogEntry['type']): string {
    const labels: Record<LogEntry['type'], string> = {
      action: '行动',
      event: '事件',
      resource_change: '资源',
      settlement: '结算',
      end: '结局',
    };
    return labels[type] || type;
  }
}

export const exportService = new ExportService();
