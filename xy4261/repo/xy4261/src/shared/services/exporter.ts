import { 
  Project, 
  Fixture, 
  PatchEntry, 
  Cue, 
  ValidationError,
  PowerConsumptionPoint,
  ChannelOccupation
} from '../models/types';
import { 
  getCueStartTime, 
  getCueEndTime, 
  calculateTotalPower 
} from '../models';
import { RuleEngineResult } from './ruleEngine';

export interface ExportOptions {
  includeFixtures: boolean;
  includePatches: boolean;
  includeCues: boolean;
  includeValidation: boolean;
  includePowerAnalysis: boolean;
  includeChannelUsage: boolean;
  title: string;
  author?: string;
  date?: string;
}

export function createDefaultExportOptions(): ExportOptions {
  return {
    includeFixtures: true,
    includePatches: true,
    includeCues: true,
    includeValidation: true,
    includePowerAnalysis: true,
    includeChannelUsage: true,
    title: 'Cue 安全预演台 - 技术复核单',
    author: undefined,
    date: new Date().toISOString().split('T')[0]
  };
}

export function generateMarkdownReport(
  project: Project,
  ruleResult: RuleEngineResult,
  options: ExportOptions = createDefaultExportOptions()
): string {
  const lines: string[] = [];

  lines.push(`# ${options.title}`);
  lines.push('');
  
  if (options.author) {
    lines.push(`**生成者**: ${options.author}`);
  }
  if (options.date) {
    lines.push(`**生成日期**: ${options.date}`);
  }
  lines.push(`**项目名称**: ${project.name}`);
  lines.push(`**项目 ID**: ${project.id}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 项目概览');
  lines.push('');
  lines.push('| 项目 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 灯具数量 | ${project.fixtures.length} |`);
  lines.push(`| Patch 条目数 | ${project.patches.length} |`);
  lines.push(`| Cue 数量 | ${project.cues.length} |`);
  lines.push(`| 总运行时间 | ${ruleResult.totalRuntime.toFixed(project.settings.timePrecision)}s |`);
  lines.push(`| 峰值功率 | ${ruleResult.maxPower}W |`);
  lines.push(`| 总功率容量 | ${project.settings.maxPower}${project.settings.powerUnit} |`);
  lines.push('');

  const totalErrors = ruleResult.errors.length;
  const totalWarnings = ruleResult.warnings.length;
  
  if (totalErrors > 0 || totalWarnings > 0) {
    lines.push('### 问题概览');
    lines.push('');
    lines.push(`- **错误**: ${totalErrors} 个`);
    lines.push(`- **警告**: ${totalWarnings} 个`);
    lines.push('');
  }

  if (options.includeFixtures && project.fixtures.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 灯具清单');
    lines.push('');
    lines.push('| 名称 | 型号 | 厂商 | 通道数 | 功率 | 类型 |');
    lines.push('|------|------|------|--------|------|------|');
    
    for (const fixture of project.fixtures) {
      lines.push(`| ${escapeMarkdown(fixture.name)} | ${escapeMarkdown(fixture.model)} | ${escapeMarkdown(fixture.manufacturer)} | ${fixture.channelCount} | ${fixture.power}${fixture.powerUnit} | ${fixture.type} |`);
    }
    lines.push('');

    const totalFixturePower = calculateTotalPower(project.fixtures);
    lines.push(`**总灯具功率**: ${totalFixturePower}W`);
    lines.push('');
  }

  if (options.includePatches && project.patches.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Patch 表');
    lines.push('');
    lines.push('| Patch 名称 | 灯具 | Universe | 起始通道 | 结束通道 | 通道数 |');
    lines.push('|------------|------|----------|----------|----------|--------|');
    
    const fixtureMap = new Map(project.fixtures.map(f => [f.id, f]));
    
    for (const patch of project.patches) {
      const fixture = fixtureMap.get(patch.fixtureId);
      const fixtureName = fixture ? fixture.name : '未知灯具';
      const channelCount = patch.endChannel - patch.startChannel + 1;
      
      lines.push(`| ${escapeMarkdown(patch.patchName)} | ${escapeMarkdown(fixtureName)} | ${patch.universe} | ${patch.startChannel} | ${patch.endChannel} | ${channelCount} |`);
    }
    lines.push('');
  }

  if (options.includeCues && project.cues.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Cue 时间轴');
    lines.push('');
    lines.push('| Cue 编号 | 名称 | 触发时间 | 淡入 | 淡出 | 延迟 | 锁定 | 黑场 | 活跃灯具数 |');
    lines.push('|----------|------|----------|------|------|------|------|------|------------|');
    
    const sortedCues = [...project.cues].sort((a, b) => a.time - b.time);
    
    for (const cue of sortedCues) {
      lines.push(`| ${escapeMarkdown(cue.number)} | ${escapeMarkdown(cue.name)} | ${cue.time.toFixed(project.settings.timePrecision)}s | ${cue.fadeIn}s | ${cue.fadeOut}s | ${cue.delay}s | ${cue.isLocked ? '✓' : '-'} | ${cue.isBlackout ? '✓' : '-'} | ${cue.activeFixtures.length} |`);
    }
    lines.push('');

    lines.push('### Cue 详细时间线');
    lines.push('');
    
    for (const cue of sortedCues) {
      const startTime = getCueStartTime(cue);
      const endTime = getCueEndTime(cue);
      
      lines.push(`#### Cue ${cue.number}: ${escapeMarkdown(cue.name)}`);
      lines.push('');
      lines.push(`- **起始时间**: ${startTime.toFixed(project.settings.timePrecision)}s`);
      lines.push(`- **结束时间**: ${endTime.toFixed(project.settings.timePrecision)}s`);
      lines.push(`- **持续时间**: ${(endTime - startTime).toFixed(project.settings.timePrecision)}s`);
      
      if (cue.fadeIn > 0) {
        const fadeInEnd = startTime + cue.fadeIn;
        lines.push(`- **淡入**: ${startTime.toFixed(project.settings.timePrecision)}s - ${fadeInEnd.toFixed(project.settings.timePrecision)}s`);
      }
      
      if (cue.fadeOut > 0) {
        const fadeOutStart = endTime - cue.fadeOut;
        lines.push(`- **淡出**: ${fadeOutStart.toFixed(project.settings.timePrecision)}s - ${endTime.toFixed(project.settings.timePrecision)}s`);
      }
      
      if (cue.activeFixtures.length > 0) {
        const activeFixtureNames = cue.activeFixtures.map(id => {
          const fixture = project.fixtures.find(f => f.id === id);
          return fixture ? fixture.name : id;
        });
        lines.push(`- **活跃灯具**: ${activeFixtureNames.join(', ')}`);
      }
      
      if (cue.notes) {
        lines.push(`- **备注**: ${escapeMarkdown(cue.notes)}`);
      }
      
      lines.push('');
    }
  }

  if (options.includePowerAnalysis && ruleResult.powerConsumption.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 功率分析');
    lines.push('');
    
    lines.push('### 功率消耗时间点');
    lines.push('');
    lines.push('| 时间 | 功率 (W) | 活跃灯具数 |');
    lines.push('|------|----------|------------|');
    
    for (const point of ruleResult.powerConsumption) {
      lines.push(`| ${point.time.toFixed(project.settings.timePrecision)}s | ${point.power} | ${point.fixtureIds.length} |`);
    }
    lines.push('');

    const maxPowerInSettings = project.settings.powerUnit === 'kW' 
      ? project.settings.maxPower * 1000 
      : project.settings.maxPower;
    
    const powerRatio = (ruleResult.maxPower / maxPowerInSettings * 100).toFixed(1);
    
    lines.push(`### 功率评估`);
    lines.push('');
    lines.push(`- **峰值功率**: ${ruleResult.maxPower}W`);
    lines.push(`- **系统容量**: ${maxPowerInSettings}W`);
    lines.push(`- **使用率**: ${powerRatio}%`);
    
    if (ruleResult.maxPower > maxPowerInSettings) {
      lines.push('- **状态**: ⚠️ 功率超载');
    } else if (ruleResult.maxPower > maxPowerInSettings * 0.8) {
      lines.push('- **状态**: ⚠️ 功率接近上限');
    } else {
      lines.push('- **状态**: ✓ 功率在安全范围内');
    }
    lines.push('');
  }

  if (options.includeChannelUsage && ruleResult.channelOccupations.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 通道使用分析');
    lines.push('');

    const universeMap = new Map<number, Set<number>>();
    
    for (const occ of ruleResult.channelOccupations) {
      if (!universeMap.has(occ.universe)) {
        universeMap.set(occ.universe, new Set());
      }
      universeMap.get(occ.universe)!.add(occ.channel);
    }

    lines.push('### 各 Universe 通道使用情况');
    lines.push('');
    lines.push('| Universe | 已用通道 | 总通道 | 使用率 |');
    lines.push('|----------|----------|--------|--------|');
    
    for (const [universe, channels] of universeMap) {
      const used = channels.size;
      const total = project.settings.maxChannelsPerUniverse;
      const ratio = (used / total * 100).toFixed(1);
      lines.push(`| ${universe} | ${used} | ${total} | ${ratio}% |`);
    }
    lines.push('');
  }

  if (options.includeValidation && (ruleResult.errors.length > 0 || ruleResult.warnings.length > 0)) {
    lines.push('---');
    lines.push('');
    lines.push('## 问题详情');
    lines.push('');

    if (ruleResult.errors.length > 0) {
      lines.push('### 错误 (必须修复)');
      lines.push('');
      
      for (let i = 0; i < ruleResult.errors.length; i++) {
        const error = ruleResult.errors[i];
        lines.push(`#### ${i + 1}. ${escapeMarkdown(error.message)}`);
        lines.push('');
        lines.push(`- **类型**: ${error.type}`);
        lines.push(`- **详细**: ${escapeMarkdown(error.details)}`);
        lines.push(`- **影响项**: ${error.affectedItems.join(', ')}`);
        lines.push('');
      }
    }

    if (ruleResult.warnings.length > 0) {
      lines.push('### 警告 (建议检查)');
      lines.push('');
      
      for (let i = 0; i < ruleResult.warnings.length; i++) {
        const warning = ruleResult.warnings[i];
        lines.push(`#### ${i + 1}. ${escapeMarkdown(warning.message)}`);
        lines.push('');
        lines.push(`- **类型**: ${warning.type}`);
        lines.push(`- **详细**: ${escapeMarkdown(warning.details)}`);
        lines.push(`- **影响项**: ${warning.affectedItems.join(', ')}`);
        lines.push('');
      }
    }
  } else if (options.includeValidation) {
    lines.push('---');
    lines.push('');
    lines.push('## 验证结果');
    lines.push('');
    lines.push('✓ **所有检查通过** - 未发现错误或警告');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*此报告由 Cue 安全预演台自动生成*');
  lines.push('');

  return lines.join('\n');
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!')
    .replace(/\|/g, '\\|');
}

export async function exportMarkdownViaIPC(
  content: string,
  defaultPath?: string
): Promise<{ success: boolean; filePath?: string; fileName?: string; error?: string }> {
  try {
    const result = await window.electronAPI.exportMarkdown(content, defaultPath);
    
    if (result.canceled) {
      return { success: false, error: '用户取消了导出' };
    }

    return {
      success: true,
      filePath: result.filePath,
      fileName: result.fileName
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出失败'
    };
  }
}
