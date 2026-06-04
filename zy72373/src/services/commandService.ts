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
    reason: string
  ): string {
    return `fan-diagnosis correct --sensor ${sensorNo} --field ${field} --from "${oldValue}" --to "${newValue}" --reason "${reason}"`;
  }

  static generateReportCommand(taskId: string, version: number): string {
    return `fan-diagnosis report --task-id ${taskId} --version ${version} --output handover_report.pdf`;
  }

  static generateFullScript(task: DiagnosisTask): string {
    const commands: string[] = [];
    
    commands.push('# ===========================================');
    commands.push('# 风扇叶片平衡诊断 - 完整复盘脚本');
    commands.push(`# 任务: ${task.title}`);
    commands.push(`# 任务ID: ${task.id}`);
    commands.push('# ===========================================');
    commands.push('');
    
    commands.push('# 1. 创建诊断任务');
    commands.push(`fan-diagnosis create --title "${task.title}" --created-by "${task.createdBy}"`);
    commands.push('');
    
    commands.push('# 2. 导入传感器数据');
    commands.push(`fan-diagnosis import --task-id ${task.id} --file sensor_data.csv`);
    commands.push('');
    
    if (task.hasUnitMixing && task.unitMixingInfo) {
      commands.push('# 3. 检测温度单位混用');
      commands.push(`fan-diagnosis detect-mixing --task-id ${task.id}`);
      commands.push(`#    - 摄氏度数据: ${task.unitMixingInfo.celsiusCount} 条`);
      commands.push(`#    - 开尔文数据: ${task.unitMixingInfo.kelvinCount} 条`);
      commands.push('');
    }
    
    if (task.photos.length > 0) {
      commands.push('# 4. 补录工况照片');
      task.photos.forEach((photo) => {
        commands.push(`fan-diagnosis add-photo --task-id ${task.id} --file ${photo.filename} --description "${photo.description}"`);
      });
      commands.push('');
    }
    
    if (task.corrections.length > 0) {
      commands.push('# 5. 人工修正数据');
      task.corrections.forEach((correction: CorrectionRecord) => {
        commands.push(`#    ${correction.reason}`);
        commands.push(`fan-diagnosis correct --task-id ${task.id} --field ${correction.field} --from "${correction.oldValue}" --to "${correction.newValue}" --operator "${correction.correctedBy}"`);
      });
      commands.push('');
    }
    
    commands.push('# 6. 重跑诊断分析');
    commands.push(`fan-diagnosis rerun --task-id ${task.id}`);
    commands.push('');
    
    commands.push('# 7. 生成交接报告');
    commands.push(`fan-diagnosis report --task-id ${task.id} --output 交接报告.pdf`);
    commands.push('');
    
    commands.push('# ===========================================');
    commands.push('# 诊断流程完成');
    commands.push('# ===========================================');
    
    return commands.join('\n');
  }

  static generateCliHelp(): string {
    return `fan-diagnosis - 风扇叶片平衡诊断工具

Usage:
  fan-diagnosis <command> [options]

Commands:
  create        创建新的诊断任务
  import        导入传感器数据
  detect-mixing 检测温度单位混用
  add-photo     补录工况照片
  correct       人工修正数据
  rerun         重跑诊断分析
  report        生成交接报告
  replay        复盘历史任务

Examples:
  fan-diagnosis create --title "风机检测"
  fan-diagnosis import --file data.csv --detect-unit-mixing
  fan-diagnosis replay --task-id demo-001 --full`;
  }
}
