export class ReportGenerator {
  constructor() {
    this.generatedAt = new Date().toISOString();
  }

  generateMarkdown(data) {
    const {
      warehouse,
      selectedOrders,
      analysis,
      hotspots,
      suggestions,
      inventoryCheck
    } = data;

    let md = `# 仓库拣货优化报告\n\n`;
    md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    md += `## 一、订单摘要\n\n`;
    md += `| 项目 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 选中订单数 | ${selectedOrders.length} |\n`;
    md += `| 总 SKU 种类 | ${this.countUniqueSKUs(selectedOrders)} |\n`;
    md += `| 总商品数量 | ${this.countTotalQuantity(selectedOrders)} |\n\n`;

    md += `### 订单详情\n\n`;
    selectedOrders.forEach(order => {
      md += `- **${order.orderId}** (${order.customerName || '未知客户'}): ${order.items.length} 种商品，共 ${order.getTotalQuantity()} 件\n`;
    });
    md += '\n';

    md += `## 二、路线分析\n\n`;
    if (analysis) {
      md += `| 指标 | 数值 |\n`;
      md += `|------|------|\n`;
      md += `| 总行驶距离 | ${analysis.totalDistance} 米 |\n`;
      md += `| 平均每人距离 | ${analysis.avgDistancePerPicker} 米 |\n`;
      md += `| 折返距离 | ${analysis.backtrackDistance} 米 |\n`;
      md += `| 折返率 | ${(analysis.backtrackRatio * 100).toFixed(0)}% |\n`;
      md += `| 转弯次数 | ${analysis.turnCount} 次 |\n`;
      md += `| 访问货架数 | ${analysis.uniqueShelvesVisited} 个 |\n\n`;

      if (analysis.pickerRoutes && analysis.pickerRoutes.length > 0) {
        md += `### 各拣货员路线\n\n`;
        analysis.pickerRoutes.forEach((route, index) => {
          md += `#### 拣货员 ${index + 1}\n\n`;
          md += `- 行驶距离: ${route.totalDistance.toFixed(2)} 米\n`;
          md += `- 访问货架: ${route.visitedShelves ? Array.from(route.visitedShelves).length : 0} 个\n`;
          md += `- 负责订单: ${route.assignedOrders ? route.assignedOrders.join(', ') : '无'}\n\n`;
          
          if (route.points && route.points.length > 0) {
            md += `**路线节点:**\n\n`;
            route.points.forEach((point, idx) => {
              const typeLabel = {
                'start': '🚀 起点',
                'pick': '📦 拣货',
                'packing': '📦 打包'
              }[point.type] || point.type;
              
              md += `${idx + 1}. ${typeLabel} - ${point.label || '未知位置'}`;
              if (point.skuCodes && point.skuCodes.length > 0) {
                md += ` (SKU: ${point.skuCodes.join(', ')})`;
              }
              md += '\n';
            });
            md += '\n';
          }
        });
      }
    }

    md += `## 三、堵点分析\n\n`;
    if (hotspots && hotspots.length > 0) {
      md += `本次模拟共发现 **${hotspots.length}** 个潜在堵点：\n\n`;
      
      hotspots.forEach((hotspot, index) => {
        const severityLabel = hotspot.severity === 'high' ? '🔴 高风险' : '🟡 中风险';
        md += `### ${index + 1}. ${severityLabel}\n\n`;
        md += `- **位置**: (${hotspot.x.toFixed(1)}, ${hotspot.y.toFixed(1)})\n`;
        if (hotspot.name) md += `- **通道**: ${hotspot.name}\n`;
        if (hotspot.trafficCount) md += `- **通行次数**: ${hotspot.trafficCount} 次\n`;
        if (hotspot.pickCount) md += `- **拣货次数**: ${hotspot.pickCount} 次\n`;
        md += `- **描述**: ${hotspot.description}\n\n`;
      });
    } else {
      md += `✅ 未发现明显堵点，路线规划较为合理。\n\n`;
    }

    md += `## 四、库存预警\n\n`;
    if (inventoryCheck) {
      const { missing, lowStock } = inventoryCheck;
      
      if (missing.length > 0) {
        md += `### ❌ 缺货/找不到货位\n\n`;
        md += `| 订单 | SKU | 数量 | 原因 |\n`;
        md += `|------|-----|------|------|\n`;
        missing.forEach(item => {
          md += `| ${item.orderId} | ${item.skuCode} | ${item.quantity} | ${item.reason} |\n`;
        });
        md += '\n';
      }
      
      if (lowStock.length > 0) {
        md += `### ⚠️ 库存不足\n\n`;
        md += `| 订单 | SKU | 商品名 | 可用 | 需求 | 缺口 |\n`;
        md += `|------|-----|--------|------|------|------|\n`;
        lowStock.forEach(item => {
          md += `| ${item.orderId} | ${item.skuCode} | ${item.skuName || '-'} | ${item.available} | ${item.required} | ${item.deficit} |\n`;
        });
        md += '\n';
      }
      
      if (missing.length === 0 && lowStock.length === 0) {
        md += `✅ 库存充足，所有订单 SKU 均可正常拣货。\n\n`;
      }
    }

    md += `## 五、优化建议\n\n`;
    if (suggestions && suggestions.length > 0) {
      const reorderSuggestions = suggestions.filter(s => s.type === 'reorder');
      const relocationSuggestions = suggestions.filter(s => s.type === 'relocation');
      
      if (reorderSuggestions.length > 0) {
        md += `### 📦 补货建议\n\n`;
        reorderSuggestions.forEach((sug, index) => {
          md += `${index + 1}. **${sug.skuName || sug.skuCode}** (${sug.skuCode})\n`;
          md += `   - 当前货位: ${sug.currentLocation}\n`;
          md += `   - ${sug.reason}\n\n`;
        });
      }
      
      if (relocationSuggestions.length > 0) {
        md += `### 📍 货位调整建议\n\n`;
        relocationSuggestions.forEach((sug, index) => {
          md += `${index + 1}. **${sug.skuName || sug.skuCode}** (${sug.skuCode})\n`;
          md += `   - 当前位置: ${sug.currentLocation}\n`;
          md += `   - 建议位置: ${sug.suggestedLocation}\n`;
          md += `   - 原因: ${sug.reason}\n`;
          if (sug.estimatedSaving > 0) {
            md += `   - 预计节省: 约 ${sug.estimatedSaving} 米/天\n`;
          }
          md += '\n';
        });
      }
    } else {
      md += `✅ 当前布局和库存状态良好，暂无紧急优化建议。\n\n`;
    }

    md += `---\n\n`;
    md += `*此报告由仓库拣货路线预演工具自动生成*\n`;

    return md;
  }

  generateHTML(data) {
    const markdown = this.generateMarkdown(data);
    const htmlContent = this.markdownToHTML(markdown);
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>仓库拣货优化报告</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        max-width: 900px;
        margin: 0 auto;
        padding: 40px 20px;
        line-height: 1.8;
        color: #333;
      }
      h1 {
        font-size: 1.8rem;
        color: #1a1a1a;
        border-bottom: 3px solid #667eea;
        padding-bottom: 12px;
      }
      h2 {
        font-size: 1.3rem;
        color: #444;
        border-bottom: 2px solid #eee;
        padding-bottom: 8px;
        margin-top: 32px;
      }
      h3 {
        font-size: 1.1rem;
        color: #555;
        margin-top: 24px;
      }
      h4 {
        font-size: 1rem;
        color: #666;
        margin-top: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        font-size: 0.9rem;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 10px 14px;
        text-align: left;
      }
      th {
        background: #f5f7fa;
        font-weight: 600;
      }
      tr:nth-child(even) {
        background: #fafbfc;
      }
      ul {
        margin: 12px 0 12px 24px;
      }
      li {
        margin: 6px 0;
      }
      blockquote {
        border-left: 4px solid #667eea;
        padding-left: 16px;
        margin: 16px 0;
        color: #666;
        background: #f8f9ff;
        padding: 12px 16px;
        border-radius: 0 6px 6px 0;
      }
      hr {
        border: none;
        border-top: 1px solid #eee;
        margin: 32px 0;
      }
      .severity-high {
        color: #c62828;
        font-weight: 600;
      }
      .severity-medium {
        color: #ef6c00;
        font-weight: 600;
      }
      .success {
        color: #2e7d32;
      }
      code {
        background: #f0f0f0;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 0.9em;
      }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
  }

  markdownToHTML(md) {
    let html = md;
    
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
    
    html = html.replace(/^\|(.*)\|$/gim, (match, content) => {
      if (content.includes('---') || content.includes('指标')) {
        return match;
      }
      return `<tr>${content.split('|').map(cell => cell.trim() ? `<td>${cell.trim()}</td>` : '').join('')}</tr>`;
    });
    
    html = html.replace(/<tr>\|?.*?\|-+.*?\|?<\/tr>/g, '');
    
    html = html.replace(/^---$/gim, '<hr>');
    
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    
    html = html.replace(/(<li>.*?<\/li>\n?)+/g, match => {
      return `<ul>\n${match}</ul>\n`;
    });
    
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/^(?!<[h|u|b|t|p|q])(.*)$/gm, '<p>$1</p>');
    
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<[h|u|b|t|q])/g, '$1');
    html = html.replace(/(<\/[h|u|b|t|q].*>)<\/p>/g, '$1');
    
    html = html.replace(/🔴/g, '<span class="severity-high">🔴</span>');
    html = html.replace(/🟡/g, '<span class="severity-medium">🟡</span>');
    html = html.replace(/✅/g, '<span class="success">✅</span>');
    
    return html;
  }

  countUniqueSKUs(orders) {
    const skus = new Set();
    orders.forEach(order => {
      order.items.forEach(item => skus.add(item.skuCode));
    });
    return skus.size;
  }

  countTotalQuantity(orders) {
    return orders.reduce((sum, order) => sum + order.getTotalQuantity(), 0);
  }

  downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadMarkdown(data) {
    const content = this.generateMarkdown(data);
    const filename = `warehouse-picking-report-${Date.now()}.md`;
    this.downloadFile(content, filename, 'text/markdown');
  }

  downloadHTML(data) {
    const content = this.generateHTML(data);
    const filename = `warehouse-picking-report-${Date.now()}.html`;
    this.downloadFile(content, filename, 'text/html');
  }
}
