const { dataStore, generateId } = require('../data/store');

function exportMarkdown(req, res) {
  try {
    const { wallId, includeRisks = true, includeRoutes = true, includeFeedback = true } = req.body;
    
    let walls = dataStore.walls;
    let routes = dataStore.routes;
    let holds = dataStore.holds;
    let risks = dataStore.riskAnalysis;
    let feedback = dataStore.feedback;

    if (wallId) {
      walls = walls.filter(w => w.id === wallId);
      routes = routes.filter(r => r.wallId === wallId);
      holds = holds.filter(h => h.wallId === wallId);
      risks = risks.filter(r => r.wallId === wallId);
    }

    const dateStr = new Date().toISOString().split('T')[0];
    
    let markdown = `# 攀岩馆路线复盘报告

生成时间: ${new Date().toLocaleString('zh-CN')}

---

## 风险分析摘要

`;

    if (includeRisks && risks.length > 0) {
      const highRisks = risks.filter(r => r.severity === 'high');
      const mediumRisks = risks.filter(r => r.severity === 'medium');
      const lowRisks = risks.filter(r => r.severity === 'low');

      markdown += `
### 风险统计
- **高风险**: ${highRisks.length} 项
- **中风险**: ${mediumRisks.length} 项
- **低风险**: ${lowRisks.length} 项
- **总计**: ${risks.length} 项

---

### 详细风险列表

`;

      if (highRisks.length > 0) {
        markdown += `#### 🔴 高风险问题

`;
        highRisks.forEach((risk, index) => {
          markdown += `**${index + 1}. ${risk.riskName}**
- 描述: ${risk.description}
- 涉及路线: ${risk.affectedRouteNames?.join(', ') || '无'}
- 建议: ${risk.suggestion}

`;
        });
      }

      if (mediumRisks.length > 0) {
        markdown += `#### 🟡 中风险问题

`;
        mediumRisks.forEach((risk, index) => {
          markdown += `**${index + 1}. ${risk.riskName}**
- 描述: ${risk.description}
- 涉及路线: ${risk.affectedRouteNames?.join(', ') || '无'}
- 建议: ${risk.suggestion}

`;
        });
      }

      if (lowRisks.length > 0) {
        markdown += `#### 🟢 低风险问题

`;
        lowRisks.forEach((risk, index) => {
          markdown += `**${index + 1}. ${risk.riskName}**
- 描述: ${risk.description}
- 涉及路线: ${risk.affectedRouteNames?.join(', ') || '无'}
- 建议: ${risk.suggestion}

`;
        });
      }
    } else {
      markdown += `暂无风险数据。

`;
    }

    if (includeRoutes && routes.length > 0) {
      markdown += `---

## 路线列表

`;

      routes.forEach((route, index) => {
        const routeHolds = route.holdIds
          .map(id => holds.find(h => h.id === id))
          .filter(h => h);

        markdown += `### ${index + 1}. ${route.name}
- **难度**: ${route.difficulty}
- **颜色**: ${route.color}
- **岩点数量**: ${routeHolds.length}
- **备注**: ${route.notes || '无'}

`;
      });
    }

    if (includeFeedback && feedback.length > 0) {
      markdown += `---

## 会员反馈摘要

`;

      const routeFeedback = {};
      feedback.forEach(fb => {
        if (fb.routeId) {
          if (!routeFeedback[fb.routeId]) {
            routeFeedback[fb.routeId] = { ratings: [], comments: [] };
          }
          routeFeedback[fb.routeId].ratings.push(fb.rating);
          if (fb.comment) {
            routeFeedback[fb.routeId].comments.push(fb.comment);
          }
        }
      });

      Object.entries(routeFeedback).forEach(([routeId, data]) => {
        const route = routes.find(r => r.id === routeId);
        const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;

        markdown += `### ${route?.name || '未知路线'}
- **平均评分**: ${avgRating.toFixed(1)}/5
- **评价数量**: ${data.ratings.length}

`;

        if (data.comments.length > 0) {
          markdown += `**典型反馈**:
`;
          data.comments.slice(0, 3).forEach(comment => {
            markdown += `- "${comment}"
`;
          });
          markdown += `
`;
        }
      });
    }

    markdown += `---

## 换线建议摘要

`;

    const suggestions = [];
    
    if (risks.some(r => r.riskType === 'large_span')) {
      suggestions.push('1. **跨距问题**: 对于跨距超过1.8米的岩点组合，建议在中间添加过渡岩点，或重新调整岩点位置');
    }
    
    if (risks.some(r => r.riskType === 'overcrowding')) {
      suggestions.push('2. **拥挤问题**: 重新规划路线布局，将相互干扰的路线分散到不同墙面区域');
    }
    
    if (risks.some(r => r.riskType === 'kids_high_difficulty')) {
      suggestions.push('3. **儿童区问题**: 将高难度路线从儿童区移至成人区域，儿童区难度建议控制在V0-V3');
    }
    
    if (risks.some(r => r.riskType === 'hotspot')) {
      suggestions.push('4. **热区问题**: 检查高使用频率区域的岩点磨损情况，考虑定期轮换岩点位置');
    }
    
    if (risks.some(r => r.riskType === 'low_rating')) {
      suggestions.push('5. **低评分问题**: 分析会员反馈，对评分较低的路线进行调整或重新设计');
    }

    if (suggestions.length > 0) {
      markdown += suggestions.join('\n\n') + '\n';
    } else {
      markdown += '当前没有需要特别关注的换线建议。\n';
    }

    markdown += `
---

*本报告由攀岩馆路线复盘工具自动生成*
`;

    res.json({ 
      success: true, 
      data: {
        content: markdown,
        filename: `route-review-${dateStr}.md`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function exportJson(req, res) {
  try {
    const { wallId } = req.body;
    
    let walls = dataStore.walls;
    let routes = dataStore.routes;
    let holds = dataStore.holds;
    let heatmap = dataStore.heatmap;
    let feedback = dataStore.feedback;
    let riskAnalysis = dataStore.riskAnalysis;

    if (wallId) {
      walls = walls.filter(w => w.id === wallId);
      routes = routes.filter(r => r.wallId === wallId);
      holds = holds.filter(h => h.wallId === wallId);
      heatmap = heatmap.filter(h => h.wallId === wallId);
      riskAnalysis = riskAnalysis.filter(r => r.wallId === wallId);
    }

    const exportData = {
      exportInfo: {
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      },
      walls,
      routes,
      holds,
      heatmap,
      feedback,
      riskAnalysis
    };

    const dateStr = new Date().toISOString().split('T')[0];
    
    res.json({ 
      success: true, 
      data: {
        content: JSON.stringify(exportData, null, 2),
        filename: `route-data-${dateStr}.json`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  exportMarkdown,
  exportJson
};
