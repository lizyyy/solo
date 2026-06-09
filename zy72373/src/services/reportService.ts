import type { DiagnosisTask, HandoverReport, ReportVersion, ReportVersionSnapshot, MissingMaterialTrigger } from '../types';

function buildMissingMaterialTriggers(task: DiagnosisTask): MissingMaterialTrigger[] {
  const triggers: MissingMaterialTrigger[] = [];

  if (task.photos.length === 0) {
    triggers.push({
      material: '工况照片',
      sourceType: 'photo',
      sourceIds: [],
      sourceDescriptions: ['尚未补录任何工况照片'],
    });
  }

  const reviewSensors = task.sensorData.filter(d => d.needsReview);
  if (reviewSensors.length > 0) {
    triggers.push({
      material: '温度单位人工复核确认',
      sourceType: 'sensor',
      sourceIds: reviewSensors.map(s => s.id),
      sourceDescriptions: reviewSensors.map(s => `传感器 ${s.sensorNo} (${s.temperature}${s.temperatureUnit === 'K' ? 'K' : '°C'})待老唐复核`),
    });
  }

  if (task.photos.length > 0 && !task.corrections.some(c => c.reason.includes('照片')) && task.photos.length >= 1) {
    triggers.push({
      material: '照片内容人工确认',
      sourceType: 'photo',
      sourceIds: task.photos.map(p => p.id),
      sourceDescriptions: task.photos.map(p => `照片 ${p.filename}: ${p.description} 待老唐确认与数据对应`),
    });
  }

  return triggers;
}

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
    const snapshot: ReportVersionSnapshot = {
      problemStatement,
      missingMaterials,
      nextAction: 'contact_laotang',
      nextHandler: '训练教练老唐',
      hasUnitMixing: task.hasUnitMixing,
      photoCount: task.photos.length,
      correctionCount: task.corrections.length,
      sensorDataSnapshots: task.sensorData.map(d => ({
        sensorNo: d.sensorNo,
        temperature: d.temperature,
        temperatureUnit: d.temperatureUnit,
        needsReview: !!d.needsReview,
      })),
    };

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
      missingMaterialTriggers: buildMissingMaterialTriggers(task),
      versionHistory: [
        {
          version: 1,
          updatedAt: now,
          changes: ['初始报告生成', task.hasUnitMixing ? '检测到温度单位混用，标记为待老唐复核' : '数据导入完成'],
          snapshot,
          triggeredBy: task.hasUnitMixing ? '系统检测-温度单位混用' : '数据导入完成',
        },
      ],
    };
  }

  static onPhotoAdded(task: DiagnosisTask): HandoverReport {
    if (!task.report) {
      return this.generateInitialReport(task);
    }

    const now = new Date().toISOString();
    const latestPhotos = task.photos.slice(-1);
    const changes = [
      `补录工况照片 ${latestPhotos.map(p => p.filename).join('、')}`,
      `当前共 ${task.photos.length} 张照片`,
    ];

    let missingMaterials = [...task.report.missingMaterials];
    if (task.photos.length > 0 && missingMaterials.includes('工况照片')) {
      missingMaterials = missingMaterials.filter(m => m !== '工况照片');
    }
    if (task.photos.length > 0 && !missingMaterials.includes('照片内容人工确认')) {
      missingMaterials.push('照片内容人工确认');
    }

    const stillHasMixing = task.sensorData.some(d => d.needsReview);
    const problemStatement = stillHasMixing
      ? '工况照片已补录，传感器数据仍存在摄氏度(℃)和开尔文(K)混用情况。请训练教练老唐结合照片复核单位问题。'
      : '工况照片已补录，请训练教练确认照片与数据一致性。';

    const snapshot: ReportVersionSnapshot = {
      problemStatement,
      missingMaterials,
      nextAction: 'contact_laotang',
      nextHandler: '训练教练老唐',
      hasUnitMixing: task.hasUnitMixing,
      photoCount: task.photos.length,
      correctionCount: task.corrections.length,
      sensorDataSnapshots: task.sensorData.map(d => ({
        sensorNo: d.sensorNo,
        temperature: d.temperature,
        temperatureUnit: d.temperatureUnit,
        needsReview: !!d.needsReview,
      })),
    };

    const newVersion: ReportVersion = {
      version: task.report.version + 1,
      updatedAt: now,
      changes,
      snapshot,
      triggeredBy: `训练教练老唐补看照片: ${latestPhotos.map(p => p.filename).join(',')}`,
    };

    return {
      ...task.report,
      problemStatement,
      missingMaterials,
      missingMaterialTriggers: buildMissingMaterialTriggers(task),
      updatedAt: now,
      version: newVersion.version,
      versionHistory: [...task.report.versionHistory, newVersion],
    };
  }

  static onCorrectionMade(task: DiagnosisTask, correctedSensorNo: string): HandoverReport {
    if (!task.report) {
      return this.generateInitialReport(task);
    }

    const now = new Date().toISOString();
    const latestCorrection = task.corrections[task.corrections.length - 1];
    const changes = [
      `人工修正传感器 ${correctedSensorNo}: ${latestCorrection?.oldValue || ''} → ${latestCorrection?.newValue || ''}`,
      `修正原因: ${latestCorrection?.reason || '未注明'}`,
    ];

    const stillHasMixingNeedsReview = task.sensorData.some(d => d.needsReview);

    let missingMaterials = [...task.report.missingMaterials];
    if (!stillHasMixingNeedsReview && missingMaterials.includes('温度单位人工复核确认')) {
      missingMaterials = missingMaterials.filter(m => m !== '温度单位人工复核确认');
    }

    const stillAnyPhotoReviewPending = missingMaterials.includes('照片内容人工确认');
    const allDone = missingMaterials.length === 0;

    const problemStatement = stillHasMixingNeedsReview
      ? `已修正 ${correctedSensorNo}，仍有传感器待老唐复核。请继续处理剩余单位混用数据。`
      : allDone
        ? '温度单位已由训练教练老唐复核确认，照片内容已核对，所有材料齐全，可以继续进行平衡诊断分析。'
        : stillAnyPhotoReviewPending
          ? '温度单位已由训练教练老唐复核确认，数据单位已统一。请进一步确认照片内容与数据的一致性。'
          : '温度单位已由训练教练老唐复核确认，数据单位已统一。';

    const nextAction = stillHasMixingNeedsReview ? 'contact_laotang' : allDone ? 'contact_coach' : 'contact_laotang';
    const nextHandler = stillHasMixingNeedsReview ? '训练教练老唐' : allDone ? '训练教练' : '训练教练老唐';

    const snapshot: ReportVersionSnapshot = {
      problemStatement,
      missingMaterials,
      nextAction,
      nextHandler,
      hasUnitMixing: task.hasUnitMixing,
      photoCount: task.photos.length,
      correctionCount: task.corrections.length,
      sensorDataSnapshots: task.sensorData.map(d => ({
        sensorNo: d.sensorNo,
        temperature: d.temperature,
        temperatureUnit: d.temperatureUnit,
        needsReview: !!d.needsReview,
      })),
    };

    const newVersion: ReportVersion = {
      version: task.report.version + 1,
      updatedAt: now,
      changes,
      snapshot,
      triggeredBy: `训练教练老唐人工修正: ${correctedSensorNo}`,
    };

    return {
      ...task.report,
      problemStatement,
      missingMaterials,
      missingMaterialTriggers: buildMissingMaterialTriggers(task),
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

    const allSensorUnitC = task.sensorData.every(d => d.temperatureUnit === 'C');
    const hasPhotoConfirm = !task.report.missingMaterials.includes('照片内容人工确认');

    const stillMissing: string[] = [];
    if (task.photos.length === 0) stillMissing.push('工况照片');
    if (!allSensorUnitC) stillMissing.push('温度单位人工复核确认');
    if (task.photos.length > 0 && !hasPhotoConfirm) stillMissing.push('照片内容人工确认');

    let problemStatement = task.report.problemStatement;
    if (stillMissing.length === 0) {
      problemStatement = '诊断重跑完成，所有数据已统一、照片已核对，风扇叶片平衡诊断流程闭环。请训练教练进行最终平衡分析结论判定。';
    }

    const nextAction = stillMissing.length > 0 ? 'contact_laotang' : 'contact_coach';
    const nextHandler = stillMissing.length > 0 ? '训练教练老唐' : '训练教练';

    const snapshot: ReportVersionSnapshot = {
      problemStatement,
      missingMaterials: stillMissing,
      nextAction,
      nextHandler,
      hasUnitMixing: task.hasUnitMixing,
      photoCount: task.photos.length,
      correctionCount: task.corrections.length,
      sensorDataSnapshots: task.sensorData.map(d => ({
        sensorNo: d.sensorNo,
        temperature: d.temperature,
        temperatureUnit: d.temperatureUnit,
        needsReview: !!d.needsReview,
      })),
    };

    const changes = [
      '重跑诊断分析完成',
      `当前状态 - 温度统一: ${allSensorUnitC ? '是' : '否'}，照片齐全: ${task.photos.length > 0 ? '是' : '否'}`,
    ];

    const newVersion: ReportVersion = {
      version: task.report.version + 1,
      updatedAt: now,
      changes,
      snapshot,
      triggeredBy: '训练教练老唐重跑诊断',
    };

    return {
      ...task.report,
      problemStatement,
      missingMaterials: stillMissing,
      missingMaterialTriggers: buildMissingMaterialTriggers(task),
      nextAction,
      nextHandler,
      updatedAt: now,
      version: newVersion.version,
      versionHistory: [...task.report.versionHistory, newVersion],
    };
  }
}

export function formatNextAction(action: 'contact_coach' | 'contact_laotang'): string {
  return action === 'contact_laotang' ? '找训练教练老唐' : '找训练教练';
}
