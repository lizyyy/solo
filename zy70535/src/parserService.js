const fs = require('fs');
const csv = require('csv-parser');
const store = require('./store');
const { FILE_STATUS, TASK_STATUS, FailedRow, ParseSummary } = require('./models');

class ParserService {
  validateRow(row, rule) {
    const errors = [];
    const basis = [];

    for (const column of rule.columns) {
      const value = row[column.name];
      
      if (column.required && (value === undefined || value === null || value === '')) {
        errors.push({
          column: column.name,
          type: 'required',
          message: `字段 '${column.name}' 是必填项`
        });
        basis.push(`规则: ${column.name} 为必填字段`);
      }

      if (value !== undefined && value !== null && value !== '') {
        if (column.type === 'number' && isNaN(Number(value))) {
          errors.push({
            column: column.name,
            type: 'type_error',
            message: `字段 '${column.name}' 必须是数字`
          });
          basis.push(`规则: ${column.name} 类型为数字`);
        }

        if (column.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push({
            column: column.name,
            type: 'format_error',
            message: `字段 '${column.name}' 不是有效的邮箱格式`
          });
          basis.push(`规则: ${column.name} 为邮箱格式`);
        }

        if (column.pattern && !new RegExp(column.pattern).test(value)) {
          errors.push({
            column: column.name,
            type: 'pattern_mismatch',
            message: `字段 '${column.name}' 格式不匹配`
          });
          basis.push(`规则: ${column.name} 匹配模式 ${column.pattern}`);
        }

        if (column.minLength !== undefined && value.length < column.minLength) {
          errors.push({
            column: column.name,
            type: 'min_length',
            message: `字段 '${column.name}' 最小长度为 ${column.minLength}`
          });
          basis.push(`规则: ${column.name} 最小长度 ${column.minLength}`);
        }

        if (column.maxLength !== undefined && value.length > column.maxLength) {
          errors.push({
            column: column.name,
            type: 'max_length',
            message: `字段 '${column.name}' 最大长度为 ${column.maxLength}`
          });
          basis.push(`规则: ${column.name} 最大长度 ${column.maxLength}`);
        }
      }
    }

    if (rule.validators) {
      for (const validator of rule.validators) {
        try {
          if (validator.type === 'custom') {
            const result = eval(validator.logic)(row);
            if (!result.valid) {
              errors.push({
                type: 'custom_validation',
                message: result.message || '自定义校验失败'
              });
              basis.push(`自定义规则: ${validator.name}`);
            }
          }
        } catch (e) {
          errors.push({
            type: 'validation_error',
            message: `校验规则执行失败: ${e.message}`
          });
        }
      }
    }

    return { valid: errors.length === 0, errors, basis };
  }

  async parseFile(taskId, filePath, rule) {
    const task = store.getTask(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const file = store.getFile(task.fileId);
    if (!file) {
      throw new Error('文件不存在');
    }

    file.updateStatus(FILE_STATUS.PARSING);
    store.saveFile(file);

    const summary = new ParseSummary({
      fileId: task.fileId,
      taskId: task.id,
      ruleId: task.ruleId
    });

    let successCount = 0;
    let failedCount = 0;
    const rows = [];

    try {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('headers', (headers) => {
          })
          .on('data', (row) => {
            rows.push(row);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });

      task.start(rows.length);
      store.saveTask(task);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 1;

        const { valid, errors, basis } = this.validateRow(row, rule);

        if (valid) {
          successCount++;
        } else {
          failedCount++;
          summary.totalRows = rows.length;
          summary.successRows = successCount;
          summary.failedRows = failedCount;

          const failedRow = new FailedRow({
            taskId: task.id,
            fileId: task.fileId,
            rowNumber,
            originalData: row,
            validationErrors: errors,
            processingBasis: basis,
            conclusion: 'validation_failed'
          });

          store.saveFailedRow(failedRow);
          summary.addSampleFailedRow(failedRow);

          for (const error of errors) {
            summary.addError(error.type, error.message);
            if (error.column) {
              summary.addColumnError(error.column, error.message);
            }
          }
        }

        task.updateProgress(successCount, failedCount);
        store.saveTask(task);

        if (i % 100 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      task.complete();
      store.saveTask(task);

      summary.totalRows = rows.length;
      summary.successRows = successCount;
      summary.failedRows = failedCount;
      store.saveSummary(summary);

      if (failedCount === 0) {
        file.updateStatus(FILE_STATUS.PARSED);
      } else {
        file.updateStatus(FILE_STATUS.FAILED);
      }
      store.saveFile(file);

      return {
        task,
        summary,
        successCount,
        failedCount
      };

    } catch (error) {
      task.fail(error.message);
      store.saveTask(task);
      file.updateStatus(FILE_STATUS.FAILED);
      store.saveFile(file);
      throw error;
    }
  }

  async parseFileAsync(taskId, filePath, rule) {
    setTimeout(async () => {
      try {
        await this.parseFile(taskId, filePath, rule);
      } catch (error) {
        console.error('解析失败:', error);
      }
    }, 100);
  }
}

module.exports = new ParserService();
