export function generateReport(objects, anomalies, boundary = null) {
  const parkingSpots = objects.filter(o => o.type === 'parking');
  const fireLanes = objects.filter(o => o.type === 'fireLane');
  const turningAreas = objects.filter(o => o.type === 'turningRadius');
  const obstacles = objects.filter(o => o.type === 'obstacle');

  const totalArea = parkingSpots.reduce((sum, s) => sum + s.width * s.length, 0);
  const fireLaneArea = fireLanes.reduce((sum, f) => sum + f.width * f.length, 0);

  const date = new Date();
  const timestamp = date.toLocaleString('zh-CN');

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>停车场规划报告</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    h1 { color: #16213e; border-bottom: 3px solid #e94560; padding-bottom: 10px; }
    h2 { color: #0f3460; margin-top: 30px; }
    .summary { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
    .summary-card { background: #f5f5f5; padding: 20px; border-radius: 8px; flex: 1; min-width: 150px; }
    .summary-card .label { font-size: 14px; color: #666; }
    .summary-card .value { font-size: 28px; font-weight: bold; color: #e94560; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #16213e; color: white; }
    tr:hover { background: #f5f5f5; }
    .anomaly-item { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .anomaly-item.warning { background: #fff3e0; border-left-color: #ff9800; }
    .anomaly-item h4 { margin: 0 0 5px 0; }
    .anomaly-item p { margin: 3px 0; color: #555; }
    .success { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>停车场泊位规划报告</h1>
  <p>生成时间: ${timestamp}</p>
  
  <h2>方案概览</h2>
  <div class="summary">
    <div class="summary-card">
      <div class="label">泊位数量</div>
      <div class="value">${parkingSpots.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">消防通道</div>
      <div class="value">${fireLanes.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">转弯区域</div>
      <div class="value">${turningAreas.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">障碍物</div>
      <div class="value">${obstacles.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">异常数量</div>
      <div class="value" style="color: ${anomalies.length > 0 ? '#f44336' : '#4caf50'}">${anomalies.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">边界校验</div>
      <div class="value" style="color: ${boundary ? '#4caf50' : '#9e9e9e'}">${boundary ? '已启用' : '未启用'}</div>
    </div>
  </div>
`;

  if (boundary) {
    html += `
  <h2>边界信息</h2>
  <table>
    <thead>
      <tr>
        <th>参数</th>
        <th>值 (米)</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>左边界 X</td><td>${boundary.minX.toFixed(2)}</td></tr>
      <tr><td>右边界 X</td><td>${boundary.maxX.toFixed(2)}</td></tr>
      <tr><td>下边界 Y</td><td>${boundary.minY.toFixed(2)}</td></tr>
      <tr><td>上边界 Y</td><td>${boundary.maxY.toFixed(2)}</td></tr>
      <tr><td>边界宽度</td><td>${(boundary.maxX - boundary.minX).toFixed(2)} m</td></tr>
      <tr><td>边界高度</td><td>${(boundary.maxY - boundary.minY).toFixed(2)} m</td></tr>
    </tbody>
  </table>
`;
  }

  html += `
  <h2>面积统计</h2>
  <div class="summary">
    <div class="summary-card">
      <div class="label">泊位总面积</div>
      <div class="value">${totalArea.toFixed(2)} m²</div>
    </div>
    <div class="summary-card">
      <div class="label">消防通道面积</div>
      <div class="value">${fireLaneArea.toFixed(2)} m²</div>
    </div>
  </div>
`;

  if (parkingSpots.length > 0) {
    html += `
  <h2>泊位详情</h2>
  <table>
    <thead>
      <tr>
        <th>编号</th>
        <th>X坐标 (m)</th>
        <th>Y坐标 (m)</th>
        <th>宽度 (m)</th>
        <th>长度 (m)</th>
        <th>角度 (°)</th>
        <th>面积 (m²)</th>
      </tr>
    </thead>
    <tbody>
`;
    for (const spot of parkingSpots) {
      html += `
      <tr>
        <td>${spot.label}</td>
        <td>${spot.x.toFixed(2)}</td>
        <td>${spot.y.toFixed(2)}</td>
        <td>${spot.width.toFixed(2)}</td>
        <td>${spot.length.toFixed(2)}</td>
        <td>${spot.angle.toFixed(0)}</td>
        <td>${(spot.width * spot.length).toFixed(2)}</td>
      </tr>`;
    }
    html += `
    </tbody>
  </table>`;
  }

  if (fireLanes.length > 0) {
    html += `
  <h2>消防通道详情</h2>
  <table>
    <thead>
      <tr>
        <th>编号</th>
        <th>X坐标 (m)</th>
        <th>Y坐标 (m)</th>
        <th>宽度 (m)</th>
        <th>长度 (m)</th>
        <th>面积 (m²)</th>
      </tr>
    </thead>
    <tbody>
`;
    for (const lane of fireLanes) {
      html += `
      <tr>
        <td>${lane.label}</td>
        <td>${lane.x.toFixed(2)}</td>
        <td>${lane.y.toFixed(2)}</td>
        <td>${lane.width.toFixed(2)}</td>
        <td>${lane.length.toFixed(2)}</td>
        <td>${(lane.width * lane.length).toFixed(2)}</td>
      </tr>`;
    }
    html += `
    </tbody>
  </table>`;
  }

  if (turningAreas.length > 0) {
    html += `
  <h2>转弯区域详情</h2>
  <table>
    <thead>
      <tr>
        <th>编号</th>
        <th>圆心X (m)</th>
        <th>圆心Y (m)</th>
        <th>半径 (m)</th>
      </tr>
    </thead>
    <tbody>
`;
    for (const ta of turningAreas) {
      html += `
      <tr>
        <td>${ta.label}</td>
        <td>${ta.x.toFixed(2)}</td>
        <td>${ta.y.toFixed(2)}</td>
        <td>${ta.radius.toFixed(2)}</td>
      </tr>`;
    }
    html += `
    </tbody>
  </table>`;
  }

  html += `
  <h2>异常检测结果</h2>
`;

  if (anomalies.length === 0) {
    html += `
  <div class="success">
    <h4>✓ 未检测到异常</h4>
    <p>所有元素布局合规，无碰撞、无消防通道占用、无转弯半径侵入。</p>
  </div>`;
  } else {
    for (const anomaly of anomalies) {
      let typeLabel = '';
      let severity = 'error';
      switch (anomaly.type) {
        case 'collision':
          typeLabel = '对象重叠';
          break;
        case 'fireLane':
          typeLabel = '消防通道占用';
          break;
        case 'turningRadius':
          typeLabel = '转弯区域侵入';
          severity = 'warning';
          break;
        case 'boundary':
          typeLabel = '超出边界';
          break;
      }

      let detail = anomaly.message;
      if (anomaly.objectA && anomaly.objectB) {
        detail += ` (涉及: ${anomaly.objectA.label}, ${anomaly.objectB.label})`;
      } else if (anomaly.object) {
        detail += ` (涉及: ${anomaly.object.label})`;
      }

      html += `
  <div class="anomaly-item ${severity}">
    <h4>【${typeLabel}】</h4>
    <p>${detail}</p>
  </div>`;
    }
  }

  html += `
</body>
</html>`;

  return html;
}

export function downloadReport(html, filename = 'parking-report.html') {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function savePlan(objects, boundary = null, filename = 'parking-plan.json') {
  const data = {
    version: '1.1',
    createdAt: new Date().toISOString(),
    objects: objects.map(o => o.toJSON()),
    boundary: boundary
  };

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
