import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from './utils/logger.js';

export class ConfigLoader {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
  }

  load(configPath) {
    if (!configPath) {
      return this.getDefaultConfig();
    }

    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }

    const ext = path.extname(configPath).toLowerCase();
    const content = fs.readFileSync(configPath, 'utf-8');

    let config;
    if (ext === '.yaml' || ext === '.yml') {
      try {
        config = yaml.load(content);
      } catch (error) {
        throw new Error(`YAML 解析失败: ${error.message}`);
      }
    } else if (ext === '.json') {
      try {
        config = JSON.parse(content);
      } catch (error) {
        throw new Error(`JSON 解析失败: ${error.message}`);
      }
    } else {
      throw new Error(`不支持的配置文件格式: ${ext}`);
    }

    return this.validateAndNormalize(config, configPath);
  }

  getDefaultConfig() {
    return {
      seed: [],
      assertions: [],
      watchTables: [],
      output: {
        markdown: true,
        json: true,
        html: true
      }
    };
  }

  validateAndNormalize(config, configPath) {
    const baseDir = path.dirname(path.resolve(configPath));
    const normalized = {
      ...this.getDefaultConfig(),
      ...config
    };

    if (config.seed) {
      normalized.seed = this.normalizeSeed(config.seed, baseDir);
    }

    if (config.assertions) {
      normalized.assertions = this.normalizeAssertions(config.assertions);
    }

    if (config.watchTables) {
      normalized.watchTables = config.watchTables;
    }

    return normalized;
  }

  normalizeSeed(seedConfig, baseDir) {
    const seeds = [];

    for (const seed of seedConfig) {
      if (typeof seed === 'string') {
        const seedPath = path.resolve(baseDir, seed);
        if (!fs.existsSync(seedPath)) {
          logger.warn(`Seed 文件不存在: ${seedPath}`);
          continue;
        }

        const ext = path.extname(seedPath).toLowerCase();
        if (ext === '.sql') {
          seeds.push({
            type: 'sql',
            path: seedPath,
            content: fs.readFileSync(seedPath, 'utf-8')
          });
        } else if (ext === '.json') {
          const data = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
          for (const [table, rows] of Object.entries(data)) {
            seeds.push({
              type: 'data',
              table,
              rows: Array.isArray(rows) ? rows : [rows]
            });
          }
        } else if (ext === '.yaml' || ext === '.yml') {
          const data = yaml.load(fs.readFileSync(seedPath, 'utf-8'));
          for (const [table, rows] of Object.entries(data)) {
            seeds.push({
              type: 'data',
              table,
              rows: Array.isArray(rows) ? rows : [rows]
            });
          }
        }
      } else if (seed.type === 'data') {
        seeds.push(seed);
      }
    }

    return seeds;
  }

  normalizeAssertions(assertions) {
    return assertions.map(assertion => {
      if (typeof assertion === 'string') {
        return {
          type: 'raw',
          sql: assertion
        };
      }
      return assertion;
    });
  }

  executeSeed(dbEngine, seeds) {
    const results = [];

    for (const seed of seeds) {
      const result = {
        success: false,
        type: seed.type,
        error: null
      };

      try {
        if (seed.type === 'sql') {
          dbEngine.execute(seed.content);
          result.success = true;
          result.message = `执行 SQL seed: ${seed.path}`;
        } else if (seed.type === 'data') {
          for (const row of seed.rows) {
            const columns = Object.keys(row);
            const placeholders = columns.map(() => '?').join(',');
            const values = columns.map(col => row[col]);
            
            const sql = `INSERT INTO "${seed.table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`;
            dbEngine.query(sql, values);
          }
          result.success = true;
          result.message = `插入数据到表: ${seed.table} (${seed.rows.length} 行)`;
        }

        if (result.success) {
          logger.success(result.message);
        }
      } catch (error) {
        result.error = error.message;
        logger.error(`Seed 执行失败: ${error.message}`);
      }

      results.push(result);
    }

    return results;
  }

  executeAssertions(dbEngine, assertions) {
    const results = [];

    for (const assertion of assertions) {
      const result = {
        success: false,
        type: assertion.type,
        error: null,
        assertion: assertion
      };

      try {
        if (assertion.type === 'raw') {
          const rows = dbEngine.query(assertion.sql);
          result.result = rows;
          result.success = true;
        } else if (assertion.type === 'table_exists') {
          const table = assertion.table;
          const exists = dbEngine.query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
          `, [table]).length > 0;
          
          if (assertion.shouldExist !== false) {
            result.success = exists;
            if (!exists) {
              result.error = `表 "${table}" 不存在`;
            }
          } else {
            result.success = !exists;
            if (exists) {
              result.error = `表 "${table}" 应该不存在，但存在`;
            }
          }
        } else if (assertion.type === 'column_exists') {
          const columnInfo = dbEngine.query(`PRAGMA table_info("${assertion.table}")`);
          const exists = columnInfo.some(col => col.name === assertion.column);
          
          if (assertion.shouldExist !== false) {
            result.success = exists;
            if (!exists) {
              result.error = `表 "${assertion.table}" 的字段 "${assertion.column}" 不存在`;
            }
          } else {
            result.success = !exists;
            if (exists) {
              result.error = `表 "${assertion.table}" 的字段 "${assertion.column}" 应该不存在，但存在`;
            }
          }
        } else if (assertion.type === 'row_count') {
          const count = dbEngine.query(`SELECT COUNT(*) as count FROM "${assertion.table}"`)[0].count;
          result.actual = count;
          result.expected = assertion.count;
          
          if (assertion.operator === '>') {
            result.success = count > assertion.count;
          } else if (assertion.operator === '>=') {
            result.success = count >= assertion.count;
          } else if (assertion.operator === '<') {
            result.success = count < assertion.count;
          } else if (assertion.operator === '<=') {
            result.success = count <= assertion.count;
          } else {
            result.success = count === assertion.count;
          }
          
          if (!result.success) {
            result.error = `表 "${assertion.table}" 行数应为 ${assertion.count}，实际为 ${count}`;
          }
        } else if (assertion.type === 'data_integrity') {
          const snapshot = dbEngine.getTableDataSnapshot([assertion.table]);
          result.data = snapshot[assertion.table];
          result.success = true;
        }

        if (result.success) {
          logger.success(`断言通过: ${JSON.stringify(assertion)}`);
        } else {
          logger.error(`断言失败: ${result.error}`);
        }
      } catch (error) {
        result.error = error.message;
        logger.error(`断言执行失败: ${error.message}`);
      }

      results.push(result);
    }

    return results;
  }
}

export default ConfigLoader;
