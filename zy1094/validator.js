import { Utils } from './utils.js';

export const ERROR_TYPES = {
    MISSING_REQUIRED: 'missing_required',
    DUPLICATE_UNIQUE_KEY: 'duplicate_unique_key',
    TYPE_ERROR: 'type_error',
    ENUM_OUT_OF_RANGE: 'enum_out_of_range',
    DATE_AMBIGUOUS: 'date_ambiguous',
    DATE_FORMAT_ERROR: 'date_format_error',
    AMOUNT_UNIT_AMBIGUOUS: 'amount_unit_ambiguous',
    CROSS_FIELD_RULE: 'cross_field_rule',
    MISSING_FIELD: 'missing_field',
    CUSTOM_ERROR: 'custom_error'
};

export const ERROR_CATEGORIES = {
    [ERROR_TYPES.MISSING_REQUIRED]: { name: '缺少必填字段', severity: 'error', icon: '❌' },
    [ERROR_TYPES.DUPLICATE_UNIQUE_KEY]: { name: '重复唯一键', severity: 'error', icon: '🔄' },
    [ERROR_TYPES.TYPE_ERROR]: { name: '类型错误', severity: 'error', icon: '⚠️' },
    [ERROR_TYPES.ENUM_OUT_OF_RANGE]: { name: '枚举越界', severity: 'error', icon: '🚫' },
    [ERROR_TYPES.DATE_AMBIGUOUS]: { name: '日期歧义', severity: 'warning', icon: '📅' },
    [ERROR_TYPES.DATE_FORMAT_ERROR]: { name: '日期格式错误', severity: 'error', icon: '❌' },
    [ERROR_TYPES.AMOUNT_UNIT_AMBIGUOUS]: { name: '金额单位混乱', severity: 'warning', icon: '💰' },
    [ERROR_TYPES.CROSS_FIELD_RULE]: { name: '跨列规则冲突', severity: 'error', icon: '⚡' },
    [ERROR_TYPES.MISSING_FIELD]: { name: '缺少字段', severity: 'warning', icon: '📭' },
    [ERROR_TYPES.CUSTOM_ERROR]: { name: '自定义错误', severity: 'error', icon: '❌' }
};

export const Validator = {
    createFieldMapping(headers, templateFields) {
        const mapping = {};
        const unmappedFields = [];
        const mappedHeaders = new Set();

        for (const field of templateFields) {
            const allNames = [field.name, ...(field.aliases || [])].map(n => n.toLowerCase());
            
            let matchedHeader = null;
            for (const header of headers) {
                if (mappedHeaders.has(header)) continue;
                if (allNames.includes(header.toLowerCase())) {
                    matchedHeader = header;
                    break;
                }
            }

            if (matchedHeader) {
                mapping[field.id] = {
                    field,
                    sourceHeader: matchedHeader,
                    mapped: true
                };
                mappedHeaders.add(matchedHeader);
            } else {
                mapping[field.id] = {
                    field,
                    sourceHeader: null,
                    mapped: false
                };
                unmappedFields.push(field);
            }
        }

        const extraHeaders = headers.filter(h => !mappedHeaders.has(h));

        return {
            mapping,
            unmappedFields,
            extraHeaders,
            mappedHeaders: Array.from(mappedHeaders)
        };
    },

    normalizeValue(rawValue, field) {
        if (rawValue === null || rawValue === undefined || rawValue === '') {
            return { value: null, normalized: null, parsed: null };
        }

        const strValue = String(rawValue).trim();
        let result = { value: strValue, normalized: strValue, parsed: null };

        switch (field.type) {
            case 'string':
                result.normalized = strValue;
                result.parsed = strValue;
                break;

            case 'number':
                const num = Utils.parseNumber(strValue);
                result.parsed = num;
                result.normalized = num !== null ? String(num) : strValue;
                result.parseError = num === null;
                break;

            case 'date':
                const dateResult = Utils.parseDate(strValue, field.dateFormat || 'auto');
                if (dateResult) {
                    result.parsed = dateResult.date;
                    result.normalized = Utils.formatDate(dateResult.date, 'YYYY-MM-DD');
                    result.dateFormat = dateResult.format;
                    result.ambiguous = dateResult.ambiguous;
                    result.possibleFormats = dateResult.possibleFormats;
                } else {
                    result.parseError = true;
                }
                break;

            case 'boolean':
                const bool = Utils.parseBoolean(strValue);
                result.parsed = bool;
                result.normalized = bool !== null ? (bool ? '是' : '否') : strValue;
                result.parseError = bool === null;
                break;

            case 'amount':
                const amountResult = Utils.parseAmount(strValue, field.amountUnit || 'auto');
                if (amountResult) {
                    result.parsed = amountResult.normalized;
                    result.normalized = Utils.formatAmount(amountResult.normalized, 'yuan');
                    result.amountValue = amountResult.value;
                    result.amountUnit = amountResult.unit;
                    result.ambiguous = amountResult.ambiguous;
                    result.detectedUnit = amountResult.detectedUnit;
                } else {
                    result.parseError = true;
                }
                break;
        }

        return result;
    },

    validateRow(row, rowIndex, fieldMapping, template) {
        const errors = [];
        const normalizedRow = {};
        const fieldResults = {};

        for (const [fieldId, mapInfo] of Object.entries(fieldMapping)) {
            const field = mapInfo.field;
            const rawValue = mapInfo.sourceHeader ? row[mapInfo.sourceHeader] : null;
            
            const normalizeResult = this.normalizeValue(rawValue, field);
            fieldResults[fieldId] = normalizeResult;
            normalizedRow[fieldId] = normalizeResult.normalized;

            if (field.required && (rawValue === null || rawValue === undefined || String(rawValue).trim() === '')) {
                errors.push(this.createError(
                    ERROR_TYPES.MISSING_REQUIRED,
                    rowIndex,
                    field,
                    rawValue,
                    `必填字段「${field.name}」为空`
                ));
                continue;
            }

            if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '') {
                if (normalizeResult.parseError) {
                    errors.push(this.createError(
                        ERROR_TYPES.TYPE_ERROR,
                        rowIndex,
                        field,
                        rawValue,
                        `字段「${field.name}」值「${Utils.truncate(rawValue)}」无法解析为${this.getFieldTypeName(field.type)}`
                    ));
                }

                if (field.enums && field.enums.length > 0 && normalizeResult.parsed !== null) {
                    const enumValues = field.enums.map(e => String(e).toLowerCase());
                    const valueStr = String(normalizeResult.parsed).toLowerCase();
                    if (!enumValues.includes(valueStr)) {
                        errors.push(this.createError(
                            ERROR_TYPES.ENUM_OUT_OF_RANGE,
                            rowIndex,
                            field,
                            rawValue,
                            `字段「${field.name}」值「${Utils.truncate(rawValue)}」不在允许的枚举值范围内`,
                            { allowedValues: field.enums }
                        ));
                    }
                }

                if (field.type === 'date' && normalizeResult.ambiguous) {
                    errors.push(this.createError(
                        ERROR_TYPES.DATE_AMBIGUOUS,
                        rowIndex,
                        field,
                        rawValue,
                        `日期「${rawValue}」存在歧义，可能是以下格式：${normalizeResult.possibleFormats?.join('、') || '多种格式'}`,
                        { possibleFormats: normalizeResult.possibleFormats }
                    ));
                }

                if (field.type === 'amount' && normalizeResult.ambiguous) {
                    errors.push(this.createError(
                        ERROR_TYPES.AMOUNT_UNIT_AMBIGUOUS,
                        rowIndex,
                        field,
                        rawValue,
                        `金额「${rawValue}」单位不明确，请确认是元、万元还是其他单位`,
                        { detectedUnit: normalizeResult.detectedUnit }
                    ));
                }
            }
        }

        return {
            rowIndex,
            rawRow: row,
            normalizedRow,
            fieldResults,
            errors,
            isValid: errors.length === 0 || errors.every(e => ERROR_CATEGORIES[e.type]?.severity === 'warning')
        };
    },

    checkUniqueKeys(validationResults, templateFields) {
        const errors = [];
        const uniqueFields = templateFields.filter(f => f.unique);

        for (const field of uniqueFields) {
            const valueMap = new Map();

            for (const result of validationResults) {
                const fieldResult = result.fieldResults[field.id];
                if (!fieldResult || fieldResult.parsed === null) continue;

                const value = fieldResult.parsed;
                const valueKey = typeof value === 'object' ? JSON.stringify(value) : String(value);

                if (valueMap.has(valueKey)) {
                    const firstRow = valueMap.get(valueKey);
                    
                    errors.push(this.createError(
                        ERROR_TYPES.DUPLICATE_UNIQUE_KEY,
                        result.rowIndex,
                        field,
                        result.rawRow[field.name] || value,
                        `唯一键「${field.name}」值「${Utils.truncate(value)}」与第 ${firstRow + 2} 行重复`,
                        { duplicateWithRow: firstRow }
                    ));
                } else {
                    valueMap.set(valueKey, result.rowIndex);
                }
            }
        }

        return errors;
    },

    validateCrossFieldRules(validationResults, crossFieldRules, fieldMapping) {
        const allErrors = [];

        for (const result of validationResults) {
            for (const rule of crossFieldRules) {
                const error = this.checkSingleRule(result, rule, fieldMapping);
                if (error) {
                    allErrors.push({
                        ...this.createError(
                            ERROR_TYPES.CROSS_FIELD_RULE,
                            result.rowIndex,
                            null,
                            null,
                            rule.errorMessage || `违反规则：${rule.name}`
                        ),
                        ruleId: rule.id,
                        ruleName: rule.name,
                        ruleType: rule.type
                    });
                }
            }
        }

        return allErrors;
    },

    checkSingleRule(validationResult, rule, fieldMapping) {
        const { fieldResults, rowIndex } = validationResult;

        switch (rule.type) {
            case 'date_order': {
                const startResult = fieldResults[rule.startField];
                const endResult = fieldResults[rule.endField];
                
                if (startResult?.parsed && endResult?.parsed) {
                    if (endResult.parsed < startResult.parsed) {
                        return true;
                    }
                }
                return false;
            }

            case 'amount_check': {
                const totalResult = fieldResults[rule.totalField];
                const priceResult = fieldResults[rule.priceField];
                const qtyResult = fieldResults[rule.quantityField];
                
                if (totalResult?.parsed !== null && 
                    priceResult?.parsed !== null && 
                    qtyResult?.parsed !== null) {
                    const calculated = priceResult.parsed * qtyResult.parsed;
                    const tolerance = 0.01;
                    if (Math.abs(totalResult.parsed - calculated) > tolerance) {
                        return true;
                    }
                }
                return false;
            }

            case 'custom': {
                try {
                    const formula = rule.formula || '';
                    let evalFormula = formula;
                    
                    for (const [fieldId, result] of Object.entries(fieldResults)) {
                        const pattern = new RegExp(`\\{${fieldId}\\}`, 'g');
                        const value = result.parsed !== null ? 
                            (typeof result.parsed === 'string' ? `"${result.parsed}"` : result.parsed) : 
                            'null';
                        evalFormula = evalFormula.replace(pattern, value);
                    }
                    
                    const result = eval(evalFormula);
                    return result === false;
                } catch (e) {
                    console.warn('Custom rule evaluation error:', e);
                    return false;
                }
            }

            default:
                return false;
        }
    },

    createError(type, rowIndex, field, value, message, extra = {}) {
        return {
            id: Utils.generateId(),
            type,
            rowIndex,
            field: field ? { id: field.id, name: field.name, type: field.type } : null,
            rawValue: value,
            message,
            severity: ERROR_CATEGORIES[type]?.severity || 'error',
            category: ERROR_CATEGORIES[type]?.name || '其他错误',
            icon: ERROR_CATEGORIES[type]?.icon || '❌',
            status: 'pending',
            suggestion: this.generateSuggestion(type, field, value, extra),
            ...extra
        };
    },

    generateSuggestion(type, field, value, extra) {
        switch (type) {
            case ERROR_TYPES.MISSING_REQUIRED:
                return {
                    action: 'fill',
                    suggestedValue: '',
                    description: '请补充必填字段值'
                };

            case ERROR_TYPES.DUPLICATE_UNIQUE_KEY:
                return {
                    action: 'modify',
                    suggestedValue: value,
                    description: '请修改为唯一值，或确认是否为重复数据'
                };

            case ERROR_TYPES.TYPE_ERROR:
                if (field?.type === 'number') {
                    return {
                        action: 'modify',
                        suggestedValue: Utils.parseNumber(String(value)) || '',
                        description: `请输入有效的数字`
                    };
                }
                if (field?.type === 'date') {
                    return {
                        action: 'modify',
                        suggestedValue: '',
                        description: `请使用 YYYY-MM-DD 格式输入日期`
                    };
                }
                return {
                    action: 'modify',
                    suggestedValue: value,
                    description: `请修正为正确的${field?.type || ''}格式`
                };

            case ERROR_TYPES.ENUM_OUT_OF_RANGE:
                return {
                    action: 'select',
                    suggestedValue: extra.allowedValues?.[0] || '',
                    allowedValues: extra.allowedValues || [],
                    description: `请从允许的值中选择`
                };

            case ERROR_TYPES.DATE_AMBIGUOUS:
                return {
                    action: 'select_format',
                    suggestedValue: value,
                    possibleFormats: extra.possibleFormats || [],
                    description: `请确认日期的正确格式`
                };

            case ERROR_TYPES.AMOUNT_UNIT_AMBIGUOUS:
                return {
                    action: 'select_unit',
                    suggestedValue: value,
                    suggestedUnit: 'yuan',
                    possibleUnits: ['yuan', 'wanyuan', 'thousand', 'cent'],
                    description: `请确认金额的正确单位`
                };

            case ERROR_TYPES.CROSS_FIELD_RULE:
                return {
                    action: 'review',
                    description: `请检查相关字段的值是否正确`
                };

            default:
                return {
                    action: 'review',
                    description: `请手动检查并修正`
                };
        }
    },

    getFieldTypeName(type) {
        const names = {
            string: '字符串',
            number: '数字',
            date: '日期',
            boolean: '布尔值',
            amount: '金额'
        };
        return names[type] || type;
    },

    validateAll(headers, rows, template) {
        const fieldMapping = this.createFieldMapping(headers, template.fields);
        
        const validationResults = rows.map((row, index) => 
            this.validateRow(row, index, fieldMapping.mapping, template)
        );

        const uniqueKeyErrors = this.checkUniqueKeys(validationResults, template.fields);
        for (const error of uniqueKeyErrors) {
            const result = validationResults[error.rowIndex];
            if (result) {
                result.errors.push(error);
            }
        }

        if (template.crossFieldRules && template.crossFieldRules.length > 0) {
            const crossFieldErrors = this.validateCrossFieldRules(
                validationResults, 
                template.crossFieldRules, 
                fieldMapping.mapping
            );
            for (const error of crossFieldErrors) {
                const result = validationResults[error.rowIndex];
                if (result) {
                    result.errors.push(error);
                }
            }
        }

        const allErrors = [];
        const validResults = [];
        const invalidResults = [];

        for (const result of validationResults) {
            const hasErrors = result.errors.some(e => e.severity === 'error');
            result.hasErrors = hasErrors;
            
            if (hasErrors) {
                invalidResults.push(result);
            } else {
                validResults.push(result);
            }
            
            allErrors.push(...result.errors);
        }

        const errorGroups = Utils.groupBy(allErrors, e => e.type);

        const unmappedRequiredFields = fieldMapping.unmappedFields.filter(f => f.required);
        const missingFieldErrors = unmappedRequiredFields.map(field => ({
            ...this.createError(
                ERROR_TYPES.MISSING_FIELD,
                -1,
                field,
                null,
                `数据源中缺少必填字段「${field.name}」，请检查列名或添加字段别名`
            ),
            isGlobal: true
        }));

        return {
            fieldMapping,
            validationResults,
            validResults,
            invalidResults,
            allErrors: [...allErrors, ...missingFieldErrors],
            errorGroups,
            globalErrors: missingFieldErrors,
            stats: {
                totalRows: rows.length,
                validRows: validResults.length,
                invalidRows: invalidResults.length,
                totalErrors: allErrors.length + missingFieldErrors.length,
                errorTypes: Object.keys(errorGroups).length
            }
        };
    },

    applyFix(error, fixAction, newValue) {
        return {
            ...error,
            status: 'fixed',
            fixedBy: fixAction,
            fixedValue: newValue,
            fixedAt: new Date().toISOString()
        };
    },

    ignoreError(error) {
        return {
            ...error,
            status: 'ignored',
            ignoredAt: new Date().toISOString()
        };
    }
};

export default Validator;
