class ReportGenerator {
  generateReport(options = {}) {
    const { elements, collisionResults, stageSize, timestamp } = options;
    
    const collisionCount = collisionResults.collisions.filter(c => c.type === 'collision').length;
    const warningCount = collisionResults.collisions.filter(c => c.type === 'warning').length;
    const boundaryCount = collisionResults.boundaryViolations.length;
    
    const html = this.generateHTMLReport({
      elements,
      collisionResults,
      stageSize,
      timestamp,
      collisionCount,
      warningCount,
      boundaryCount
    });
    
    const csv = this.generateCSVReport({
      elements,
      collisionResults,
      timestamp
    });
    
    return { html, csv };
  }

  generateHTMLReport(data) {
    const { elements, collisionResults, stageSize, timestamp, collisionCount, warningCount, boundaryCount } = data;
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>舞台灯位碰撞检测报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 40px;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a1a2e;
      margin-bottom: 20px;
      border-bottom: 3px solid #e94560;
      padding-bottom: 10px;
    }
    .metadata {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
    }
    .metadata p { margin: 8px 0; }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card.collision { background: #ffebee; border-left: 4px solid #dc3545; }
    .summary-card.warning { background: #fff8e1; border-left: 4px solid #ffc107; }
    .summary-card.ok { background: #e8f5e9; border-left: 4px solid #28a745; }
    .summary-number {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .summary-label { font-size: 14px; color: #666; }
    h2 {
      margin: 30px 0 15px;
      color: #1a1a2e;
      font-size: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #1a1a2e;
      color: white;
      font-weight: 500;
    }
    tr:hover { background: #f8f9fa; }
    .collision-item {
      padding: 15px;
      margin: 10px 0;
      border-radius: 6px;
    }
    .collision-item.error { background: #ffebee; border-left: 4px solid #dc3545; }
    .collision-item.warning { background: #fff8e1; border-left: 4px solid #ffc107; }
    .collision-item.boundary { background: #fff3e0; border-left: 4px solid #ff9800; }
    .type-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .type-light-rig { background: #e3f2fd; color: #1565c0; }
    .type-curtain { background: #fce4ec; color: #880e4f; }
    .type-camera { background: #f3e5f5; color: #4a148c; }
  </style>
</head>
<body>
  <div class="container">
    <h1>舞台灯位碰撞检测报告</h1>
    
    <div class="metadata">
      <p><strong>报告生成时间：</strong>${this.formatTimestamp(timestamp)}</p>
      <p><strong>舞台尺寸：</strong>${stageSize.width}m × ${stageSize.height}m × ${stageSize.depth}m</p>
      <p><strong>元素总数：</strong>${elements.length} 个</p>
    </div>
    
    <div class="summary">
      <div class="summary-card collision">
        <div class="summary-number" style="color: #dc3545;">${collisionCount}</div>
        <div class="summary-label">碰撞问题</div>
      </div>
      <div class="summary-card warning">
        <div class="summary-number" style="color: #ffc107;">${warningCount}</div>
        <div class="summary-label">距离警告</div>
      </div>
      <div class="summary-card ${boundaryCount > 0 ? 'warning' : 'ok'}">
        <div class="summary-number" style="color: ${boundaryCount > 0 ? '#ffc107' : '#28a745'};">${boundaryCount}</div>
        <div class="summary-label">边界违规</div>
      </div>
    </div>
    
    <h2>元素列表及位置信息</h2>
    <table>
      <thead>
        <tr>
          <th>名称</th>
          <th>类型</th>
          <th>X坐标</th>
          <th>Y坐标</th>
          <th>Z坐标</th>
          <th>尺寸 (宽×高×深)</th>
        </tr>
      </thead>
      <tbody>
        ${elements.map(el => `
          <tr>
            <td>${el.name}</td>
            <td><span class="type-badge type-${el.type}">${this.formatType(el.type)}</span></td>
            <td>${el.position.x.toFixed(2)} m</td>
            <td>${el.position.y.toFixed(2)} m</td>
            <td>${el.position.z.toFixed(2)} m</td>
            <td>${el.size.width} × ${el.size.height} × ${el.size.depth}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <h2>碰撞检测结果</h2>
    ${collisionResults.collisions.length > 0 ? `
      ${collisionResults.collisions.map(c => `
        <div class="collision-item ${c.type}">
          <strong>${c.type === 'collision' ? '碰撞' : '警告'}：</strong>${c.message}
        </div>
      `).join('')}
    ` : '<p style="color: #28a745; padding: 15px;">未检测到碰撞问题</p>'}
    
    <h2>边界检测结果</h2>
    ${collisionResults.boundaryViolations.length > 0 ? `
      ${collisionResults.boundaryViolations.map(b => `
        <div class="collision-item boundary">
          <strong>边界违规：</strong>${b.element} - ${b.message}
        </div>
      `).join('')}
    ` : '<p style="color: #28a745; padding: 15px;">所有元素均在舞台边界内</p>'}
    
    <h2>元素间距信息</h2>
    <table>
      <thead>
        <tr>
          <th>元素1</th>
          <th>元素2</th>
          <th>中心距离</th>
        </tr>
      </thead>
      <tbody>
        ${collisionResults.distances.map(d => `
          <tr>
            <td>${d.element1}</td>
            <td>${d.element2}</td>
            <td>${d.distance.toFixed(2)} m</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `.trim();
  }

  generateCSVReport(data) {
    const { elements, collisionResults, timestamp } = data;
    
    let csv = '\ufeff';
    
    csv += '舞台灯位碰撞检测报告\n';
    csv += `报告生成时间,${this.formatTimestamp(timestamp)}\n\n`;
    
    csv += '元素列表\n';
    csv += '名称,类型,X坐标,Y坐标,Z坐标,宽度,高度,深度\n';
    elements.forEach(el => {
      csv += `${el.name},${this.formatType(el.type)},${el.position.x.toFixed(2)},${el.position.y.toFixed(2)},${el.position.z.toFixed(2)},${el.size.width},${el.size.height},${el.size.depth}\n`;
    });
    
    csv += '\n碰撞检测结果\n';
    csv += '类型,元素1,元素2,描述\n';
    collisionResults.collisions.forEach(c => {
      csv += `${c.type === 'collision' ? '碰撞' : '警告'},${c.element1},${c.element2},${c.message}\n`;
    });
    
    csv += '\n边界检测结果\n';
    csv += '元素,违规信息\n';
    collisionResults.boundaryViolations.forEach(b => {
      csv += `${b.element},${b.message}\n`;
    });
    
    csv += '\n元素间距信息\n';
    csv += '元素1,元素2,中心距离(m)\n';
    collisionResults.distances.forEach(d => {
      csv += `${d.element1},${d.element2},${d.distance.toFixed(2)}\n`;
    });
    
    return csv;
  }

  formatTimestamp(timestamp) {
    if (!timestamp) timestamp = new Date();
    return timestamp.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  formatType(type) {
    const typeMap = {
      'light-rig': '灯架',
      'curtain': '幕布',
      'camera': '摄像机'
    };
    return typeMap[type] || type;
  }
}

export default ReportGenerator;
