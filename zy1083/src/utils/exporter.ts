import {
  ScoredHouse,
  ShortlistItem,
  ProjectData,
  RiskFactor,
  RatingConfig,
  House,
  VisitNote,
} from '../types';
import { calculateMonthlyHiddenCost, calculateCommuteTimeCost, calculateDepositRisk } from './scoring';

export const exportToJson = (projectData: ProjectData): Blob => {
  const jsonString = JSON.stringify(projectData, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
};

export const exportToMarkdown = (
  scoredHouses: ScoredHouse[],
  shortlist: (ShortlistItem & { house?: ScoredHouse })[],
  ratingConfig: RatingConfig,
  options: { includeAllHouses?: boolean; includeShortlistOnly?: boolean } = {}
): string => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let md = `# 租房看房复盘报告\n\n`;
  md += `> 生成时间：${dateStr} ${timeStr}\n\n`;
  md += `---\n\n`;

  const targetHouses = options.includeShortlistOnly
    ? shortlist.filter((s) => s.house).map((s) => s.house!)
    : scoredHouses;

  md += `## 一、概览\n\n`;
  md += `- 总房源数：${scoredHouses.length} 套\n`;
  md += `- 短名单房源数：${shortlist.length} 套\n`;
  md += `- 评分范围：最低 ${Math.min(...targetHouses.map((h) => h.overallScore))} 分，最高 ${Math.max(...targetHouses.map((h) => h.overallScore))} 分\n\n`;

  if (targetHouses.length > 0) {
    md += `### 评分排名\n\n`;
    md += `| 排名 | 房源名称 | 综合评分 | 等级 | 月租金 | 通勤时间 |\n`;
    md += `|------|----------|----------|------|--------|----------|\n`;

    const sortedHouses = [...targetHouses].sort((a, b) => b.overallScore - a.overallScore);
    sortedHouses.forEach((house, index) => {
      const gradeEmoji = {
        excellent: '⭐',
        good: '👍',
        fair: '⚠️',
        poor: '❌',
      };
      const gradeText = {
        excellent: '优秀',
        good: '良好',
        fair: '一般',
        poor: '较差',
      };
      md += `| ${index + 1} | ${house.name} | ${house.overallScore.toFixed(1)} | ${gradeEmoji[house.overallGrade]} ${gradeText[house.overallGrade]} | ¥${house.monthlyRent.toLocaleString()} | ${house.commuteTime}分钟 |\n`;
    });
    md += `\n`;
  }

  if (shortlist.length > 0) {
    md += `## 二、短名单详情\n\n`;

    const priorityOrder: Record<string, number> = { '高': 0, '中': 1, '低': 2 };
    const sortedShortlist = [...shortlist].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    sortedShortlist.forEach((item) => {
      if (!item.house) return;

      const house = item.house;
      md += `### ${house.name}\n\n`;
      md += `- **优先级**：${item.priority}\n`;
      md += `- **综合评分**：${house.overallScore.toFixed(1)} 分\n`;
      md += `- **地址**：${house.address}\n`;
      md += `- **月租金**：¥${house.monthlyRent.toLocaleString()}\n`;
      md += `- **面积**：${house.area}㎡\n`;
      md += `- **通勤时间**：${house.commuteTime} 分钟（${house.commuteType}）\n`;
      md += `- **看房日期**：${house.visitDate}\n`;
      md += `\n`;

      md += `#### 评分明细\n\n`;
      md += `| 评分项 | 得分 | 权重 |\n`;
      md += `|--------|------|------|\n`;
      md += `| 月租金 | ${house.scores.monthlyRentScore.toFixed(0)} | ${ratingConfig.weights.monthlyRent} |\n`;
      md += `| 押金风险 | ${house.scores.depositRiskScore.toFixed(0)} | ${ratingConfig.weights.depositRisk} |\n`;
      md += `| 通勤时间 | ${house.scores.commuteTimeScore.toFixed(0)} | ${ratingConfig.weights.commuteTime} |\n`;
      md += `| 采光 | ${house.scores.lightingScore.toFixed(0)} | ${ratingConfig.weights.lighting} |\n`;
      md += `| 噪音 | ${house.scores.noiseScore.toFixed(0)} | ${ratingConfig.weights.noise} |\n`;
      md += `| 漏水 | ${house.scores.waterLeakScore.toFixed(0)} | ${ratingConfig.weights.waterLeak} |\n`;
      md += `| 异味 | ${house.scores.odorScore.toFixed(0)} | ${ratingConfig.weights.odor} |\n`;
      md += `| 维修成本 | ${house.scores.repairCostScore.toFixed(0)} | ${ratingConfig.weights.repairCost} |\n`;
      md += `| 周边安全 | ${house.scores.surroundingSafetyScore.toFixed(0)} | ${ratingConfig.weights.surroundingSafety} |\n`;
      md += `\n`;

      const hiddenCost = calculateMonthlyHiddenCost(house);
      const commuteCost = calculateCommuteTimeCost(house);
      const depositRisk = calculateDepositRisk(house);

      md += `#### 成本分析\n\n`;
      md += `- **月均隐性成本**：¥${hiddenCost.toFixed(0)}（中介费分摊 + 额外费用）\n`;
      md += `- **通勤时间成本（估算）**：每月约 ¥${commuteCost.costPerMonth.toFixed(0)}（按每小时50元计算）\n`;
      md += `- **实际月均成本**：约 ¥${(house.monthlyRent + hiddenCost).toLocaleString()}\n`;
      md += `- **押金情况**：${house.depositType}，¥${house.deposit.toLocaleString()}（${depositRisk.description}）\n`;
      md += `\n`;

      if (house.riskFactors.length > 0) {
        md += `#### 主要风险点\n\n`;
        house.riskFactors.forEach((risk) => {
          const levelEmoji = {
            '高': '🔴',
            '中': '🟡',
            '低': '🟢',
          };
          md += `##### ${levelEmoji[risk.level]} ${risk.category}（${risk.level}风险）\n\n`;
          md += `> ${risk.description}\n\n`;
          md += `**建议**：${risk.suggestion}\n\n`;
        });
      }

      if (item.followUps.length > 0 || (house.visitNote?.pendingQuestions?.length ?? 0) > 0) {
        md += `#### 待确认问题\n\n`;
        const allQuestions = [
          ...item.followUps.map((f) => ({ question: f.question, status: f.status, answer: f.answer })),
          ...(house.visitNote?.pendingQuestions?.map((pq) => ({ question: pq.question, status: pq.status, answer: pq.answer })) ?? []),
        ];

        const uniqueQuestions = Array.from(new Map(allQuestions.map((q) => [q.question, q])).values());

        uniqueQuestions.forEach((q) => {
          const statusEmoji = {
            '待确认': '⏳',
            '已确认': '✅',
            '放弃': '❌',
          };
          md += `- ${statusEmoji[q.status]} **${q.question}** (${q.status})`;
          if (q.answer) {
            md += `\n  - 回答：${q.answer}`;
          }
          md += `\n`;
        });
        md += `\n`;
      }

      if (house.notes) {
        md += `#### 看房备注\n\n`;
        md += `> ${house.notes}\n\n`;
      }

      if (house.visitNote?.generalNotes) {
        md += `#### 详细看房记录\n\n`;
        md += `> ${house.visitNote.generalNotes}\n\n`;
      }

      md += `---\n\n`;
    });
  }

  if (!options.includeShortlistOnly && targetHouses.length > 0) {
    md += `## 三、所有房源对比\n\n`;

    md += `| 房源名称 | 综合评分 | 月租金 | 面积 | 通勤时间 | 楼层 | 朝向 |\n`;
    md += `|----------|----------|--------|------|----------|------|------|\n`;

    const sortedAll = [...targetHouses].sort((a, b) => b.overallScore - a.overallScore);
    sortedAll.forEach((house) => {
      md += `| ${house.name} | ${house.overallScore.toFixed(1)} | ¥${house.monthlyRent.toLocaleString()} | ${house.area}㎡ | ${house.commuteTime}分钟 | ${house.floor} | ${house.orientation} |\n`;
    });
    md += `\n`;
  }

  md += `## 四、评分配置\n\n`;
  md += `当前使用的评分权重配置：\n\n`;
  md += `| 评分项 | 权重 | 说明 |\n`;
  md += `|--------|------|------|\n`;
  md += `| 月租金 | ${ratingConfig.weights.monthlyRent} | 租金占比越高越重要 |\n`;
  md += `| 押金风险 | ${ratingConfig.weights.depositRisk} | 押金退还的安全性 |\n`;
  md += `| 通勤时间 | ${ratingConfig.weights.commuteTime} | 每日通勤时长 |\n`;
  md += `| 采光 | ${ratingConfig.weights.lighting} | 房屋采光情况 |\n`;
  md += `| 噪音 | ${ratingConfig.weights.noise} | 周边安静程度 |\n`;
  md += `| 漏水 | ${ratingConfig.weights.waterLeak} | 是否存在漏水问题 |\n`;
  md += `| 异味 | ${ratingConfig.weights.odor} | 是否存在异味问题 |\n`;
  md += `| 维修成本 | ${ratingConfig.weights.repairCost} | 需要维修的项目数量和严重程度 |\n`;
  md += `| 周边安全 | ${ratingConfig.weights.surroundingSafety} | 小区和周边治安情况 |\n`;
  md += `| 中介费 | ${ratingConfig.weights.agencyFee} | 中介费用高低 |\n`;
  md += `| 额外费用 | ${ratingConfig.weights.additionalFees} | 物业费、网费等额外费用 |\n`;
  md += `\n`;

  md += `---\n\n`;
  md += `*本报告由「租房看房复盘台」生成，数据仅供参考，签约前请务必核实所有信息。*\n`;

  return md;
};

export const exportToHtml = (
  scoredHouses: ScoredHouse[],
  shortlist: (ShortlistItem & { house?: ScoredHouse })[],
  ratingConfig: RatingConfig,
  options: { includeAllHouses?: boolean; includeShortlistOnly?: boolean } = {}
): string => {
  const markdown = exportToMarkdown(scoredHouses, shortlist, ratingConfig, options);
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>租房看房复盘报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      background-color: #f9fafb;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 2em;
      margin-bottom: 0.5em;
      color: #1a1a1a;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 0.5em;
    }
    h2 {
      font-size: 1.5em;
      margin: 1.5em 0 1em;
      color: #1a1a1a;
      border-left: 4px solid #3b82f6;
      padding-left: 0.5em;
    }
    h3 {
      font-size: 1.25em;
      margin: 1.25em 0 0.75em;
      color: #374151;
    }
    h4 {
      font-size: 1.1em;
      margin: 1em 0 0.5em;
      color: #4b5563;
    }
    p {
      margin: 0.75em 0;
    }
    blockquote {
      border-left: 3px solid #d1d5db;
      padding-left: 1em;
      margin: 1em 0;
      color: #6b7280;
      background: #f9fafb;
      padding: 1em;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      font-size: 0.95em;
    }
    table th, table td {
      border: 1px solid #e5e7eb;
      padding: 12px;
      text-align: left;
    }
    table th {
      background-color: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    table tr:nth-child(even) {
      background-color: #f9fafb;
    }
    ul {
      margin: 0.75em 0;
      padding-left: 1.5em;
    }
    li {
      margin: 0.5em 0;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 2em 0;
    }
    .risk-high { color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 4px; }
    .risk-medium { color: #d97706; background: #fffbeb; padding: 2px 6px; border-radius: 4px; }
    .risk-low { color: #059669; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; }
    .status-pending { color: #d97706; }
    .status-confirmed { color: #059669; }
    .status-givenup { color: #6b7280; }
    .footer {
      margin-top: 2em;
      padding-top: 1em;
      border-top: 1px solid #e5e7eb;
      font-size: 0.875em;
      color: #9ca3af;
      text-align: center;
    }
    .header-info {
      color: #6b7280;
      font-size: 0.875em;
      margin-bottom: 2em;
    }
  </style>
</head>
<body>
  <div class="container">
    ${markdownToHtml(markdown)}
    <div class="footer">
      本报告由「租房看房复盘台」生成，数据仅供参考，签约前请务必核实所有信息。
    </div>
  </div>
</body>
</html>`;

  return html;
};

const markdownToHtml = (md: string): string => {
  let html = md;

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');

  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/^---$/gm, '<hr>');

  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>\n$&</ul>');

  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/^(.+?)(<h|<ul|<table|<blockquote|<hr)/g, '<p>$1</p>$2');

  return html;
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadProjectJson = (projectData: ProjectData): void => {
  const blob = exportToJson(projectData);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `租房复盘_${timestamp}.json`);
};

export const downloadMarkdownReport = (
  scoredHouses: ScoredHouse[],
  shortlist: (ShortlistItem & { house?: ScoredHouse })[],
  ratingConfig: RatingConfig,
  options: { includeAllHouses?: boolean; includeShortlistOnly?: boolean } = {}
): void => {
  const markdown = exportToMarkdown(scoredHouses, shortlist, ratingConfig, options);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `租房复盘报告_${timestamp}.md`);
};

export const downloadHtmlReport = (
  scoredHouses: ScoredHouse[],
  shortlist: (ShortlistItem & { house?: ScoredHouse })[],
  ratingConfig: RatingConfig,
  options: { includeAllHouses?: boolean; includeShortlistOnly?: boolean } = {}
): void => {
  const html = exportToHtml(scoredHouses, shortlist, ratingConfig, options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `租房复盘报告_${timestamp}.html`);
};
