import type { InspectionTask, ReportData, SampleWalkthroughStep } from '@/types';
import { exportToPDF, exportToExcel, downloadBlob } from '@/utils/exporter';
import dayjs from 'dayjs';

export async function generateReport(
  task: InspectionTask,
  includeRawData: boolean = true
): Promise<ReportData> {
  return {
    task,
    marks: [...task.marks].sort((a, b) => a.sequenceNo - b.sequenceNo),
    conflicts: task.conflicts,
    abnormalities: task.abnormalities,
    selfCheckReports: task.selfCheckReports,
    includeRawData,
    generatedAt: new Date().toISOString()
  };
}

export async function downloadReportPDF(reportData: ReportData): Promise<void> {
  const blob = await exportToPDF(reportData);
  const filename = `管线巡检报告_${reportData.task.taskNo}_${dayjs(reportData.generatedAt).format('YYYYMMDD')}.pdf`;
  downloadBlob(blob, filename);
}

export async function downloadReportExcel(reportData: ReportData): Promise<void> {
  const blob = await exportToExcel(reportData);
  const filename = `管线巡检报告_${reportData.task.taskNo}_${dayjs(reportData.generatedAt).format('YYYYMMDD')}.xlsx`;
  downloadBlob(blob, filename);
}

export function generateSampleWalkthrough(): SampleWalkthroughStep[] {
  return [
    {
      id: 1,
      title: '创建巡检任务',
      description: '在首页点击"新建任务"，填写任务编号、项目名称、巡检日期等基本信息',
      route: '/',
      action: '创建任务',
      expectedResult: '任务创建成功，自动跳转到数据导入页面'
    },
    {
      id: 2,
      title: '导入正常材料',
      description: '选择"正常材料"类型，拖拽或点击上传CSV/Excel文件，系统自动执行导入前自检',
      route: '/import',
      action: '导入正常材料',
      expectedResult: '预览数据无误后，点击"确认导入"，数据成功入库'
    },
    {
      id: 3,
      title: '导入错口径材料',
      description: '选择"错口径材料"类型，上传包含管径错误的文件，观察系统标记的警告信息',
      route: '/import',
      action: '导入错口径材料',
      expectedResult: '系统自动标记管径异常记录，保留原始备注供后续复核'
    },
    {
      id: 4,
      title: '导入补录材料',
      description: '选择"补录材料"类型，上传补充数据，系统自动触发路径重算',
      route: '/import',
      action: '导入补录材料',
      expectedResult: '补录数据追加成功，路径自动重新计算，显示重算前后对比'
    },
    {
      id: 5,
      title: '查看路径回放',
      description: '进入路径回放页面，拖动时间轴或点击播放，查看管线路径的3D可视化',
      route: '/replay',
      action: '路径回放',
      expectedResult: '3D视图中清晰显示管线路径、障碍物标记点，可切换历史版本对比'
    },
    {
      id: 6,
      title: '处理冲突记录',
      description: '查看障碍物备注与楼层剖面草图的冲突，仔细阅读两边证据，由许工手动裁决',
      route: '/conflicts',
      action: '冲突裁决',
      expectedResult: '点击"确认"或"驳回"按钮，填写裁决理由，冲突状态更新'
    },
    {
      id: 7,
      title: '复核Z轴异常',
      description: '查看系统检测到的Z轴方向可能写反的记录，联系现场班组复核，不自动修正',
      route: '/abnormal',
      action: 'Z轴复核',
      expectedResult: '现场班组提交复核结果后，异常状态更新，坐标保持原始值'
    },
    {
      id: 8,
      title: '执行系统自检',
      description: '运行四大自检项：重复导入、Z轴方向、补录重算、导出一致性',
      route: '/self-check',
      action: '执行自检',
      expectedResult: '生成自检报告，显示每项检查结果和详细数据快照'
    },
    {
      id: 9,
      title: '生成巡检报告',
      description: '选择是否包含原始数据，导出PDF或Excel格式的完整巡检报告',
      route: '/report',
      action: '导出报告',
      expectedResult: '报告包含所有标记、冲突处理记录、Z轴复核记录、自检报告，原始备注完整保留'
    }
  ];
}

export function getReportSummary(reportData: ReportData): {
  totalMarks: number;
  obstacleCount: number;
  conflictCount: number;
  pendingConflictCount: number;
  abnormalCount: number;
  pendingAbnormalCount: number;
  checkPassCount: number;
  checkTotalCount: number;
} {
  return {
    totalMarks: reportData.marks.length,
    obstacleCount: reportData.marks.filter(m => m.isObstacle).length,
    conflictCount: reportData.conflicts.length,
    pendingConflictCount: reportData.conflicts.filter(c => c.status === 'pending').length,
    abnormalCount: reportData.abnormalities.length,
    pendingAbnormalCount: reportData.abnormalities.filter(a => a.reviewStatus === 'pending').length,
    checkPassCount: reportData.selfCheckReports.filter(r => r.result === 'pass').length,
    checkTotalCount: reportData.selfCheckReports.length
  };
}

export function getSampleDataInstructions(): string {
  return `
【样例数据使用说明】

1. 系统内置了完整的样例数据，包含：
   - 10条正常巡检标记
   - 3条Z轴方向异常（按旧习惯写反）
   - 2条管径错误记录
   - 1条障碍物与草图冲突记录
   - 完整的原始备注信息

2. 新人学习路径：
   第1步：点击首页"加载样例数据"
   第2步：按照 /sample 页面的指引逐步操作
   第3步：依次完成导入、回放、冲突处理、Z轴复核、自检、导出全流程
   第4步：对比导出报告与原始数据，验证完整性

3. 注意事项：
   - 样例数据不会影响真实业务数据
   - 可随时点击"重置样例"恢复初始状态
   - 建议至少完成3遍完整流程：正常材料、错口径材料、补录材料各1遍
  `;
}
