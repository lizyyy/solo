#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIParser } from './parser';
import { PaginationConsistencyChecker } from './checker';
import { Reporter } from './reporter';
import { PaginationConfig } from './types';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('pagination-check')
  .description('检查 OpenAPI 规范中分页接口的参数和响应字段一致性')
  .version(pkg.version);

program
  .argument('<openapi-file>', 'OpenAPI 规范文件路径 (YAML/JSON)')
  .option('-c, --config <path>', '配置文件路径')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('--json <filename>', '导出 JSON 报告的文件名', 'pagination-check.json')
  .option('--md <filename>', '导出 Markdown 报告的文件名', 'pagination-check.md')
  .option('--no-terminal', '不输出终端报告')
  .option('--fail-on-error', '发现错误时以非零状态退出')
  .option('--include <paths...>', '包含的路径模式 (如 /api/*)')
  .option('--exclude <paths...>', '排除的路径模式 (如 /health)')
  .option('--methods <methods...>', '检查的 HTTP 方法 (默认: get)', ['get'])
  .action(async (openapiFile: string, options: any) => {
    try {
      let config: Partial<PaginationConfig> | undefined;

      if (options.config) {
        const configPath = path.resolve(options.config);
        if (!fs.existsSync(configPath)) {
          console.error(`错误: 配置文件不存在: ${configPath}`);
          process.exit(1);
        }
        const configContent = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(configContent);
      }

      if (options.include) {
        config = config || {};
        config.includePaths = options.include;
      }

      if (options.exclude) {
        config = config || {};
        config.excludePaths = options.exclude;
      }

      if (options.methods) {
        config = config || {};
        config.httpMethods = options.methods;
      }

      const openapiPath = path.resolve(openapiFile);
      if (!fs.existsSync(openapiPath)) {
        console.error(`错误: OpenAPI 文件不存在: ${openapiPath}`);
        process.exit(1);
      }

      const parser = new OpenAPIParser(openapiPath);
      const checker = new PaginationConsistencyChecker(parser, config);
      const result = checker.check();
      const reporter = new Reporter(result);

      if (options.terminal !== false) {
        reporter.printTerminalSummary();
      }

      const outputDir = path.resolve(options.output);

      if (options.json) {
        reporter.exportJSON(path.join(outputDir, options.json));
      }

      if (options.md) {
        reporter.exportMarkdown(path.join(outputDir, options.md));
      }

      if (options.failOnError && reporter.hasErrors()) {
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`错误: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('init')
  .description('创建示例配置文件')
  .option('-o, --output <path>', '输出路径', './pagination-config.json')
  .action((options: any) => {
    const defaultConfig = {
      expectedParams: {
        page: ['page', 'pageNum', 'page_number', 'current'],
        pageSize: ['pageSize', 'size', 'per_page', 'limit', 'count']
      },
      expectedResponseFields: {
        data: ['data', 'items', 'list', 'records', 'rows'],
        total: ['total', 'totalCount', 'total_count', 'totalElements'],
        page: ['page', 'pageNum', 'current', 'page_number'],
        pageSize: ['pageSize', 'size', 'per_page', 'limit'],
        totalPages: ['totalPages', 'pages', 'page_count', 'total_pages']
      },
      includePaths: ['/api/*'],
      excludePaths: ['/health', '/metrics'],
      httpMethods: ['get']
    };

    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log(`✅ 配置文件已创建: ${outputPath}`);
  });

program
  .command('example')
  .description('创建示例 OpenAPI 文件用于测试')
  .option('-o, --output <path>', '输出路径', './example-openapi.yaml')
  .action((options: any) => {
    const exampleYaml = `openapi: 3.0.0
info:
  title: 示例 API
  version: 1.0.0
  description: 用于测试分页一致性检查的示例 API

paths:
  /api/users:
    get:
      summary: 获取用户列表 (规范)
      parameters:
        - name: page
          in: query
          schema:
            type: integer
        - name: pageSize
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      type: object
                  total:
                    type: integer
                  page:
                    type: integer
                  pageSize:
                    type: integer

  /api/orders:
    get:
      summary: 获取订单列表 (参数命名不一致)
      parameters:
        - name: pageNum
          in: query
          schema:
            type: integer
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      type: object
                  total:
                    type: integer

  /api/products:
    get:
      summary: 获取产品列表 (缺少字段)
      parameters:
        - name: page
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      type: object

  /api/health:
    get:
      summary: 健康检查
      responses:
        '200':
          description: 成功
`;

    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, exampleYaml, 'utf-8');
    console.log(`✅ 示例 OpenAPI 文件已创建: ${outputPath}`);
  });

program.parseAsync();
