class DataStore {
  constructor() {
    this.anomalies = new Map();
  }

  add(anomaly) {
    this.anomalies.set(anomaly.id, anomaly);
  }

  getById(id) {
    return this.anomalies.get(id);
  }

  getAll() {
    return Array.from(this.anomalies.values());
  }

  update(anomaly) {
    if (!this.anomalies.has(anomaly.id)) {
      throw new Error('记录不存在');
    }
    this.anomalies.set(anomaly.id, anomaly);
  }

  delete(id) {
    return this.anomalies.delete(id);
  }

  findByRecordId(recordId) {
    return this.getAll().filter(a => a.recordId === recordId);
  }

  findByStatus(status) {
    return this.getAll().filter(a => a.status === status);
  }

  getUnifiedViewData(anomalyId) {
    const anomaly = this.getById(anomalyId);
    if (!anomaly) {
      throw new Error('记录不存在');
    }
    return anomaly.toJSON();
  }

  getExportData(anomalyId, format = 'json') {
    const anomaly = this.getById(anomalyId);
    if (!anomaly) {
      throw new Error('记录不存在');
    }

    const baseData = anomaly.toJSON();
    
    if (format === 'json') {
      return {
        ...baseData,
        meta: {
          exportTime: new Date().toISOString(),
          exportedBy: 'system'
        }
      };
    }

    if (format === 'csv') {
      return this.convertToCSV(baseData);
    }

    return baseData;
  }

  getApiResponse(anomalyId) {
    const anomaly = this.getById(anomalyId);
    if (!anomaly) {
      throw new Error('记录不存在');
    }
    return anomaly.toJSON();
  }

  convertToCSV(data) {
    const headers = [
      'ID', '证券代码', '证券名称', '市值', '计算值', '偏离值', '偏离率',
      '状态', '备注', '是否零值冲正', '创建时间', '更新时间'
    ];
    
    const rows = [
      headers.join(','),
      [
        data.id,
        data.securityCode,
        data.securityName,
        data.marketValue,
        data.calculatedValue,
        data.deviation,
        data.deviationRate,
        data.statusText,
        `"${data.remark}"`,
        data.isZeroWithReversal ? '是' : '否',
        data.createdAt,
        data.updatedAt
      ].join(',')
    ];

    return rows.join('\n');
  }

  exportAllSummary() {
    const all = this.getAll();
    return {
      total: all.length,
      byStatus: all.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {}),
      requiresRiskReview: all.filter(a => a.isZeroWithReversal).length,
      hasConflicts: all.filter(a => a.conflicts.length > 0).length,
      list: all.map(a => ({
        id: a.id,
        securityCode: a.securityCode,
        securityName: a.securityName,
        marketValue: a.marketValue,
        status: a.status,
        statusText: a.getStatusText(),
        isZeroWithReversal: a.isZeroWithReversal,
        workflowStep: a.workflowStep
      }))
    };
  }
}

module.exports = DataStore;
