function checkTemperature(mergedData, threshold) {
  const rejectedRecords = [];
  const acceptedRecords = [];
  const anomalyRecords = [];

  for (const record of mergedData) {
    const isRejected = record.temperature.max >= threshold;

    const hasAnomaly = record.temperature.records.some(t => t.temperature >= threshold);

    if (hasAnomaly) {
      const anomalySamples = record.temperature.records
        .filter(t => t.temperature >= threshold)
        .map(t => ({
          ...t,
          batchId: record.batchId,
          supplier: record.supplier,
          category: record.category
        }));
      anomalyRecords.push(...anomalySamples);
    }

    const resultRecord = {
      ...record,
      result: isRejected ? 'REJECTED' : 'ACCEPTED',
      rejectionReason: isRejected ? `最高温度 ${record.temperature.max}℃ ≥ 阈值 ${threshold}℃` : null
    };

    if (isRejected) {
      rejectedRecords.push(resultRecord);
    } else {
      acceptedRecords.push(resultRecord);
    }
  }

  return {
    rejectedRecords,
    acceptedRecords,
    anomalyRecords
  };
}

function generateStatistics(data) {
  const { rejectedRecords, acceptedRecords, anomalyRecords, badRows, totalProcessed } = data;

  const supplierStats = {};
  const categoryStats = {};

  const allRecords = [...rejectedRecords, ...acceptedRecords];

  for (const record of allRecords) {
    if (!supplierStats[record.supplier]) {
      supplierStats[record.supplier] = {
        total: 0,
        rejected: 0,
        accepted: 0,
        rejectionRate: 0,
        totalQuantity: 0,
        rejectedQuantity: 0,
        categories: new Set()
      };
    }
    supplierStats[record.supplier].total++;
    supplierStats[record.supplier].totalQuantity += record.quantity;
    supplierStats[record.supplier].categories.add(record.category);

    if (record.result === 'REJECTED') {
      supplierStats[record.supplier].rejected++;
      supplierStats[record.supplier].rejectedQuantity += record.quantity;
    } else {
      supplierStats[record.supplier].accepted++;
    }
  }

  for (const supplier in supplierStats) {
    const stats = supplierStats[supplier];
    stats.rejectionRate = parseFloat(((stats.rejected / stats.total) * 100).toFixed(2));
    stats.categories = Array.from(stats.categories);
  }

  for (const record of allRecords) {
    if (!categoryStats[record.category]) {
      categoryStats[record.category] = {
        total: 0,
        rejected: 0,
        accepted: 0,
        rejectionRate: 0
      };
    }
    categoryStats[record.category].total++;
    if (record.result === 'REJECTED') {
      categoryStats[record.category].rejected++;
    } else {
      categoryStats[record.category].accepted++;
    }
  }

  for (const category in categoryStats) {
    const stats = categoryStats[category];
    stats.rejectionRate = parseFloat(((stats.rejected / stats.total) * 100).toFixed(2));
  }

  const totalRejected = rejectedRecords.length;
  const totalAccepted = acceptedRecords.length;

  return {
    summary: {
      totalProcessed,
      totalRejected,
      totalAccepted,
      totalAnomalies: anomalyRecords.length,
      totalBadRows: badRows.length,
      rejectionRate: totalProcessed > 0 
        ? parseFloat(((totalRejected / totalProcessed) * 100).toFixed(2)) 
        : 0,
      totalQuantity: allRecords.reduce((sum, r) => sum + r.quantity, 0),
      rejectedQuantity: rejectedRecords.reduce((sum, r) => sum + r.quantity, 0)
    },
    bySupplier: supplierStats,
    byCategory: categoryStats,
    topRejectedSuppliers: Object.entries(supplierStats)
      .sort((a, b) => b[1].rejected - a[1].rejected)
      .slice(0, 5)
      .map(([name, stats]) => ({
        supplier: name,
        ...stats
      }))
  };
}

module.exports = {
  checkTemperature,
  generateStatistics
};