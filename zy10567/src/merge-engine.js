import { parseEnvFile, getShellEnv } from './env-parser.js';

const PRIORITY = {
  shell: 40,
  cli: 30,
  env_file: 20,
  compose: 10
};

const PRIORITY_NAMES = {
  shell: 'Shell环境变量',
  cli: 'CLI参数 (-e)',
  env_file: '.env文件',
  compose: 'compose文件'
};

export function mergeEnvironments(sources) {
  const result = {
    variables: {},
    conflicts: [],
    sources: {},
    warnings: []
  };

  const allVariables = [];

  for (const source of sources) {
    if (source.variables) {
      for (const variable of source.variables) {
        allVariables.push({
          ...variable,
          priority: PRIORITY[variable.source] || 0
        });
      }
    }
  }

  const varGroups = {};
  for (const variable of allVariables) {
    if (!varGroups[variable.key]) {
      varGroups[variable.key] = [];
    }
    varGroups[variable.key].push(variable);
  }

  for (const [key, vars] of Object.entries(varGroups)) {
    vars.sort((a, b) => b.priority - a.priority);
    
    const winner = vars[0];
    const conflicts = vars.slice(1).filter(v => v.priority < winner.priority);

    result.variables[key] = {
      key,
      finalValue: winner.value,
      winner: {
        value: winner.value,
        source: winner.source,
        sourceName: PRIORITY_NAMES[winner.source],
        sourceFile: winner.sourceFile,
        lineNumber: winner.lineNumber
      },
      allSources: vars.map(v => ({
        value: v.value,
        source: v.source,
        sourceName: PRIORITY_NAMES[v.source],
        sourceFile: v.sourceFile,
        lineNumber: v.lineNumber,
        priority: v.priority
      }))
    };

    if (conflicts.length > 0) {
      result.conflicts.push({
        key,
        winner: {
          value: winner.value,
          source: winner.source,
          sourceName: PRIORITY_NAMES[winner.source]
        },
        overridden: conflicts.map(c => ({
          value: c.value,
          source: c.source,
          sourceName: PRIORITY_NAMES[c.source],
          sourceFile: c.sourceFile,
          lineNumber: c.lineNumber
        }))
      });
    }
  }

  return result;
}

export async function processService(serviceName, composeConfig, baseDir) {
  const result = {
    serviceName,
    sources: {
      compose: [],
      env_files: [],
      cli: [],
      shell: []
    },
    mergeResult: null,
    errors: [],
    warnings: []
  };

  const composeEnv = composeConfig.environment || [];
  result.sources.compose = composeEnv;

  const envFiles = composeConfig.env_file || [];
  for (const envFile of envFiles) {
    const envResult = await parseEnvFile(envFile.path, baseDir);
    if (envResult.loaded) {
      result.sources.env_files.push(envResult);
    } else {
      if (envFile.required) {
        result.errors.push({
          type: 'required_env_file_missing',
          message: `必需的env文件不存在: ${envFile.path}`,
          file: envFile.path
        });
      } else {
        result.warnings.push({
          type: 'env_file_missing',
          message: `env文件不存在: ${envFile.path}`,
          file: envFile.path
        });
      }
    }
  }

  const allVariables = [
    ...composeEnv,
    ...result.sources.env_files.flatMap(ef => ef.variables)
  ];

  const varKeys = allVariables.map(v => v.key);
  const shellEnv = getShellEnv(varKeys);
  result.sources.shell = shellEnv.variables;

  result.mergeResult = mergeEnvironments([
    { variables: composeEnv },
    ...result.sources.env_files,
    shellEnv
  ]);

  return result;
}
