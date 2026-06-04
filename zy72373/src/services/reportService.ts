import type { DiagnosisTask, HandoverReport, ReportVersion } from '../types';

export class ReportAutoUpdater {
  static generateInitialReport(task: DiagnosisTask): HandoverReport {
    const problemStatement = task.hasUnitMixing
      ? '传感器数据存在摄氏度(℃)和开尔文(K)混用情况，不能直接照抄传感器编号里的结论。请训练教练老唐复核后统一单位再进行分析。'
      : '初始诊断完成，请检查数据完整性后进行下一步操作。';

    const missingMaterials: string[] = [];
    if (task.photos.length === 0) {
      missingMaterials.push('工况照片');
    }
    if (task.hasUnitMixing) {
      missingMaterials.push('温度单位人工复核确认');
    }

    const now = new Date().toISOString();

    return {
      id: `report-${task.id}`,
      diagnosisId: task.id,
      problemStatement,
      missingMaterials,
      nextAction: 'contact_laotang',
      nextHandler: '训练教练老唐',
      generatedAt: now,
      updatedAt: now,
      version: 1,
      versionHistory: [
        {
          version: 1,
          updatedAt: now,
          changes: ['初始报告生成', task.hasUnitMixing ? '检测到温度单位混用，标记为待老唐复核' : '数据导入完成'],
        },
      ],
    };
  }

  static onPhotoAdded(task: DiagnosisTask): HandoverReport {
    if (!task.report) {
      return this.generateInitialReport(task);
    }

    const now = new Date().toISOString();
    const changes = [`补录工况照片 ${task.photos.length} 张`];
    
    const missingMaterials = task.report.missingMaterials.filter(m => m !== '工况照片');
    
    if (missingMaterials.length === task.report.missingMaterials.length) {
      missingMaterials.push('照片内容人工确认');
    }

    const newVersion: ReportVersion = {
      version: task.report.version + 1,
      updatedAt: now,
      changes,
    };

    return {
      ...task.report,
      missingMaterials,
      updatedAt: now,
      version: newVersion.version,
      versionHistory: [...task.report.versionHistory, newVersion],
    };
  }

  static onCorrectionMade(task: DiagnosisTask): HandoverReport {
    if (!task.report) {
      return this.generateInitialReport(task);
    }

    const now = new Date().toISOString();
    const changes = [`人工修正数据 ${task.corrections.length} 条`];

    const stillHasMixing = task.sensorData.some(d => d.needsReview);
    
    const missingMaterials = stillHasMixing
      ? task.report.missingMaterials.filter(m => m !== '温度单位人工复核确认')
      : task.report.missingMaterials;

    const problemStatement = stillHasMixing
      ? task.report.problemStatement
      : '温度单位已由训练教练老唐复核确认，数据单位已统一。可以继续进行平衡诊断分析。';

    const newVersion: ReportVersion = {
      version: task.report.version + 1,
      updatedAt: now,
      changes,
    };

    const nextAction = stillHasMixing ? 'contact_laotang' : 'contact_coach';
    const nextHandler = stillHasMixing ? '训练教练老唐' : '训练教练';

    return {
      ...task.report,
      problemStatement,
      missingMaterials,
      nextAction,
      nextHandler,
      updatedAt: now,
      version: newVersion.version,
      versionHistory: [...task.report.versionHistory, newVersion],
    };
  }

  static onRerunComplete(task: DiagnosisTask): HandoverReport {
    if (!task.report) {
      return this.generateInitialReport(task);
    }

    const now = new Date().toISOString();
    const changes = ['重跑诊断分析完成'];

    const newVersion: ReportVersion = {
      version: task.report.version + 1,
      updatedAt: now,
      changes,
    };

    return {
      ...task.report,
      updatedAt: now,
      version: newVersion.version,
      versionHistory: [...task.report.versionHistory, newVersion],
    };
  }
}

export function formatNextAction(action: 'contact_coach' | 'contact_laotang'): string {
  return action === 'contact_laotang' ? '找训练教练老唐' : '找训练教练';
}
