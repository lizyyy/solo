import {
  GameState,
  RestorationAction,
  DataGap,
  ActionResult,
  MaterialCompatibility,
  FinalScore,
  Grade,
  RestorationReport,
  Artwork,
  StateSnapshot,
  HistoryEntry,
} from '../types';

export function checkMaterialCompatibility(
  actionMaterials: string[],
  artworkMaterials: string[],
  incompatibleMaterials?: string[]
): MaterialCompatibility {
  const issues: string[] = [];

  if (incompatibleMaterials) {
    for (const incompat of incompatibleMaterials) {
      if (artworkMaterials.some(m => m.includes(incompat) || incompat.includes(m))) {
        issues.push(`材料不兼容：${incompat} 与作品材质可能发生不良反应`);
      }
    }
  }

  return {
    compatible: issues.length === 0,
    issues,
  };
}

export function calculateActionResult(
  action: RestorationAction,
  currentState: GameState,
  dataGaps: DataGap[]
): ActionResult {
  let stainDelta = action.effects.stainDelta || 0;
  let paintDelta = action.effects.paintLayerDelta || 0;
  let structureDelta = action.effects.structureDelta || 0;

  const unresolvedGaps = dataGaps.filter(g => !g.resolved);
  const riskMultiplier = 1 + unresolvedGaps.length * 0.2;

  const compatibility = checkMaterialCompatibility(
    action.materialRequirements,
    currentState.selectedArtwork?.materials || [],
    action.risks.materialIncompatibility
  );

  if (!compatibility.compatible) {
    paintDelta -= 15;
    structureDelta -= 10;
  }

  const consequences: string[] = [...compatibility.issues];
  const artwork = currentState.selectedArtwork;

  if (action.risks.overCleaningChance && artwork) {
    if (Math.random() < action.risks.overCleaningChance * riskMultiplier) {
      paintDelta -= 20;
      consequences.push('过度清洁导致颜料层损伤，部分区域颜料脱落');
    }
  }

  if (action.risks.paintDamageChance && artwork) {
    if (Math.random() < action.risks.paintDamageChance * riskMultiplier) {
      paintDelta -= 15;
      consequences.push('颜料层出现剥落，需后续补色修复');
    }
  }

  if (action.risks.structureDamageChance && artwork) {
    if (Math.random() < action.risks.structureDamageChance * riskMultiplier) {
      structureDelta -= 12;
      consequences.push('结构受损，底材出现轻微撕裂');
    }
  }

  const newStain = Math.max(0, Math.min(100, currentState.currentStain + stainDelta));
  const newPaint = Math.max(0, Math.min(100, currentState.currentPaintLayer + paintDelta));
  const newStructure = Math.max(0, Math.min(100, currentState.currentStructure + structureDelta));
  const newTime = currentState.remainingTime - action.timeCost;

  const feedback = generateFeedback(consequences, compatibility, action, {
    stain: newStain,
    paintLayer: newPaint,
    structure: newStructure,
  });

  return {
    newState: {
      currentStain: newStain,
      currentPaintLayer: newPaint,
      currentStructure: newStructure,
      remainingTime: newTime,
    },
    feedback,
    consequences,
    riskOccurred: consequences.length > 0,
  };
}

function generateFeedback(
  consequences: string[],
  compatibility: MaterialCompatibility,
  action: RestorationAction,
  newState: { stain: number; paintLayer: number; structure: number }
): string {
  if (consequences.length > 0) {
    return `操作完成，但出现${consequences.length}个问题：${consequences[0]}。请评估是否需要后续补救措施。`;
  }

  if (!compatibility.compatible) {
    return '操作完成，但检测到材料兼容性问题，建议后续监测作品状态。';
  }

  const positiveNotes: string[] = [];
  if (action.effects.stainDelta && action.effects.stainDelta < 0) {
    positiveNotes.push(`污渍已减少至${newState.stain}%`);
  }
  if (action.effects.paintLayerDelta && action.effects.paintLayerDelta > 0) {
    positiveNotes.push(`颜料层完整性提升至${newState.paintLayer}%`);
  }
  if (action.effects.structureDelta && action.effects.structureDelta > 0) {
    positiveNotes.push(`结构强度提升至${newState.structure}%`);
  }

  if (positiveNotes.length > 0) {
    return `操作顺利完成。${positiveNotes.join('，')}。`;
  }

  return '操作完成，未检测到明显异常。';
}

export function calculateFinalScore(state: GameState): FinalScore {
  const artwork = state.selectedArtwork!;

  const stainImprovement = artwork.initialStain - state.currentStain;
  const appearance = Math.min(100, (stainImprovement / artwork.initialStain) * 100) * 0.3;

  const structure = ((state.currentPaintLayer + state.currentStructure) / 2) * 0.3;

  const materialCompatibility = calculateMaterialScore(state.usedMaterials, artwork) * 0.2;

  const timeEfficiency = state.remainingTime > 0 ? 100 : 0;

  const riskControl = Math.max(0, 100 - state.riskEvents.length * 25);

  const total = appearance + structure + materialCompatibility + timeEfficiency * 0.1 + riskControl * 0.1;

  return {
    appearance: Math.round(appearance * 10) / 10,
    structure: Math.round(structure * 10) / 10,
    materialCompatibility: Math.round(materialCompatibility * 10) / 10,
    timeEfficiency: Math.round(timeEfficiency * 10) / 10,
    riskControl: Math.round(riskControl * 10) / 10,
    total: Math.round(total * 10) / 10,
    grade: getGrade(total),
  };
}

function calculateMaterialScore(usedMaterials: string[], artwork: Artwork): number {
  if (usedMaterials.length === 0) return 50;

  const compatibleCount = usedMaterials.filter(m => {
    const incompatibleKeywords = ['干性油', '亚麻油', '植物颜料', '水墨', '宣纸', '亚麻画布'];
    const artworkMaterialStr = artwork.materials.join(' ');
    const paintComp = artwork.paintComposition;

    for (const keyword of incompatibleKeywords) {
      if (m.includes(keyword)) {
        if (keyword === '干性油' || keyword === '亚麻油') {
          if (artworkMaterialStr.includes('植物') || artworkMaterialStr.includes('水墨')) {
            return false;
          }
        }
        if (keyword === '植物颜料' || keyword === '水墨') {
          if (paintComp.includes('亚麻油') || paintComp.includes('矿物')) {
            return false;
          }
        }
        if (keyword === '宣纸') {
          if (!artworkMaterialStr.includes('宣纸') && !artworkMaterialStr.includes('纸')) {
            return false;
          }
        }
        if (keyword === '亚麻画布') {
          if (!artworkMaterialStr.includes('亚麻') && !artworkMaterialStr.includes('画布')) {
            return false;
          }
        }
      }
    }
    return true;
  }).length;

  return Math.round((compatibleCount / usedMaterials.length) * 100);
}

function getGrade(total: number): Grade {
  if (total >= 90) return 'S';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  return 'F';
}

export function generateReport(state: GameState): RestorationReport {
  const artwork = state.selectedArtwork!;
  const score = state.finalScore!;

  const initialState: StateSnapshot = {
    stain: artwork.initialStain,
    paintLayer: artwork.initialPaintLayer,
    structure: artwork.initialStructure,
    remainingTime: artwork.timeBudget,
  };

  const finalState: StateSnapshot = {
    stain: state.currentStain,
    paintLayer: state.currentPaintLayer,
    structure: state.currentStructure,
    remainingTime: state.remainingTime,
  };

  return {
    artworkName: artwork.name,
    artworkDescription: artwork.description,
    initialState,
    finalState,
    history: state.history,
    score,
    dataGapsResolved: state.dataGaps.filter(g => g.resolved).length,
    dataGapsTotal: state.dataGaps.length,
    riskEvents: state.riskEvents,
    materialsUsed: state.usedMaterials,
    timestamp: Date.now(),
  };
}

export function formatReportAsText(report: RestorationReport): string {
  const date = new Date(report.timestamp).toLocaleString('zh-CN');

  let text = `
╔══════════════════════════════════════════════════════════════╗
║                    艺术品修复报告                              ║
╠══════════════════════════════════════════════════════════════╣
║  生成时间: ${date.padEnd(45)}║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  【作品信息】                                                 ║
║  ─────────────────────────────────────────────────────────   ║
║  作品名称: ${report.artworkName.padEnd(43)}║
║  作品描述: ${truncate(report.artworkDescription, 43).padEnd(43)}║
║                                                              ║
║  【初始状态】                                                 ║
║  ─────────────────────────────────────────────────────────   ║
║  污渍程度:   ${report.initialState.stain.toString().padStart(3)}%                               ║
║  颜料层完整: ${report.initialState.paintLayer.toString().padStart(3)}%                               ║
║  结构强度:   ${report.initialState.structure.toString().padStart(3)}%                               ║
║  时间预算:   ${report.initialState.remainingTime.toString().padStart(3)} 单位                             ║
║                                                              ║
║  【最终状态】                                                 ║
║  ─────────────────────────────────────────────────────────   ║
║  污渍程度:   ${report.finalState.stain.toString().padStart(3)}%                               ║
║  颜料层完整: ${report.finalState.paintLayer.toString().padStart(3)}%                               ║
║  结构强度:   ${report.finalState.structure.toString().padStart(3)}%                               ║
║  剩余时间:   ${report.finalState.remainingTime.toString().padStart(3)} 单位                             ║
║                                                              ║
║  【修复评分】                                                 ║
║  ─────────────────────────────────────────────────────────   ║
║  综合评级: ${' '.repeat(18)}【${report.score.grade}】${' '.repeat(18)}║
║  总分: ${' '.repeat(22)}${report.score.total.toFixed(1).padStart(6)} / 100${' '.repeat(10)}║
║                                                              ║
║    外观修复:    ${report.score.appearance.toFixed(1).padStart(6)} (权重 30%)${' '.repeat(10)}║
║    结构保存:    ${report.score.structure.toFixed(1).padStart(6)} (权重 30%)${' '.repeat(10)}║
║    材料兼容:    ${report.score.materialCompatibility.toFixed(1).padStart(6)} (权重 20%)${' '.repeat(10)}║
║    时间效率:    ${report.score.timeEfficiency.toFixed(1).padStart(6)} (权重 10%)${' '.repeat(10)}║
║    风险控制:    ${report.score.riskControl.toFixed(1).padStart(6)} (权重 10%)${' '.repeat(10)}║
║                                                              ║
║  【信息缺口处理】                                             ║
║  ─────────────────────────────────────────────────────────   ║
║  已识别并解决: ${report.dataGapsResolved.toString().padStart(2)} / ${report.dataGapsTotal.toString().padStart(2)} 项${' '.repeat(33)}║
║                                                              ║
║  【风险事件记录】                                             ║
║  ─────────────────────────────────────────────────────────   ║
`;

  if (report.riskEvents.length === 0) {
    text += `║  本次修复未发生重大风险事件${' '.repeat(29)}║\n`;
  } else {
    report.riskEvents.forEach((event, i) => {
      text += `║  ${i + 1}. ${truncate(event, 47).padEnd(47)}║\n`;
    });
  }

  text += `║                                                              ║
║  【使用材料】                                                 ║
║  ─────────────────────────────────────────────────────────   ║
`;

  if (report.materialsUsed.length === 0) {
    text += `║  无材料使用记录${' '.repeat(37)}║\n`;
  } else {
    report.materialsUsed.forEach((material, i) => {
      text += `║  ${i + 1}. ${truncate(material, 47).padEnd(47)}║\n`;
    });
  }

  text += `║                                                              ║
║  【修复操作历史】                                             ║
╠══════════════════════════════════════════════════════════════╣
`;

  report.history.forEach((entry, index) => {
    const entryDate = new Date(entry.timestamp).toLocaleTimeString('zh-CN');
    text += `║  #${(index + 1).toString().padStart(2)} ${entryDate.padEnd(10)} ${getCategoryName(entry.actionType).padEnd(6)} ${truncate(entry.actionName, 10).padEnd(10)}  ║\n`;
    text += `║      ${truncate(entry.feedback, 45).padEnd(45)}║\n`;
    if (entry.consequences.length > 0) {
      entry.consequences.forEach(c => {
        text += `║      ⚠ ${truncate(c, 44).padEnd(44)}║\n`;
      });
    }
    text += `║      污渍: ${entry.stateBefore.stain.toString().padStart(3)}% → ${entry.stateAfter.stain.toString().padStart(3)}%  `;
    text += `颜料: ${entry.stateBefore.paintLayer.toString().padStart(3)}% → ${entry.stateAfter.paintLayer.toString().padStart(3)}%  `;
    text += `结构: ${entry.stateBefore.structure.toString().padStart(3)}% → ${entry.stateAfter.structure.toString().padStart(3)}% ║\n`;
    text += `╠──────────────────────────────────────────────────────────────╣\n`;
  });

  text += `║                    报告结束                                  ║
╚══════════════════════════════════════════════════════════════╝
`;

  return text;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    cleaning: '清洁',
    retouching: '补色',
    reinforcing: '加固',
    detect: '检测',
  };
  return names[category] || category;
}

export function exportReport(report: RestorationReport, format: 'json' | 'text'): void {
  let content: string;
  let mimeType: string;
  let filename: string;

  if (format === 'json') {
    content = JSON.stringify(report, null, 2);
    mimeType = 'application/json';
    filename = `修复报告_${report.artworkName}_${Date.now()}.json`;
  } else {
    content = formatReportAsText(report);
    mimeType = 'text/plain';
    filename = `修复报告_${report.artworkName}_${Date.now()}.txt`;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function shouldEndGame(state: GameState): boolean {
  if (state.remainingTime <= 0) return true;
  if (state.currentPaintLayer <= 10) return true;
  if (state.currentStructure <= 10) return true;
  return false;
}

export function getEndReason(state: GameState): string {
  if (state.remainingTime <= 0) return '时间预算耗尽，修复工作被迫终止';
  if (state.currentPaintLayer <= 10) return '颜料层严重损坏，作品已无法修复';
  if (state.currentStructure <= 10) return '结构严重受损，作品濒临损毁';
  return '修复工作正常完成';
}

export function createHistoryEntry(
  action: RestorationAction,
  stateBefore: StateSnapshot,
  stateAfter: StateSnapshot,
  feedback: string,
  consequences: string[]
): HistoryEntry {
  return {
    id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    actionType: action.category,
    actionName: action.name,
    riskLevel: action.riskLevel,
    stateBefore,
    stateAfter,
    feedback,
    consequences,
    materialsUsed: action.materialRequirements,
  };
}
