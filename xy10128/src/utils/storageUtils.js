const STORAGE_KEY = 'medical_instrument_setups';

export function serializeSetup(name, instruments, validationResults) {
  const instrumentData = [];
  
  Object.values(instruments).forEach(instrument => {
    if (instrument.userData.isInstrument) {
      instrumentData.push({
        id: instrument.userData.id,
        typeKey: instrument.userData.typeKey,
        type: instrument.userData.type,
        name: instrument.userData.name,
        position: {
          x: instrument.position.x,
          y: instrument.position.y - 0.91,
          z: instrument.position.z
        },
        rotation: {
          x: instrument.rotation.x,
          y: instrument.rotation.y,
          z: instrument.rotation.z
        }
      });
    }
  });

  const setup = {
    id: Date.now().toString(),
    name,
    createdAt: new Date().toISOString(),
    instruments: instrumentData,
    validation: validationResults ? {
      isValid: validationResults.isValid,
      hasWarnings: validationResults.hasWarnings,
      totalIssues: validationResults.issues.length,
      summary: validationResults
    } : null
  };

  return setup;
}

export function saveSetup(name, instruments, validationResults) {
  try {
    const setup = serializeSetup(name, instruments, validationResults);
    const setups = getAllSetups();
    setups.push(setup);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
    return setup;
  } catch (error) {
    console.error('Failed to save setup:', error);
    throw error;
  }
}

export function getAllSetups() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get setups:', error);
    return [];
  }
}

export function getSetupById(setupId) {
  const setups = getAllSetups();
  return setups.find(s => s.id === setupId);
}

export function deleteSetup(setupId) {
  try {
    const setups = getAllSetups();
    const filtered = setups.filter(s => s.id !== setupId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Failed to delete setup:', error);
    return false;
  }
}

export function exportSetupAsJSON(setup) {
  const dataStr = JSON.stringify(setup, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `setup_${setup.name}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importSetupFromJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    throw error;
  }
}

export function generateValidationReport(setup, validationResults, instruments) {
  const report = {
    reportTitle: '医疗器械摆台三维校验报告',
    generatedAt: new Date().toISOString(),
    setupName: setup.name,
    setupId: setup.id,
    createdDate: setup.createdAt,
    summary: {
      totalInstruments: Object.keys(instruments).length,
      totalIssues: validationResults.issues.length,
      highSeverity: validationResults.highSeverityIssues.length,
      mediumSeverity: validationResults.mediumSeverityIssues.length,
      lowSeverity: validationResults.lowSeverityIssues.length,
      isValid: validationResults.isValid,
      hasWarnings: validationResults.hasWarnings,
      overallStatus: validationResults.isValid 
        ? (validationResults.hasWarnings ? '通过（有警告）' : '通过')
        : '不通过'
    },
    instruments: [],
    collisions: validationResults.collisions.map(c => ({
      type: '碰撞',
      instruments: [c.instrument1Name, c.instrument2Name],
      distance: c.distance.toFixed(3) + 'm',
      severity: '高',
      recommendation: '将器械分开，确保不发生物理接触'
    })),
    distanceViolations: validationResults.distanceViolations.map(v => ({
      type: '最小间距',
      instruments: [v.instrument1Name, v.instrument2Name],
      actualDistance: v.actualDistance.toFixed(3) + 'm',
      requiredDistance: v.requiredDistance.toFixed(3) + 'm',
      deficit: v.deficit.toFixed(3) + 'm',
      severity: '中',
      recommendation: `增加间距至少 ${v.deficit.toFixed(3)}m`
    })),
    boundaryViolations: validationResults.boundaryViolations.map(v => ({
      type: '边界越界',
      instrument: v.instrumentName,
      outsideDistance: v.outsideDistance.toFixed(3) + 'm',
      position: `X: ${v.position.x.toFixed(3)}m, Z: ${v.position.z.toFixed(3)}m`,
      severity: '高',
      recommendation: '将器械移回无菌区范围内'
    })),
    pathwayObstructions: validationResults.pathwayObstructions.map(v => ({
      type: '路径遮挡',
      instrument: v.instrumentName,
      overlapArea: v.overlapArea.toFixed(3) + 'm²',
      severity: v.severity === 'high' ? '高' : '中',
      recommendation: '将器械移离手术取用路径区域'
    })),
    instrumentDetails: []
  };

  Object.values(instruments).forEach(instrument => {
    const config = instrument.userData.config;
    const center = {
      x: instrument.position.x,
      y: instrument.position.y,
      z: instrument.position.z
    };

    report.instruments.push({
      id: instrument.userData.id,
      type: config.type,
      name: config.name,
      position: {
        x: center.x.toFixed(3),
        y: center.y.toFixed(3),
        z: center.z.toFixed(3)
      },
      rotation: {
        x: (instrument.rotation.x * 180 / Math.PI).toFixed(1) + '°',
        y: (instrument.rotation.y * 180 / Math.PI).toFixed(1) + '°',
        z: (instrument.rotation.z * 180 / Math.PI).toFixed(1) + '°'
      },
      dimensions: {
        width: config.width + 'm',
        height: config.height + 'm',
        depth: config.depth + 'm'
      },
      sterile: config.sterile,
      minDistance: config.minDistance + 'm'
    });

    const instrumentIssues = validationResults.issues.filter(issue => 
      issue.instrument === instrument.userData.id ||
      issue.instrument1 === instrument.userData.id ||
      issue.instrument2 === instrument.userData.id
    );

    report.instrumentDetails.push({
      instrument: config.name,
      issues: instrumentIssues.length,
      issueTypes: instrumentIssues.map(i => {
        if (i.type === 'collision') return '碰撞';
        if (i.type === 'min_distance') return '最小间距';
        if (i.type === 'boundary') return '边界越界';
        if (i.type === 'pathway') return '路径遮挡';
        return i.type;
      })
    });
  });

  return report;
}

export function exportReportAsJSON(report) {
  const dataStr = JSON.stringify(report, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `validation_report_${report.setupName}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportReportAsText(report) {
  let text = `══════════════════════════════════════════════\n`;
  text += `      医疗器械摆台三维校验报告\n`;
  text += `══════════════════════════════════════════════\n\n`;
  text += `报告生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}\n`;
  text += `方案名称: ${report.setupName}\n`;
  text += `创建时间: ${new Date(report.createdDate).toLocaleString('zh-CN')}\n\n`;
  text += `──────────────────────────────────────────────\n`;
  text += `                  总体概况\n`;
  text += `──────────────────────────────────────────────\n\n`;
  text += `器械总数: ${report.summary.totalInstruments}\n`;
  text += `问题总数: ${report.summary.totalIssues}\n`;
  text += `  高严重度: ${report.summary.highSeverity}\n`;
  text += `  中严重度: ${report.summary.mediumSeverity}\n`;
  text += `  低严重度: ${report.summary.lowSeverity}\n\n`;
  text += `总体状态: ${report.summary.overallStatus}\n\n`;

  if (report.collisions.length > 0) {
    text += `──────────────────────────────────────────────\n`;
    text += `                碰撞问题\n`;
    text += `──────────────────────────────────────────────\n\n`;
    report.collisions.forEach((c, i) => {
      text += `${i + 1}. ${c.instruments[0]} 和 ${c.instruments[1]}\n`;
      text += `   距离: ${c.distance}\n`;
      text += `   严重度: ${c.severity}\n`;
      text += `   建议: ${c.recommendation}\n\n`;
    });
  }

  if (report.distanceViolations.length > 0) {
    text += `──────────────────────────────────────────────\n`;
    text += `              最小间距问题\n`;
    text += `──────────────────────────────────────────────\n\n`;
    report.distanceViolations.forEach((v, i) => {
      text += `${i + 1}. ${v.instruments[0]} 和 ${v.instruments[1]}\n`;
      text += `   实际距离: ${v.actualDistance}\n`;
      text += `   要求距离: ${v.requiredDistance}\n`;
      text += `   差值: ${v.deficit}\n`;
      text += `   严重度: ${v.severity}\n`;
      text += `   建议: ${v.recommendation}\n\n`;
    });
  }

  if (report.boundaryViolations.length > 0) {
    text += `──────────────────────────────────────────────\n`;
    text += `              边界越界问题\n`;
    text += `──────────────────────────────────────────────\n\n`;
    report.boundaryViolations.forEach((v, i) => {
      text += `${i + 1}. ${v.instrument}\n`;
      text += `   越界距离: ${v.outsideDistance}\n`;
      text += `   位置: ${v.position}\n`;
      text += `   严重度: ${v.severity}\n`;
      text += `   建议: ${v.recommendation}\n\n`;
    });
  }

  if (report.pathwayObstructions.length > 0) {
    text += `──────────────────────────────────────────────\n`;
    text += `              路径遮挡问题\n`;
    text += `──────────────────────────────────────────────\n\n`;
    report.pathwayObstructions.forEach((v, i) => {
      text += `${i + 1}. ${v.instrument}\n`;
      text += `   重叠面积: ${v.overlapArea}\n`;
      text += `   严重度: ${v.severity}\n`;
      text += `   建议: ${v.recommendation}\n\n`;
    });
  }

  text += `──────────────────────────────────────────────\n`;
  text += `                器械详情\n`;
  text += `──────────────────────────────────────────────\n\n`;
  report.instruments.forEach((inst, i) => {
    text += `${i + 1}. ${inst.name} (${inst.type})\n`;
    text += `   位置: X:${inst.position.x}, Y:${inst.position.y}, Z:${inst.position.z}\n`;
    text += `   旋转: X:${inst.rotation.x}, Y:${inst.rotation.y}, Z:${inst.rotation.z}\n`;
    text += `   尺寸: ${inst.dimensions.width} × ${inst.dimensions.height} × ${inst.dimensions.depth}\n`;
    text += `   最小间距: ${inst.minDistance}\n`;
    text += `   无菌: ${inst.sterile ? '是' : '否'}\n\n`;
  });

  text += `══════════════════════════════════════════════\n`;
  text += `                报告结束\n`;
  text += `══════════════════════════════════════════════\n`;

  return text;
}

export function exportReport(report, format = 'text') {
  if (format === 'json') {
    exportReportAsJSON(report);
  } else {
    const text = exportReportAsText(report);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation_report_${report.setupName}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
