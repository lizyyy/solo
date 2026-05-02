import { Borehole, ValidationIssue } from '../types';

export function exportToJson(boreholes: Borehole[], issues: ValidationIssue[]): string {
  const data = {
    exportDate: new Date().toISOString(),
    boreholes: boreholes.map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      groundElevation: b.groundElevation,
      waterLevel: b.waterLevel,
      totalDepth: b.totalDepth,
      layers: b.layers.map(l => ({
        id: l.id,
        layerIndex: l.layerIndex,
        topDepth: l.topDepth,
        bottomDepth: l.bottomDepth,
        thickness: l.thickness,
        soilType: l.soilType,
        soilCode: l.soilCode,
        description: l.description,
        hasSample: l.hasSample,
        sampleId: l.sampleId,
        isContaminated: l.isContaminated,
        contaminantType: l.contaminantType,
        contaminantLevel: l.contaminantLevel,
        mark: l.mark,
      })),
    })),
    validationIssues: issues,
  };
  return JSON.stringify(data, null, 2);
}

export function exportToCsv(boreholes: Borehole[]): string {
  const headers = [
    '钻孔编号', 'X坐标', 'Y坐标', '地面标高', '地下水位',
    '层号', '层顶深度', '层底深度', '厚度', '土类', '土类代码',
    '描述', '是否采样', '样品编号', '是否污染', '污染物类型', '污染浓度',
    '标记状态', '标记时间'
  ];

  const rows: string[][] = [headers];

  boreholes.forEach(borehole => {
    borehole.layers.forEach(layer => {
      const markType = layer.mark ? layer.mark.type : 'none';
      const markTime = layer.mark ? new Date(layer.mark.timestamp).toLocaleString('zh-CN') : '';
      
      rows.push([
        borehole.id,
        borehole.x.toFixed(2),
        borehole.y.toFixed(2),
        borehole.groundElevation.toFixed(2),
        borehole.waterLevel !== undefined ? borehole.waterLevel.toFixed(2) : '',
        layer.layerIndex.toString(),
        layer.topDepth.toFixed(2),
        layer.bottomDepth.toFixed(2),
        layer.thickness.toFixed(2),
        layer.soilType,
        layer.soilCode,
        layer.description,
        layer.hasSample ? '是' : '否',
        layer.sampleId || '',
        layer.isContaminated ? '是' : '否',
        layer.contaminantType || '',
        layer.contaminantLevel !== undefined ? layer.contaminantLevel.toFixed(4) : '',
        markType,
        markTime,
      ]);
    });
  });

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

export function exportToMarkdown(
  boreholes: Borehole[],
  issues: ValidationIssue[],
  projectName?: string
): string {
  const now = new Date().toLocaleString('zh-CN');
  const name = projectName || '钻孔地层勘察报告';

  let md = `# ${name}\n\n`;
  md += `> 生成时间: ${now}\n\n`;

  md += `## 数据概览\n\n`;
  md += `- **钻孔总数**: ${boreholes.length} 个\n`;
  
  const totalLayers = boreholes.reduce((sum, b) => sum + b.layers.length, 0);
  md += `- **地层总数**: ${totalLayers} 层\n`;
  
  const maxDepth = boreholes.length > 0 
    ? Math.max(...boreholes.map(b => b.totalDepth)) 
    : 0;
  md += `- **最大钻探深度**: ${maxDepth.toFixed(2)}m\n\n`;

  const markedLayers = boreholes.reduce(
    (sum, b) => sum + b.layers.filter(l => l.mark && l.mark.type !== 'none').length, 
    0
  );
  
  md += `## 标记统计\n\n`;
  md += `- **总标记层**: ${markedLayers} 层\n`;
  
  const suspicious = boreholes.reduce(
    (sum, b) => sum + b.layers.filter(l => l.mark?.type === 'suspicious').length, 
    0
  );
  const confirmed = boreholes.reduce(
    (sum, b) => sum + b.layers.filter(l => l.mark?.type === 'confirmed').length, 
    0
  );
  const danger = boreholes.reduce(
    (sum, b) => sum + b.layers.filter(l => l.mark?.type === 'danger').length, 
    0
  );
  
  md += `- ⚠️ **可疑层**: ${suspicious} 层\n`;
  md += `- ✓ **已确认**: ${confirmed} 层\n`;
  md += `- 🚨 **重点关注**: ${danger} 层\n\n`;

  md += `## 校验结果\n\n`;
  
  if (issues.length === 0) {
    md += `✅ **所有数据校验通过，未发现问题**\n\n`;
  } else {
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    
    md += `- ❌ **错误**: ${errors} 项\n`;
    md += `- ⚠️ **警告**: ${warnings} 项\n\n`;

    md += `### 详细问题列表\n\n`;
    
    issues.forEach(issue => {
      const icon = issue.severity === 'error' ? '❌' : '⚠️';
      md += `#### ${icon} [${issue.boreholeId}] ${issue.type}\n\n`;
      md += `${issue.message}\n\n`;
      
      if (Object.keys(issue.details).length > 0) {
        md += `| 字段 | 值 |\n|------|-----|\n`;
        Object.entries(issue.details).forEach(([key, value]) => {
          md += `| ${key} | ${value ?? '-'} |\n`;
        });
        md += `\n`;
      }
    });
  }

  md += `## 钻孔详情\n\n`;
  
  boreholes.forEach(borehole => {
    md += `### 钻孔 ${borehole.id}\n\n`;
    md += `- **坐标**: (${borehole.x.toFixed(2)}, ${borehole.y.toFixed(2)})\n`;
    md += `- **地面标高**: ${borehole.groundElevation.toFixed(2)}m\n`;
    if (borehole.waterLevel !== undefined) {
      md += `- **地下水位**: ${borehole.waterLevel.toFixed(2)}m\n`;
    }
    md += `- **总深度**: ${borehole.totalDepth.toFixed(2)}m\n`;
    md += `- **分层数**: ${borehole.layers.length} 层\n\n`;

    md += `| 层号 | 层顶深度 | 层底深度 | 厚度 | 土类 | 采样 | 污染 | 标记 |\n`;
    md += `|------|----------|----------|------|------|------|------|------|\n`;

    borehole.layers.forEach(layer => {
      const markIcon = layer.mark ? 
        (layer.mark.type === 'suspicious' ? '⚠️' :
         layer.mark.type === 'confirmed' ? '✓' :
         layer.mark.type === 'danger' ? '🚨' : '-') : '-';

      md += `| ${layer.layerIndex} | ${layer.topDepth.toFixed(2)}m | ${layer.bottomDepth.toFixed(2)}m | ${layer.thickness.toFixed(2)}m | ${layer.soilType} | ${layer.hasSample ? '✓' : '-'} | ${layer.isContaminated ? '🚨' : '-'} | ${markIcon} |\n`;
    });

    md += `\n`;

    const markedInBorehole = borehole.layers.filter(l => l.mark && l.mark.type !== 'none');
    if (markedInBorehole.length > 0) {
      md += `#### 标记层详情\n\n`;
      markedInBorehole.forEach(layer => {
        if (!layer.mark) return;
        const markTypeText = 
          layer.mark.type === 'suspicious' ? '可疑' :
          layer.mark.type === 'confirmed' ? '确认正常' :
          layer.mark.type === 'danger' ? '重点关注' : '无';
        
        md += `- **层 ${layer.layerIndex} (${layer.soilType})**\n`;
        md += `  - 标记类型: ${markTypeText}\n`;
        if (layer.mark.note) {
          md += `  - 备注: ${layer.mark.note}\n`;
        }
        md += `  - 标记时间: ${new Date(layer.mark.timestamp).toLocaleString('zh-CN')}\n\n`;
      });
    }
  });

  md += `---\n\n`;
  md += `*本报告由「钻孔地层拼接台」工具自动生成*`;

  return md;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
