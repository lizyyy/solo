/**
 * 拣货单模型
 * 管理拣货订单数据
 */

class PickingOrder {
    constructor(options = {}) {
        this.id = options.id || Utils.generateId('picking');
        this.name = options.name || `拣货单 ${new Date().toLocaleDateString()}`;
        
        this.items = [];
        if (options.items) {
            options.items.forEach(item => this.addItem(item));
        }
        
        this.createdAt = options.createdAt || new Date();
        this.status = options.status || 'pending';
        
        this.optimizedRoute = null;
        this.manualRoute = null;
    }
    
    addItem(item) {
        const validatedItem = {
            id: item.id || Utils.generateId('item'),
            orderNo: item.orderNo || '',
            sku: item.sku || '',
            quantity: parseInt(item.quantity) || 0,
            shelfSlot: item.shelfSlot || item.shelfId || item.slot || '',
            shelfId: item.shelfId || null,
            notes: item.notes || '',
            isValid: item.isValid !== undefined ? item.isValid : true,
            validationErrors: item.validationErrors || []
        };
        
        this.items.push(validatedItem);
        return validatedItem;
    }
    
    removeItem(itemId) {
        const index = this.items.findIndex(item => item.id === itemId);
        if (index >= 0) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }
    
    getItemById(itemId) {
        return this.items.find(item => item.id === itemId);
    }
    
    getItemsBySku(sku) {
        return this.items.filter(item => item.sku === sku);
    }
    
    getUniqueSkus() {
        const skus = new Set();
        this.items.forEach(item => {
            if (item.sku) skus.add(item.sku);
        });
        return Array.from(skus);
    }
    
    getValidItems() {
        return this.items.filter(item => item.isValid);
    }
    
    getInvalidItems() {
        return this.items.filter(item => !item.isValid);
    }
    
    getTotalQuantity() {
        return this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }
    
    validate(warehouse) {
        const errors = [];
        
        this.items.forEach((item, index) => {
            const itemErrors = [];
            
            if (!item.sku) {
                itemErrors.push(`第 ${index + 1} 行: SKU 不能为空`);
            }
            
            if (item.quantity <= 0) {
                itemErrors.push(`SKU ${item.sku}: 数量 ${item.quantity} 无效，必须大于 0`);
            }
            
            if (!item.shelfSlot) {
                itemErrors.push(`SKU ${item.sku}: 未指定货架位`);
            }
            
            if (warehouse && item.shelfSlot) {
                const shelf = warehouse.findShelfBySlot(item.shelfSlot);
                if (!shelf) {
                    itemErrors.push(`SKU ${item.sku}: 货架位 "${item.shelfSlot}" 不存在`);
                } else {
                    item.shelfId = shelf.id;
                    
                    if (item.sku && !shelf.hasSku(item.sku)) {
                        itemErrors.push(`SKU ${item.sku}: 货架 "${shelf.name}" 上没有该 SKU`);
                    }
                }
            }
            
            item.isValid = itemErrors.length === 0;
            item.validationErrors = itemErrors;
            
            if (itemErrors.length > 0) {
                errors.push(...itemErrors);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            validCount: this.getValidItems().length,
            invalidCount: this.getInvalidItems().length
        };
    }
    
    setOptimizedRoute(route) {
        this.optimizedRoute = {
            ...route,
            createdAt: new Date()
        };
    }
    
    setManualRoute(route) {
        this.manualRoute = {
            ...route,
            createdAt: new Date()
        };
    }
    
    getRouteComparison() {
        if (!this.optimizedRoute && !this.manualRoute) {
            return null;
        }
        
        const optimized = this.optimizedRoute;
        const manual = this.manualRoute;
        
        return {
            optimizedDistance: optimized ? optimized.totalDistance : null,
            manualDistance: manual ? manual.totalDistance : null,
            optimizedPoints: optimized ? optimized.points.length : 0,
            manualPoints: manual ? manual.points.length : 0,
            difference: (optimized && manual) 
                ? manual.totalDistance - optimized.totalDistance 
                : null,
            differencePercent: (optimized && manual && optimized.totalDistance > 0)
                ? ((manual.totalDistance - optimized.totalDistance) / optimized.totalDistance * 100)
                : null
        };
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            items: Utils.deepClone(this.items),
            createdAt: this.createdAt.toISOString(),
            status: this.status,
            optimizedRoute: this.optimizedRoute ? Utils.deepClone(this.optimizedRoute) : null,
            manualRoute: this.manualRoute ? Utils.deepClone(this.manualRoute) : null
        };
    }
    
    static fromJSON(json) {
        const picking = new PickingOrder({
            id: json.id,
            name: json.name,
            createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
            status: json.status
        });
        
        if (json.items) {
            json.items.forEach(item => picking.addItem(item));
        }
        
        if (json.optimizedRoute) {
            picking.optimizedRoute = json.optimizedRoute;
        }
        
        if (json.manualRoute) {
            picking.manualRoute = json.manualRoute;
        }
        
        return picking;
    }
}
