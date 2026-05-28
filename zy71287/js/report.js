class ReportExporter {
  constructor(permissionLevel) {
    this.permissionLevel = permissionLevel || 'standard';
    this._auditLog = [];
  }

  _maskIfNeeded(obj) {
    if (this.permissionLevel === 'admin') return obj;
    const copy = { ...obj };
    for (const f of SENSITIVE_FIELDS) {
      if (copy[f] != null) copy[f] = '***';
    }
    return copy;
  }

  _logExport(format, recordCount, reportId) {
    this._auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EXPORT',
      format,
      recordCount,
      reportId,
      permissionLevel: this.permissionLevel,
    });
  }

  getAuditLog() {
    return [...this._auditLog];
  }

  toCSV(report) {
    const rows = [];
    const headers = [
      '报告ID', '数据来源', '订单ID', '箱型ID', '箱型名称',
      '商品ID', '商品名称', '位置X(mm)', '位置Y(mm)', '位置Z(mm)',
      '尺寸dx(mm)', '尺寸dy(mm)', '尺寸dz(mm)', '旋转方式',
      '易碎', '重量(g)', '体积利用率', '重量利用率',
      '总重量(g)', '状态码', '状态说明',
    ];

    rows.push(headers.join(','));

    for (const p of report.placements) {
      const masked = this._maskIfNeeded(p);
      const row = [
        report.id,
        DATA_SOURCE_LABEL[DATA_SOURCE.PACKING_REPORT],
        report.orderId || '',
        report.boxTypeId,
        report.boxTypeName,
        masked.productId,
        masked.productName,
        masked.position.x,
        masked.position.y,
        masked.position.z,
        masked.dimensions.dx,
        masked.dimensions.dy,
        masked.dimensions.dz,
        ROTATION_MAP[masked.rotation] ? ROTATION_MAP[masked.rotation].label : masked.rotation,
        masked.fragile ? '是' : '否',
        masked.weight,
        (report.utilization * 100).toFixed(1) + '%',
        (report.weightUtilization * 100).toFixed(1) + '%',
        report.totalWeight,
        report.status,
        PACK_STATUS_LABEL[report.status],
      ];
      rows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }

    if (report.unpackedItems.length > 0) {
      rows.push('');
      rows.push('"--- 未装入商品 ---"');
      const unplacedHeaders = ['商品ID', '商品名称', '重量(g)', '易碎', '失败原因'];
      rows.push(unplacedHeaders.join(','));
      for (const u of report.unpackedItems) {
        const masked = this._maskIfNeeded(u);
        const failure = report.failures.find(f => f.productId === masked.productId);
        const row = [
          masked.productId,
          masked.productName,
          masked.weight,
          masked.fragile ? '是' : '否',
          failure ? failure.message : '',
        ];
        rows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      }
    }

    this._logExport('CSV', report.placements.length, report.id);
    return rows.join('\n');
  }

  toJSON(report) {
    const output = {
      report: this._maskIfNeeded(report.summary()),
      placements: report.placements.map(p => {
        const d = this._maskIfNeeded(p);
        return d.toDisplay ? d.toDisplay() : d;
      }),
      unpackedItems: report.unpackedItems.map(u => this._maskIfNeeded(u)),
      failures: report.failures.map(f => ({
        status: f.status,
        statusLabel: PACK_STATUS_LABEL[f.status] || f.status,
        message: f.message,
        productId: f.productId,
        productName: f.productName,
      })),
      constraintLog: this._maskIfNeeded({ violationsLogged: report.failures.length }),
    };

    this._logExport('JSON', report.placements.length, report.id);
    return JSON.stringify(output, null, 2);
  }

  downloadCSV(report, filename) {
    const csv = this.toCSV(report);
    this._triggerDownload(csv, filename || `${report.id}.csv`, 'text/csv;charset=utf-8');
  }

  downloadJSON(report, filename) {
    const json = this.toJSON(report);
    this._triggerDownload(json, filename || `${report.id}.json`, 'application/json');
  }

  _triggerDownload(content, filename, mimeType) {
    const bom = '\uFEFF';
    const blob = new Blob([bom + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  }
}
