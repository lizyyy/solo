import { ExcavationSquare, Artifact, ValidationError } from '../types';
import { getTypeLabel } from './filterEngine';

export const generateReportHTML = (
  data: ExcavationSquare,
  filteredArtifacts: Artifact[],
  errors: ValidationError[]
): string => {
  const artifactTypeStats = getArtifactTypeStats(filteredArtifacts);
  const periodStats = getPeriodStats(filteredArtifacts);

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>考古探方分层报告 - ${data.name}</title>
    <style>
        body {
            font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1000px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #faf8f5;
        }
        h1 {
            color: #5D4037;
            border-bottom: 3px solid #D4A574;
            padding-bottom: 15px;
            margin-bottom: 30px;
        }
        h2 {
            color: #6B5B4F;
            border-left: 4px solid #C75B39;
            padding-left: 15px;
            margin-top: 40px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #5D4037;
            color: white;
            font-weight: 600;
        }
        tr:nth-child(even) {
            background: #f5f2ed;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-top: 4px solid #D4A574;
        }
        .stat-number {
            font-size: 32px;
            font-weight: bold;
            color: #5D4037;
        }
        .stat-label {
            color: #888;
            font-size: 14px;
        }
        .error {
            background: #fee;
            color: #c00;
            padding: 10px;
            border-radius: 4px;
            margin: 8px 0;
        }
        .layer-box {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 1px solid #999;
            vertical-align: middle;
            margin-right: 10px;
        }
        .meta-info {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .meta-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .meta-label {
            width: 150px;
            font-weight: 600;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>考古探方分层报告</h1>
    
    <div class="meta-info">
        <div class="meta-row">
            <span class="meta-label">探方名称：</span>
            <span>${data.name}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">探方编号：</span>
            <span>${data.id.toUpperCase()}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">探方尺寸：</span>
            <span>${data.gridSize.x} × ${data.gridSize.y} × ${data.gridSize.z} ${data.unit}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">层位总数：</span>
            <span>${data.layers.length} 层</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">出土物总数：</span>
            <span>${data.artifacts.length} 件</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">筛选后出土物：</span>
            <span>${filteredArtifacts.length} 件</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">报告生成时间：</span>
            <span>${new Date().toLocaleString('zh-CN')}</span>
        </div>
    </div>

    <h2>一、统计概览</h2>
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">${data.layers.length}</div>
            <div class="stat-label">文化层数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${filteredArtifacts.length}</div>
            <div class="stat-label">出土文物</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${new Set(filteredArtifacts.map(a => a.period)).size}</div>
            <div class="stat-label">历史时期</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${errors.length}</div>
            <div class="stat-label">数据问题</div>
        </div>
    </div>

    <h2>二、层位信息</h2>
    <table>
        <tr>
            <th>序号</th>
            <th>层位名称</th>
            <th>颜色</th>
            <th>深度范围</th>
            <th>厚度</th>
            <th>年代</th>
            <th>出土物数量</th>
        </tr>
        ${data.layers
          .map(
            (layer, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${layer.name}</td>
            <td><span class="layer-box" style="background:${layer.color}"></span>${layer.color}</td>
            <td>${layer.depthTop} - ${layer.depthBottom} ${data.unit}</td>
            <td>${layer.depthBottom - layer.depthTop} ${data.unit}</td>
            <td>${layer.period}</td>
            <td>${filteredArtifacts.filter(a => a.layerId === layer.id).length} 件</td>
        </tr>
        `
          )
          .join('')}
    </table>

    <h2>三、出土物类型统计</h2>
    <table>
        <tr>
            <th>类型</th>
            <th>数量</th>
            <th>占比</th>
        </tr>
        ${artifactTypeStats
          .map(
            (stat) => `
        <tr>
            <td>${stat.label}</td>
            <td>${stat.count} 件</td>
            <td>${stat.percentage}%</td>
        </tr>
        `
          )
          .join('')}
    </table>

    <h2>四、年代分布统计</h2>
    <table>
        <tr>
            <th>年代</th>
            <th>数量</th>
            <th>占比</th>
        </tr>
        ${periodStats
          .map(
            (stat) => `
        <tr>
            <td>${stat.period}</td>
            <td>${stat.count} 件</td>
            <td>${stat.percentage}%</td>
        </tr>
        `
          )
          .join('')}
    </table>

    <h2>五、出土物详细清单</h2>
    <table>
        <tr>
            <th>编号</th>
            <th>名称</th>
            <th>类型</th>
            <th>坐标 (X, Y, Z)</th>
            <th>所属层位</th>
            <th>年代</th>
            <th>描述</th>
        </tr>
        ${filteredArtifacts
          .map(
            (artifact) => `
        <tr>
            <td>${artifact.artifactId}</td>
            <td>${artifact.name}</td>
            <td>${getTypeLabel(artifact.type)}</td>
            <td>(${artifact.position.x}, ${artifact.position.y}, ${artifact.position.z})</td>
            <td>${data.layers.find((l) => l.id === artifact.layerId)?.name || artifact.layerId}</td>
            <td>${artifact.period}</td>
            <td>${artifact.description}</td>
        </tr>
        `
          )
          .join('')}
    </table>

    ${errors.length > 0 ? `
    <h2>六、数据问题提示</h2>
    ${errors.map((e) => `<div class="error">⚠️ ${e.message}</div>`).join('')}
    ` : ''}

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888;">
        <p>本报告由考古探方分层查看系统自动生成</p>
    </footer>
</body>
</html>
  `;
};

const getArtifactTypeStats = (artifacts: Artifact[]) => {
  const counts: Record<string, number> = {};
  artifacts.forEach((a) => {
    const label = getTypeLabel(a.type);
    counts[label] = (counts[label] || 0) + 1;
  });
  const total = artifacts.length || 1;
  return Object.entries(counts).map(([label, count]) => ({
    label,
    count,
    percentage: ((count / total) * 100).toFixed(1),
  }));
};

const getPeriodStats = (artifacts: Artifact[]) => {
  const counts: Record<string, number> = {};
  artifacts.forEach((a) => {
    counts[a.period] = (counts[a.period] || 0) + 1;
  });
  const total = artifacts.length || 1;
  return Object.entries(counts).map(([period, count]) => ({
    period,
    count,
    percentage: ((count / total) * 100).toFixed(1),
  }));
};

export const downloadReport = (
  data: ExcavationSquare,
  filteredArtifacts: Artifact[],
  errors: ValidationError[]
): void => {
  const html = generateReportHTML(data, filteredArtifacts, errors);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.name}_考古报告_${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
