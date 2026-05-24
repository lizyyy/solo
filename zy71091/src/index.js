const { parseArgs } = require('./cli.js');
const { validateOptions, validateSampleData, EXIT_CODES } = require('./validator.js');
const { readSampleFile, applySampling, normalizeData, calculateBasicStats } = require('./reader.js');
const { aggregateByPrefix, detectPrefixPatterns, analyzePrefixMemoryDistribution, findHighRiskPrefixes } = require('./prefix.js');
const { analyzeTTL } = require('./ttl.js');
const { compareSnapshots } = require('./trend.js');
const { writeReports } = require('./reporter.js');

async function main() {
  const options = parseArgs(process.argv);

  const optionValidation = validateOptions(options);
  if (!optionValidation.isValid) {
    console.error('参数验证失败:');
    optionValidation.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(EXIT_CODES.INPUT_ERROR);
  }

  if (optionValidation.warnings.length > 0 && !options.quiet) {
    console.warn('参数警告:');
    optionValidation.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  const currentSample = readSampleFile(options.input);
  if (!currentSample.success) {
    console.error(`读取输入文件失败: ${currentSample.message}`);
    process.exit(currentSample.error === 'INVALID_JSON' ? EXIT_CODES.INVALID_JSON : EXIT_CODES.FILE_NOT_FOUND);
  }

  const dataValidation = validateSampleData(currentSample.data, options.strict);
  if (!dataValidation.isValid) {
    console.error('样本数据验证失败:');
    dataValidation.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }

  const normalizedData = normalizeData(currentSample.data);
  const sampling = applySampling(normalizedData, parseFloat(options.sampleRate));
  const basicStats = calculateBasicStats(sampling.sampledData);

  const prefixDepth = parseInt(options.prefixDepth, 10);
  const topN = parseInt(options.topN, 10);

  const prefixByDepth = aggregateByPrefix(
    sampling.sampledData,
    options.prefixSeparator,
    prefixDepth,
    topN
  );

  const prefixPatterns = detectPrefixPatterns(sampling.sampledData, options.prefixSeparator);
  const memoryDistribution = analyzePrefixMemoryDistribution(prefixByDepth, prefixDepth);
  const highRiskPrefixes = findHighRiskPrefixes(prefixByDepth, prefixDepth);

  const ttlAnalysis = analyzeTTL(sampling.sampledData, options.ttlBuckets);

  let trendAnalysis = null;
  if (options.previous) {
    const previousSample = readSampleFile(options.previous);
    if (previousSample.success) {
      const prevNormalized = normalizeData(previousSample.data);
      trendAnalysis = compareSnapshots(
        sampling.sampledData,
        prevNormalized,
        options.prefixSeparator,
        prefixDepth
      );
    } else if (!options.quiet) {
      console.warn(`警告: 无法读取历史快照文件: ${previousSample.message}`);
    }
  }

  const analysisResult = {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceFile: currentSample.sourceFile,
      sampled: sampling.isSampled || false,
      sampleRate: sampling.sampleRate,
      originalCount: sampling.totalCount,
      analyzedCount: sampling.sampledCount
    },
    basicStats,
    prefixAnalysis: {
      byDepth: prefixByDepth,
      patterns: prefixPatterns,
      memoryDistribution,
      highRiskPrefixes
    },
    ttlAnalysis,
    trendAnalysis,
    validation: {
      errors: dataValidation.errors,
      warnings: dataValidation.warnings
    }
  };

  const reportResult = writeReports(analysisResult, options);

  if (!options.quiet) {
    console.log(`\n报告文件已生成:`);
    reportResult.files.forEach(f => {
      console.log(`  - ${f}`);
    });
  }

  const hasWarnings = dataValidation.warnings.length > 0;
  const hasHighRisk = highRiskPrefixes.length > 0 || parseFloat(basicStats.noTTLPercentage) > 30;
  
  if (options.strict && (hasWarnings || hasHighRisk)) {
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

module.exports = { main, EXIT_CODES };
