import fs from 'fs/promises';
import path from 'path';
import { parseComposeFile, findComposeFiles } from './yaml-parser.js';
import { parseEnvFile, getShellEnv, parseCliEnvArgs } from './env-parser.js';
import { mergeEnvironments } from './merge-engine.js';
import { generateTerminalSummary, generateJsonReport, generateMarkdownReport, writeReports } from './reporter.js';

export async function analyzeEnvironment(options) {
  const {
    inputDir = process.cwd(),
    outputDir = path.join(process.cwd(), 'reports'),
    composeFile = null,
    envFiles = [],
    cliEnv = [],
    service = null
  } = options;

  const result = {
    metadata: {
      timestamp: new Date().toISOString(),
      inputDir,
      outputDir,
      composeFile,
      envFiles,
      cliEnv
    },
    composeFiles: [],
    envFiles: [],
    services: {},
    finalVariables: {},
    conflicts: [],
    errors: [],
    warnings: [],
    reports: null
  };

  let composeFilesToParse = [];
  if (composeFile) {
    composeFilesToParse = [path.resolve(inputDir, composeFile)];
  } else {
    const candidates = findComposeFiles(inputDir);
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        composeFilesToParse.push(candidate);
      } catch {}
    }
  }

  if (composeFilesToParse.length === 0) {
    result.errors.push({
      type: 'no_compose_file',
      message: '未找到compose文件'
    });
    return result;
  }

  const allComposeEnv = [];
  for (const cf of composeFilesToParse) {
    const composeResult = await parseComposeFile(cf);
    result.composeFiles.push(composeResult);
    
    if (composeResult.errors.length > 0) {
      result.errors.push(...composeResult.errors.map(e => ({
        ...e,
        file: cf
      })));
    }
    if (composeResult.warnings.length > 0) {
      result.warnings.push(...composeResult.warnings.map(w => ({
        ...w,
        file: cf
      })));
    }

    for (const [serviceName, svcConfig] of Object.entries(composeResult.services)) {
      if (service && serviceName !== service) continue;
      
      if (!result.services[serviceName]) {
        result.services[serviceName] = {
          environment: [],
          envFiles: [],
          conflicts: []
        };
      }
      
      for (const envVar of svcConfig.environment) {
        result.services[serviceName].environment.push({
          ...envVar,
          sourceFile: cf
        });
        allComposeEnv.push(envVar);
      }

      for (const envFileRef of svcConfig.env_file) {
        const envFilePath = path.resolve(path.dirname(cf), envFileRef.path);
        const envResult = await parseEnvFile(envFilePath);
        result.services[serviceName].envFiles.push(envResult);
        
        if (envResult.errors.length > 0) {
          result.errors.push(...envResult.errors.map(e => ({
            ...e,
            file: envFilePath
          })));
        }
        if (envResult.warnings.length > 0) {
          result.warnings.push(...envResult.warnings.map(w => ({
            ...w,
            file: envFilePath
          })));
        }
      }
    }
  }

  for (const envFile of envFiles) {
    const envFilePath = path.resolve(inputDir, envFile);
    const envResult = await parseEnvFile(envFilePath);
    result.envFiles.push(envResult);
    
    if (envResult.errors.length > 0) {
      result.errors.push(...envResult.errors);
    }
    if (envResult.warnings.length > 0) {
      result.warnings.push(...envResult.warnings);
    }
  }

  const cliEnvResult = parseCliEnvArgs(cliEnv);
  const shellEnvResult = getShellEnv();

  for (const [serviceName, serviceData] of Object.entries(result.services)) {
    const allSources = [
      { variables: serviceData.environment, source: 'compose' },
      ...serviceData.envFiles.map(ef => ({ variables: ef.variables, source: 'env_file' })),
      { variables: cliEnvResult.variables, source: 'cli' },
      { variables: shellEnvResult.variables, source: 'shell' }
    ];

    const mergeResult = mergeEnvironments(allSources);
    result.services[serviceName].mergeResult = mergeResult;

    for (const conflict of mergeResult.conflicts) {
      result.conflicts.push({
        service: serviceName,
        ...conflict
      });
    }
  }

  for (const [serviceName, serviceData] of Object.entries(result.services)) {
    for (const [key, info] of Object.entries(serviceData.mergeResult.variables)) {
      if (!result.finalVariables[key]) {
        result.finalVariables[key] = {
          ...info,
          services: [serviceName]
        };
      } else {
        result.finalVariables[key].services.push(serviceName);
      }
    }
  }

  result.reports = await writeReports(result, outputDir);

  return result;
}

export {
  generateTerminalSummary,
  generateJsonReport,
  generateMarkdownReport
};
