#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const ProtoParser = require('./proto-parser');
const MatrixBuilder = require('./matrix-builder');
const ReportGenerator = require('./report-generator');
const chalk = require('chalk');

const program = new Command();
program.name('grpc-error-matrix').description('gRPC Error Code Matrix Tool').version('1.0.0');

program.command('self-test').description('Self test all modules').action(() => {
  try {
    require('./proto-parser');
    require('./matrix-builder');
    require('./report-generator');
    console.log(chalk.green('All modules loaded successfully!'));
  } catch (err) {
    console.error(chalk.red('Self test failed:'), err.message);
    process.exit(1);
  }
});

program.command('analyze')
  .description('Analyze error code matrix from proto and SDK definitions')
  .option('--proto <path>', 'Path to .proto file with error codes')
  .option('--sdk <path>', 'Path to SDK definitions JSON file')
  .option('--output <dir>', 'Output directory for reports (default: reports/)', 'reports')
  .action(async (options) => {
    try {
      if (!options.proto) {
        console.error(chalk.red('Error: --proto option is required'));
        process.exit(1);
      }
      if (!options.sdk) {
        console.error(chalk.red('Error: --sdk option is required'));
        process.exit(1);
      }

      const protoPath = path.resolve(options.proto);
      const sdkPath = path.resolve(options.sdk);
      const outputDir = path.resolve(options.output);

      if (!fs.existsSync(protoPath)) {
        console.error(chalk.red(`Error: Proto file not found: ${protoPath}`));
        process.exit(1);
      }
      if (!fs.existsSync(sdkPath)) {
        console.error(chalk.red(`Error: SDK definitions file not found: ${sdkPath}`));
        process.exit(1);
      }

      console.log(chalk.cyan('Parsing proto file...'));
      const parser = new ProtoParser();
      const parseResult = parser.parse(protoPath);
      
      if (parseResult.errorCodes.length === 0) {
        console.error(chalk.red('Error: No error codes found in proto file'));
        process.exit(1);
      }
      console.log(chalk.green(`Found ${parseResult.errorCodes.length} error codes`));

      console.log(chalk.cyan('Loading SDK definitions...'));
      const sdkData = JSON.parse(fs.readFileSync(sdkPath, 'utf8'));
      const langCount = Object.keys(sdkData.languages || {}).length;
      console.log(chalk.green(`Loaded definitions for ${langCount} languages`));

      console.log(chalk.cyan('Building error code matrix...'));
      const builder = new MatrixBuilder();
      const matrix = builder
        .loadProtoErrorCodes(parseResult.errorCodes)
        .loadSdkDefinitions(sdkData)
        .buildMatrix();
      console.log(chalk.green('Matrix built successfully'));

      console.log(chalk.cyan('Generating reports...'));
      const reportGenerator = new ReportGenerator();
      const reports = reportGenerator.generateAllReports(matrix, outputDir);

      console.log('\n' + reports.console);
      
      console.log(chalk.cyan('\n📄 Reports generated:'));
      console.log(chalk.gray(`   JSON: ${reports.jsonPath}`));
      console.log(chalk.gray(`   Markdown: ${reports.markdownPath}`));
      
      if (matrix.summary.differencesCount > 0) {
        console.log(chalk.yellow(`\n⚠️ Found ${matrix.summary.differencesCount} differences between SDKs`));
      } else {
        console.log(chalk.green('\n✅ No differences found between SDKs'));
      }

    } catch (err) {
      console.error(chalk.red('Error:'), err.message);
      console.error(err.stack);
      process.exit(1);
    }
  });

program.command('init')
  .description('Create example data files')
  .option('--force', 'Overwrite existing files', false)
  .action((options) => {
    try {
      const examplesDir = path.resolve('examples');
      
      if (!fs.existsSync(examplesDir)) {
        fs.mkdirSync(examplesDir, { recursive: true });
      }

      const protoFile = path.join(examplesDir, 'error_codes.proto');
      const sdkFile = path.join(examplesDir, 'sdk-definitions.json');

      if (fs.existsSync(protoFile) && !options.force) {
        console.error(chalk.red(`Error: File already exists: ${protoFile}`));
        console.error(chalk.gray('Use --force to overwrite'));
        process.exit(1);
      }
      if (fs.existsSync(sdkFile) && !options.force) {
        console.error(chalk.red(`Error: File already exists: ${sdkFile}`));
        console.error(chalk.gray('Use --force to overwrite'));
        process.exit(1);
      }

      const protoContent = `syntax = "proto3";
package grpc.status;

enum StatusCode {
  OK = 0;
  CANCELLED = 1;
  UNKNOWN = 2;
  INVALID_ARGUMENT = 3;
  DEADLINE_EXCEEDED = 4;
  NOT_FOUND = 5;
  ALREADY_EXISTS = 6;
  PERMISSION_DENIED = 7;
  RESOURCE_EXHAUSTED = 8;
  FAILED_PRECONDITION = 9;
  ABORTED = 10;
  OUT_OF_RANGE = 11;
  UNIMPLEMENTED = 12;
  INTERNAL = 13;
  UNAVAILABLE = 14;
  DATA_LOSS = 15;
  UNAUTHENTICATED = 16;
}
`;

      const sdkContent = {
        languages: {
          go: {
            name: "Go SDK",
            codes: {
              OK: { grpcCode: 0, retry: "nonRetriable" },
              CANCELLED: { grpcCode: 1, retry: "nonRetriable" },
              UNKNOWN: { grpcCode: 2, retry: "conditional" },
              INVALID_ARGUMENT: { grpcCode: 3, retry: "nonRetriable" },
              DEADLINE_EXCEEDED: { grpcCode: 4, retry: "retriable" },
              NOT_FOUND: { grpcCode: 5, retry: "nonRetriable" },
              ALREADY_EXISTS: { grpcCode: 6, retry: "nonRetriable" },
              PERMISSION_DENIED: { grpcCode: 7, retry: "nonRetriable" },
              RESOURCE_EXHAUSTED: { grpcCode: 8, retry: "retriable" },
              FAILED_PRECONDITION: { grpcCode: 9, retry: "conditional" },
              ABORTED: { grpcCode: 10, retry: "retriable" },
              OUT_OF_RANGE: { grpcCode: 11, retry: "nonRetriable" },
              UNIMPLEMENTED: { grpcCode: 12, retry: "nonRetriable" },
              INTERNAL: { grpcCode: 13, retry: "conditional" },
              UNAVAILABLE: { grpcCode: 14, retry: "retriable" },
              DATA_LOSS: { grpcCode: 15, retry: "nonRetriable" },
              UNAUTHENTICATED: { grpcCode: 16, retry: "nonRetriable" }
            }
          },
          java: {
            name: "Java SDK",
            codes: {
              OK: { grpcCode: 0, retry: "nonRetriable" },
              CANCELLED: { grpcCode: 1, retry: "nonRetriable" },
              UNKNOWN: { grpcCode: 2, retry: "conditional" },
              INVALID_ARGUMENT: { grpcCode: 3, retry: "nonRetriable" },
              DEADLINE_EXCEEDED: { grpcCode: 4, retry: "retriable" },
              NOT_FOUND: { grpcCode: 5, retry: "nonRetriable" },
              ALREADY_EXISTS: { grpcCode: 6, retry: "nonRetriable" },
              PERMISSION_DENIED: { grpcCode: 7, retry: "nonRetriable" },
              RESOURCE_EXHAUSTED: { grpcCode: 8, retry: "retriable" },
              FAILED_PRECONDITION: { grpcCode: 9, retry: "nonRetriable" },
              ABORTED: { grpcCode: 10, retry: "retriable" },
              OUT_OF_RANGE: { grpcCode: 11, retry: "nonRetriable" },
              UNIMPLEMENTED: { grpcCode: 12, retry: "nonRetriable" },
              INTERNAL: { grpcCode: 13, retry: "conditional" },
              UNAVAILABLE: { grpcCode: 14, retry: "retriable" },
              DATA_LOSS: { grpcCode: 15, retry: "nonRetriable" },
              UNAUTHENTICATED: { grpcCode: 16, retry: "nonRetriable" }
            }
          },
          python: {
            name: "Python SDK",
            codes: {
              OK: { grpcCode: 0, retry: "nonRetriable" },
              CANCELLED: { grpcCode: 1, retry: "nonRetriable" },
              UNKNOWN: { grpcCode: 2, retry: "retriable" },
              INVALID_ARGUMENT: { grpcCode: 3, retry: "nonRetriable" },
              DEADLINE_EXCEEDED: { grpcCode: 4, retry: "retriable" },
              NOT_FOUND: { grpcCode: 5, retry: "nonRetriable" },
              ALREADY_EXISTS: { grpcCode: 6, retry: "nonRetriable" },
              PERMISSION_DENIED: { grpcCode: 7, retry: "nonRetriable" },
              RESOURCE_EXHAUSTED: { grpcCode: 8, retry: "retriable" },
              FAILED_PRECONDITION: { grpcCode: 9, retry: "conditional" },
              ABORTED: { grpcCode: 10, retry: "retriable" },
              OUT_OF_RANGE: { grpcCode: 11, retry: "nonRetriable" },
              UNIMPLEMENTED: { grpcCode: 12, retry: "nonRetriable" },
              INTERNAL: { grpcCode: 13, retry: "retriable" },
              UNAVAILABLE: { grpcCode: 14, retry: "retriable" },
              DATA_LOSS: { grpcCode: 15, retry: "nonRetriable" },
              UNAUTHENTICATED: { grpcCode: 16, retry: "nonRetriable" }
            }
          }
        }
      };

      fs.writeFileSync(protoFile, protoContent, 'utf8');
      fs.writeFileSync(sdkFile, JSON.stringify(sdkContent, null, 2), 'utf8');

      console.log(chalk.green('✅ Example files created successfully!'));
      console.log(chalk.gray(`   ${protoFile}`));
      console.log(chalk.gray(`   ${sdkFile}`));
      console.log(chalk.cyan('\nRun the demo with:'));
      console.log(chalk.gray('  node src/cli.js analyze --proto examples/error_codes.proto --sdk examples/sdk-definitions.json'));

    } catch (err) {
      console.error(chalk.red('Error:'), err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
