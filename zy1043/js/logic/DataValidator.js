/**
 * 数据验证器
 * 验证拣货单数据、仓库方案数据等
 */

class DataValidator {
    constructor() {
        this.errors = [];
    }
    
    validatePickingData(data, format = 'json') {
        this.errors = [];
        let items = [];
        
        try {
            if (format === 'json') {
                items = this.parseJSON(data);
            } else if (format === 'csv') {
                items = this.parseCSV(data);
            }
        } catch (e) {
            this.addError('格式错误', `数据解析失败: ${e.message}`);
            return {
                isValid: false,
                errors: [...this.errors],
                items: []
            };
        }
        
        if (!Array.isArray(items)) {
            this.addError('格式错误', '数据必须是数组格式');
            return {
                isValid: false,
                errors: [...this.errors],
                items: []
            };
        }
        
        if (items.length === 0) {
            this.addError('数据为空', '没有提供任何拣货项');
            return {
                isValid: false,
                errors: [...this.errors],
                items: []
            };
        }
        
        const validatedItems = [];
        
        items.forEach((item, index) => {
            const validatedItem = this.validatePickingItem(item, index);
            validatedItems.push(validatedItem);
        });
        
        return {
            isValid: this.errors.length === 0,
            errors: [...this.errors],
            items: validatedItems,
            validCount: validatedItems.filter(i => i.isValid).length,
            invalidCount: validatedItems.filter(i => !i.isValid).length
        };
    }
    
    parseJSON(data) {
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        return data;
    }
    
    parseCSV(data) {
        return Utils.parseCSV(data);
    }
    
    validatePickingItem(item, index) {
        const errors = [];
        const rowNum = index + 1;
        
        const sku = this.normalizeValue(item.sku || item.SKU || item.sku_code || item['SKU代码']);
        if (!sku) {
            errors.push(`第 ${rowNum} 行: SKU 不能为空`);
        }
        
        let quantity = this.normalizeValue(item.quantity || item.qty || item.QTY || item['数量']);
        if (quantity !== undefined && quantity !== null && quantity !== '') {
            quantity = parseFloat(quantity);
            if (isNaN(quantity) || quantity <= 0) {
                errors.push(`第 ${rowNum} 行 (SKU: ${sku}): 数量 "${item.quantity}" 无效，必须大于 0`);
            }
        } else {
            errors.push(`第 ${rowNum} 行 (SKU: ${sku}): 未指定数量`);
        }
        
        const shelfSlot = this.normalizeValue(
            item.shelfSlot || item.slot || item.shelf_id || 
            item['货架位'] || item['货位'] || item.location
        );
        if (!shelfSlot) {
            errors.push(`第 ${rowNum} 行 (SKU: ${sku}): 未指定货架位`);
        }
        
        const orderNo = this.normalizeValue(item.orderNo || item.order_no || item['订单号']);
        if (!orderNo) {
            errors.push(`第 ${rowNum} 行 (SKU: ${sku}): 未指定订单号`);
        }
        
        errors.forEach(e => this.errors.push(e));
        
        return {
            ...item,
            sku: sku,
            quantity: quantity,
            shelfSlot: shelfSlot,
            orderNo: orderNo,
            isValid: errors.length === 0,
            validationErrors: errors
        };
    }
    
    normalizeValue(value) {
        if (value === undefined || value === null) return '';
        if (typeof value === 'string') {
            return value.trim();
        }
        return value;
    }
    
    validateProjectData(data) {
        this.errors = [];
        
        try {
            let project;
            if (typeof data === 'string') {
                project = JSON.parse(data);
            } else {
                project = data;
            }
            
            if (!project) {
                this.addError('数据为空', '没有提供有效的项目数据');
                return { isValid: false, errors: [...this.errors] };
            }
            
            if (!project.warehouse && !project.objects) {
                this.addError('格式错误', '数据格式不正确，缺少 warehouse 或 objects 字段');
                return { isValid: false, errors: [...this.errors] };
            }
            
            if (project.warehouse) {
                this.validateWarehouse(project.warehouse);
            }
            
            if (project.objects) {
                if (!Array.isArray(project.objects)) {
                    this.addError('格式错误', 'objects 必须是数组');
                } else {
                    project.objects.forEach((obj, index) => {
                        this.validateObject(obj, index);
                    });
                }
            }
            
            return {
                isValid: this.errors.length === 0,
                errors: [...this.errors]
            };
            
        } catch (e) {
            this.addError('解析错误', `JSON 解析失败: ${e.message}`);
            return { isValid: false, errors: [...this.errors] };
        }
    }
    
    validateWarehouse(warehouse) {
        if (warehouse.length !== undefined && warehouse.length <= 0) {
            this.addError('仓库配置错误', '仓库长度必须大于 0');
        }
        if (warehouse.width !== undefined && warehouse.width <= 0) {
            this.addError('仓库配置错误', '仓库宽度必须大于 0');
        }
        if (warehouse.height !== undefined && warehouse.height <= 0) {
            this.addError('仓库配置错误', '仓库高度必须大于 0');
        }
    }
    
    validateObject(obj, index) {
        const rowNum = index + 1;
        
        if (!obj.type) {
            this.addError(`对象 #${rowNum}`, '缺少类型字段');
            return;
        }
        
        const validTypes = Object.values(Constants.OBJECT_TYPES);
        if (!validTypes.includes(obj.type)) {
            this.addError(`对象 #${rowNum}`, `无效的对象类型: ${obj.type}，有效值: ${validTypes.join(', ')}`);
        }
        
        if (obj.length !== undefined && obj.length <= 0) {
            this.addError(`对象 #${rowNum}`, '长度必须大于 0');
        }
        if (obj.width !== undefined && obj.width <= 0) {
            this.addError(`对象 #${rowNum}`, '宽度必须大于 0');
        }
        if (obj.height !== undefined && obj.height <= 0) {
            this.addError(`对象 #${rowNum}`, '高度必须大于 0');
        }
        
        if (obj.rotation !== undefined) {
            const rot = parseFloat(obj.rotation);
            if (isNaN(rot)) {
                this.addError(`对象 #${rowNum}`, '旋转角度必须是数字');
            }
        }
    }
    
    addError(type, message) {
        this.errors.push({
            type: type,
            message: message,
            timestamp: Date.now()
        });
    }
    
    static validatePicking(data, format) {
        const validator = new DataValidator();
        return validator.validatePickingData(data, format);
    }
    
    static validatePickingOrder(pickingOrder, warehouse) {
        if (pickingOrder && typeof pickingOrder.validate === 'function') {
            return pickingOrder.validate(warehouse);
        }
        return {
            isValid: true,
            errors: [],
            validCount: 0,
            invalidCount: 0
        };
    }
    
    static validateProject(data) {
        const validator = new DataValidator();
        return validator.validateProjectData(data);
    }
}
