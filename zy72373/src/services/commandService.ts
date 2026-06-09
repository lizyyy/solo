import type { DiagnosisTask, CorrectionRecord } from '../types';

export class CommandGenerator {
  static generateReplayCommand(taskId: string): string {
    return `fan-diagnosis replay --task-id ${taskId} --full`;
  }

  static generateImportCommand(filename: string): string {
    return `fan-diagnosis import --file ${filename} --detect-unit-mixing`;
  }

  static generateCorrectionCommand(
    sensorNo: string,
    field: string,
    oldValue: string,
    newValue: string,
    reason: string,
    operator: string
  ): string {
    return `fan-diagnosis correct --sensor "${sensorNo}" --field ${field} --from "${oldValue}" --to "${newValue}" --reason "${reason}" --operator "${operator}"`;
  }

  static generateReportCommand(taskId: string, version: number): string {
    return `fan-diagnosis report --task-id ${taskId} --version ${version} --output 交接报告_v${version}.pdf`;
  }

  static generatePhotoCommand(taskId: string, filename: string, description: string, uploadBy: string): string {
    return `fan-diagnosis add-photo --task-id ${taskId} --file "${filename}" --description "${description}" --upload-by "${uploadBy}"`;
  }

  static generateFullScript(task: DiagnosisTask): string {
    const commands: string[] = [];
    
    commands.push('# ===========================================');
    commands.push('# 风扇叶片平衡诊断 - 完整复盘脚本');
    commands.push(`# 任务: ${task.title}`);
    commands.push(`# 任务ID: ${task.id}`);
    commands.push(`# 创建人: ${task.createdBy}`);
    commands.push('# ===========================================');
    commands.push('');
    
    commands.push('# 1. 创建诊断任务');
    commands.push(`fan-diagnosis create --title "${task.title}" --created-by "${task.createdBy}" --task-id ${task.id}`);
    commands.push('');
    
    commands.push('# 2. 导入传感器数据');
    commands.push(`fan-diagnosis import --task-id ${task.id} --file sensor_data.csv --detect-unit-mixing`);
    commands.push(`#    - 共 ${task.sensorData.length} 条传感器数据`);
    commands.push(`#    - 传感器编号: ${task.sensorData.map(d => d.sensorNo).join(', ')}`);
    commands.push('');
    
    if (task.hasUnitMixing && task.unitMixingInfo) {
      commands.push('# 3. 检测温度单位混用');
      commands.push(`fan-diagnosis detect-mixing --task-id ${task.id} --report`);
      commands.push(`#    - 摄氏度数据: ${task.unitMixingInfo.celsiusCount} 条`);
      commands.push(`#    - 开尔文数据: ${task.unitMixingInfo.kelvinCount} 条`);
      commands.push(`#    - 影响传感器: ${task.sensorData.filter(d => d.temperatureUnit === 'K').map(d => `${d.sensorNo}(${d.temperature}K)`).join(', ')}`);
      commands.push('');
    }
    
    if (task.photos.length > 0) {
      commands.push('# 4. 补录工况照片（训练教练老唐从群里补传后补录）');
      task.photos.forEach((photo) => {
        commands.push(CommandGenerator.generatePhotoCommand(task.id, photo.filename, photo.description, photo.uploadBy));
      });
      commands.push('');
    }
    
    if (task.corrections.length > 0) {
      commands.push('# 5. 人工修正数据（训练教练老唐复核后执行）');
      task.corrections.forEach((correction: CorrectionRecord) => {
        commands.push(`#    修正传感器 ${correction.sensorNo}: ${correction.reason}`);
        commands.push(CommandGenerator.generateCorrectionCommand(
          correction.sensorNo, correction.field, correction.oldValue, correction.newValue, correction.reason, correction.correctedBy
        ));
      });
      commands.push('');
    }
    
    commands.push('# 6. 重跑诊断分析');
    commands.push(`fan-diagnosis rerun --task-id ${task.id} --check-uniformity`);
    commands.push('');
    
    commands.push('# 7. 生成交接报告');
    if (task.report) {
      commands.push(`fan-diagnosis report --task-id ${task.id} --version ${task.report.version} --output 交接报告_v${task.report.version}.pdf`);
      commands.push(`#    交接说明: ${task.report.problemStatement.substring(0, 80)}...`);
      commands.push(`#    当前版本: v${task.report.version}，历史版本: ${task.report.versionHistory.map(v => 'v' + v.version).join(', ')}`);
    } else {
      commands.push(`fan-diagnosis report --task-id ${task.id}`);
    }
    commands.push('');
    
    commands.push('# ===========================================');
    commands.push('# 复盘校验：按版本追溯');
    commands.push('# ===========================================');
    if (task.report) {
      task.report.versionHistory.forEach((v) => {
        commands.push(`#   版本 v${v.version} (${v.updatedAt.substring(0, 10)})`);
        commands.push(`#     触发: ${v.triggeredBy}`);
        commands.push(`#     变更: ${v.changes.join('; ')}`);
        commands.push(`#     缺失材料: ${v.snapshot.missingMaterials.join(', ') || '无'}`);
        commands.push(`#     下一步: ${v.snapshot.nextHandler}`);
      });
    }
    commands.push('');
    
    commands.push('# ===========================================');
    commands.push('# 诊断流程完成 - 可直接复制上方脚本即可完全复现完整诊断流程');
    commands.push('# ===========================================');
    
    return commands.join('\n');
  }

  static generateCliHelp(): string {
    return `fan-diagnosis - 风扇叶片平衡诊断工具

Usage:
  fan-diagnosis <command> [options]

Commands:
  create          创建新的诊断任务
  import          导入传感器数据
  detect-mixing   检测温度单位混用
  add-photo       补录工况照片
  correct         人工修正数据
  rerun           重跑诊断分析
  report          生成交接报告
  replay          复盘历史任务
  trace-version    追溯版本变化

Examples:
  fan-diagnosis create --title "风机检测"
  fan-diagnosis import --file data.csv --detect-unit-mixing
  fan-diagnosis correct --sensor FAN-001 --field temperature --from "358K" --to "85°C" --operator "老唐"
  fan-diagnosis replay --task-id demo-001 --full
  fan-diagnosis trace-version --task-id demo-001 --version 2`;
  }
}
