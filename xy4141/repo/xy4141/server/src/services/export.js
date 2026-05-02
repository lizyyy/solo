const { Batch, Sample, Run, Plugin, Review } = require('../models');
const dayjs = require('dayjs');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ExportService {
  generateMarkdownReport(batchId, options = {}) {
    const batch = Batch.findById(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    const plugin = Plugin.findById(batch.plugin_id);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    const runs = Run.findAll(batchId);
    const stats = Run.getStats(batchId);
    const reviews = Review.findAll(batchId);

    const markdown = [];

    markdown.push('# WASM 规则插件验收报告');
    markdown.push('');
    markdown.push(`> 生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
    markdown.push(`> 批次 ID: ${batch.id}`);
    markdown.push('');

    markdown.push('## 1. 批次信息');
    markdown.push('');
    markdown.push('| 字段 | 值 |');
    markdown.push('|------|-----|');
    markdown.push(`| 批次名称 | ${batch.name} |`);
    markdown.push(`| 批次描述 | ${batch.description || '无'} |`);
    markdown.push(`| 样本数量 | ${batch.sample_count} |`);
    markdown.push(`| 状态 | ${this._formatStatus(batch.status)} |`);
    markdown.push(`| 创建时间 | ${dayjs(batch.created_at).format('YYYY-MM-DD HH:mm:ss')} |`);
    markdown.push('');

    markdown.push('## 2. 插件信息');
    markdown.push('');
    const manifest = JSON.parse(plugin.manifest);
    markdown.push('| 字段 | 值 |');
    markdown.push('|------|-----|');
    markdown.push(`| 插件名称 | ${plugin.name} |`);
    markdown.push(`| 版本 | ${plugin.version} |`);
    markdown.push(`| 供应商 | ${plugin.vendor || '未知'} |`);
    markdown.push(`| 入口点 | ${manifest.entrypoint || 'process'} |`);
    markdown.push(`| 描述 | ${plugin.description || '无'} |`);
    markdown.push(`| 最大内存 | ${plugin.max_memory_mb} MB |`);
    markdown.push(`| 超时时间 | ${plugin.max_timeout_ms} ms |`);
    markdown.push(`| 性能阈值 | ${plugin.performance_threshold_ms} ms |`);
    markdown.push('');

    if (manifest.dependencies && manifest.dependencies.length > 0) {
      markdown.push('### 依赖项');
      markdown.push('');
      markdown.push('| 名称 | 版本要求 |');
      markdown.push('|------|----------|');
      manifest.dependencies.forEach(dep => {
        markdown.push(`| ${dep.name} | ${dep.version || '*'} |`);
      });
      markdown.push('');
    }

    if (manifest.permissions && manifest.permissions.length > 0) {
      markdown.push('### 权限声明');
      markdown.push('');
      manifest.permissions.forEach(perm => {
        markdown.push(`- \`${perm}\``);
      });
      markdown.push('');
    }

    if (manifest.error_codes && manifest.error_codes.length > 0) {
      markdown.push('### 错误码定义');
      markdown.push('');
      markdown.push('| 错误码 | 描述 |');
      markdown.push('|--------|------|');
      manifest.error_codes.forEach(code => {
        markdown.push(`| ${code.code} | ${code.description || '无描述'} |`);
      });
      markdown.push('');
    }

    markdown.push('## 3. 执行统计');
    markdown.push('');
    markdown.push('| 统计项 | 数值 |');
    markdown.push('|--------|------|');
    markdown.push(`| 总样本数 | ${stats.total || 0} |`);
    markdown.push(`| 通过 | ${stats.passed || 0} |`);
    markdown.push(`| 失败 | ${stats.failed || 0} |`);
    markdown.push(`| 错误 | ${stats.errors || 0} |`);
    markdown.push(`| 超时 | ${stats.timeouts || 0} |`);
    markdown.push(`| Schema 校验通过 | ${stats.schema_passed || 0} |`);
    markdown.push(`| Schema 校验失败 | ${stats.schema_failed || 0} |`);
    markdown.push(`| 平均执行时间 | ${stats.avg_execution_time_ms ? stats.avg_execution_time_ms.toFixed(2) : 'N/A'} ms |`);
    markdown.push(`| 最大执行时间 | ${stats.max_execution_time_ms || 'N/A'} ms |`);
    markdown.push('');

    const passRate = stats.total > 0 ? (stats.passed / stats.total * 100).toFixed(2) : 0;
    markdown.push(`**通过率: ${passRate}%**`);
    markdown.push('');

    markdown.push('## 4. 详细执行结果');
    markdown.push('');

    runs.forEach((run, index) => {
      const sample = Sample.findById(run.sample_id);
      const review = Review.findByRunId(run.id);
      
      markdown.push(`### 样本 #${index + 1}`);
      markdown.push('');
      markdown.push('| 字段 | 值 |');
      markdown.push('|------|-----|');
      markdown.push(`| 样本 ID | ${run.sample_id} |`);
      markdown.push(`| 运行 ID | ${run.id} |`);
      markdown.push(`| 状态 | ${this._formatStatus(run.status)} |`);
      markdown.push(`| 执行时间 | ${run.execution_time_ms || 'N/A'} ms |`);
      markdown.push(`| 内存使用 | ${run.memory_usage_mb || 'N/A'} MB |`);
      markdown.push(`| Schema 校验 | ${run.schema_validation_passed ? '通过' : run.schema_validation_passed === false ? '失败' : '未执行'} |`);
      markdown.push('');

      if (sample) {
        markdown.push('#### 输入数据');
        markdown.push('');
        markdown.push('```json');
        const inputData = typeof sample.input_data === 'string' ? sample.input_data : JSON.stringify(sample.input_data, null, 2);
        markdown.push(inputData);
        markdown.push('```');
        markdown.push('');

        if (sample.expected_output) {
          markdown.push('#### 期望输出');
          markdown.push('');
          markdown.push('```json');
          const expectedOutput = typeof sample.expected_output === 'string' ? sample.expected_output : JSON.stringify(sample.expected_output, null, 2);
          markdown.push(expectedOutput);
          markdown.push('```');
          markdown.push('');
        }
      }

      if (run.output_data) {
        markdown.push('#### 实际输出');
        markdown.push('');
        markdown.push('```json');
        const outputData = typeof run.output_data === 'string' ? run.output_data : JSON.stringify(run.output_data, null, 2);
        markdown.push(outputData);
        markdown.push('```');
        markdown.push('');
      }

      if (run.error_message) {
        markdown.push('#### 错误信息');
        markdown.push('');
        markdown.push(`**错误码:** ${run.error_code || 'N/A'}`);
        markdown.push('');
        markdown.push(`**错误信息:** ${run.error_message}`);
        markdown.push('');
      }

      if (run.schema_errors && run.schema_errors.length > 0) {
        markdown.push('#### Schema 校验错误');
        markdown.push('');
        run.schema_errors.forEach((error, idx) => {
          markdown.push(`${idx + 1}. **${error.type}**`);
          if (error.path) markdown.push(`   - 路径: ${error.path}`);
          if (error.message) markdown.push(`   - 消息: ${error.message}`);
          if (error.details) markdown.push(`   - 详情: ${JSON.stringify(error.details)}`);
        });
        markdown.push('');
      }

      if (review) {
        markdown.push('#### 人工复核');
        markdown.push('');
        markdown.push(`| 字段 | 值 |`);
        markdown.push(`|------|-----|`);
        markdown.push(`| 复核人 | ${review.reviewer || '未指定'} |`);
        markdown.push(`| 结论 | ${this._formatConclusion(review.conclusion)} |`);
        markdown.push(`| 复核时间 | ${dayjs(review.created_at).format('YYYY-MM-DD HH:mm:ss')} |`);
        if (review.notes) {
          markdown.push(`| 备注 | ${review.notes} |`);
        }
        markdown.push('');
      }

      markdown.push('---');
      markdown.push('');
    });

    if (reviews.length > 0) {
      markdown.push('## 5. 复核汇总');
      markdown.push('');
      const approved = reviews.filter(r => r.conclusion === 'approved').length;
      const rejected = reviews.filter(r => r.conclusion === 'rejected').length;
      const pending = reviews.filter(r => r.conclusion === 'pending').length;

      markdown.push('| 结论 | 数量 |');
      markdown.push('|------|------|');
      markdown.push(`| 通过 | ${approved} |`);
      markdown.push(`| 驳回 | ${rejected} |`);
      markdown.push(`| 待定 | ${pending} |`);
      markdown.push('');
    }

    markdown.push('## 6. 附录');
    markdown.push('');
    markdown.push('### 状态定义');
    markdown.push('');
    markdown.push('- `passed`: 执行成功，输出符合预期');
    markdown.push('- `failed`: 执行完成但输出不符合预期');
    markdown.push('- `error`: 执行过程中发生错误');
    markdown.push('- `timeout`: 执行超时');
    markdown.push('- `running`: 正在执行');
    markdown.push('- `cancelled`: 已取消');
    markdown.push('');

    markdown.push('### 复核结论定义');
    markdown.push('');
    markdown.push('- `approved`: 复核通过');
    markdown.push('- `rejected`: 复核驳回');
    markdown.push('- `pending`: 待复核');
    markdown.push('');

    return markdown.join('\n');
  }

  async generateAuditPackage(batchId, options = {}) {
    const batch = Batch.findById(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    const plugin = Plugin.findById(batch.plugin_id);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    const runs = Run.findAll(batchId);
    const samples = Sample.findAll(batchId);
    const reviews = Review.findAll(batchId);
    const stats = Run.getStats(batchId);

    const zip = new JSZip();
    const auditId = uuidv4();

    const metadata = {
      auditId,
      generatedAt: dayjs().toISOString(),
      batch: {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        status: batch.status,
        sampleCount: batch.sample_count,
        createdAt: batch.created_at
      },
      plugin: {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        vendor: plugin.vendor,
        manifest: JSON.parse(plugin.manifest)
      },
      statistics: stats,
      version: '1.0.0'
    };

    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    const runsData = runs.map(run => ({
      id: run.id,
      sampleId: run.sample_id,
      batchId: run.batch_id,
      pluginId: run.plugin_id,
      inputData: JSON.parse(run.input_data),
      outputData: run.output_data ? JSON.parse(run.output_data) : null,
      executionTimeMs: run.execution_time_ms,
      memoryUsageMb: run.memory_usage_mb,
      status: run.status,
      errorMessage: run.error_message,
      errorCode: run.error_code,
      schemaValidationPassed: run.schema_validation_passed,
      schemaErrors: run.schema_errors ? JSON.parse(run.schema_errors) : null,
      createdAt: run.created_at
    }));
    zip.file('runs.json', JSON.stringify(runsData, null, 2));

    const samplesData = samples.map(sample => ({
      id: sample.id,
      batchId: sample.batch_id,
      inputData: JSON.parse(sample.input_data),
      expectedOutput: sample.expected_output ? JSON.parse(sample.expected_output) : null,
      orderIndex: sample.order_index,
      createdAt: sample.created_at
    }));
    zip.file('samples.json', JSON.stringify(samplesData, null, 2));

    if (reviews.length > 0) {
      const reviewsData = reviews.map(review => ({
        id: review.id,
        runId: review.run_id,
        reviewer: review.reviewer,
        conclusion: review.conclusion,
        notes: review.notes,
        createdAt: review.created_at
      }));
      zip.file('reviews.json', JSON.stringify(reviewsData, null, 2));
    }

    const markdownReport = this.generateMarkdownReport(batchId);
    zip.file('report.md', markdownReport);

    if (options.includeWasm !== false && plugin.wasm_path && fs.existsSync(plugin.wasm_path)) {
      const wasmBuffer = fs.readFileSync(plugin.wasm_path);
      zip.file(`plugin-${plugin.name}-${plugin.version}.wasm`, wasmBuffer);
    }

    const manifestJson = plugin.manifest;
    zip.file('manifest.json', manifestJson);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return {
      auditId,
      buffer,
      filename: `audit-package-${batch.id.slice(0, 8)}-${dayjs().format('YYYYMMDD')}.zip`
    };
  }

  _formatStatus(status) {
    const statusMap = {
      'passed': '✅ 通过',
      'failed': '❌ 失败',
      'error': '⚠️ 错误',
      'timeout': '⏰ 超时',
      'running': '🔄 运行中',
      'pending': '⏳ 待执行',
      'completed': '✅ 已完成',
      'completed_with_errors': '⚠️ 完成(有错误)',
      'cancelled': '🚫 已取消'
    };
    return statusMap[status] || status;
  }

  _formatConclusion(conclusion) {
    const conclusionMap = {
      'approved': '✅ 通过',
      'rejected': '❌ 驳回',
      'pending': '⏳ 待定'
    };
    return conclusionMap[conclusion] || conclusion;
  }
}

module.exports = new ExportService();
