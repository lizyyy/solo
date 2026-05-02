export class Exporter {
  static exportLoadPlan(tray, instruments, warnings) {
    const plan = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      tray: tray,
      instruments: instruments.map(inst => ({
        id: inst.id,
        name: inst.name,
        type: inst.type,
        dimensions: {
          width: inst.width,
          depth: inst.depth,
          height: inst.height
        },
        position: inst.position,
        rotation: inst.rotation
      })),
      summary: {
        totalInstruments: instruments.length,
        totalWeight: instruments.reduce((sum, i) => sum + i.weight, 0),
        warnings: warnings.length,
        errors: warnings.filter(w => w.type === 'ERROR').length
      }
    };
    
    return JSON.stringify(plan, null, 2);
  }
  
  static exportRiskReport(tray, instruments, warnings) {
    const errorCount = warnings.filter(w => w.type === 'ERROR').length;
    const warningCount = warnings.filter(w => w.type === 'WARNING').length;
    
    let report = `# 灭菌装载风险报告\n\n`;
    report += `**生成时间**: ${new Date().toLocaleString()}\n\n`;
    report += `## 托盘信息\n\n`;
    report += `- 名称: ${tray.name}\n`;
    report += `- 规格: ${tray.width} × ${tray.depth} × ${tray.maxHeight} mm\n\n`;
    report += `## 器械清单\n\n`;
    report += `| 编号 | 名称 | 类型 | 尺寸 (W×D×H) | 位置 |\n`;
    report += `|------|------|------|--------------|------|\n`;
    instruments.forEach(inst => {
      report += `| ${inst.id} | ${inst.name} | ${inst.type} | ${inst.width}×${inst.depth}×${inst.height} | (${inst.position.x.toFixed(1)}, ${inst.position.y.toFixed(1)}, ${inst.position.z.toFixed(1)}) |\n`;
    });
    report += `\n## 风险评估\n\n`;
    report += `- **错误数量**: ${errorCount}\n`;
    report += `- **警告数量**: ${warningCount}\n\n`;
    
    if (warnings.length > 0) {
      report += `### 详细问题\n\n`;
      warnings.forEach((w, i) => {
        const icon = w.type === 'ERROR' ? '❌' : '⚠️';
        report += `${i + 1}. ${icon} ${w.message}\n`;
      });
    } else {
      report += `✅ 无问题，装载符合规范。\n`;
    }
    
    return report;
  }
  
  static downloadFile(content, filename, type) {
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
}
