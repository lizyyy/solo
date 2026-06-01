import type { CalculationRecord, Sample, ReportSection, Batch, Remark } from '@/types';

export class ReportGenerator {
  generateReport(
    batch: Batch,
    records: CalculationRecord[],
    samples: Sample[],
    remarks: Remark[]
  ): {
    sections: ReportSection[];
    summary: string;
    actionItems: string[];
  } {
    const sections: ReportSection[] = [];
    const actionItems: string[] = [];

    sections.push({
      title: '📊 批次概览',
      type: 'summary',
      content: '本批次"' + batch.name + '"共处理' + batch.totalSamples + '个样本，其中：\n• 顺利完成：' + batch.successCount + '个\n• 待人工确认：' + batch.pendingCount + '个\n• 历史口径补录：' + batch.legacyCount + '个\n• 异常记录：' + batch.errorCount + '个\n\n计算时间：' + new Date(batch.createdAt).toLocaleString('zh-CN'),
    });

    const successRecords = records.filter((r) => r.type === 'success');
    if (successRecords.length > 0) {
      const names = successRecords.map((r) => r.sampleName).join('、');
      sections.push({
        title: '✅ 顺利完成记录',
        type: 'summary',
        content: '以下' + successRecords.length + '条记录计算顺利：\n' + names + '\n\n【处理建议】这些记录的社区结构清晰，可直接使用结果进行后续分析。',
      });
    }

    const pendingRecords = records.filter((r) => r.type === 'pending');
    if (pendingRecords.length > 0) {
      const details = pendingRecords
        .map((r) => {
          const sample = samples.find((s) => s.id === r.sampleId);
          return '• ' + r.sampleName + '：' + (r.errorReason || r.processingAdvice) + (sample?.remark ? '\n  备注：' + sample.remark : '');
        })
        .join('\n\n');

      sections.push({
        title: '⚠️ 待人工确认记录',
        type: 'warning',
        content: '以下' + pendingRecords.length + '条记录需要您的关注：\n\n' + details,
        highlight: true,
      });

      actionItems.push(...pendingRecords.map((r) => r.sampleName + '：' + (r.processingAdvice || '请人工确认')));
    }

    const legacyRecords = records.filter((r) => r.type === 'legacy');
    if (legacyRecords.length > 0) {
      const details = legacyRecords
        .map((r) => {
          const sample = samples.find((s) => s.id === r.sampleId);
          return '• ' + r.sampleName + '：' + (sample?.legacySource || '历史复盘图表') + '\n  ' + r.processingAdvice;
        })
        .join('\n\n');

      sections.push({
        title: '📜 历史口径补录记录',
        type: 'detail',
        content: '以下' + legacyRecords.length + '条记录来自历史数据补录：\n\n' + details,
      });
    }

    const unitIssues = records.filter((r) => r.unitCheck.issues.length > 0);
    if (unitIssues.length > 0) {
      const issueDetails = unitIssues
        .map((r) => '• ' + r.sampleName + '：' + r.unitCheck.issues.join('；'))
        .join('\n');

      sections.push({
        title: '🔍 单位校验提醒',
        type: 'warning',
        content: '发现' + unitIssues.length + '条记录存在单位不一致问题：\n\n' + issueDetails + '\n\n【处理建议】请检查参数单位，统一规范后重新计算，避免结果偏差。',
        highlight: true,
      });

      actionItems.push('统一所有参数单位规范，去除不必要的单位文字描述');
    }

    if (remarks.length > 0) {
      const remarkDetails = remarks
        .map((r) => {
          const record = records.find((rec) => rec.id === r.recordId);
          return '• ' + (record?.sampleName || r.recordId) + '：' + r.content + '\n  [' + r.addedBy + ' @ ' + new Date(r.addedAt).toLocaleString('zh-CN') + ']';
        })
        .join('\n\n');

      sections.push({
        title: '📝 补录备注',
        type: 'advice',
        content: '周姐补充说明：\n\n' + remarkDetails + '\n\n【注意】以上为临时补录内容，已高亮差异部分请特别留意。',
        highlight: true,
      });
    }

    sections.push({
      title: '📋 交接提醒',
      type: 'advice',
      content: '1. 所有计算过程已保留完整步骤，点击记录可追溯\n2. 异常样本未自动过滤，均在本表中列明\n3. 图神经网络社区解释算法参与了所有记录的判断\n4. 如需复查：可从图表点击跳转至对应明细\n5. 后续交接：新接手人员可通过本系统查看历史记录',
    });

    const summary = this.generateSummary(batch, records, samples);

    return { sections, summary, actionItems };
  }

  private generateSummary(batch: Batch, records: CalculationRecord[], samples: Sample[]): string {
    const successRate = ((batch.successCount / batch.totalSamples) * 100).toFixed(1);
    const hasIssues = batch.pendingCount + batch.errorCount > 0;

    let summary = '批次"' + batch.name + '"处理完成。';
    summary += '完成率' + successRate + '%（' + batch.successCount + '/' + batch.totalSamples + '）。';

    if (hasIssues) {
      summary += '' + batch.pendingCount + '条待确认、' + batch.errorCount + '条异常。';
      summary += '请周姐核对异常样本后确认结果。';
    } else {
      summary += '全部计算顺利，可直接使用。';
    }

    return summary;
  }

  generateBusinessAdvice(record: CalculationRecord): string {
    const advice = [];

    if (!record.unitCheck.passed) {
      advice.push('单位不一致问题');
    }

    if (record.errorReason) {
      advice.push('数据完整性');
    }

    if (record.type === 'pending') {
      advice.push('边界值人工复核');
    }

    if (record.type === 'legacy') {
      advice.push('历史口径参考');
    }

    if (advice.length === 0) {
      return '该记录计算完成，可直接用于业务分析';
    }

    return '请关注：' + advice.join('、');
  }
}

export const reportGenerator = new ReportGenerator();
