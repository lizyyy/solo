export function generateSummary(parseResult, validateResult, matchResult) {
  const { records, parseErrors } = parseResult;
  const { validRecords, validationErrors } = validateResult;
  const { matchedResults, unmatchedRecords, allResults } = matchResult;

  const errorTypeCounts = {};
  validationErrors.forEach(record => {
    record.errors.forEach(error => {
      errorTypeCounts[error.type] = (errorTypeCounts[error.type] || 0) + 1;
    });
  });

  const totalAmount = validRecords.reduce((sum, r) => sum + r.实收金额, 0);
  const matchedAmount = matchedResults.reduce((sum, r) => sum + r.无牌车实收金额, 0);
  const unmatchedAmount = unmatchedRecords.reduce((sum, r) => sum + r.无牌车实收金额, 0);

  const confidenceDistribution = {
    '90-100': 0,
    '70-89': 0,
    '50-69': 0,
    '<50': 0
  };

  matchedResults.forEach(r => {
    if (r.匹配置信度 >= 90) confidenceDistribution['90-100']++;
    else if (r.匹配置信度 >= 70) confidenceDistribution['70-89']++;
    else if (r.匹配置信度 >= 50) confidenceDistribution['50-69']++;
    else confidenceDistribution['<50']++;
  });

  return {
    报告标题: '停车场流水无牌车匹配复核报告',
    生成时间: new Date().toISOString(),
    文件统计: {
      总记录数: records.length,
      解析错误数: parseErrors.length,
      有效记录数: validRecords.length,
      异常记录数: validationErrors.length
    },
    无牌车匹配统计: {
      无牌车总数: allResults.length,
      匹配成功数: matchedResults.length,
      匹配成功率: allResults.length > 0 ? (matchedResults.length / allResults.length * 100).toFixed(2) + '%' : '0%',
      未匹配数: unmatchedRecords.length,
      匹配成功金额: matchedAmount.toFixed(2),
      未匹配金额: unmatchedAmount.toFixed(2)
    },
    异常类型统计: errorTypeCounts,
    匹配置信度分布: confidenceDistribution,
    金额统计: {
      总实收金额: totalAmount.toFixed(2),
      无牌车实收金额: (matchedAmount + unmatchedAmount).toFixed(2),
      无牌车金额占比: totalAmount > 0 ? ((matchedAmount + unmatchedAmount) / totalAmount * 100).toFixed(2) + '%' : '0%'
    }
  };
}
