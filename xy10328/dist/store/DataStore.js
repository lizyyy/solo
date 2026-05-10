"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryDataStore = void 0;
class InMemoryDataStore {
    constructor() {
        this.products = new Map();
        this.purchases = new Map();
        this.sales = new Map();
        this.losses = new Map();
        this.inventories = new Map();
        this.batchInventory = new Map();
    }
    addProduct(product) {
        if (this.products.has(product.code)) {
            return false;
        }
        this.products.set(product.code, product);
        return true;
    }
    getProduct(code) {
        return this.products.get(code);
    }
    addPurchase(purchase) {
        const errors = [];
        if (this.purchases.has(purchase.id)) {
            return { added: false, errors };
        }
        if (!this.products.has(purchase.productCode)) {
            errors.push({
                code: 'PRODUCT_NOT_FOUND',
                message: `商品 ${purchase.productCode} 不存在`,
                details: '请先导入商品信息或检查商品编码是否正确',
                recordId: purchase.id,
                productCode: purchase.productCode
            });
            return { added: false, errors };
        }
        if (purchase.quantity <= 0) {
            errors.push({
                code: 'INVALID_QUANTITY',
                message: `采购数量必须大于0`,
                details: '请检查采购数量字段',
                recordId: purchase.id,
                productCode: purchase.productCode
            });
            return { added: false, errors };
        }
        if (purchase.unitCost < 0) {
            errors.push({
                code: 'NEGATIVE_COST',
                message: `采购单价不能为负数`,
                details: '请检查采购单价字段',
                recordId: purchase.id,
                productCode: purchase.productCode
            });
            return { added: false, errors };
        }
        this.purchases.set(purchase.id, purchase);
        const batchKey = `${purchase.productCode}-${purchase.batchId}`;
        if (!this.batchInventory.has(batchKey)) {
            this.batchInventory.set(batchKey, {
                productCode: purchase.productCode,
                purchased: 0,
                sold: 0,
                lost: 0,
                unitCost: purchase.unitCost
            });
        }
        const batch = this.batchInventory.get(batchKey);
        batch.purchased += purchase.quantity;
        return { added: true, errors };
    }
    addSale(sale) {
        const errors = [];
        if (this.sales.has(sale.id)) {
            return { added: false, errors };
        }
        if (!this.products.has(sale.productCode)) {
            errors.push({
                code: 'PRODUCT_NOT_FOUND',
                message: `商品 ${sale.productCode} 不存在`,
                details: '请先导入商品信息或检查商品编码是否正确',
                recordId: sale.id,
                productCode: sale.productCode
            });
            return { added: false, errors };
        }
        const batchKey = `${sale.productCode}-${sale.batchId}`;
        if (!this.batchInventory.has(batchKey)) {
            errors.push({
                code: 'BATCH_NOT_FOUND',
                message: `批次 ${sale.batchId} 不存在`,
                details: '请先导入该批次的采购记录',
                recordId: sale.id,
                batchId: sale.batchId,
                productCode: sale.productCode
            });
            return { added: false, errors };
        }
        if (sale.quantity <= 0) {
            errors.push({
                code: 'INVALID_QUANTITY',
                message: `销售数量必须大于0`,
                details: '请检查销售数量字段',
                recordId: sale.id,
                productCode: sale.productCode
            });
            return { added: false, errors };
        }
        if (sale.unitPrice < 0) {
            errors.push({
                code: 'NEGATIVE_PRICE',
                message: `销售单价不能为负数`,
                details: '售价为负，请检查销售单价字段',
                recordId: sale.id,
                productCode: sale.productCode
            });
            return { added: false, errors };
        }
        const batch = this.batchInventory.get(batchKey);
        const available = batch.purchased - batch.sold - batch.lost;
        if (sale.quantity > available) {
            errors.push({
                code: 'INSUFFICIENT_STOCK',
                message: `销售数量超过库存`,
                details: `批次 ${sale.batchId} 可用库存 ${available}，销售数量 ${sale.quantity}`,
                recordId: sale.id,
                batchId: sale.batchId,
                productCode: sale.productCode
            });
            return { added: false, errors };
        }
        this.sales.set(sale.id, sale);
        batch.sold += sale.quantity;
        return { added: true, errors };
    }
    addLoss(loss) {
        const errors = [];
        if (this.losses.has(loss.id)) {
            return { added: false, errors };
        }
        if (!this.products.has(loss.productCode)) {
            errors.push({
                code: 'PRODUCT_NOT_FOUND',
                message: `商品 ${loss.productCode} 不存在`,
                details: '请先导入商品信息或检查商品编码是否正确',
                recordId: loss.id,
                productCode: loss.productCode
            });
            return { added: false, errors };
        }
        const batchKey = `${loss.productCode}-${loss.batchId}`;
        if (!this.batchInventory.has(batchKey)) {
            errors.push({
                code: 'BATCH_NOT_FOUND',
                message: `批次 ${loss.batchId} 不存在`,
                details: '请先导入该批次的采购记录',
                recordId: loss.id,
                batchId: loss.batchId,
                productCode: loss.productCode
            });
            return { added: false, errors };
        }
        if (loss.quantity <= 0) {
            errors.push({
                code: 'INVALID_QUANTITY',
                message: `报损数量必须大于0`,
                details: '请检查报损数量字段',
                recordId: loss.id,
                productCode: loss.productCode
            });
            return { added: false, errors };
        }
        const batch = this.batchInventory.get(batchKey);
        const available = batch.purchased - batch.sold - batch.lost;
        if (loss.quantity > available) {
            errors.push({
                code: 'LOSS_EXCEEDS_STOCK',
                message: `报损数量超过剩余库存`,
                details: `批次 ${loss.batchId} 剩余库存 ${available}，报损数量 ${loss.quantity}，请检查报损记录`,
                recordId: loss.id,
                batchId: loss.batchId,
                productCode: loss.productCode
            });
            return { added: false, errors };
        }
        this.losses.set(loss.id, loss);
        batch.lost += loss.quantity;
        return { added: true, errors };
    }
    addInventory(inventory) {
        const errors = [];
        if (this.inventories.has(inventory.id)) {
            return { added: false, errors };
        }
        if (!this.products.has(inventory.productCode)) {
            errors.push({
                code: 'PRODUCT_NOT_FOUND',
                message: `商品 ${inventory.productCode} 不存在`,
                details: '请先导入商品信息或检查商品编码是否正确',
                recordId: inventory.id,
                productCode: inventory.productCode
            });
            return { added: false, errors };
        }
        const batchKey = `${inventory.productCode}-${inventory.batchId}`;
        if (!this.batchInventory.has(batchKey)) {
            errors.push({
                code: 'BATCH_NOT_FOUND',
                message: `批次 ${inventory.batchId} 不存在`,
                details: '请先导入该批次的采购记录',
                recordId: inventory.id,
                batchId: inventory.batchId,
                productCode: inventory.productCode
            });
            return { added: false, errors };
        }
        if (inventory.countedQuantity < 0) {
            errors.push({
                code: 'NEGATIVE_INVENTORY',
                message: `盘点数量不能为负数`,
                details: '请检查盘点数量字段',
                recordId: inventory.id,
                productCode: inventory.productCode
            });
            return { added: false, errors };
        }
        this.inventories.set(inventory.id, inventory);
        return { added: true, errors };
    }
    getBatchInventory(productCode, batchId) {
        const batchKey = `${productCode}-${batchId}`;
        return this.batchInventory.get(batchKey);
    }
    getAllBatches() {
        const batches = [];
        for (const [key] of this.batchInventory) {
            const [productCode, batchId] = key.split('-');
            batches.push({ productCode, batchId });
        }
        return batches;
    }
}
exports.InMemoryDataStore = InMemoryDataStore;
