import type { BoundaryRecord, Material, CaliberVersion, CSVExportConfig, ReviewSummary } from '../types';

export class CSVExporter {
  static exportBoundaryRecords(
    records: BoundaryRecord[],
    material: Material,
    caliber: CaliberVersion,
    config: CSVExportConfig,
    caliberVersions: CaliberVersion[] = []
  ): string {
    const rows: string[][] = [];

    if (config.includeCaliberInfo) {
      rows.push(['=== 概率模拟边界复核 - 导出明细 ===']);
      rows.push(['导出时间', new Date().toLocaleString('zh-CN')]);
      rows.push(['材料标题', material.title]);
      rows.push(['材料ID', material.id]);
      rows.push(['当前口径版本', `${caliber.version} - ${caliber.name}`]);
      rows.push(['口径说明', caliber.description]);
      rows.push(['口径发布时间', new Date(caliber.createdAt).toLocaleString('zh-CN')]);
      rows.push([]);

      rows.push(['=== 口径阈值定义 ===']);
      rows.push(['指标名称', '最小值', '最大值', '单位', '说明']);
      caliber.thresholds.forEach((t) => {
        rows.push([t.name, t.minValue.toString(), t.maxValue.toString(), t.unit, t.description]);
      });
      rows.push([]);

      rows.push(['=== 口径公式定义 ===']);
      rows.push(['公式名称', '表达式', '变量', '说明']);
      caliber.formulas.forEach((f) => {
        rows.push([f.name, f.expression, f.variables.join(', '), f.description]);
      });
      rows.push([]);
    }

    if (config.format === 'detailed') {
      rows.push(['=== 边界复核明细 ===']);
      const header = [
        '序号',
        '原始对象名称',
        '标准名称',
        '输入值',
        '输入单位',
        '计算值(换算后)',
        '计算单位',
        '概率值',
        '阈值下限',
        '阈值上限',
        '阈值单位',
        '是否在界内',
        '状态',
        '异常数量',
        '错误数量',
        '警告数量',
        '是否外推',
        '外推方向',
        '外推影响范围',
        '数据来源',
        '使用口径版本',
        '创建时间'
      ];

      if (config.includeAnomalies) {
        header.push('异常详情');
      }
      if (config.includeCalculationTrace) {
        header.push('计算轨迹');
      }

      rows.push(header);

      records.forEach((record, index) => {
        const errors = record.anomalies.filter((a) => a.severity === 'error').length;
        const warnings = record.anomalies.filter((a) => a.severity === 'warning').length;
        
        const row: string[] = [
          (index + 1).toString(),
          record.objectName,
          record.canonicalName,
          record.inputValue.toString(),
          record.inputUnit,
          record.calculatedValue.toString(),
          record.calculatedUnit,
          (record.probability * 100).toFixed(2) + '%',
          record.lowerBound.toString(),
          record.upperBound.toString(),
          record.boundUnit,
          record.isWithinBounds ? '是' : '否',
          this.getStatusLabel(record.status),
          record.anomalies.length.toString(),
          errors.toString(),
          warnings.toString(),
          record.extrapolation ? '是' : '否',
          record.extrapolation?.direction === 'up' ? '向上' : record.extrapolation?.direction === 'down' ? '向下' : '',
          record.extrapolation?.impactScope.join('; ') || '',
          record.sourceName,
          `${caliber.version} - ${caliber.name}`,
          new Date(record.createdAt).toLocaleString('zh-CN')
        ];

        if (config.includeAnomalies) {
          const anomalyDetails = record.anomalies
            .map((a) => `[${this.getBlockTypeLabel(a.blockType)}][${this.getSeverityLabel(a.severity)}] ${a.message}`)
            .join(' | ');
          row.push(anomalyDetails);
        }

        if (config.includeCalculationTrace) {
          const traceDetails = record.calculationTrace
            .map((t) => `步骤${t.step}: ${t.formula} = ${t.result.toFixed(4)}`)
            .join(' | ');
          row.push(traceDetails);
        }

        rows.push(row);
      });
    } else {
      rows.push(['=== 边界复核汇总 ===']);
      rows.push(['指标名称', '记录数', '界内数量', '界外数量', '错误数', '警告数', '外推数']);
      
      const byCanonical = new Map<string, BoundaryRecord[]>();
      records.forEach((r) => {
        const list = byCanonical.get(r.canonicalName) || [];
        list.push(r);
        byCanonical.set(r.canonicalName, list);
      });

      byCanonical.forEach((list, name) => {
        const within = list.filter((r) => r.isWithinBounds).length;
        const errors = list.filter((r) => r.anomalies.some((a) => a.severity === 'error')).length;
        const warnings = list.filter((r) => r.anomalies.some((a) => a.severity === 'warning')).length;
        const extrapolations = list.filter((r) => r.extrapolation).length;
        
        rows.push([
          name,
          list.length.toString(),
          within.toString(),
          (list.length - within).toString(),
          errors.toString(),
          warnings.toString(),
          extrapolations.toString()
        ]);
      });
    }

    rows.push([]);
    rows.push(['=== 材料来源说明 ===']);
    rows.push(['来源类型', '名称', '上传时间', '使用口径']);
    const caliberLabel = (id: string): string => {
      if (id === caliber.id) return `${caliber.version} - ${caliber.name}`;
      const found = caliberVersions.find((cv) => cv.id === id);
      return found ? `${found.version} - ${found.name}` : id;
    };
    material.materials.forEach((m) => {
      rows.push([
        this.getSourceTypeLabel(m.type),
        m.name,
        new Date(m.uploadTime).toLocaleString('zh-CN'),
        caliberLabel(m.caliberVersionId)
      ]);
    });

    if (material.scoreRemark) {
      rows.push([]);
      rows.push(['=== 评分备注 ===']);
      rows.push([material.scoreRemark]);
    }

    if (material.oralNote) {
      rows.push([]);
      rows.push(['=== 临时口头说明 ===']);
      rows.push([material.oralNote]);
    }

    return this.rowsToCSV(rows);
  }

  static exportSummary(summary: ReviewSummary, caliber: CaliberVersion): string {
    const rows: string[][] = [];

    rows.push(['=== 概率模拟边界复核 - 汇总报告 ===']);
    rows.push(['导出时间', new Date().toLocaleString('zh-CN')]);
    rows.push(['当前口径版本', `${caliber.version} - ${caliber.name}`]);
    rows.push([]);

    rows.push(['统计项', '数量', '占比']);
    rows.push(['总记录数', summary.totalRecords.toString(), '100%']);
    rows.push(['界内记录', summary.withinBounds.toString(), this.calcPercent(summary.withinBounds, summary.totalRecords)]);
    rows.push(['界外记录', summary.outOfBounds.toString(), this.calcPercent(summary.outOfBounds, summary.totalRecords)]);
    rows.push(['错误记录', summary.errors.toString(), this.calcPercent(summary.errors, summary.totalRecords)]);
    rows.push(['警告记录', summary.warnings.toString(), this.calcPercent(summary.warnings, summary.totalRecords)]);
    rows.push(['外推记录', summary.extrapolations.toString(), this.calcPercent(summary.extrapolations, summary.totalRecords)]);
    rows.push(['别名解析记录', summary.aliasResolved.toString(), this.calcPercent(summary.aliasResolved, summary.totalRecords)]);

    return this.rowsToCSV(rows);
  }

  static exportBusinessExplanation(
    records: BoundaryRecord[],
    material: Material,
    caliber: CaliberVersion
  ): string {
    const rows: string[][] = [];

    rows.push(['=== 概率模拟边界复核 - 业务解释报告 ===']);
    rows.push(['生成时间', new Date().toLocaleString('zh-CN')]);
    rows.push(['报告用途', '月底封账说明 - 供非技术人员阅读']);
    rows.push([]);

    rows.push(['一、材料基本信息']);
    rows.push(['材料名称', material.title]);
    rows.push(['数据来源', material.materials.map((m) => m.name).join('、')]);
    rows.push(['数据项数', material.items.length.toString()]);
    rows.push([]);

    rows.push(['二、复核标准说明']);
    rows.push(['使用口径', `${caliber.version}版 - ${caliber.name}`]);
    rows.push(['口径说明', caliber.description]);
    rows.push([]);

    rows.push(['三、复核结果概览']);
    const total = records.length;
    const within = records.filter((r) => r.isWithinBounds).length;
    const errors = records.filter((r) => r.status === 'error').length;
    const warnings = records.filter((r) => r.status === 'warning').length;
    
    rows.push(['复核记录总数', total.toString()]);
    rows.push(['正常通过', `${within}条 (${this.calcPercent(within, total)})`]);
    rows.push(['需要关注', `${warnings}条 (${this.calcPercent(warnings, total)})`]);
    rows.push(['存在问题', `${errors}条 (${this.calcPercent(errors, total)})`]);
    rows.push([]);

    rows.push(['四、异常详情说明']);
    const errorRecords = records.filter((r) => r.status === 'error');
    if (errorRecords.length > 0) {
      rows.push(['序号', '指标名称', '数值', '问题描述', '处理建议']);
      errorRecords.forEach((r, idx) => {
        const mainError = r.anomalies.find((a) => a.severity === 'error');
        rows.push([
          (idx + 1).toString(),
          r.canonicalName,
          `${r.inputValue}${r.inputUnit}`,
          mainError?.message || '未知错误',
          '请核查数据准确性，必要时人工复核'
        ]);
      });
    } else {
      rows.push(['无错误记录']);
    }
    rows.push([]);

    rows.push(['五、外推情况说明']);
    const extrapolationRecords = records.filter((r) => r.extrapolation);
    if (extrapolationRecords.length > 0) {
      rows.push(['序号', '指标名称', '外推方向', '影响范围', '处理建议']);
      extrapolationRecords.forEach((r, idx) => {
        rows.push([
          (idx + 1).toString(),
          r.canonicalName,
          r.extrapolation!.direction === 'up' ? '向上外推' : '向下外推',
          r.extrapolation!.impactScope.join('、'),
          '建议设置审慎调整因子，人工复核确认'
        ]);
      });
    } else {
      rows.push(['无外推记录']);
    }
    rows.push([]);

    rows.push(['六、数字来源线索']);
    rows.push(['序号', '指标名称', '输入值', '数据来源', '来源类型', '来源内容', '计算公式', '结果说明']);
    records.forEach((r, idx) => {
      const formula = r.calculationTrace.find((t) => t.source === 'probability_calculation')?.formula
        || (r.isMaterialLevel ? '材料级校验' : '标准公式');
      const sourceTypeLabel = r.sourceType === 'file' ? '文件材料' : r.sourceType === 'remark' ? '评分备注' : '口头说明';
      const resultNote = r.isMaterialLevel
        ? '材料级异常，需人工核查'
        : r.isWithinBounds
          ? '计算结果在阈值范围内，复核通过'
          : '计算结果超出阈值范围，需关注';

      rows.push([
        (idx + 1).toString(),
        r.canonicalName,
        r.isMaterialLevel ? '—' : `${r.inputValue}${r.inputUnit}`,
        r.sourceName,
        sourceTypeLabel,
        r.sourceContext.replace(/\n/g, ' ').slice(0, 200),
        formula,
        resultNote
      ]);
    });

    rows.push([]);
    rows.push(['=== 口径一致性说明 ===']);
    rows.push(['本文件所有数值均按当前口径输出，与页面展示一致']);
    rows.push(['当前口径版本', `${caliber.version} - ${caliber.name}`]);
    rows.push(['百分比单位说明', '阈值与输入值均按百分比语义比较（如 2.5% 与 0-3% 比较）']);
    caliber.thresholds.forEach((t) => {
      rows.push([t.name, `[${t.minValue}, ${t.maxValue}]${t.unit}`, t.description]);
    });

    return this.rowsToCSV(rows);
  }

  static downloadCSV(content: string, filename: string): void {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private static rowsToCSV(rows: string[][]): string {
    return rows
      .map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return '';
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\n');
  }

  private static getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: '待处理',
      calculating: '计算中',
      completed: '已完成',
      error: '错误',
      warning: '警告'
    };
    return labels[status] || status;
  }

  private static getBlockTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      formula: '公式',
      unit: '单位',
      threshold: '阈值',
      extrapolation: '外推',
      alias: '别名',
      consistency: '材料一致性',
      caliber: '口径变更'
    };
    return labels[type] || type;
  }

  private static getSeverityLabel(severity: string): string {
    const labels: Record<string, string> = {
      error: '错误',
      warning: '警告',
      info: '提示'
    };
    return labels[severity] || severity;
  }

  private static getSourceTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      file: '文件材料',
      remark: '评分备注',
      oral: '口头说明'
    };
    return labels[type] || type;
  }

  private static calcPercent(part: number, total: number): string {
    if (total === 0) return '0%';
    return `${(part / total * 100).toFixed(1)}%`;
  }
}
