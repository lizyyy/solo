#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const SwaggerParser = require('@apidevtools/swagger-parser');
const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const dotenv = require('dotenv');

const program = new Command();

function resolveVariables(value, env) {
  const errors = [];
  if (typeof value === 'string') {
    const regex = /\$\{([^}]+)\}/g;
    let resolved = value;
    let match;
    while ((match = regex.exec(value)) !== null) {
      const varName = match[1];
      if (env[varName] !== undefined) {
        resolved = resolved.replace(match[0], env[varName]);
      } else {
        errors.push("Missing environment variable: " + varName);
      }
    }
    return { resolved, errors };
  }
  return { resolved: value, errors };
}

function extractExamples(openapi, filePath) {
  const examples = [];
  const baseUrl = (openapi.servers && openapi.servers[0] && openapi.servers[0].url) || 'http://localhost';

  for (const [pathKey, pathItem] of Object.entries(openapi.paths || {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const operation = pathItem[method];
      if (!operation) continue;

      const requestBody = operation.requestBody;
      const responses = operation.responses;

      if (requestBody && requestBody.content) {
        for (const [contentType, content] of Object.entries(requestBody.content)) {
          if (content.example) {
            examples.push({
              source: { file: filePath, path: pathKey, method: method.toUpperCase() },
              method: method.toUpperCase(),
              url: baseUrl + pathKey,
              path: pathKey,
              headers: { 'Content-Type': contentType },
              body: content.example,
            });
          }
        }
      }

      for (const [statusCode, response] of Object.entries(responses || {})) {
        if (response.content) {
          for (const [contentType, content] of Object.entries(response.content)) {
            if (content.example) {
              examples.push({
                source: { file: filePath, path: pathKey, method: method.toUpperCase(), statusCode },
                method: method.toUpperCase(),
                url: baseUrl + pathKey,
                path: pathKey,
                expectedResponse: { statusCode, body: content.example },
              });
            }
          }
        }
      }
    }
  }

  return examples;
}

async function executeExample(example, env) {
  const startTime = Date.now();
  const assertions = [];

  try {
    const { resolved: url, errors: urlErrors } = resolveVariables(example.url, env);
    if (urlErrors.length > 0) {
      return {
        example,
        success: false,
        assertions,
        duration: Date.now() - startTime,
        error: urlErrors.join(', '),
        errorType: 'VARIABLE_ERROR',
      };
    }

    const headers = { ...example.headers };
    for (const [key, value] of Object.entries(headers)) {
      const { resolved, errors } = resolveVariables(value, env);
      if (errors.length > 0) {
        return {
          example,
          success: false,
          assertions,
          duration: Date.now() - startTime,
          error: errors.join(', '),
          errorType: 'VARIABLE_ERROR',
        };
      }
      headers[key] = resolved;
    }

    const config = {
      method: example.method.toLowerCase(),
      url,
      headers,
      validateStatus: () => true,
    };

    if (example.body && ['POST', 'PUT', 'PATCH'].includes(example.method)) {
      config.data = example.body;
    }

    const response = await axios(config);

    if (example.expectedResponse && example.expectedResponse.statusCode) {
      const expectedStatus = parseInt(example.expectedResponse.statusCode, 10);
      assertions.push({
        type: 'status',
        expected: expectedStatus,
        actual: response.status,
        passed: response.status === expectedStatus,
        message: "Expected status " + expectedStatus + ", got " + response.status,
      });
    }

    const allPassed = assertions.every(a => a.passed);

    return {
      example,
      success: allPassed,
      status: response.status,
      responseBody: response.data,
      assertions,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      example,
      success: false,
      assertions,
      duration: Date.now() - startTime,
      error: error.message,
      errorType: 'REQUEST_ERROR',
    };
  }
}

function printTerminalSummary(report) {
  console.log('\n' + chalk.bold.blue('='.repeat(60)));
  console.log(chalk.bold.blue('  OpenAPI Example Regression Report'));
  console.log(chalk.bold.blue('='.repeat(60)) + '\n');

  console.log(chalk.bold('Summary:'));
  const table = new Table({
    head: ['Total', 'Passed', 'Failed', 'Duration'],
    colWidths: [12, 12, 12, 12],
  });
  table.push([
    report.summary.total,
    chalk.green(report.summary.passed),
    chalk.red(report.summary.failed),
    report.summary.duration + 'ms',
  ]);
  console.log(table.toString() + '\n');

  if (report.failedExamples.length > 0) {
    console.log(chalk.bold.red('Failed Examples:'));
    for (const failed of report.failedExamples) {
      console.log(chalk.gray('\n  File: ') + failed.example.source.file);
      console.log(chalk.gray('  Path: ') + failed.example.path);
      console.log(chalk.gray('  Method: ') + failed.example.method);
      if (failed.example.source.statusCode) {
        console.log(chalk.gray('  Expected Status: ') + failed.example.source.statusCode);
      }
      if (failed.error) {
        console.log(chalk.red('  Error: ') + failed.error);
      }
      for (const assertion of failed.assertions.filter(a => !a.passed)) {
        console.log(chalk.red('  Assertion Failed: ' + assertion.message));
      }
    }
    console.log('');
  }

  const successRate = report.summary.total > 0 ? ((report.summary.passed / report.summary.total) * 100).toFixed(1) : '0';
  console.log(chalk.bold('Success Rate: ' + successRate + '%'));
  
  if (report.summary.failed > 0) {
    console.log(chalk.red.bold('\n There are failed examples. Please check the reports.'));
    process.exit(1);
  } else {
    console.log(chalk.green.bold('\n All examples passed!'));
    process.exit(0);
  }
}

function generateJsonReport(report, outputDir) {
  const jsonPath = path.join(outputDir, 'regression-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(chalk.gray('  Machine-readable report: ' + jsonPath));
}

function generateMarkdownReport(report, outputDir, openapiFile) {
  const mdPath = path.join(outputDir, 'regression-report.md');
  
  let md = '# OpenAPI Example Regression Report\n\n';
  md += '> Generated at: ' + new Date().toLocaleString() + '\n';
  md += '> OpenAPI File: ' + openapiFile + '\n\n';
  
  md += '## Summary\n\n';
  md += '| Total | Passed | Failed | Duration |\n';
  md += '|-------|--------|--------|----------|\n';
  md += '| ' + report.summary.total + ' | ' + report.summary.passed + ' | ' + report.summary.failed + ' | ' + report.summary.duration + 'ms |\n\n';
  
  if (report.failedExamples.length > 0) {
    md += '## Failed Examples\n\n';
    for (const failed of report.failedExamples) {
      md += '### ' + failed.example.method + ' ' + failed.example.path + '\n\n';
      md += '- **File Location**: ' + failed.example.source.file + '\n';
      md += '- **Request URL**: ' + failed.example.url + '\n';
      if (failed.example.source.statusCode) {
        md += '- **Expected Status Code**: ' + failed.example.source.statusCode + '\n';
      }
      if (failed.status) {
        md += '- **Actual Status Code**: ' + failed.status + '\n';
      }
      if (failed.error) {
        md += '- **Error Reason**: ' + failed.error + '\n';
      }
      md += '\n---\n\n';
    }
  }
  
  fs.writeFileSync(mdPath, md);
  console.log(chalk.gray('  Team share report: ' + mdPath));
}

program
  .name('oer')
  .description('OpenAPI Example Regression CLI - Validate API documentation examples')
  .version('1.0.0');

program
  .command('run')
  .description('Run OpenAPI example regression tests')
  .argument('<openapi-file>', 'OpenAPI specification file path (JSON/YAML)')
  .option('-b, --base-url <url>', 'Override API base URL')
  .option('-e, --env <file>', 'Environment variables file path', '.env')
  .option('-o, --output <dir>', 'Output directory', './reports')
  .option('--fail-fast', 'Stop on first failure', false)
  .action(async (openapiFile, options) => {
    const startTime = Date.now();
    
    console.log(chalk.blue('Starting OpenAPI example regression tests...'));
    console.log(chalk.gray('  OpenAPI File: ' + openapiFile));
    
    if (!fs.existsSync(openapiFile)) {
      console.error(chalk.red('Error: File does not exist - ' + openapiFile));
      process.exit(1);
    }
    
    const env = {};
    if (fs.existsSync(options.env)) {
      const envConfig = dotenv.parse(fs.readFileSync(options.env));
      Object.assign(env, envConfig);
      console.log(chalk.gray('  Environment file: ' + options.env));
    }
    Object.assign(env, process.env);
    
    try {
      const openapi = await SwaggerParser.parse(openapiFile);
      console.log(chalk.green('  OpenAPI file parsed successfully'));
      
      const examples = extractExamples(openapi, openapiFile);
      console.log(chalk.gray('  Found ' + examples.length + ' examples'));
      
      if (options.baseUrl) {
        for (const example of examples) {
          const pathOnly = example.path;
          example.url = options.baseUrl + pathOnly;
        }
        console.log(chalk.gray('  Using custom base URL: ' + options.baseUrl));
      }
      
      fs.mkdirSync(options.output, { recursive: true });
      
      const results = [];
      
      for (let i = 0; i < examples.length; i++) {
        const example = examples[i];
        console.log(chalk.gray('  Executing (' + (i + 1) + '/' + examples.length + '): ' + example.method + ' ' + example.path));
        
        const result = await executeExample(example, env);
        results.push(result);
        
        if (!result.success && options.failFast) {
          console.log(chalk.yellow('  Fail-fast mode enabled, stopping on first failure'));
          break;
        }
      }
      
      const failedExamples = results.filter(r => !r.success);
      
      const report = {
        summary: {
          total: results.length,
          passed: results.filter(r => r.success).length,
          failed: failedExamples.length,
          duration: Date.now() - startTime,
          startTime: new Date().toISOString(),
        },
        results,
        failedExamples,
      };
      
      console.log(chalk.bold('\nGenerating reports:'));
      generateJsonReport(report, options.output);
      generateMarkdownReport(report, options.output, openapiFile);
      
      printTerminalSummary(report);
      
    } catch (error) {
      console.error(chalk.red('Error: ' + error.message));
      process.exit(1);
    }
  });

program.parse();
