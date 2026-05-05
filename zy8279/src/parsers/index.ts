import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import * as yaml from 'js-yaml';
import { Order, SkuTag, ZoneCapacity, Rule, ValidationError, ValidationResult } from '../types';

export class FileParser {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.cwd();
  }

  async parseOrders(filePath: string): Promise<{ data: Order[]; errors: ValidationError[] }> {
    const fullPath = this.resolvePath(filePath);
    const errors: ValidationError[] = [];
    const orders: Order[] = [];

    if (!fs.existsSync(fullPath)) {
      errors.push({
        type: 'error',
        field: 'orders.csv',
        message: `文件不存在: ${fullPath}`
      });
      return { data: [], errors };
    }

    return new Promise((resolve) => {
      fs.createReadStream(fullPath)
        .pipe(csv())
        .on('data', (row: any) => {
          try {
            const order = this.validateOrderRow(row, orders.length + 2, errors);
            if (order) {
              orders.push(order);
            }
          } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            errors.push({
              type: 'error',
              field: 'orders.csv',
              message: `行 ${orders.length + 2} 解析错误: ${errorMessage}`
            });
          }
        })
        .on('end', () => {
          resolve({ data: orders, errors });
        })
        .on('error', (e: Error) => {
          errors.push({
            type: 'error',
            field: 'orders.csv',
            message: `文件读取错误: ${e.message}`
          });
          resolve({ data: [], errors });
        });
    });
  }

  private validateOrderRow(row: any, lineNumber: number, errors: ValidationError[]): Order | null {
    const requiredFields = ['orderId', 'sku', 'quantity', 'orderTime', 'customerType', 'shippingMethod', 'weight', 'volume'];
    const missingFields = requiredFields.filter(f => !row[f]);

    if (missingFields.length > 0) {
      errors.push({
        type: 'error',
        field: 'orders.csv',
        message: `行 ${lineNumber} 缺少必需字段: ${missingFields.join(', ')}`
      });
      return null;
    }

    const quantity = parseInt(row.quantity);
    const weight = parseFloat(row.weight);
    const volume = parseFloat(row.volume);

    if (isNaN(quantity) || quantity <= 0) {
      errors.push({
        type: 'error',
        field: 'orders.csv',
        message: `行 ${lineNumber} quantity 必须是正整数`
      });
      return null;
    }

    if (isNaN(weight) || weight < 0) {
      errors.push({
        type: 'error',
        field: 'orders.csv',
        message: `行 ${lineNumber} weight 必须是非负数`
      });
      return null;
    }

    if (isNaN(volume) || volume < 0) {
      errors.push({
        type: 'error',
        field: 'orders.csv',
        message: `行 ${lineNumber} volume 必须是非负数`
      });
      return null;
    }

    const validCustomerTypes = ['B2C', 'B2B', 'VIP'];
    if (!validCustomerTypes.includes(row.customerType)) {
      errors.push({
        type: 'warning',
        field: 'orders.csv',
        message: `行 ${lineNumber} customerType 应为 B2C/B2B/VIP，当前值: ${row.customerType}`
      });
    }

    return {
      orderId: row.orderId,
      sku: row.sku,
      quantity,
      orderTime: row.orderTime,
      customerType: row.customerType as 'B2C' | 'B2B' | 'VIP',
      shippingMethod: row.shippingMethod,
      weight,
      volume
    };
  }

  async parseSkuTags(filePath: string): Promise<{ data: SkuTag[]; errors: ValidationError[] }> {
    const fullPath = this.resolvePath(filePath);
    const errors: ValidationError[] = [];
    const skuTags: SkuTag[] = [];

    if (!fs.existsSync(fullPath)) {
      errors.push({
        type: 'error',
        field: 'sku_tags.csv',
        message: `文件不存在: ${fullPath}`
      });
      return { data: [], errors };
    }

    return new Promise((resolve) => {
      fs.createReadStream(fullPath)
        .pipe(csv())
        .on('data', (row: any) => {
          try {
            const skuTag = this.validateSkuTagRow(row, skuTags.length + 2, errors);
            if (skuTag) {
              skuTags.push(skuTag);
            }
          } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            errors.push({
              type: 'error',
              field: 'sku_tags.csv',
              message: `行 ${skuTags.length + 2} 解析错误: ${errorMessage}`
            });
          }
        })
        .on('end', () => {
          resolve({ data: skuTags, errors });
        })
        .on('error', (e: Error) => {
          errors.push({
            type: 'error',
            field: 'sku_tags.csv',
            message: `文件读取错误: ${e.message}`
          });
          resolve({ data: [], errors });
        });
    });
  }

  private validateSkuTagRow(row: any, lineNumber: number, errors: ValidationError[]): SkuTag | null {
    if (!row.sku) {
      errors.push({
        type: 'error',
        field: 'sku_tags.csv',
        message: `行 ${lineNumber} 缺少 sku 字段`
      });
      return null;
    }

    let tags: string[] = [];
    if (row.tags) {
      tags = row.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
    }

    return {
      sku: row.sku,
      tags
    };
  }

  parseZoneCapacity(filePath: string): { data: ZoneCapacity[]; errors: ValidationError[] } {
    const fullPath = this.resolvePath(filePath);
    const errors: ValidationError[] = [];

    if (!fs.existsSync(fullPath)) {
      errors.push({
        type: 'error',
        field: 'zone_capacity.yaml',
        message: `文件不存在: ${fullPath}`
      });
      return { data: [], errors };
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const parsed = yaml.load(content) as any;

      if (!parsed || !Array.isArray(parsed.zones)) {
        errors.push({
          type: 'error',
          field: 'zone_capacity.yaml',
          message: 'YAML 文件格式错误，需要包含 zones 数组'
        });
        return { data: [], errors };
      }

      const zones: ZoneCapacity[] = [];

      for (let i = 0; i < parsed.zones.length; i++) {
        const zone = parsed.zones[i];
        const validationErrors = this.validateZone(zone, i);
        errors.push(...validationErrors);

        if (validationErrors.every(e => e.type !== 'error')) {
          zones.push({
            zoneId: zone.zoneId,
            zoneName: zone.zoneName || zone.zoneId,
            maxOrders: zone.maxOrders || 100,
            maxWeight: zone.maxWeight || 1000,
            maxVolume: zone.maxVolume || 100,
            supportedTags: zone.supportedTags || [],
            excludedTags: zone.excludedTags || [],
            priority: zone.priority || 10
          });
        }
      }

      return { data: zones, errors };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      errors.push({
        type: 'error',
        field: 'zone_capacity.yaml',
        message: `YAML 解析错误: ${errorMessage}`
      });
      return { data: [], errors };
    }
  }

  private validateZone(zone: any, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const zoneId = zone.zoneId || `zone[${index}]`;

    if (!zone.zoneId) {
      errors.push({
        type: 'error',
        field: 'zone_capacity.yaml',
        message: `区域 ${index} 缺少 zoneId`,
        zoneId
      });
    }

    if (zone.maxOrders !== undefined && (typeof zone.maxOrders !== 'number' || zone.maxOrders < 0)) {
      errors.push({
        type: 'error',
        field: 'zone_capacity.yaml',
        message: `区域 ${zoneId} 的 maxOrders 必须是非负整数`,
        zoneId
      });
    }

    if (zone.maxWeight !== undefined && (typeof zone.maxWeight !== 'number' || zone.maxWeight < 0)) {
      errors.push({
        type: 'error',
        field: 'zone_capacity.yaml',
        message: `区域 ${zoneId} 的 maxWeight 必须是非负数`,
        zoneId
      });
    }

    if (zone.maxVolume !== undefined && (typeof zone.maxVolume !== 'number' || zone.maxVolume < 0)) {
      errors.push({
        type: 'error',
        field: 'zone_capacity.yaml',
        message: `区域 ${zoneId} 的 maxVolume 必须是非负数`,
        zoneId
      });
    }

    return errors;
  }

  parseRules(filePath: string): { data: Rule[]; errors: ValidationError[] } {
    const fullPath = this.resolvePath(filePath);
    const errors: ValidationError[] = [];

    if (!fs.existsSync(fullPath)) {
      errors.push({
        type: 'error',
        field: 'rules.json',
        message: `文件不存在: ${fullPath}`
      });
      return { data: [], errors };
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(content);

      if (!parsed || !Array.isArray(parsed.rules)) {
        errors.push({
          type: 'error',
          field: 'rules.json',
          message: 'JSON 文件格式错误，需要包含 rules 数组'
        });
        return { data: [], errors };
      }

      const rules: Rule[] = [];

      for (let i = 0; i < parsed.rules.length; i++) {
        const rule = parsed.rules[i];
        const validationErrors = this.validateRule(rule, i);
        errors.push(...validationErrors);

        if (validationErrors.every(e => e.type !== 'error')) {
          rules.push(rule);
        }
      }

      const defaultRules = rules.filter(r => r.isDefault);
      if (defaultRules.length > 1) {
        errors.push({
          type: 'error',
          field: 'rules.json',
          message: `存在多个默认规则: ${defaultRules.map(r => r.id).join(', ')}`
        });
      }

      const ruleIds = new Set<string>();
      for (const rule of rules) {
        if (ruleIds.has(rule.id)) {
          errors.push({
            type: 'error',
            field: 'rules.json',
            message: `重复的规则ID: ${rule.id}`,
            ruleId: rule.id
          });
        }
        ruleIds.add(rule.id);
      }

      return { data: rules.filter(r => ruleIds.has(r.id)), errors };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      errors.push({
        type: 'error',
        field: 'rules.json',
        message: `JSON 解析错误: ${errorMessage}`
      });
      return { data: [], errors };
    }
  }

  private validateRule(rule: any, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const ruleId = rule.id || `rule[${index}]`;

    if (!rule.id) {
      errors.push({
        type: 'error',
        field: 'rules.json',
        message: `规则 ${index} 缺少 id`,
        ruleId
      });
    }

    if (!rule.name) {
      errors.push({
        type: 'warning',
        field: 'rules.json',
        message: `规则 ${ruleId} 缺少 name`,
        ruleId
      });
    }

    if (rule.priority === undefined || typeof rule.priority !== 'number' || rule.priority < 0) {
      errors.push({
        type: 'error',
        field: 'rules.json',
        message: `规则 ${ruleId} 的 priority 必须是非负整数`,
        ruleId
      });
    }

    if (rule.conditionLogic && !['AND', 'OR'].includes(rule.conditionLogic)) {
      errors.push({
        type: 'error',
        field: 'rules.json',
        message: `规则 ${ruleId} 的 conditionLogic 必须是 AND 或 OR`,
        ruleId
      });
    }

    if (rule.conditions && Array.isArray(rule.conditions)) {
      const validOperators = ['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'in', 'notIn'];
      for (let i = 0; i < rule.conditions.length; i++) {
        const cond = rule.conditions[i];
        if (!cond.field) {
          errors.push({
            type: 'error',
            field: 'rules.json',
            message: `规则 ${ruleId} 的条件 ${i} 缺少 field`,
            ruleId
          });
        }
        if (!cond.operator || !validOperators.includes(cond.operator)) {
          errors.push({
            type: 'error',
            field: 'rules.json',
            message: `规则 ${ruleId} 的条件 ${i} 的 operator 无效，有效值: ${validOperators.join(', ')}`,
            ruleId
          });
        }
        if (cond.value === undefined) {
          errors.push({
            type: 'error',
            field: 'rules.json',
            message: `规则 ${ruleId} 的条件 ${i} 缺少 value`,
            ruleId
          });
        }
      }
    }

    if (rule.actions && Array.isArray(rule.actions)) {
      const validActionTypes = ['assignZone', 'setPriority', 'excludeZone', 'setWaveLabel', 'hold'];
      for (let i = 0; i < rule.actions.length; i++) {
        const action = rule.actions[i];
        if (!action.type || !validActionTypes.includes(action.type)) {
          errors.push({
            type: 'error',
            field: 'rules.json',
            message: `规则 ${ruleId} 的动作 ${i} 的 type 无效，有效值: ${validActionTypes.join(', ')}`,
            ruleId
          });
        }
        if (action.value === undefined) {
          errors.push({
            type: 'error',
            field: 'rules.json',
            message: `规则 ${ruleId} 的动作 ${i} 缺少 value`,
            ruleId
          });
        }
      }
    }

    return errors;
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.basePath, filePath);
  }
}
