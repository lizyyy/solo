import { db, saveDb } from '../data/db.js';
import type { ReviewTask, ExperimentReview } from '../../shared/types.js';
import { recordChange } from './auditService.js';
import crypto from 'crypto';

export async function getReviewTasks(assignee?: string, status?: ReviewTask['status']) {
  await db.read();
  let tasks = [...db.data.reviewTasks];

  if (assignee) {
    tasks = tasks.filter((t) => t.assignee === assignee);
  }
  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function resolveReviewTask(
  taskId: string,
  resolution: string,
  resolvedBy: string,
  markAsNormal: boolean
): Promise<ReviewTask | null> {
  await db.read();

  const task = db.data.reviewTasks.find((t) => t.id === taskId);
  if (!task) return null;

  task.status = markAsNormal ? 'resolved' : 'rejected';
  task.resolvedAt = new Date().toISOString();
  task.resolution = resolution;

  const calc = db.data.calculations.find((c) => c.id === task.calculationId);
  if (calc) {
    if (markAsNormal) {
      calc.status = 'completed';
      calc.reviewComment = resolution;
      
      await recordChange(
        'calculation',
        calc.id,
        'status',
        'pending_review',
        'completed',
        `质检员复核通过: ${resolution}`,
        resolvedBy,
        [calc.id]
      );
    } else {
      calc.status = 'draft';
      calc.reviewComment = `复核不通过: ${resolution}`;
      
      await recordChange(
        'calculation',
        calc.id,
        'status',
        'pending_review',
        'draft',
        `质检员复核不通过: ${resolution}`,
        resolvedBy,
        [calc.id]
      );
    }
  }

  await saveDb();
  return task;
}

export async function createReview(
  calculationId: string,
  decisions: ExperimentReview['decisions'],
  reportContent: string,
  createdBy: string
): Promise<ExperimentReview> {
  await db.read();

  const existing = db.data.reviews.find((r) => r.calculationId === calculationId);
  if (existing) {
    existing.decisions = decisions;
    existing.reportContent = reportContent;
    existing.createdAt = new Date().toISOString();
    existing.createdBy = createdBy;
    await saveDb();
    return existing;
  }

  const review: ExperimentReview = {
    id: `review-${crypto.randomUUID().slice(0, 8)}`,
    calculationId,
    decisions,
    reportContent,
    createdAt: new Date().toISOString(),
    createdBy,
  };

  db.data.reviews.unshift(review);
  
  const calc = db.data.calculations.find((c) => c.id === calculationId);
  if (calc) {
    calc.status = 'completed';
    calc.updatedAt = new Date().toISOString();
    calc.updatedBy = createdBy;
  }

  await saveDb();
  return review;
}

export async function getReviewByCalculationId(calculationId: string) {
  await db.read();
  return db.data.reviews.find((r) => r.calculationId === calculationId);
}

export async function getAllReviews() {
  await db.read();
  return [...db.data.reviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function generateHumanizedReport(
  calc: {
    name: string;
    riskLevel: string;
    riskScore: number;
    screenshotIds: string[];
    parameters: {
      sampleTimes: string[];
      missingIntervals: { start: string; end: string; duration: number }[];
      pressure: number[];
      flowRate: number[];
    };
    result: {
      npshAvailable: number;
      npshRequired: number;
      cavitationProbability: number;
      affectedAreas: string[];
      recommendations: string[];
    };
    remark: string;
  },
  decisions: {
    dataPointId: string;
    keepReason: string;
    missingMaterials: string[];
    nextAction: string;
    assignee?: string;
  }[],
  users: { id: string; name: string; avatar?: string }[],
  screenshots?: {
    id: string;
    fileName: string;
    status: string;
    duplicateOf?: string;
    repeatType?: string;
    uploadTime: string;
    uploader: string;
    remark?: string;
  }[],
  changeRecords?: {
    fieldName: string;
    oldValue: any;
    newValue: any;
    changeReason: string;
    changedBy: string;
    changedAt: string;
  }[]
): string {
  const riskLevelText: Record<string, string> = {
    low: '低',
    medium: '中等',
    high: '高',
    critical: '严重',
  };

  const repeatTypeText: Record<string, string> = {
    new: '新记录',
    current_batch: '本次重复',
    historical: '历史重复',
  };

  const getUser = (id: string) => users.find((u) => u.id === id);

  let report = `## 实验复盘：${calc.name}\n\n`;

  if (screenshots && screenshots.length > 0) {
    report += `### 数据来源与去重处理\n`;
    const uniqueScreenshots = screenshots.filter(s => s.status !== 'duplicate');
    const duplicateScreenshots = screenshots.filter(s => s.status === 'duplicate');
    
    report += `本次计算共涉及 **${screenshots.length}张** 截图`;
    if (uniqueScreenshots.length > 0 && duplicateScreenshots.length > 0) {
      report += `，其中 **${uniqueScreenshots.length}张** 有效（新记录）、**${duplicateScreenshots.length}张** 重复`;
    } else if (uniqueScreenshots.length > 0) {
      report += `，均为有效新记录`;
    }
    report += `\n\n`;
    
    uniqueScreenshots.forEach((s, idx) => {
      const uploader = users.find(u => u.id === s.uploader);
      const repeatLabel = repeatTypeText[s.repeatType || 'new'] || '新记录';
      report += `${idx + 1}. ✅ **${s.fileName}**\n`;
      report += `   - 上传人：${uploader?.name || s.uploader}\n`;
      report += `   - 上传时间：${new Date(s.uploadTime).toLocaleString('zh-CN')}\n`;
      report += `   - 重复类型：${repeatLabel}\n`;
      report += `   - 处理判断：有效数据，纳入计算\n`;
      report += `   - 当前状态：已纳入本次计算结果\n`;
      if (s.remark) {
        report += `   - 备注：${s.remark}\n`;
      }
      report += `   - 最终结论：作为有效采样数据参与汽蚀风险计算\n\n`;
    });
    
    if (duplicateScreenshots.length > 0) {
      report += `#### 重复导入处理记录\n`;
      duplicateScreenshots.forEach((s, idx) => {
        const original = screenshots.find(os => os.id === s.duplicateOf);
        const uploader = users.find(u => u.id === s.uploader);
        const repeatLabel = repeatTypeText[s.repeatType || 'historical'] || '历史重复';
        report += `${idx + 1}. ⚠️ **${s.fileName}**\n`;
        report += `   - 上传人：${uploader?.name || s.uploader}\n`;
        report += `   - 上传时间：${new Date(s.uploadTime).toLocaleString('zh-CN')}\n`;
        report += `   - 重复类型：${repeatLabel}\n`;
        report += `   - 重复来源：${original ? `与「${original.fileName}」内容重复（原始上传于 ${new Date(original.uploadTime).toLocaleString('zh-CN')}）` : '与历史记录重复'}\n`;
        report += `   - 处理判断：内容重复，不新增计算任务\n`;
        report += `   - 当前状态：已标记为重复，仅保留上传记录\n`;
        if (s.remark) {
          report += `   - 备注：${s.remark}\n`;
        }
        report += `   - 最终结论：未纳入本次计算，不影响"泵站汽蚀风险计算"数量\n\n`;
      });
    }
  }

  if (changeRecords && changeRecords.length > 0) {
    const remarkChanges = changeRecords.filter(c => c.fieldName === 'remark');
    if (remarkChanges.length > 0) {
      report += `### 备注变更历史\n`;
      report += `> 修改记录保留原话、修改人和修改原因，不覆盖\n\n`;
      remarkChanges.forEach((c, idx) => {
        const changer = users.find(u => u.id === c.changedBy);
        report += `${idx + 1}. **修改时间**：${new Date(c.changedAt).toLocaleString('zh-CN')}\n`;
        report += `   - **修改人**：${changer?.name || c.changedBy}\n`;
        report += `   - **修改原因**：${c.changeReason}\n`;
        report += `   - **改前**：${c.oldValue || '(空)'}\n`;
        report += `   - **改后**：${c.newValue || '(空)'}\n\n`;
      });
    }
  }

  report += `### 数据质量评估\n`;
  const validCount = calc.parameters.sampleTimes.length;
  const missingCount = calc.parameters.missingIntervals.length;
  report += `本次计算共 **${validCount}个** 有效采样时间点`;
  if (missingCount > 0) {
    report += `，检测到 **${missingCount}个** 缺失采样点：\n`;
    calc.parameters.missingIntervals.forEach((m, idx) => {
      const startStr = new Date(m.start).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const endStr = new Date(m.end).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      report += `- 缺失采样点${idx + 1}：${startStr}-${endStr}（缺${m.duration}分钟）\n`;
    });
    report += `\n> **说明**：采样间隔为30分钟，`;
    if (missingCount === 1 && missingCount === 1) {
      const m = calc.parameters.missingIntervals[0];
      const startStr = new Date(m.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      report += `相邻采样点之间缺少${m.duration}分钟的数据点（${startStr}），`;
      report += `不是缺失${m.duration * 2 || 60}分钟，而是该30分钟间隔内缺少1个采样记录。\n`;
    } else {
      report += `每个缺失采样点代表一个期望间隔内缺少的采样记录。\n`;
    }
  } else {
    report += `，无缺失采样点。`;
  }

  if (calc.parameters.pressure.length > 1) {
    const pStart = calc.parameters.pressure[0];
    const pEnd = calc.parameters.pressure[calc.parameters.pressure.length - 1];
    const trend = pEnd < pStart ? '缓慢下降' : pEnd > pStart ? '上升' : '稳定';
    report += `\n整体数据趋势${trend}，压力从${pStart}MPa${trend === '稳定' ? '保持' : trend}至${pEnd}MPa。\n\n`;
  }

  report += `### 风险分析\n`;
  report += `汽蚀风险等级：**${riskLevelText[calc.riskLevel] || calc.riskLevel}**（风险评分${calc.riskScore}分）\n`;
  report += `- NPSH可用值：${calc.result.npshAvailable}m\n`;
  report += `- NPSH必需值：${calc.result.npshRequired}m\n`;
  report += `- 汽蚀概率：${Math.round(calc.result.cavitationProbability * 100)}%\n`;

  if (calc.result.affectedAreas.length > 0) {
    report += `- 可能受影响区域：${calc.result.affectedAreas.join('、')}\n`;
  }
  report += '\n';

  report += `### 关键决策\n`;
  calc.parameters.sampleTimes.forEach((time, idx) => {
    const decision = decisions.find((d) => d.dataPointId === `dp-${idx + 1}`);
    const timeStr = new Date(time).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    report += `${idx + 1}. **数据点${idx + 1}（${timeStr}）**：`;
    if (decision) {
      report += `保留。${decision.keepReason}`;
      if (decision.missingMaterials.length > 0) {
        report += ` 🔴 缺${decision.missingMaterials.join('、')}`;
      }
      report += '\n';
    } else {
      report += `保留。数据完整。\n`;
    }
  });
  
  if (calc.parameters.missingIntervals.length > 0) {
    report += `\n**缺失采样点决策**：\n`;
    calc.parameters.missingIntervals.forEach((m, idx) => {
      const startStr = new Date(m.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const endStr = new Date(m.end).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const decision = decisions.find((d) => d.dataPointId === `missing-${idx + 1}`);
      report += `- 缺失点${idx + 1}（${startStr}-${endStr}，${m.duration}分钟）：`;
      if (decision) {
        report += `${decision.keepReason}。`;
        if (decision.missingMaterials.length > 0) {
          report += ` 缺${decision.missingMaterials.join('、')}。`;
        }
      } else {
        report += `待质检员复核确认原因。`;
      }
      report += '\n';
    });
  }
  report += '\n';

  const allMissingMaterials = decisions.flatMap((d) => d.missingMaterials);
  if (allMissingMaterials.length > 0) {
    report += `### 缺失材料\n`;
    allMissingMaterials.forEach((m) => {
      const decision = decisions.find((d) => d.missingMaterials.includes(m));
      const assignee = decision?.assignee ? getUser(decision.assignee) : null;
      report += `- ${m}`;
      if (assignee) {
        const avatar = assignee.avatar || '';
        report += ` - 请${avatar} ${assignee.name}补充`;
      }
      report += '\n';
    });
    report += '\n';
  }

  const actions = decisions.filter((d) => d.nextAction !== 'none');
  if (actions.length > 0) {
    report += `### 下一步行动\n`;
    report += `| 责任人 | 任务 | 截止时间 |\n`;
    report += `|--------|------|----------|\n`;
    actions.forEach((action) => {
      const assignee = action.assignee ? getUser(action.assignee) : null;
      if (assignee) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);
        const dueStr = dueDate.toISOString().split('T')[0];
        const taskText =
          action.nextAction === 'teacher'
            ? '补充缺失数据或说明原因'
            : '复核计算结果';
        const avatar = assignee.avatar || '';
        report += `| ${avatar} ${assignee.name} | ${taskText} | ${dueStr} |\n`;
      }
    });
    report += '\n';
  }

  report += `### 建议措施\n`;
  calc.result.recommendations.forEach((rec, idx) => {
    report += `${idx + 1}. ${rec}\n`;
  });

  if (calc.remark) {
    report += `\n### 备注\n${calc.remark}\n`;
  }

  return report;
}
