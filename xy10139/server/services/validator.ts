import { ValidationSchema, SchemaField, ValidationError, RowResult } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'

export type ValidationStatus = 'success' | 'failed' | 'skipped'

export interface ValidationContext {
  jobId: string
  schema: ValidationSchema
  allRows: Record<string, any>[]
  seenValues: Map<string, Set<any>>
}

export class Validator {
  validate(
    row: Record<string, any>,
    rowIndex: number,
    context: ValidationContext
  ): RowResult {
    const errors: ValidationError[] = []
    let status: ValidationStatus = 'success'

    for (const field of context.schema.fields) {
      const fieldErrors = this.validateField(row, field, rowIndex, context)
      errors.push(...fieldErrors)
    }

    if (errors.length > 0) {
      status = 'failed'
    }

    const rowResult: RowResult = {
      id: uuidv4(),
      jobId: context.jobId,
      rowIndex,
      status,
      data: { ...row },
      errors,
      createdAt: new Date().toISOString(),
      retryCount: 0
    }

    if (status === 'success') {
      this.updateSeenValues(row, context.schema, context.seenValues)
    }

    return rowResult
  }

  private validateField(
    row: Record<string, any>,
    field: SchemaField,
    rowIndex: number,
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = []
    const rawValue = row[field.name]
    const value = this.coerceValue(rawValue, field)
    
    if (this.isEmpty(rawValue)) {
      if (field.required) {
        errors.push({
          field: field.name,
          rule: 'required',
          message: `${field.label} 不能为空`,
          value: rawValue
        })
      }
      return errors
    }

    const typeError = this.validateType(value, field)
    if (typeError) {
      errors.push({
        field: field.name,
        rule: 'type',
        message: `${field.label} ${typeError}`,
        value: rawValue
      })
      return errors
    }

    for (const rule of field.rules) {
      const error = this.applyRule(value, field, rule, context, row)
      if (error) {
        errors.push(error)
      }
    }

    return errors
  }

  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim() === ''
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.keys(value).length === 0
    return false
  }

  private coerceValue(value: any, field: SchemaField): any {
    if (this.isEmpty(value)) return value

    switch (field.type) {
      case 'number':
        const num = Number(value)
        return isNaN(num) ? value : num
      case 'integer':
        const int = Number(value)
        return isNaN(int) ? value : Math.floor(int)
      case 'boolean':
        const strVal = String(value).toLowerCase()
        if (['true', '1', 'yes', '是'].includes(strVal)) return true
        if (['false', '0', 'no', '否'].includes(strVal)) return false
        return value
      case 'date':
        if (value instanceof Date) return value
        const date = new Date(value)
        return isNaN(date.getTime()) ? value : date
      default:
        return value
    }
  }

  private validateType(value: any, field: SchemaField): string | null {
    switch (field.type) {
      case 'string':
        return typeof value === 'string' ? null : '必须是字符串'
      case 'number':
        return typeof value === 'number' && !isNaN(value) ? null : '必须是数字'
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value) ? null : '必须是整数'
      case 'boolean':
        return typeof value === 'boolean' ? null : '必须是布尔值'
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return typeof value === 'string' && emailRegex.test(value) ? null : '必须是有效的邮箱地址'
      case 'date':
        return value instanceof Date || !isNaN(new Date(value).getTime()) 
          ? null : '必须是有效的日期格式'
      default:
        return null
    }
  }

  private applyRule(
    value: any,
    field: SchemaField,
    rule: any,
    context: ValidationContext,
    row: Record<string, any>
  ): ValidationError | null {
    switch (rule.type) {
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          return {
            field: field.name,
            rule: 'minLength',
            message: rule.message || `${field.label} 长度不能小于 ${rule.value}`,
            value
          }
        }
        break

      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          return {
            field: field.name,
            rule: 'maxLength',
            message: rule.message || `${field.label} 长度不能大于 ${rule.value}`,
            value
          }
        }
        break

      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return {
            field: field.name,
            rule: 'min',
            message: rule.message || `${field.label} 不能小于 ${rule.value}`,
            value
          }
        }
        break

      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return {
            field: field.name,
            rule: 'max',
            message: rule.message || `${field.label} 不能大于 ${rule.value}`,
            value
          }
        }
        break

      case 'pattern':
        if (typeof value === 'string') {
          const regex = new RegExp(rule.value)
          if (!regex.test(value)) {
            return {
              field: field.name,
              rule: 'pattern',
              message: rule.message || `${field.label} 格式不正确`,
              value
            }
          }
        }
        break

      case 'enum':
        if (Array.isArray(rule.value) && !rule.value.includes(value)) {
          return {
            field: field.name,
            rule: 'enum',
            message: rule.message || `${field.label} 必须是 ${rule.value.join(', ')} 之一`,
            value
          }
        }
        break

      case 'unique':
        const key = `${field.name}`
        if (!context.seenValues.has(key)) {
          context.seenValues.set(key, new Set())
        }
        const seen = context.seenValues.get(key)!
        if (seen.has(value)) {
          return {
            field: field.name,
            rule: 'unique',
            message: rule.message || `${field.label} "${value}" 已存在，值必须唯一`,
            value
          }
        }
        break
    }

    return null
  }

  private updateSeenValues(
    row: Record<string, any>,
    schema: ValidationSchema,
    seenValues: Map<string, Set<any>>
  ) {
    for (const field of schema.fields) {
      const uniqueRule = field.rules.find(r => r.type === 'unique')
      if (uniqueRule) {
        const key = field.name
        const value = row[field.name]
        if (!this.isEmpty(value)) {
          if (!seenValues.has(key)) {
            seenValues.set(key, new Set())
          }
          seenValues.get(key)!.add(value)
        }
      }
    }
  }

  createContext(jobId: string, schema: ValidationSchema, allRows: Record<string, any>[]): ValidationContext {
    return {
      jobId,
      schema,
      allRows,
      seenValues: new Map()
    }
  }
}

export const validator = new Validator()
