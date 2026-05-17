const ConfigLoader = require('./config-loader');
const JsonDiffer = require('./json-differ');
const DiffProcessor = require('./diff-processor');
const ReportGenerator = require('./report-generator');

class JsonConfigDiff {
  constructor(options = {}) {
    this.options = options;
  }

  run(options = {}) {
    const loader = new ConfigLoader({
      inputDir: options.inputDir
    });

    let envFiles;
    if (options.files && options.files.length > 0) {
      envFiles = options.files.map((f, i) => ({
        env: options.envs?.[i] || `env${i + 1}`,
        filename: f
      }));
    } else {
      envFiles = loader.findJsonFiles();
    }

    if (envFiles.length < 2) {
      throw new Error('至少需要 2 个配置文件进行比较');
    }

    const { configs, errors } = loader.loadEnvConfigs(envFiles);
    const envs = Object.keys(configs);

    if (envs.length < 2) {
      throw new Error('没有足够的有效配置文件进行比较');
    }

    const baseEnv = options.baseEnv || envs[0];
    if (!configs[baseEnv]) {
      throw new Error(`基准环境 ${baseEnv} 不存在`);
    }

    const differ = new JsonDiffer({
      arrayNormalize: options.arrayNormalize !== false,
      arrayKeyFields: this.parseArrayKeyFields(options.arrayKeys),
      ignoreArrayOrder: options.ignoreArrayOrder !== false
    });

    const diffResults = differ.multiEnvDiff(configs, baseEnv);

    const processor = new DiffProcessor({
      sensitivePatterns: options.sensitive || [],
      defaultValues: this.parseDefaultValues(options.defaults || {})
    });

    const processedResults = {};
    for (const [key, result] of Object.entries(diffResults)) {
      processedResults[key] = {
        ...result,
        diffs: processor.processDiffs(result.diffs),
        summary: processor.summarizeDiffs(result.diffs)
      };
    }

    const reporter = new ReportGenerator({
      outputDir: options.outputDir
    });

    const reportResult = reporter.writeAllReports(processedResults, errors);

    return {
      ...reportResult,
      envs,
      baseEnv,
      errors
    };
  }

  parseArrayKeyFields(arrayKeys) {
    if (!arrayKeys) return {};
    if (typeof arrayKeys === 'string') {
      const result = {};
      for (const pair of arrayKeys.split(',')) {
        const [path, key] = pair.split('=');
        if (path && key) {
          result[path.trim()] = key.trim();
        }
      }
      return result;
    }
    return arrayKeys;
  }

  parseDefaultValues(defaults) {
    if (typeof defaults === 'string') {
      try {
        return JSON.parse(defaults);
      } catch {
        return {};
      }
    }
    return defaults;
  }
}

module.exports = JsonConfigDiff;