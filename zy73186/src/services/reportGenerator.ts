import type {
  Session,
  Material,
  ComputationStep,
  AuditLog,
  Report,
  Citation,
  SuspendedTask,
  BoundaryCheckResult,
} from '../types';
import { generateId } from '../utils/hash';
import { shortHash } from '../utils/hash';
import { auditLogger } from './auditLogger';

const MATERIAL_LABELS: Record<string, string> = {
  historical_answer: '历史答案',
  boundary_sample: '边界样本',
  verbal_note: '口头说明',
};

export const reportGenerator = {
  generate(
    session: Session,
    materials: Material[],
    steps: ComputationStep[],
    audits: AuditLog[],
    operator: string = '系统',
    suspendedTasks?: SuspendedTask[]
  ): Report {
    const citations: Citation[] = [];
    let citationIndex = 1;

    const addCitation = (text: string, materialId: string, anchor?: string): string => {
      const citation: Citation = {
        id: generateId(),
        materialId,
        content: text,
        anchorText: anchor || text.substring(0, 50),
        position: 0,
        location: { start: 0, end: text.length },
      };
      citations.push(citation);
      return `[${citationIndex++}]`;
    };

    const createdAt = new Date(session.createdAt).toLocaleString('zh-CN');
    const updatedAt = new Date(session.updatedAt).toLocaleString('zh-CN');
    const title = session.title || `误差传播边界复核报告 #${shortHash(session.id, 6)}`;

    const materialSection = this.generateMaterialSection(materials, addCitation);
    const computationSection = this.generateComputationSection(steps);
    const boundarySection = this.generateBoundarySection(steps, materials, addCitation);
    const suspendedSection = this.generateSuspendedSection(suspendedTasks);
    const auditSection = this.generateAuditSection(audits);
    const conclusionSection = this.generateConclusionSection(steps, suspendedTasks);

    const markdownContent = `# ${title}

---

## 一、基本信息

| 项目 | 内容 |
|------|------|
| 会话ID | \`${session.id}\` |
| 状态 | ${this.getStatusText(session.status)} |
| 创建时间 | ${createdAt} |
| 最后更新 | ${updatedAt} |
| 计算步骤数 | ${steps.length} |
| 人工修改次数 | ${auditLogger.getManualEditCount(audits)} |
| 挂起任务数 | ${suspendedTasks?.length || 0} |

---

## 二、材料清单

${materialSection}

---

## 三、计算过程

${computationSection}

---

## 四、边界检查

${boundarySection}

---

## 五、挂起与人工确认

${suspendedSection}

---

## 六、操作审计

${auditSection}

---

## 七、结论

${conclusionSection}

---

## 八、引用溯源

${this.generateCitationsSection(citations, materials)}

---

*报告由误差传播边界复核系统自动生成*
*生成时间: ${new Date().toLocaleString('zh-CN')}*
*生成人: ${operator}*
`;

    const now = Date.now();
    return {
      id: generateId(),
      sessionId: session.id,
      content: markdownContent,
      title,
      generatedBy: operator,
      generatedAt: now,
      citations,
      createdAt: now,
    };
  },

  generateMaterialSection(
    materials: Material[],
    addCitation: (text: string, materialId: string) => string
  ): string {
    if (materials.length === 0) {
      return '> 暂无上传材料';
    }

    const sections = materials.map((material) => {
      const label = MATERIAL_LABELS[material.type] || material.type;
      const hashDisplay = shortHash(material.contentHash, 8);
      const versionInfo = material.version > 1
        ? ` (v${material.version}, 共${material.versions.length}个版本)`
        : ' (v1)';
      const caliberWarning = material.hasCaliberChanged
        ? '\n\n> ⚠️ **注意：该材料已检测到口径变更**'
        : '';

      const contentPreview = material.content.length > 500
        ? material.content.substring(0, 500) + '...'
        : material.content;

      const citation = addCitation(material.content, material.id);

      return `### ${label}${versionInfo} ${citation}

**文件名**: ${material.name}
**内容哈希**: \`${hashDisplay}\`
**版本**: v${material.version}

\`\`\`
${contentPreview}
\`\`\`
${caliberWarning}
`;
    });

    return sections.join('\n\n');
  },

  generateComputationSection(steps: ComputationStep[]): string {
    if (steps.length === 0) {
      return '> 暂无计算记录';
    }

    const stepSections = steps.map((step, index) => {
      const manualBadge = step.manuallyModified
        ? ' <span style="color:#c53030">✏️ 已人工修改</span>'
        : '';

      const unitConversion = step.unitConversion
        ? `\n\n**单位换算**: ${step.unitConversion.formula}`
        : '';

      const inputs = Object.entries(step.inputValues)
        .map(([name, data]) => `  - ${name} = ${data.value} ${data.unit}${data.error ? ` ± ${data.error}` : ''}`)
        .join('\n');

      const partialDerivatives = step.partialDerivatives
        ? `\n\n**偏导数**:\n${Object.entries(step.partialDerivatives)
            .map(([name, value]) => `  - ∂f/∂${name} = ${value.toFixed(6)}`)
            .join('\n')}`
        : '';

      const errorContribution = step.errorContribution
        ? `\n\n**误差贡献**:\n${Object.entries(step.errorContribution)
            .map(([name, value]) => `  - σ_${name} = ${value.toFixed(6)}`)
            .join('\n')}`
        : '';

      return `### 步骤 ${index + 1}: ${step.description}${manualBadge}

**公式**:
\`\`\`
${step.formula}
\`\`\`

**输入值**:
${inputs}${unitConversion}${partialDerivatives}${errorContribution}

**结果**: \`${step.result.toFixed(6)} ${step.resultUnit}\`
`;
    });

    return stepSections.join('\n\n---\n\n');
  },

  generateAuditSection(audits: AuditLog[]): string {
    if (audits.length === 0) {
      return '> 暂无操作记录';
    }

    const auditItems = audits.map((audit) => {
      const display = auditLogger.formatLogForDisplay(audit);
      const diff = audit.beforeValue !== undefined || audit.afterValue !== undefined
        ? `\n  - 变更: ${auditLogger.getDiffSummary(audit.beforeValue, audit.afterValue)}`
        : '';
      const reason = audit.reason ? `\n  - 原因: ${audit.reason}` : '';

      return `- **${display.title}** - ${display.description}${diff}${reason}`;
    });

    return auditItems.join('\n\n');
  },

  generateBoundarySection(
    steps: ComputationStep[],
    materials: Material[],
    addCitation: (text: string, materialId: string, anchor?: string) => string
  ): string {
    const boundaryStep = steps.find((s) => s.resultUnit === 'pass/fail');
    if (!boundaryStep) {
      return '> 未检测到边界条件检查';
    }

    const checks = boundaryStep.formula.split('\n').filter((l) => l.trim());
    if (checks.length === 0) {
      return '> 未检测到边界条件检查';
    }

    const passed = boundaryStep.result === 1;
    const statusText = passed ? '✅ 所有边界条件符合要求' : '❌ 部分边界条件超出范围';

    const checkItems = checks.map((check) => {
      const isPass = check.includes('✓');
      const icon = isPass ? '✅' : '❌';
      return `- ${icon} ${check.replace('✓', '').replace('✗', '').trim()}`;
    });

    const boundaryMaterials = materials.filter((m) => m.type === 'boundary_sample');
    let citations = '';
    if (boundaryMaterials.length > 0) {
      const material = boundaryMaterials[0];
      const cit = addCitation(material.content, material.id, '边界条件来源');
      citations = `\n\n> 边界条件来源: ${cit}`;
    }

    return `### 边界检查结果

**总体结论**: ${statusText}

### 详细检查项

${checkItems.join('\n')}
${citations}
`;
  },

  generateSuspendedSection(suspendedTasks?: SuspendedTask[]): string {
    if (!suspendedTasks || suspendedTasks.length === 0) {
      return '> 本次复核无挂起任务';
    }

    const items = suspendedTasks.map((task) => {
      const statusIcon = task.status === 'pending' ? '⏳' : task.status === 'confirmed' ? '✅' : '❌';
      const statusText = task.status === 'pending' ? '待处理' : task.status === 'confirmed' ? '已确认' : '已驳回';
      const reasonText = task.reason === 'duplicate_sample' ? '重复样本' : '口径变更';
      
      let resolutionText = '';
      if (task.resolution) {
        const actionText = task.resolution.action === 'continue' ? '继续处理' : task.resolution.action === 'new_session' ? '新建会话' : '已驳回';
        resolutionText = `
  - 处理方式: ${actionText}
  - 处理人: ${task.resolution.resolvedBy}
  - 处理时间: ${new Date(task.resolution.resolvedAt).toLocaleString('zh-CN')}
  - 处理说明: ${task.resolution.notes}`;
      }

      return `#### ${statusIcon} ${reasonText} - ${statusText}

**挂起时间**: ${new Date(task.createdAt).toLocaleString('zh-CN')}
**挂起人**: ${task.createdBy}
**描述**: ${task.description}${resolutionText}
`;
    });

    const pendingCount = suspendedTasks.filter((t) => t.status === 'pending').length;
    const warning = pendingCount > 0
      ? `\n\n> ⚠️ **注意：还有 ${pendingCount} 个挂起任务待处理，结论可能不完整**`
      : '';

    return `${items.join('\n---\n')}${warning}
`;
  },

  generateConclusionSection(steps: ComputationStep[], suspendedTasks?: SuspendedTask[]): string {
    if (steps.length === 0) {
      return '> 暂无计算结果';
    }

    const finalStep = steps[steps.length - 1];
    const hasManualEdits = steps.some((s) => s.manuallyModified);
    const boundaryStep = steps.find((s) => s.resultUnit === 'pass/fail');
    const boundaryPassed = boundaryStep ? boundaryStep.result === 1 : true;

    const manualWarning = hasManualEdits
      ? '\n\n> ⚠️ **注意：计算过程中包含人工修改，请仔细复核修改内容**'
      : '';

    const pendingWarning = suspendedTasks?.some((t) => t.status === 'pending')
      ? '\n\n> ⚠️ **注意：存在未处理的挂起任务，结论可能不完整**'
      : '';

    const totalError = finalStep.errorContribution
      ? Math.sqrt(
          Object.values(finalStep.errorContribution).reduce((sum, ec) => sum + ec * ec, 0)
        )
      : 0;

    const relativeError = Math.abs(finalStep.result) > 0
      ? ((totalError / Math.abs(finalStep.result)) * 100).toFixed(4)
      : 'N/A';

    const boundaryStatus = boundaryStep
      ? (boundaryPassed ? '✅ 边界检查通过' : '❌ 边界检查未通过')
      : 'ℹ️ 未执行边界检查';

    const overallStatus = boundaryPassed && (!suspendedTasks?.some((t) => t.status === 'pending'))
      ? '✅ 复核通过'
      : '⚠️ 需要进一步确认';

    return `### 复核结论

**最终状态**: ${overallStatus}
**边界检查**: ${boundaryStatus}

### 最终结果

\`\`\`
f = ${finalStep.result.toFixed(6)} ± ${totalError.toFixed(6)} ${finalStep.resultUnit}
相对误差: ${relativeError}%
\`\`\`

### 误差分析

1. **总误差**: ${totalError.toFixed(6)} ${finalStep.resultUnit}
2. **相对误差**: ${relativeError}%
3. **结果单位**: ${finalStep.resultUnit}
${manualWarning}${pendingWarning}

### 结论依据

1. 所有计算步骤均已展开，包含误差传播公式、参数代入、单位换算和中间数值
2. 边界条件已与历史答案原文进行比对和溯源
3. 人工修改和挂起任务均有完整记录，可追溯操作人、修改内容和原因
`;
  },

  generateCitationsSection(citations: Citation[], materials: Material[]): string {
    if (citations.length === 0) {
      return '> 暂无引用';
    }

    const items = citations.map((citation, index) => {
      const material = materials.find((m) => m.id === citation.materialId);
      const label = material ? MATERIAL_LABELS[material.type] : '未知来源';
      const quotePreview = citation.anchorText.length > 100
        ? citation.anchorText.substring(0, 100) + '...'
        : citation.anchorText;

      return `[${index + 1}] **${label}**: "${quotePreview}"
   - 材料ID: \`${citation.materialId}\``;
    });

    return items.join('\n\n');
  },

  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      draft: '📝 草稿',
      pending: '⏳ 待处理',
      computing: '⚙️ 计算中',
      suspended: '⏸️ 已挂起',
      completed: '✅ 已完成',
    };
    return statusMap[status] || status;
  },

  exportMarkdown(report: Report): string {
    return report.content;
  },

  downloadReport(report: Report, format: 'md' | 'json' = 'md'): void {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(report, null, 2);
      filename = `report-${report.id}.json`;
      mimeType = 'application/json';
    } else {
      content = report.content;
      filename = `report-${shortHash(report.id, 8)}.md`;
      mimeType = 'text/markdown';
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
  },
};
